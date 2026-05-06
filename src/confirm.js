import {
  auth,
  onAuthStateChanged,
  provider,
  signInWithPopup,
} from "./firebase.js";
import { approveRequest, ensureUserDocument, getRequestByToken, signOutIfNeeded, getFriendlyErrorMessage } from "./data.js";

const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const authStatus = document.getElementById("authStatus");
const requestState = document.getElementById("requestState");

function getToken() {
  return new URLSearchParams(window.location.search).get("token");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/** Name + position only; no confirm until signed in. */
async function renderSignedOutRequest() {
  const token = getToken();
  if (!token) {
    requestState.innerHTML = '<p class="muted">Missing token.</p>';
    return;
  }

  let requestRecord = null;
  try {
    requestRecord = await getRequestByToken(token, { publicPreview: true });
  } catch (error) {
    // Some environments may still deny unauthenticated request reads.
    if (error?.code === "permission-denied" || error?.code === "firestore/permission-denied") {
      requestState.innerHTML =
        '<p class="muted">This link is invalid, expired, or already confirmed. If you already confirmed, you can close this page.</p>';
      return;
    }
    throw error;
  }

  if (!requestRecord) {
    requestState.innerHTML =
      '<p class="muted">This link is invalid, expired, or already confirmed. If you already confirmed, you can close this page.</p>';
    return;
  }

  const data = requestRecord.data();
  requestState.innerHTML = `
    <div class="stack">
      <p class="reference-name">${escapeHtml(data.toName)}</p>
      <p class="reference-position">${escapeHtml(data.position)}</p>
      <p class="muted" style="margin-top: 16px;">Sign in with Google above to confirm. You can’t complete this step until you’re signed in.</p>
    </div>
  `;
}

async function renderRequest(user) {
  const token = getToken();
  if (!token) {
    requestState.innerHTML = '<p class="muted">Missing token.</p>';
    return;
  }

  const requestRecord = await getRequestByToken(token);
  if (!requestRecord) {
    requestState.innerHTML =
      '<p class="muted">This link is invalid, expired, or already confirmed. If you already confirmed, you can close this page.</p>';
    return;
  }

  const data = requestRecord.data();

  if (data.status === "confirmed") {
    requestState.innerHTML = `
      <div class="stack">
        <p class="reference-name">${escapeHtml(data.toName)}</p>
        <p class="reference-position">${escapeHtml(data.position)}</p>
        <p class="reference-confirmation">✔ Already confirmed</p>
        <p class="muted" style="margin-top: 12px;">You can close this page.</p>
      </div>
    `;
    return;
  }

  requestState.innerHTML = `
    <div class="stack">
      <p class="reference-name">${escapeHtml(data.toName)}</p>
      <p class="reference-position">${escapeHtml(data.position)}</p>
      <p class="muted">Tap confirm if this is what you agreed to.</p>
      <button id="approveBtn" class="button button-primary">Confirm</button>
    </div>
  `;

  document.getElementById("approveBtn").addEventListener("click", async () => {
    const btn = document.getElementById("approveBtn");
    try {
      btn.disabled = true;
      btn.textContent = "Confirming...";
      await approveRequest(requestRecord, user);
      requestState.innerHTML = `
        <div class="stack">
          <p class="reference-name">${escapeHtml(data.toName)}</p>
          <p class="reference-position">${escapeHtml(data.position)}</p>
          <p class="reference-confirmation">✔ Confirmed</p>
        </div>
      `;
      btn.remove();
      document.getElementById("reciprocalSection").classList.remove("hidden");

      const getFromUser = async () => {
        const { getDoc, doc, db } = await import("./firebase.js");
        const snap = await getDoc(doc(db, "users", data.fromUserId));
        return snap.exists() ? snap.data() : null;
      };

      const fromUser = await getFromUser();
      const reciprocalForm = document.getElementById("reciprocalForm");

      reciprocalForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = reciprocalForm.querySelector("button[type=submit]");
        const reciprocalPosition = document.getElementById("reciprocalPosition").value.trim();

        if (!reciprocalPosition) {
          authStatus.textContent = "Add a short description first.";
          return;
        }

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = "Adding...";
          const { addDoc, collection, serverTimestamp } = await import("./firebase.js");
          const { db } = await import("./firebase.js");
          await addDoc(collection(db, "references"), {
            // Reciprocal add should show on the current user's profile.
            fromUserId: data.fromUserId,
            fromUserEmail: data.fromUserEmail || "",
            fromUserName: fromUser?.name || data.fromUserName || data.fromUserEmail || "Unknown",
            toUserId: user.uid,
            toUserEmail: user.email || "",
            position: reciprocalPosition,
            status: "confirmed",
            createdAt: serverTimestamp(),
          });
          authStatus.textContent = "Added to your profile.";
          submitBtn.textContent = "Added!";
          document.getElementById("skipReciprocal").remove();
        } catch (error) {
          console.error(error);
          authStatus.textContent = getFriendlyErrorMessage(error);
          submitBtn.disabled = false;
          submitBtn.textContent = "Add to my profile";
        }
      });

      document.getElementById("skipReciprocal").addEventListener("click", () => {
        document.getElementById("reciprocalSection").classList.add("hidden");
      });
    } catch (error) {
      console.error(error);
      authStatus.textContent = getFriendlyErrorMessage(error);
      btn.disabled = false;
      btn.textContent = "Confirm";
    }
  });
}

signInBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    authStatus.textContent = getFriendlyErrorMessage(error);
  }
});

signOutBtn.addEventListener("click", async () => {
  try {
    await signOutIfNeeded();
  } catch (error) {
    console.error(error);
    authStatus.textContent = getFriendlyErrorMessage(error);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    authStatus.textContent = "Not signed in.";
    signInBtn.classList.remove("hidden");
    signOutBtn.classList.add("hidden");
    try {
      await renderSignedOutRequest();
    } catch (error) {
      if (error?.code === "permission-denied" || error?.code === "firestore/permission-denied") {
        requestState.innerHTML =
          '<p class="muted">This link is invalid, expired, or already confirmed. If you already confirmed, you can close this page.</p>';
      } else {
        console.error(error);
        requestState.innerHTML = `<p class="muted">Could not load request.</p>`;
      }
    }
    return;
  }

  signInBtn.classList.add("hidden");
  signOutBtn.classList.remove("hidden");
  authStatus.textContent = `Signed in as ${user.displayName || user.email}`;

  try {
    await ensureUserDocument(user);
    await renderRequest(user);
  } catch (error) {
    console.error(error);
    requestState.innerHTML = `<p class="muted">${getFriendlyErrorMessage(error)}</p>`;
  }
});
