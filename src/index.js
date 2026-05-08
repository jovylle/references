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
} from "./ui.js?v=8";
import {
  ensureUserDocument,
  signOutIfNeeded,
  getFriendlyErrorMessage,
  getUserById,
} from "./data.js?v=5";

mountAccountControls({
  includeProfileLink: true,
  includeCreateRequest: false,
  createRequestHref: "/create.html",
});
const dockController = initAccountControlsDock();
const accountDock = document.getElementById("accountDock");

renderFooterLinks(document.getElementById("homeFooter"), [
  { href: "/about.html", label: "About" },
  { href: "/privacy.html", label: "Privacy Policy" },
]);

const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const authStatus = document.getElementById("authStatus");
const startProfileBtn = document.getElementById("startProfileBtn");
const homeProfileUrlLine = document.getElementById("homeProfileUrlLine");

function setProfileLinkVisibility(visible) {
  if (!homeProfileUrlLine) return;
  homeProfileUrlLine.classList.toggle("hidden", !visible);
}

function openDockPanel() {
  dockController?.setCollapsed(false);
}
startProfileBtn?.addEventListener("click", (event) => {
  // Prevent the global outside-click handler from immediately collapsing the dock.
  event.stopPropagation();
  if (accountDock) {
    accountDock.classList.remove("hidden");
    accountDock.setAttribute("aria-hidden", "false");
  }
  openDockPanel();
  authStatus.textContent = "Continue with Google to start your Referly profile.";
});

function setHomeProfileLinks(slug) {
  const path = slug ? `/${slug}` : "/profile.html";
  const label = slug ? path : "My profile";

  const anchor = document.getElementById("homeProfileUrlAnchor");

  if (anchor) {
    anchor.href = path;
    anchor.textContent = label;
  }
}

function renderSignedOut() {
  setProfileLinkVisibility(false);
  signInBtn.classList.remove("hidden");
  signOutBtn.classList.add("hidden");
  authStatus.textContent = "Not signed in.";
  setHomeProfileLinks("");
}

async function renderSignedIn(user, slug) {
  setProfileLinkVisibility(true);
  signInBtn.classList.add("hidden");
  signOutBtn.classList.remove("hidden");
  const profile = await getUserById(user.uid);
  const resolvedName = String(profile?.nameF || "").trim() || user.email?.split("@")[0] || user.email || "Unknown";
  authStatus.textContent = `Signed in as ${resolvedName}`;
  const resolvedSlug = slug || profile?.slugF || "";
  setHomeProfileLinks(resolvedSlug);
}

function renderSignedInImmediate(user, slug = "") {
  setProfileLinkVisibility(true);
  signInBtn.classList.add("hidden");
  signOutBtn.classList.remove("hidden");
  const fallbackName = user.email?.split("@")[0] || user.email || "Unknown";
  authStatus.textContent = `Signed in as ${fallbackName}`;
  if (slug) {
    setHomeProfileLinks(slug);
  }
}

signInBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    renderSignedInImmediate(result.user);
    const { slug } = await ensureUserDocument(result.user);
    setHomeProfileLinks(slug);
    saveSessionHint(result.user, slug);
  } catch (error) {
    authStatus.textContent = getFriendlyErrorMessage(error);
  }
});

signOutBtn.addEventListener("click", async () => {
  try {
    await signOutIfNeeded();
    clearSessionHint();
  } catch (error) {
    authStatus.textContent = getFriendlyErrorMessage(error);
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
} else {
  setProfileLinkVisibility(false);
}
