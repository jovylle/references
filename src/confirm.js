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
  approveRequest,
  ensureUserDocument,
  getRequestByToken,
  getUserById,
  signOutIfNeeded,
  getFriendlyErrorMessage,
} from "./data.js?v=5";

mountAccountControls({
  includeProfileLink: true,
  includeCreateRequest: true,
  createRequestHref: "/create.html",
});
initAccountControlsDock();

renderFooterLinks(document.getElementById("confirmFooter"), [
  { href: "/", label: "Home" },
  { href: "/about.html", label: "About" },
  { href: "/privacy.html", label: "Privacy Policy" },
]);

const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const authStatus = document.getElementById("authStatus");
const requestState = document.getElementById("requestState");

function setHomeProfileLinks(slug) {
  const path = slug ? `/${slug}` : "/profile.html";
  const label = slug ? path : "My profile";

  const anchor = document.getElementById("homeProfileUrlAnchor");
  if (anchor) {
    anchor.href = path;
    anchor.textContent = label;
  }
}

function getToken() {
  return new URLSearchParams(window.location.search).get("token");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function getRequesterName(data) {
  const fromName = String(data?.fromUserNameF || "").trim();
  if (fromName) return fromName;

  const fromEmail = String(data?.fromUserEmailF || "").trim();
  if (fromEmail) return fromEmail.split("@")[0];

  return "Unknown";
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
      <p class="reference-position">${escapeHtml(data.positionF)}</p>
      <p class="muted" style="margin-top: 16px;">Sign in with Google above to confirm. You can’t complete this step until you’re signed in.</p>
    </div>
  `;
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
        <p class="reference-position">${escapeHtml(data.positionF)}</p>
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
      <p class="reference-position">${escapeHtml(data.positionF)}</p>
      <p class="muted">Tap confirm if this is what you agreed to.</p>
      <button id="approveBtn" class="button button-primary">Confirm</button>
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
          ${requesterMetaTemplate(data)}
          <p class="reference-name">${escapeHtml(data.toNameF)}</p>
          <p class="reference-position">${escapeHtml(data.positionF)}</p>
          <p class="reference-confirmation">✔ Confirmed</p>
        </div>
      `;
      btn.remove();
      document.getElementById("reciprocalSection").classList.remove("hidden");

      const getFromUser = async () => {
        const { getDoc, doc, db } = await import("./firebase.js");
        const snap = await getDoc(doc(db, "usersC", data.fromUserIdF));
        return snap.exists() ? snap.data() : null;
      };

      const fromUser = await getFromUser();
      const reciprocalForm = document.getElementById("reciprocalForm");

      reciprocalForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = reciprocalForm.querySelector("button[type=submit]");
        const reciprocalPosition = document.getElementById("reciprocalPosition").value.trim();

        if (!reciprocalPosition) {
          authStatus.textContent = "Add a short description first.";
          return;
        }

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = "Adding...";
          const { addDoc, collection, serverTimestamp } = await import("./firebase.js");
          const { db } = await import("./firebase.js");
          await addDoc(collection(db, "referencesC"), {
            // Reciprocal add should show on the current user's profile.
            fromUserIdF: data.fromUserIdF,
            fromUserEmailF: data.fromUserEmailF || "",
            fromUserNameF: fromUser?.nameF || data.fromUserNameF || data.fromUserEmailF || "Unknown",
            toUserIdF: user.uid,
            toUserEmailF: user.email || "",
            positionF: reciprocalPosition,
            statusF: "confirmed",
            createdAtF: serverTimestamp(),
          });
          authStatus.textContent = "Added to your profile.";
          submitBtn.textContent = "Added!";
          document.getElementById("skipReciprocal").remove();
        } catch (error) {
          console.error(error);
          authStatus.textContent = getFriendlyErrorMessage(error);
          submitBtn.disabled = false;
          submitBtn.textContent = "Add to my profile";
        }
      });

      document.getElementById("skipReciprocal").addEventListener("click", () => {
        document.getElementById("reciprocalSection").classList.add("hidden");
      });
    } catch (error) {
      console.error(error);
      authStatus.textContent = getFriendlyErrorMessage(error);
      btn.disabled = false;
      btn.textContent = "Confirm";
    }
  });
}

signInBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    signInBtn.classList.add("hidden");
    signOutBtn.classList.remove("hidden");
    const { slug } = await ensureUserDocument(result.user);
    const profile = await getUserById(result.user.uid);
    const resolvedName = String(profile?.nameF || "").trim() || result.user.email?.split("@")[0] || result.user.email || "Unknown";
    authStatus.textContent = `Signed in as ${resolvedName}`;
    setHomeProfileLinks(slug);
    saveSessionHint(result.user, slug);
  } catch (error) {
    console.error(error);
    authStatus.textContent = getFriendlyErrorMessage(error);
  }
});

signOutBtn.addEventListener("click", async () => {
  try {
    await signOutIfNeeded();
    clearSessionHint();
  } catch (error) {
    console.error(error);
    authStatus.textContent = getFriendlyErrorMessage(error);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    clearSessionHint();
    authStatus.textContent = "Not signed in.";
    setHomeProfileLinks("");
    signInBtn.classList.remove("hidden");
    signOutBtn.classList.add("hidden");
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
    return;
  }

  signInBtn.classList.add("hidden");
  signOutBtn.classList.remove("hidden");
  const profile = await getUserById(user.uid);
  const resolvedName = String(profile?.nameF || "").trim() || user.email?.split("@")[0] || user.email || "Unknown";
  authStatus.textContent = `Signed in as ${resolvedName}`;
  saveSessionHint(user);

  try {
    const { slug } = await ensureUserDocument(user);
    setHomeProfileLinks(slug);
    saveSessionHint(user, slug);
    await renderRequest(user);
  } catch (error) {
    console.error(error);
    requestState.innerHTML = `<p class="muted">${getFriendlyErrorMessage(error)}</p>`;
  }
});

const cachedSession = readSessionHint();
if (cachedSession) {
  const fallbackName = cachedSession.email?.split("@")[0] || cachedSession.email || "Unknown";
  authStatus.textContent = `Signed in as ${fallbackName}`;
  setHomeProfileLinks(cachedSession.slug || "");
  signInBtn.classList.add("hidden");
  signOutBtn.classList.remove("hidden");
}
