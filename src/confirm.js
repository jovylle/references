import { initAuthSession, renderFooterLinks } from "./ui.js";
import {
  addReciprocalReference,
  approveRequest,
  getRequestByToken,
  getUserById,
  getFriendlyErrorMessage,
} from "./data.js";
import { escapeHtml } from "./utils.js";

renderFooterLinks(document.getElementById("confirmFooter"), [
  { href: "/", label: "Home" },
  { href: "/about.html", label: "About" },
  { href: "/privacy.html", label: "Privacy Policy" },
]);

const requestState = document.getElementById("requestState");

function setProfileLink(dock, slug) {
  const path = slug ? `/${slug}` : "/profile.html";
  const label = slug ? path : "My profile";
  if (dock.profileUrlAnchor) {
    dock.profileUrlAnchor.href = path;
    dock.profileUrlAnchor.textContent = label;
  }
}

function getToken() {
  return new URLSearchParams(window.location.search).get("token");
}

function getRequesterName(data) {
  const fromName = String(data?.fromUserNameF || "").trim();
  if (fromName) return fromName;

  const fromEmail = String(data?.fromUserEmailF || "").trim();
  if (fromEmail) return fromEmail.split("@")[0];

  return "Unknown";
}

function positionLineHtml(data) {
  const position = String(data?.positionF || "").trim();
  const company = String(data?.companyF || "").trim();
  const label = company ? `${position} @ ${company}` : position;
  return `<p class="reference-position">${escapeHtml(label)}</p>`;
}

function requesterMetaTemplate(data) {
  const requesterName = getRequesterName(data);
  const requesterEmail = String(data?.fromUserEmailF || "").trim();

  return `
    <div class="requester-meta">
      <p class="requester-meta-label">Requested by</p>
      <p class="requester-meta-name">${escapeHtml(requesterName)}</p>
      ${requesterEmail ? `<p class="requester-meta-email">${escapeHtml(requesterEmail)}</p>` : ""}
    </div>
  `;
}

/** Request preview only; no confirm until signed in. */
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
      ${requesterMetaTemplate(data)}
      <p class="reference-name">${escapeHtml(data.toNameF)}</p>
      ${positionLineHtml(data)}
      <p class="muted" style="margin-top: 16px;">Sign in with Google above to confirm. You can’t complete this step until you’re signed in.</p>
      <button id="inlineSignInBtn" class="button button-primary">Sign in with Google</button>
    </div>
  `;

  const inlineSignInBtn = document.getElementById("inlineSignInBtn");
  inlineSignInBtn?.addEventListener("click", async () => {
    authSession.dockControls?.setCollapsed(false);
    await authSession.signIn();
  });
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

  if (data.statusF === "confirmed") {
    requestState.innerHTML = `
      <div class="stack">
        ${requesterMetaTemplate(data)}
        <p class="reference-name">${escapeHtml(data.toNameF)}</p>
        ${positionLineHtml(data)}
        <p class="reference-confirmation">✔ Already confirmed</p>
        <p class="muted" style="margin-top: 12px;">You can close this page.</p>
      </div>
    `;
    return;
  }

  requestState.innerHTML = `
    <div class="stack">
      ${requesterMetaTemplate(data)}
      <p class="reference-name">${escapeHtml(data.toNameF)}</p>
      ${positionLineHtml(data)}
      <p class="muted">Tap confirm if this is what you agreed to.</p>
      <button id="approveBtn" class="button button-primary">Confirm</button>
    </div>
  `;

  const authStatus = document.getElementById("authStatus");

  document.getElementById("approveBtn").addEventListener("click", async () => {
    const btn = document.getElementById("approveBtn");
    try {
      btn.disabled = true;
      btn.textContent = "Confirming...";
      await approveRequest(requestRecord, user);
      requestState.innerHTML = `
        <div class="stack">
          ${requesterMetaTemplate(data)}
          <p class="reference-name">${escapeHtml(data.toNameF)}</p>
          ${positionLineHtml(data)}
          <p class="reference-confirmation">✔ Confirmed</p>
        </div>
      `;
      btn.remove();
      document.getElementById("reciprocalSection").classList.remove("hidden");

      const fromUser = await getUserById(data.fromUserIdF);
      const reciprocalForm = document.getElementById("reciprocalForm");

      reciprocalForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = reciprocalForm.querySelector("button[type=submit]");
        const reciprocalPosition = document.getElementById("reciprocalPosition").value.trim();

        if (!reciprocalPosition) {
          if (authStatus) authStatus.textContent = "Add a short description first.";
          return;
        }

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = "Adding...";
          await addReciprocalReference({
            fromUserId: data.fromUserIdF,
            fromUserEmail: data.fromUserEmailF,
            fromUserName: fromUser?.nameF || data.fromUserNameF || data.fromUserEmailF || "Unknown",
            toUserId: user.uid,
            toUserEmail: user.email,
            position: reciprocalPosition,
          });
          if (authStatus) authStatus.textContent = "Added to your profile.";
          submitBtn.textContent = "Added!";
          document.getElementById("skipReciprocal").remove();
        } catch (error) {
          console.error(error);
          if (authStatus) authStatus.textContent = getFriendlyErrorMessage(error);
          submitBtn.disabled = false;
          submitBtn.textContent = "Add to my profile";
        }
      });

      document.getElementById("skipReciprocal").addEventListener("click", () => {
        document.getElementById("reciprocalSection").classList.add("hidden");
      });
    } catch (error) {
      console.error(error);
      if (authStatus) authStatus.textContent = getFriendlyErrorMessage(error);
      btn.disabled = false;
      btn.textContent = "Confirm";
    }
  });
}

function onSignedOut(dock) {
  dock.createRequestLink?.classList.add("hidden");
  if (dock.authStatus) dock.authStatus.textContent = "Not signed in.";
  setProfileLink(dock, "");
  dock.signInBtn?.classList.remove("hidden");
  dock.signOutBtn?.classList.add("hidden");
}

function onSignedInImmediate(user, slug, dock) {
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
  setProfileLink(dock, slug);
  try {
    await renderRequest(user);
  } catch (error) {
    console.error(error);
    requestState.innerHTML = `<p class="muted">${getFriendlyErrorMessage(error)}</p>`;
  }
}

async function onAuthResolved(user) {
  if (user) return;
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
}

const authSession = initAuthSession({
  dockOptions: {
    includeProfileLink: true,
    includeCreateRequest: true,
    createRequestHref: "/create.html",
  },
  onSignedOut,
  onSignedInImmediate,
  onSignedIn,
  onAuthResolved,
});
