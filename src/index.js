import {
  auth,
  onAuthStateChanged,
  provider,
  signInWithPopup,
} from "./firebase.js?v=2";
import {
  createRequest,
  ensureUserDocument,
  signOutIfNeeded,
  getFriendlyErrorMessage,
  getUserById,
} from "./data.js?v=3";

const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const authStatus = document.getElementById("authStatus");
const requestForm = document.getElementById("requestForm");
const requestHint = document.getElementById("requestHint");
const createdLink = document.getElementById("createdLink");
const createdLinkValue = document.getElementById("createdLinkValue");
const infoSection = document.getElementById("infoSection");

function setHomeProfileLinks(slug) {
  const path = slug ? `/${slug}` : "/profile.html";
  const label = slug ? path : "My profile";

  const footer = document.getElementById("homeFooterProfileLink");
  const anchor = document.getElementById("homeProfileUrlAnchor");
  const line = document.getElementById("homeProfileUrlLine");

  if (footer) {
    footer.href = path;
    footer.textContent = label;
  }
  if (anchor) {
    anchor.href = path;
    anchor.textContent = label;
  }
  if (line) {
    if (slug) line.classList.remove("hidden");
    else line.classList.add("hidden");
  }
}

function renderSignedOut() {
  requestForm.classList.add("hidden");
  requestHint.classList.remove("hidden");
  signInBtn.classList.remove("hidden");
  signOutBtn.classList.add("hidden");
  infoSection.classList.remove("hidden");
  authStatus.textContent = "Not signed in.";
  setHomeProfileLinks("");
}

async function renderSignedIn(user, slug) {
  requestForm.classList.remove("hidden");
  requestHint.classList.add("hidden");
  infoSection.classList.add("hidden");
  signInBtn.classList.add("hidden");
  signOutBtn.classList.remove("hidden");
  authStatus.textContent = `Signed in as ${user.displayName || user.email}`;

  const resolvedSlug = slug || (await getUserById(user.uid))?.slugF || "";
  setHomeProfileLinks(resolvedSlug);
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
    if (createdLink) createdLink.classList.add("hidden");
    if (createdLinkValue) {
      createdLinkValue.textContent = "";
      createdLinkValue.setAttribute("href", "#");
    }
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
    if (createdLink) createdLink.classList.remove("hidden");
    if (createdLinkValue) {
      createdLinkValue.textContent = result.link;
      createdLinkValue.href = result.link;
    }
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
    const { slug } = await ensureUserDocument(user);
    await renderSignedIn(user, slug);
  } catch (error) {
    console.error(error);
    authStatus.textContent = getFriendlyErrorMessage(error);
  }
});
