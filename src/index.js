import {
  auth,
  onAuthStateChanged,
  provider,
  signInWithPopup,
} from "./firebase.js";
import {
  createRequest,
  ensureUserDocument,
  signOutIfNeeded,
  getFriendlyErrorMessage,
  getUserById,
} from "./data.js";

const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const authStatus = document.getElementById("authStatus");
const requestForm = document.getElementById("requestForm");
const requestHint = document.getElementById("requestHint");
const createdLink = document.getElementById("createdLink");
const createdLinkValue = document.getElementById("createdLinkValue");
const infoSection = document.getElementById("infoSection");
const homeFooterProfileLink = document.getElementById("homeFooterProfileLink");

function setHomeProfileLinks(url) {
  if (homeFooterProfileLink) homeFooterProfileLink.href = url;
}

function renderSignedOut() {
  requestForm.classList.add("hidden");
  requestHint.classList.remove("hidden");
  signInBtn.classList.remove("hidden");
  signOutBtn.classList.add("hidden");
  infoSection.classList.remove("hidden");
  authStatus.textContent = "Not signed in.";
  setHomeProfileLinks("/profile.html");
}

async function renderSignedIn(user) {
  requestForm.classList.remove("hidden");
  requestHint.classList.add("hidden");
  infoSection.classList.add("hidden");
  signInBtn.classList.add("hidden");
  signOutBtn.classList.remove("hidden");
  authStatus.textContent = `Signed in as ${user.displayName || user.email}`;

  const profile = await getUserById(user.uid);
  if (profile?.slug) {
    setHomeProfileLinks(`/${profile.slug}`);
  } else {
    setHomeProfileLinks("/profile.html");
  }
}

signInBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    await ensureUserDocument(result.user);
  } catch (error) {
    authStatus.textContent = getFriendlyErrorMessage(error);
  }
});

signOutBtn.addEventListener("click", async () => {
  try {
    await signOutIfNeeded();
    createdLink.classList.add("hidden");
    createdLinkValue.textContent = "";
  } catch (error) {
    authStatus.textContent = getFriendlyErrorMessage(error);
  }
});

requestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const submitBtn = requestForm.querySelector("button[type=submit]");
  const toName = document.getElementById("toName").value.trim();
  const position = document.getElementById("position").value.trim();

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = "Generating link...";
    const result = await createRequest(user, toName, position);
    createdLink.classList.remove("hidden");
    createdLinkValue.textContent = result.link;
    createdLinkValue.href = result.link;
    submitBtn.textContent = "Link generated!";
    setTimeout(() => {
      submitBtn.textContent = "Generate link";
      submitBtn.disabled = false;
    }, 2000);
  } catch (error) {
    console.error(error);
    authStatus.textContent = getFriendlyErrorMessage(error);
    submitBtn.textContent = "Generate link";
    submitBtn.disabled = false;
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
    console.error(error);
    authStatus.textContent = getFriendlyErrorMessage(error);
  }
});
