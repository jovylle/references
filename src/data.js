import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "./firebase.js";
import { auth, db, signOut } from "./firebase.js";

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
  const existing = await getDoc(doc(db, "users", user.uid));
  const existingSlug = existing.exists() ? existing.data().slug : "";
  const baseSlug = slugify(user.displayName || user.email || "profile") || "profile";
  let slug = existingSlug || baseSlug;

  if (!existingSlug) {
    const slugCheck = await getDocs(query(collection(db, "users"), where("slug", "==", baseSlug), limit(1)));
    if (!slugCheck.empty && slugCheck.docs[0].id !== user.uid) {
      slug = `${baseSlug}-${user.uid.slice(0, 6)}`;
    }
  }

  await setDoc(
    doc(db, "users", user.uid),
    {
      name: user.displayName || user.email?.split("@")[0] || "Unknown",
      slug,
      email: user.email || "",
      photoURL: user.photoURL || "",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return { slug };
}

export async function getUserById(userId) {
  const snap = await getDoc(doc(db, "users", userId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getUserBySlug(slug) {
  const q = query(collection(db, "users"), where("slug", "==", slug), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

export async function createRequest(user, toName, position) {
  const token = generateToken();
  const ref = await addDoc(collection(db, "requests"), {
    fromUserId: user.uid,
    fromUserEmail: user.email || "",
    toName,
    position,
    token,
    status: "pending",
    createdAt: serverTimestamp(),
  });

  return {
    id: ref.id,
    token,
    link: `${globalThis.location.origin}/confirm.html?token=${token}`,
  };
}

export async function getRequestByToken(token) {
  const q = query(collection(db, "requests"), where("token", "==", token), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ref: docSnap.ref, data: () => docSnap.data(), snapshot: docSnap };
}

export async function approveRequest(requestRecord, currentUser) {
  const data = requestRecord.data();
  const createdReference = await addDoc(collection(db, "references"), {
    fromUserId: data.fromUserId,
    fromUserEmail: data.fromUserEmail || "",
    fromUserName: data.toName || "",
    toUserId: currentUser.uid,
    toUserEmail: currentUser.email || "",
    position: data.position,
    status: "confirmed",
    createdAt: serverTimestamp(),
  });

  await updateDoc(requestRecord.ref, {
    status: "confirmed",
    confirmedBy: currentUser.uid,
    confirmedAt: serverTimestamp(),
    referenceId: createdReference.id,
    toUserId: currentUser.uid,
  });
}

export async function getReferences(userId) {
  const q = query(
    collection(db, "references"),
    where("toUserId", "==", userId),
    where("status", "==", "confirmed"),
  );

  const snap = await getDocs(q);
  return snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

export async function updateUserSlug(userId, newSlug) {
  const slug = slugify(newSlug);
  if (!slug) throw new Error("Invalid slug.");

  const existing = await getDocs(query(collection(db, "users"), where("slug", "==", slug), limit(1)));
  if (!existing.empty && existing.docs[0].id !== userId) {
    throw new Error("Slug already taken. Try another.");
  }

  await updateDoc(doc(db, "users", userId), { slug });
}

export async function signOutIfNeeded() {
  return signOut(auth);
}
