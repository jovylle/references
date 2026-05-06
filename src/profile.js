import { auth, onAuthStateChanged } from "./firebase.js";
import {
  ensureUserDocument,
  getReferences,
  getUserById,
  getUserBySlug,
  updateReference,
  deleteReference,
  updateUserName,
  updateUserSlug,
  updateUserLinks,
  getFriendlyErrorMessage,
} from "./data.js";

const RESERVED_PATHS = new Set([
  "profile",
  "profile.html",
  "confirm",
  "confirm.html",
  "about",
  "about.html",
  "privacy",
  "privacy.html",
  "index.html",
]);

function getSlug() {
  const params = new URLSearchParams(window.location.search);
  const slugParam = params.get("slug");
  if (slugParam) {
    const fromQuery = slugParam.trim().toLowerCase();
    // Hosting may rewrite /profile → profile.html?slug=profile; that is not a user slug.
    if (fromQuery && !RESERVED_PATHS.has(fromQuery)) return fromQuery;
  }

  const segments = window.location.pathname.split("/").filter(Boolean);
  const first = (segments[0] || "").toLowerCase();
  if (!first || RESERVED_PATHS.has(first)) return "";
  return first;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function getProfileMount() {
  return document.getElementById("profileState");
}

let currentUser = null;
let profileUser = null;

function setEditStatus(message) {
  const el = document.getElementById("profileEditStatus");
  if (el) el.textContent = message;
}

async function route() {
  const mount = getProfileMount();
  if (!mount) return;

  const slug = getSlug();

  if (!slug) {
    if (currentUser) {
      await ensureUserDocument(currentUser);
      const me = await getUserById(currentUser.uid);
      if (me?.slug) {
        window.location.replace(`/${me.slug}`);
        return;
      }
    }
    mount.innerHTML =
      '<p class="muted">Open your profile link, or sign in on the home page—if you already have an account you will be sent to your profile URL automatically.</p>';
    return;
  }

  await render();
}

(async () => {
  await auth.authStateReady();
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    try {
      await route();
    } catch (error) {
      console.error(error);
      const mount = getProfileMount();
      if (mount) {
        mount.innerHTML = `<p class="muted">${escapeHtml(getFriendlyErrorMessage(error))}</p>`;
      }
    }
  });
})();

