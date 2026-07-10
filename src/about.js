import { initAuthSession, renderFooterLinks } from "./ui.js";
import { getUserById } from "./data.js";

renderFooterLinks(document.getElementById("aboutFooter"), [
  { href: "/", label: "Home" },
  { href: "/privacy.html", label: "Privacy Policy" },
]);

function setProfileLink(dock, slug) {
  const path = slug ? `/${slug}` : "/profile.html";
  const label = slug ? path : "My profile";
  if (dock.profileUrlAnchor) {
    dock.profileUrlAnchor.href = path;
    dock.profileUrlAnchor.textContent = label;
  }
}

function onSignedOut(dock) {
  dock.profileUrlLine?.classList.add("hidden");
  dock.createRequestLink?.classList.add("hidden");
  dock.signInBtn?.classList.remove("hidden");
  dock.signOutBtn?.classList.add("hidden");
  if (dock.authStatus) dock.authStatus.textContent = "Not signed in.";
  setProfileLink(dock, "");
}

function onSignedInImmediate(user, slug, dock) {
  dock.profileUrlLine?.classList.remove("hidden");
  dock.createRequestLink?.classList.remove("hidden");
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
