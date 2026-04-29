import {
  auth,
  onAuthStateChanged,
  provider,
  signInWithPopup,
} from "./firebase.js";
import {
  createRequest,
  ensureUserDocument,
  getReferences,
  getUserById,
  signOutIfNeeded,
} from "./data.js";

const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const authStatus = document.getElementById("authStatus");
const requestForm = document.getElementById("requestForm");
const requestHint = document.getElementById("requestHint");
const createdLink = document.getElementById("createdLink");
const createdLinkValue = document.getElementById("createdLinkValue");
const profileCard = document.getElementById("profileCard");

function renderSignedOut() {
  requestForm.classList.add("hidden");
  requestHint.classList.remove("hidden");
  signOutBtn.classList.add("hidden");
  authStatus.textContent = "Not signed in.";
  profileCard.innerHTML = '<p class="muted">No profile loaded yet.</p>';
}

async function renderSignedIn(user) {
  requestForm.classList.remove("hidden");
  requestHint.classList.add("hidden");
  signOutBtn.classList.remove("hidden");
  authStatus.textContent = `Signed in as ${user.displayName || user.email}`;

  const profile = await getUserById(user.uid);
  if (profile) {
    const references = await getReferences(user.uid);
    const publicSlug = profile.slug || "";
    profileCard.innerHTML = `
      <div class="stack">
        <p class="reference-name">${profile.name}</p>
        <p class="reference-position">@${publicSlug || "profile"}</p>
        <p class="reference-confirmation">${references.length} confirmed reference${references.length === 1 ? "" : "s"}</p>
        <a href="/${publicSlug}" target="_blank" rel="noreferrer">Public profile</a>
      </div>
    `;
  }
}

signInBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    await ensureUserDocument(result.user);
  } catch (error) {
    authStatus.textContent = error.message || "Sign-in failed.";
  }
});

signOutBtn.addEventListener("click", async () => {
  try {
    await signOutIfNeeded();
    createdLink.classList.add("hidden");
    createdLinkValue.textContent = "";
  } catch (error) {
    authStatus.textContent = error.message || "Sign-out failed.";
  }
});

requestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const toEmail = document.getElementById("toEmail").value.trim();
  const position = document.getElementById("position").value.trim();

  try {
    const result = await createRequest(user, toEmail, position);
    createdLink.classList.remove("hidden");
    createdLinkValue.textContent = result.link;
    createdLinkValue.href = result.link;
  } catch (error) {
    authStatus.textContent = error.message || "Could not create request.";
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    renderSignedOut();
    return;
  }

  try {
    await ensureUserDocument(user);
    await renderSignedIn(user);
  } catch (error) {
    authStatus.textContent = error.message || "Failed to load user profile.";
  }
});