async function render() {
  const mount = getProfileMount();
  if (!mount) return;

  const slug = getSlug();
  if (!slug) return;

  profileUser = await getUserBySlug(slug);
  if (!profileUser) {
    mount.innerHTML = '<p class="muted">Profile not found.</p>';
    return;
  }

  if (currentUser && currentUser.uid === profileUser.id) {
    try {
      await ensureUserDocument(currentUser);
    } catch (error) {
      console.error(error);
    }
  }

  const isOwnProfile = Boolean(currentUser && currentUser.uid === profileUser.id);

  let otherProfileBanner = "";
  if (currentUser && !isOwnProfile) {
    const me = await getUserById(currentUser.uid);
    const who = escapeHtml(currentUser.email || currentUser.displayName || "another account");
    if (me?.slug) {
      otherProfileBanner = `<p class="muted" style="margin: 0 0 20px; padding: 12px 14px; background: rgba(17, 75, 95, 0.06); border-radius: 8px;">You're signed in as ${who}. This page is not your profile. <a href="/${escapeHtml(me.slug)}">Open your profile</a> to edit your details.</p>`;
    } else {
      otherProfileBanner = `<p class="muted" style="margin: 0 0 20px; padding: 12px 14px; background: rgba(17, 75, 95, 0.06); border-radius: 8px;">You're signed in as ${who}, but this profile belongs to another account. Use the <a href="/">home page</a> if you need your profile link.</p>`;
    }
  }

  const references = await getReferences(profileUser.id);

  const publicSlug = profileUser.slug || "";
  const portfolio = profileUser.portfolio || "";
  const github = profileUser.github || "";
  const linkedin = profileUser.linkedin || "";

  const editSection = isOwnProfile
    ? `
    <div class="stack" style="margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid rgba(17, 75, 95, 0.15);">
      <button type="button" id="profileEditToggleBtn" class="button button-secondary" aria-expanded="false" aria-controls="profileEditPanel">Edit profile</button>
      <div id="profileEditPanel" hidden style="margin-top: 16px;">
        <h2 style="margin-top: 0; font-size: 1.15rem;">Edit your profile</h2>
        <p id="profileEditStatus" class="status" style="min-height: 1.25em;"></p>

        <div class="stack" style="display: grid; gap: 10px;">
          <label class="muted" style="font-size: 0.95rem;">
            Your name
            <input id="nameInput" type="text" value="${escapeHtml(profileUser.name)}" maxlength="120" style="margin-top: 6px; width: 100%; box-sizing: border-box;" />
          </label>
          <button type="button" id="updateNameBtn" class="button button-secondary">Save name</button>
        </div>

        <div class="stack" style="display: grid; gap: 10px; margin-top: 20px;">
          <label class="muted" style="font-size: 0.95rem;">
            Your profile URL (slug)
            <input id="slugInput" type="text" value="${escapeHtml(publicSlug)}" maxlength="40" style="margin-top: 6px; width: 100%; box-sizing: border-box;" />
          </label>
          <button type="button" id="updateSlugBtn" class="button button-secondary">Save slug</button>
        </div>

        <div class="stack" style="display: grid; gap: 10px; margin-top: 20px;">
          <p style="font-size: 0.95rem; color: var(--muted); margin: 0;">Profile links</p>
          <label class="muted" style="font-size: 0.85rem;">
            Portfolio
            <input id="portfolioInput" type="url" value="${escapeHtml(portfolio)}" placeholder="https://example.com" style="margin-top: 4px; width: 100%; box-sizing: border-box;" />
          </label>
          <label class="muted" style="font-size: 0.85rem;">
            GitHub
            <input id="githubInput" type="url" value="${escapeHtml(github)}" placeholder="https://github.com/username" style="margin-top: 4px; width: 100%; box-sizing: border-box;" />
          </label>
          <label class="muted" style="font-size: 0.85rem;">
            LinkedIn
            <input id="linkedinInput" type="url" value="${escapeHtml(linkedin)}" placeholder="https://linkedin.com/in/username" style="margin-top: 4px; width: 100%; box-sizing: border-box;" />
          </label>
          <button type="button" id="updateLinksBtn" class="button button-secondary">Save links</button>
        </div>
      </div>
    </div>
  `
    : "";

  const refList = references
    .map((ref) => {
      const year = ref.createdAt?.toDate?.().getFullYear?.() || new Date().getFullYear();
      if (isOwnProfile) {
        return `
    <div class="reference-item" data-ref-id="${escapeHtml(ref.id)}" style="position: relative;">
      <label class="muted" style="font-size: 0.85rem; display: block;">
        Reference name
        <input type="text" class="ref-name-input" value="${escapeHtml(ref.fromUserName || "")}" maxlength="120" style="margin-top: 4px; width: 100%; box-sizing: border-box;" />
      </label>
      <label class="muted" style="font-size: 0.85rem; display: block; margin-top: 10px;">
        Position / context
        <input type="text" class="ref-position-input" value="${escapeHtml(ref.position || "")}" maxlength="120" style="margin-top: 4px; width: 100%; box-sizing: border-box;" />
      </label>
      <p class="reference-confirmation" style="margin-top: 10px;">✔ Confirmed ${year}</p>
      <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
        <button type="button" class="ref-save-btn button button-secondary">Save reference</button>
        <button type="button" class="ref-delete-btn button" style="background: #d32f2f; color: white; border: none;">Hide</button>
      </div>
    </div>
  `;
      }
      return `
    <div class="reference-item" style="position: relative;">
      <p class="reference-name">${escapeHtml(ref.fromUserName || "Anonymous")}</p>
      <p class="reference-position">${escapeHtml(ref.position)}</p>
      <p class="reference-confirmation">✔ Confirmed ${year}</p>
    </div>
  `;
    })
    .join("");

  const linksHTML =
    profileUser.portfolio || profileUser.github || profileUser.linkedin
      ? `<div style="display: flex; gap: 16px; margin: 16px 0; flex-wrap: wrap;">
        ${profileUser.portfolio ? `<a href="${escapeHtml(profileUser.portfolio)}" target="_blank" rel="noreferrer" style="color: var(--text); text-decoration: none; font-weight: 500;">Portfolio ↗</a>` : ""}
        ${profileUser.github ? `<a href="${escapeHtml(profileUser.github)}" target="_blank" rel="noreferrer" style="color: var(--text); text-decoration: none; font-weight: 500;">GitHub ↗</a>` : ""}
        ${profileUser.linkedin ? `<a href="${escapeHtml(profileUser.linkedin)}" target="_blank" rel="noreferrer" style="color: var(--text); text-decoration: none; font-weight: 500;">LinkedIn ↗</a>` : ""}
      </div>`
      : "";

  mount.innerHTML = `
    ${otherProfileBanner}
    ${editSection}
    <div>
      <h1>${escapeHtml(profileUser.name)}</h1>
      ${linksHTML}
      <h2 style="margin-top: 32px; font-size: 1.2rem;">References</h2>
      ${references.length > 0 ? `<div class="stack" style="gap: 16px;">${refList}</div>` : '<p class="muted">No confirmed references yet.</p>'}
    </div>
  `;

  if (isOwnProfile) {
    const profileEditPanel = document.getElementById("profileEditPanel");
    const profileEditToggleBtn = document.getElementById("profileEditToggleBtn");
    const setProfileEditOpen = (open) => {
      profileEditPanel.hidden = !open;
      profileEditToggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
      profileEditToggleBtn.textContent = open ? "Done editing" : "Edit profile";
    };
    profileEditToggleBtn.addEventListener("click", () => {
      setProfileEditOpen(profileEditPanel.hidden);
    });

    document.getElementById("updateNameBtn").addEventListener("click", async () => {
      const btn = document.getElementById("updateNameBtn");
      const newName = document.getElementById("nameInput").value.trim();
      if (!newName) {
        setEditStatus("Name cannot be empty.");
        return;
      }
      try {
        btn.disabled = true;
        btn.textContent = "Saving...";
        await updateUserName(currentUser.uid, newName);
        profileUser.name = newName;
        setEditStatus("Name updated.");
        btn.textContent = "Saved!";
        setTimeout(() => {
          btn.textContent = "Save name";
          btn.disabled = false;
        }, 1500);
      } catch (error) {
        console.error(error);
        setEditStatus(getFriendlyErrorMessage(error));
        btn.textContent = "Save name";
        btn.disabled = false;
      }
    });

    document.getElementById("updateSlugBtn").addEventListener("click", async () => {
      const btn = document.getElementById("updateSlugBtn");
      const newSlug = document.getElementById("slugInput").value.trim();
      if (!newSlug) {
        setEditStatus("Slug cannot be empty.");
        return;
      }
      try {
        btn.disabled = true;
        btn.textContent = "Saving...";
        await updateUserSlug(currentUser.uid, newSlug);
        profileUser.slug = newSlug;
        setEditStatus("Slug updated. If you changed the URL, use the new link.");
        btn.textContent = "Saved!";
        const pathSlug = getSlug();
        if (pathSlug && pathSlug !== newSlug) {
          window.location.replace(`/${newSlug}`);
          return;
        }
        setTimeout(() => {
          btn.textContent = "Save slug";
          btn.disabled = false;
        }, 1500);
      } catch (error) {
        console.error(error);
        setEditStatus(getFriendlyErrorMessage(error));
        btn.textContent = "Save slug";
        btn.disabled = false;
      }
    });

    document.getElementById("updateLinksBtn").addEventListener("click", async () => {
      const btn = document.getElementById("updateLinksBtn");
      const portfolioVal = document.getElementById("portfolioInput").value.trim();
      const githubVal = document.getElementById("githubInput").value.trim();
      const linkedinVal = document.getElementById("linkedinInput").value.trim();

      try {
        btn.disabled = true;
        btn.textContent = "Saving...";
        await updateUserLinks(currentUser.uid, {
          portfolio: portfolioVal,
          github: githubVal,
          linkedin: linkedinVal,
        });
        profileUser.portfolio = portfolioVal;
        profileUser.github = githubVal;
        profileUser.linkedin = linkedinVal;
        setEditStatus("Links updated.");
        btn.textContent = "Saved!";
        setTimeout(() => {
          btn.textContent = "Save links";
          btn.disabled = false;
        }, 1500);
      } catch (error) {
        console.error(error);
        setEditStatus(getFriendlyErrorMessage(error));
        btn.textContent = "Save links";
        btn.disabled = false;
      }
    });

    document.querySelectorAll(".ref-save-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest("[data-ref-id]");
        const refId = row.getAttribute("data-ref-id");
        const fromUserName = row.querySelector(".ref-name-input").value.trim();
        const position = row.querySelector(".ref-position-input").value.trim();
        if (!fromUserName || !position) {
          setEditStatus("Reference name and position cannot be empty.");
          return;
        }
        try {
          btn.disabled = true;
          btn.textContent = "Saving...";
          await updateReference(refId, { fromUserName, position });
          setEditStatus("Reference updated.");
          btn.textContent = "Saved!";
          setTimeout(() => {
            btn.textContent = "Save reference";
            btn.disabled = false;
          }, 1500);
        } catch (error) {
          console.error(error);
          setEditStatus(getFriendlyErrorMessage(error));
          btn.textContent = "Save reference";
          btn.disabled = false;
        }
      });
    });

    document.querySelectorAll(".ref-delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest("[data-ref-id]");
        const refId = row.getAttribute("data-ref-id");
        if (!confirm("Hide this reference?")) return;
        try {
          btn.disabled = true;
          await deleteReference(refId);
          setEditStatus("Reference hidden.");
          await render();
        } catch (error) {
          console.error(error);
          setEditStatus(getFriendlyErrorMessage(error));
          btn.disabled = false;
        }
      });
    });
  }
}
