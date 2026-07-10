import { auth } from "./firebase.js";
import { initAuthSession, renderFooterLinks } from "./ui.js";
import { createRequest, getFriendlyErrorMessage, getUserById } from "./data.js";

renderFooterLinks(document.getElementById("createFooter"), [
  { href: "/", label: "Home" },
  { href: "/about.html", label: "About" },
  { href: "/privacy.html", label: "Privacy Policy" },
]);

const requestForm = document.getElementById("requestForm");
const requestHint = document.getElementById("requestHint");
const createdLink = document.getElementById("createdLink");
const createdLinkValue = document.getElementById("createdLinkValue");

function setProfileLink(dock, slug) {
  const path = slug ? `/${slug}` : "/profile.html";
  const label = slug ? path : "My profile";
  if (dock.profileUrlAnchor) {
    dock.profileUrlAnchor.href = path;
    dock.profileUrlAnchor.textContent = label;
  }
}

function onSignedOut(dock) {
  dock.createRequestLink?.classList.add("hidden");
  requestForm.classList.add("hidden");
  requestHint.classList.remove("hidden");
  dock.signInBtn?.classList.remove("hidden");
  dock.signOutBtn?.classList.add("hidden");
  if (dock.authStatus) dock.authStatus.textContent = "Not signed in.";
  setProfileLink(dock, "");
  if (createdLink) createdLink.classList.add("hidden");
  if (createdLinkValue) {
    createdLinkValue.textContent = "";
    createdLinkValue.setAttribute("href", "#");
  }
}

function onSignedInImmediate(user, slug, dock) {
  dock.createRequestLink?.classList.remove("hidden");
  requestForm.classList.remove("hidden");
  requestHint.classList.add("hidden");
  dock.signInBtn?.classList.add("hidden");
  dock.signOutBtn?.classList.remove("hidden");
  const fallbackName = user.email?.split("@")[0] || user.email || "Unknown";
  if (dock.authStatus) dock.authStatus.textContent = `Signed in as ${fallbackName}`;
  if (slug) setProfileLink(dock, slug);
}

async function onSignedIn(user, slug, dock) {
  const profile = await getUserById(user.uid);
  const resolvedName = String(profile?.nameF || "").trim() || user.email?.split("@")[0] || user.email || "Unknown";
  if (dock.authStatus) dock.authStatus.textContent = `Signed in as ${resolvedName}`;
  setProfileLink(dock, slug || profile?.slugF || "");
}

initAuthSession({
  dockOptions: {
    includeProfileLink: true,
    includeCreateRequest: true,
    createRequestHref: "/create.html",
  },
  onSignedOut,
  onSignedInImmediate,
  onSignedIn,
});

const authStatus = document.getElementById("authStatus");

requestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const submitBtn = requestForm.querySelector("button[type=submit]");
  const toName = document.getElementById("toName").value.trim();
  const position = document.getElementById("position").value.trim();
  const company = document.getElementById("company").value.trim();

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = "Generating link...";
    const result = await createRequest(user, toName, position, company);
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
    if (authStatus) authStatus.textContent = getFriendlyErrorMessage(error);
    submitBtn.textContent = "Generate link";
    submitBtn.disabled = false;
  }
});
