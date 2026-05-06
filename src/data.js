import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "./firebase.js?v=2";
import { auth, db, signOut } from "./firebase.js?v=2";

export function slugify(name) {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

export function generateToken() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, "");
  }

  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function getFriendlyErrorMessage(error) {
  const code = error?.code || "";
  const messages = {
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/operation-not-allowed": "Sign-in is not enabled. Please try again later.",
    "auth/unauthorized-domain": "This domain is not authorized. Contact support.",
  };
  return messages[code] || error?.message || "An error occurred. Please try again.";
}

export async function ensureUserDocument(user) {
  const existing = await getDoc(doc(db, "usersC", user.uid));
  const existingSlug = existing.exists() ? existing.data().slugF : "";
  const baseSlug = slugify(user.email || "profile") || "profile";
  let slug = existingSlug || baseSlug;

  if (!existingSlug) {
    const slugCheck = await getDocs(query(collection(db, "usersC"), where("slugF", "==", baseSlug), limit(1)));
    if (!slugCheck.empty && slugCheck.docs[0].id !== user.uid) {
      slug = `${baseSlug}-${user.uid.slice(0, 6)}`;
    }
  }

  if (existing.exists()) {
    // Existing user: only sync auth-derived fields. Never touch user-edited fields like name.
    await updateDoc(doc(db, "usersC", user.uid), {
      slugF: slug,
      emailF: user.email || "",
      updatedAtF: serverTimestamp(),
    });
  } else {
    // New user: create the full document seeded from the Google profile.
    await setDoc(doc(db, "usersC", user.uid), {
      nameF: user.email?.split("@")[0] || "Unknown",
      bioF: "",
      photoURLF: "",
      portfolioF: "",
      githubF: "",
      linkedinF: "",
      slugF: slug,
      emailF: user.email || "",
      updatedAtF: serverTimestamp(),
    });
  }
  return { slug };
}

export async function updateUserLinks(userId, links) {
  const { portfolio, github, linkedin } = links;
  await updateDoc(doc(db, "usersC", userId), {
    portfolioF: portfolio || "",
    githubF: github || "",
    linkedinF: linkedin || "",
  });
}

export async function updateUserName(userId, newName) {
  if (!newName?.trim()) throw new Error("Name cannot be empty.");
  await updateDoc(doc(db, "usersC", userId), { nameF: newName.trim() });
}

export async function updateUserBio(userId, newBio) {
  await updateDoc(doc(db, "usersC", userId), { bioF: newBio.trim() });
}

export async function updateReference(referenceId, { position, fromUserName } = {}) {
  const payload = {};
  if (position !== undefined) {
    if (!position?.trim()) throw new Error("Position cannot be empty.");
    payload.positionF = position.trim();
  }
  if (fromUserName !== undefined) {
    if (!fromUserName?.trim()) throw new Error("Name cannot be empty.");
    payload.fromUserNameF = fromUserName.trim();
  }
  if (Object.keys(payload).length === 0) {
    throw new Error("Nothing to update.");
  }
  await updateDoc(doc(db, "referencesC", referenceId), payload);
}

export async function deleteReference(referenceId) {
  await updateDoc(doc(db, "referencesC", referenceId), { statusF: "hidden" });
}

export async function getUserById(userId) {
  const snap = await getDoc(doc(db, "usersC", userId));
  if (!snap.exists()) return null;
  // Document id must win: stored fields named `id` would otherwise break auth checks.
  return { ...snap.data(), id: snap.id };
}

export async function getUserBySlug(slug) {
  const q = query(collection(db, "usersC"), where("slugF", "==", slug), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { ...docSnap.data(), id: docSnap.id };
}

export async function createRequest(user, toName, position) {
  const token = generateToken();
  const ref = await addDoc(collection(db, "requestsC"), {
    fromUserIdF: user.uid,
    fromUserEmailF: user.email || "",
    toNameF: toName,
    positionF: position,
    tokenF: token,
    statusF: "pending",
    createdAtF: serverTimestamp(),
  });

  return {
    id: ref.id,
    token,
    link: `${globalThis.location.origin}/confirm.html?token=${token}`,
  };
}

/**
 * @param {string} token
 * @param {{ publicPreview?: boolean }} [options] If true, only pending requests (required for unauthenticated reads per security rules).
 */
export async function getRequestByToken(token, options = {}) {
  const { publicPreview = false } = options;
  const parts = [collection(db, "requestsC"), where("tokenF", "==", token)];
  if (publicPreview) {
    parts.push(where("statusF", "==", "pending"));
  }
  parts.push(limit(1));
  const q = query(...parts);
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ref: docSnap.ref, data: () => docSnap.data(), snapshot: docSnap };
}

export async function approveRequest(requestRecord, currentUser) {
  const requestRef = requestRecord.ref;
  const referenceRef = doc(db, "referencesC", requestRecord.id);

  await runTransaction(db, async (tx) => {
    const latestRequestSnap = await tx.get(requestRef);
    if (!latestRequestSnap.exists()) throw new Error("Request not found.");
    const existingReferenceSnap = await tx.get(referenceRef);

    const latestData = latestRequestSnap.data();
    if (latestData.statusF !== "pending") {
      // Idempotent success path: request was already confirmed to this reference.
      if (latestData.referenceIdF === referenceRef.id && existingReferenceSnap.exists()) return;
      throw new Error("This request is already confirmed.");
    }

    tx.set(referenceRef, {
      requestIdF: requestRecord.id,
      fromUserIdF: currentUser.uid,
      fromUserEmailF: currentUser.email || "",
      fromUserNameF: currentUser.email?.split("@")[0] || "Unknown",
      toUserIdF: latestData.fromUserIdF,
      toUserEmailF: latestData.fromUserEmailF || "",
      positionF: latestData.positionF,
      statusF: "confirmed",
      createdAtF: serverTimestamp(),
    });

    tx.update(requestRef, {
      statusF: "confirmed",
      confirmedByF: currentUser.uid,
      confirmedAtF: serverTimestamp(),
      referenceIdF: referenceRef.id,
      toUserIdF: currentUser.uid,
    });
  });
}

export async function getReferences(userId) {
  const q = query(
    collection(db, "referencesC"),
    where("toUserIdF", "==", userId),
    where("statusF", "==", "confirmed"),
  );

  const snap = await getDocs(q);
  return snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

export async function updateUserSlug(userId, newSlug) {
  const slug = slugify(newSlug);
  if (!slug) throw new Error("Invalid slug.");

  const existing = await getDocs(query(collection(db, "usersC"), where("slugF", "==", slug), limit(1)));
  if (!existing.empty && existing.docs[0].id !== userId) {
    throw new Error("Slug already taken. Try another.");
  }

  await updateDoc(doc(db, "usersC", userId), { slugF: slug });
}

export async function signOutIfNeeded() {
  return signOut(auth);
}
