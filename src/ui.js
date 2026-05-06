function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

const SESSION_HINT_STORAGE_KEY = "referly:lastSessionHint";

export function saveSessionHint(user, slug = "") {
  if (!user?.uid) return;
  try {
    const payload = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      slug: slug || "",
      savedAt: Date.now(),
    };
    globalThis.localStorage?.setItem(SESSION_HINT_STORAGE_KEY, JSON.stringify(payload));
  } catch (_error) {
    // Ignore storage issues (private mode / blocked storage).
  }
}

export function readSessionHint() {
  try {
    const raw = globalThis.localStorage?.getItem(SESSION_HINT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.uid) return null;
    return parsed;
  } catch (_error) {
    return null;
  }
}

export function clearSessionHint() {
  try {
    globalThis.localStorage?.removeItem(SESSION_HINT_STORAGE_KEY);
  } catch (_error) {
    // Ignore storage issues.
  }
}

export function accountControlsTemplate({
  includeProfileLink = false,
  includeCreateRequest = false,
  includeEditProfileAction = false,
  createRequestHref = "/create.html",
} = {}) {
  const safeCreateRequestHref = escapeHtml(createRequestHref);

  return `
    <aside id="accountDock" class="account-dock is-collapsed" aria-label="Main action area">
      <button id="accountDockToggleBtn" type="button" class="account-dock-toggle" aria-expanded="false" aria-controls="accountDockPanel" aria-label="Open main actions">
        <span aria-hidden="true">◎</span>
      </button>
      <div id="accountDockPanel" class="account-dock-panel" hidden>
        <p id="authStatus" class="status account-status">Not signed in.</p>
        <div class="auth-row account-auth-row">
          <button id="signInBtn" class="button button-primary">Continue with Google</button>
          <button id="signOutBtn" class="button button-secondary hidden">Sign out</button>
        </div>
        ${
          includeCreateRequest
            ? `<a id="accountCreateRequestLink" href="${safeCreateRequestHref}" class="button button-secondary account-action-link">Create request</a>`
            : ""
        }
        ${
          includeProfileLink
            ? `<p id="homeProfileUrlLine" class="muted account-profile-line">
                Profile link: <a id="homeProfileUrlAnchor" href="/profile.html" class="account-profile-anchor">My profile</a>
              </p>`
            : ""
        }
        ${
          includeEditProfileAction
            ? `<button id="accountEditProfileBtn" type="button" class="button button-secondary hidden">Edit profile</button>`
            : ""
        }
      </div>
    </aside>
  `;
}

export function mountAccountControls(options = {}) {
  const existing = document.getElementById("accountDock");
  if (existing) return existing;
  document.body.insertAdjacentHTML("beforeend", accountControlsTemplate(options));
  return document.getElementById("accountDock");
}

export function initAccountControlsDock({ defaultCollapsed = true } = {}) {
  const dock = document.getElementById("accountDock");
  const toggleBtn = document.getElementById("accountDockToggleBtn");
  const panel = document.getElementById("accountDockPanel");
  if (!dock || !toggleBtn || !panel) return;

  const setCollapsed = (collapsed) => {
    dock.classList.toggle("is-collapsed", collapsed);
    panel.hidden = collapsed;
    toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    toggleBtn.setAttribute("aria-label", collapsed ? "Open main actions" : "Close main actions");
  };

  setCollapsed(defaultCollapsed);

  toggleBtn.addEventListener("click", () => {
    setCollapsed(!dock.classList.contains("is-collapsed"));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setCollapsed(true);
    }
  });

  document.addEventListener("click", (event) => {
    if (dock.classList.contains("is-collapsed")) return;
    if (!dock.contains(event.target)) {
      setCollapsed(true);
    }
  });

  return { setCollapsed };
}

export function renderFooterLinks(container, links) {
  if (!container) return;
  container.innerHTML = links
    .map((link) => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`)
    .join("");
}
