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
const preSignInRequest = document.getElementById("preSignInRequest");

function getToken() {
  return new URLSearchParams(window.location.search).get("token");
}

async function loadRequestPreview() {
  const token = getToken();
  if (!token) {
    requestState.innerHTML = '<p class="muted">Missing token.</p>';
    return;
  }

  const requestRecord = await getRequestByToken(token);
  if (!requestRecord) {
    requestState.innerHTML = '<p class="muted">Request not found.</p>';
    return;
  }

  const data = requestRecord.data();
  document.getElementById("preName").textContent = data.toName;
  document.getElementById("prePosition").textContent = data.position;
  preSignInRequest.classList.remove("hidden");
}

async function renderRequest(user) {
  const token = getToken();
  if (!token) {
    requestState.innerHTML = '<p class="muted">Missing token.</p>';
    return;
  }

  const requestRecord = await getRequestByToken(token);
  if (!requestRecord) {
    requestState.innerHTML = '<p class="muted">Request not found.</p>';
    return;
  }

  const data = requestRecord.data();
  requestState.innerHTML = `
    <div class="stack">
      <p class="reference-name">${data.toName}</p>
      <p class="reference-position">${data.position}</p>
      <p class="muted">This request is waiting for confirmation.</p>
      <button id="approveBtn" class="button button-primary">Confirm reference</button>
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
          <p class="reference-name">${data.toName}</p>
          <p class="reference-position">${data.position}</p>
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
          authStatus.textContent = "Position cannot be empty.";
          return;
        }

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = "Adding...";
          const { addDoc, collection, serverTimestamp } = await import("./firebase.js");
          const { db } = await import("./firebase.js");
          await addDoc(collection(db, "references"), {
            fromUserId: user.uid,
            fromUserEmail: user.email || "",
            fromUserName: fromUser?.name || user.displayName || "Unknown",
            toUserId: data.fromUserId,
            toUserEmail: data.fromUserEmail || "",
            position: reciprocalPosition,
            status: "confirmed",
            createdAt: serverTimestamp(),
          });
          authStatus.textContent = "Reciprocal reference added!";
          submitBtn.textContent = "Added!";
          document.getElementById("skipReciprocal").remove();
        } catch (error) {
          console.error(error);
          authStatus.textContent = getFriendlyErrorMessage(error);
          submitBtn.disabled = false;
          submitBtn.textContent = "Add reciprocal reference";
        }
      });

      document.getElementById("skipReciprocal").addEventListener("click", () => {
        document.getElementById("reciprocalSection").classList.add("hidden");
      });
    } catch (error) {
      console.error(error);
      authStatus.textContent = getFriendlyErrorMessage(error);
      btn.disabled = false;
      btn.textContent = "Confirm reference";
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
    requestState.innerHTML = '<p class="muted">Ready to confirm after you sign in.</p>';
    signOutBtn.classList.add("hidden");
    try {
      await loadRequestPreview();
    } catch (error) {
      console.error(error);
      preSignInRequest.classList.add("hidden");
      requestState.innerHTML = `<p class="muted">Could not load request.</p>`;
    }
    return;
  }

  signOutBtn.classList.remove("hidden");
  preSignInRequest.classList.add("hidden");
  authStatus.textContent = `Signed in as ${user.displayName || user.email}`;

  try {
    await ensureUserDocument(user);
    await renderRequest(user);
  } catch (error) {
    console.error(error);
    requestState.innerHTML = `<p class="muted">${getFriendlyErrorMessage(error)}</p>`;
  }
});
