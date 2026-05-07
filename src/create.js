import {
  auth,
  onAuthStateChanged,
  provider,
  signInWithPopup,
} from "./firebase.js?v=2";
import {
  clearSessionHint,
  initAccountControlsDock,
  mountAccountControls,
  readSessionHint,
  renderFooterLinks,
  saveSessionHint,
} from "./ui.js?v=7";
import {
  createRequest,
  ensureUserDocument,
  signOutIfNeeded,
  getFriendlyErrorMessage,
  getUserById,
} from "./data.js?v=5";

mountAccountControls({
  includeProfileLink: true,
  includeCreateRequest: true,
  createRequestHref: "/create.html",
});
initAccountControlsDock();

renderFooterLinks(document.getElementById("createFooter"), [
  { href: "/", label: "Home" },
  { href: "/about.html", label: "About" },
  { href: "/privacy.html", label: "Privacy Policy" },
]);

const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const authStatus = document.getElementById("authStatus");
const requestForm = document.getElementById("requestForm");
const requestHint = document.getElementById("requestHint");
const createdLink = document.getElementById("createdLink");
const createdLinkValue = document.getElementById("createdLinkValue");

function setProfileLink(slug) {
  const path = slug ? `/${slug}` : "/profile.html";
  const label = slug ? path : "My profile";
  const anchor = document.getElementById("homeProfileUrlAnchor");
  if (anchor) {
    anchor.href = path;
    anchor.textContent = label;
  }
}

function renderSignedOut() {
  requestForm.classList.add("hidden");
  requestHint.classList.remove("hidden");
  signInBtn.classList.remove("hidden");
  signOutBtn.classList.add("hidden");
  authStatus.textContent = "Not signed in.";
  setProfileLink("");
}

async function renderSignedIn(user, slug) {
  requestForm.classList.remove("hidden");
  requestHint.classList.add("hidden");
  signInBtn.classList.add("hidden");
  signOutBtn.classList.remove("hidden");
  const profile = await getUserById(user.uid);
  const resolvedName = String(profile?.nameF || "").trim() || user.email?.split("@")[0] || user.email || "Unknown";
  authStatus.textContent = `Signed in as ${resolvedName}`;
  const resolvedSlug = slug || profile?.slugF || "";
  setProfileLink(resolvedSlug);
}

function renderSignedInImmediate(user, slug = "") {
  requestForm.classList.remove("hidden");
  requestHint.classList.add("hidden");
  signInBtn.classList.add("hidden");
  signOutBtn.classList.remove("hidden");
  const fallbackName = user.email?.split("@")[0] || user.email || "Unknown";
  authStatus.textContent = `Signed in as ${fallbackName}`;
  if (slug) setProfileLink(slug);
}

signInBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    renderSignedInImmediate(result.user);
    const { slug } = await ensureUserDocument(result.user);
    setProfileLink(slug);
    saveSessionHint(result.user, slug);
  } catch (error) {
    authStatus.textContent = getFriendlyErrorMessage(error);
  }
});

signOutBtn.addEventListener("click", async () => {
  try {
    await signOutIfNeeded();
    clearSessionHint();
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
    clearSessionHint();
    renderSignedOut();
    return;
  }

  renderSignedInImmediate(user);
  saveSessionHint(user);

  try {
    const { slug } = await ensureUserDocument(user);
    saveSessionHint(user, slug);
    await renderSignedIn(user, slug);
  } catch (error) {
    console.error(error);
    authStatus.textContent = getFriendlyErrorMessage(error);
  }
});

const cachedSession = readSessionHint();
if (cachedSession) {
  renderSignedInImmediate(
    {
      uid: cachedSession.uid,
      email: cachedSession.email,
      displayName: cachedSession.displayName,
    },
    cachedSession.slug
  );
}
