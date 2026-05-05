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
    requestState.innerHTML = '<p class="muted">Sign in to confirm the request.</p>';
    signOutBtn.classList.add("hidden");
    return;
  }

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
