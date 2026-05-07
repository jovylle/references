import { auth, onAuthStateChanged, provider, signInWithPopup } from "./firebase.js?v=2";
import {
  clearSessionHint,
  initAccountControlsDock,
  mountAccountControls,
  readSessionHint,
  saveSessionHint,
} from "./ui.js?v=7";
import {
  ensureUserDocument,
  getReferences,
  getUserById,
  getUserBySlug,
  updateReference,
  deleteReference,
  updateUserName,
  updateUserBio,
  updateUserSlug,
  updateUserLinks,
  signOutIfNeeded,
  getFriendlyErrorMessage,
} from "./data.js?v=5";

const RESERVED_PATHS = new Set([
  "profile",
  "profile.html",
  "confirm",
  "confirm.html",
  "about",
  "about.html",
  "create",
  "create.html",
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

function normalizeExternalUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function getProfileMount() {
  return document.getElementById("profileState");
}

let currentUser = null;
let profileUser = null;
mountAccountControls({
  includeProfileLink: true,
  includeCreateRequest: true,
  includeEditProfileAction: true,
  createRequestHref: "/create.html",
});
initAccountControlsDock();

const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const authStatus = document.getElementById("authStatus");

function setDockProfileLink(slug) {
  const path = slug ? `/${slug}` : "/profile.html";
  const label = slug ? path : "My profile";
  const anchor = document.getElementById("homeProfileUrlAnchor");
  if (anchor) {
    anchor.href = path;
    anchor.textContent = label;
  }
}

function setDockEditAction(visible, onClick = null) {
  const editBtn = document.getElementById("accountEditProfileBtn");
  if (!editBtn) return;
  if (!visible) {
    editBtn.classList.add("hidden");
    editBtn.onclick = null;
    return;
  }
  editBtn.classList.remove("hidden");
  editBtn.onclick = onClick;
}

function renderDockSignedOut() {
  if (signInBtn) signInBtn.classList.remove("hidden");
  if (signOutBtn) signOutBtn.classList.add("hidden");
  if (authStatus) authStatus.textContent = "Not signed in.";
  setDockProfileLink("");
  setDockEditAction(false);
}

function renderDockSignedInImmediate(user, slug = "") {
  if (signInBtn) signInBtn.classList.add("hidden");
  if (signOutBtn) signOutBtn.classList.remove("hidden");
  const fallbackName = user.email?.split("@")[0] || user.email || "Unknown";
  if (authStatus) authStatus.textContent = `Signed in as ${fallbackName}`;
  if (slug) setDockProfileLink(slug);
}

async function renderDockSignedIn(user, slug = "") {
  renderDockSignedInImmediate(user, slug);
  const profile = await getUserById(user.uid);
  const resolvedName = String(profile?.nameF || "").trim() || user.email?.split("@")[0] || user.email || "Unknown";
  if (authStatus) authStatus.textContent = `Signed in as ${resolvedName}`;
  const resolvedSlug = slug || profile?.slugF || "";
  setDockProfileLink(resolvedSlug);
}

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
      const existing = await getUserById(currentUser.uid);
      const mySlug = existing?.slugF
        ? existing.slugF
        : (await ensureUserDocument(currentUser)).slug;
      window.location.replace(`/${mySlug}`);
    } else {
      window.location.replace('/');
    }
    return;
  }

  await render();
}

signInBtn?.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    renderDockSignedInImmediate(result.user);
    const { slug } = await ensureUserDocument(result.user);
    setDockProfileLink(slug);
    saveSessionHint(result.user, slug);
  } catch (error) {
    if (authStatus) authStatus.textContent = getFriendlyErrorMessage(error);
  }
});

signOutBtn?.addEventListener("click", async () => {
  try {
    await signOutIfNeeded();
    clearSessionHint();
  } catch (error) {
    if (authStatus) authStatus.textContent = getFriendlyErrorMessage(error);
  }
});

(async () => {
  const cachedSession = readSessionHint();
  if (cachedSession) {
    renderDockSignedInImmediate(
      {
        uid: cachedSession.uid,
        email: cachedSession.email,
        displayName: cachedSession.displayName,
      },
      cachedSession.slug
    );
  } else {
    renderDockSignedOut();
  }

  await auth.authStateReady();
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (!user) {
      clearSessionHint();
      renderDockSignedOut();
    } else {
      renderDockSignedInImmediate(user);
      saveSessionHint(user);
      try {
        const { slug } = await ensureUserDocument(user);
        saveSessionHint(user, slug);
        await renderDockSignedIn(user, slug);
      } catch (error) {
        console.error(error);
        if (authStatus) authStatus.textContent = getFriendlyErrorMessage(error);
      }
    }

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
    setDockEditAction(false);
    return;
  }


  const isOwnProfile = Boolean(currentUser && currentUser.uid === profileUser.id);

  let otherProfileBanner = "";
  if (currentUser && !isOwnProfile) {
    const me = await getUserById(currentUser.uid);
    const who = escapeHtml(currentUser.email || currentUser.displayName || "another account");
    if (me?.slugF) {
      otherProfileBanner = `<p class="muted" style="margin: 0 0 20px; padding: 12px 14px; background: rgba(17, 75, 95, 0.06); border-radius: 8px;">You're signed in as ${who}. This is someone else's page. <a href="/${escapeHtml(me.slugF)}">Open your profile</a> to make changes.</p>`;
    } else {
      otherProfileBanner = `<p class="muted" style="margin: 0 0 20px; padding: 12px 14px; background: rgba(17, 75, 95, 0.06); border-radius: 8px;">You're signed in as ${who}, but this profile is for a different account. Go to the <a href="/">home page</a> to find yours.</p>`;
    }
  }

  const references = await getReferences(profileUser.id);

  const publicSlug = profileUser.slugF || "";
  const bio = profileUser.bioF || "";
  const portfolio = profileUser.portfolioF || "";
  const github = profileUser.githubF || "";
  const linkedin = profileUser.linkedinF || "";

  const editSection = isOwnProfile
    ? `
    <div class="stack profile-edit-zone">
      <div id="profileEditPanel" hidden>
        <h2 style="margin-top: 0; font-size: 1.15rem;">Edit your profile</h2>
        <p id="profileEditStatus" class="status" style="min-height: 1.25em;"></p>

        <div class="stack" style="display: grid; gap: 10px;">
          <label class="muted" style="font-size: 0.95rem;">
            Your name
            <input id="nameInput" type="text" value="${escapeHtml(profileUser.nameF)}" maxlength="120" style="margin-top: 6px; width: 100%; box-sizing: border-box;" />
          </label>
          <button type="button" id="updateNameBtn" class="button button-secondary">Save name</button>
        </div>

        <div class="stack" style="display: grid; gap: 10px; margin-top: 20px;">
          <label class="muted" style="font-size: 0.95rem;">
            Tagline <span style="font-weight: 400; opacity: 0.85;">(e.g. Full Stack Developer)</span>
            <input id="bioInput" type="text" value="${escapeHtml(bio)}" maxlength="160" placeholder="e.g. Full Stack Developer" style="margin-top: 6px; width: 100%; box-sizing: border-box;" />
          </label>
          <button type="button" id="updateBioBtn" class="button button-secondary">Save tagline</button>
        </div>

        <div class="stack" style="display: grid; gap: 10px; margin-top: 20px;">
          <label class="muted" style="font-size: 0.95rem;">
            Your public link name <span style="font-weight: 400; opacity: 0.85;">(the part after the site URL)</span>
            <input id="slugInput" type="text" value="${escapeHtml(publicSlug)}" maxlength="40" style="margin-top: 6px; width: 100%; box-sizing: border-box;" />
          </label>
          <button type="button" id="updateSlugBtn" class="button button-secondary">Save link</button>
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
      const year = ref.createdAtF?.toDate?.().getFullYear?.() || new Date().getFullYear();
      if (isOwnProfile) {
        return `
    <div class="reference-item" data-ref-id="${escapeHtml(ref.id)}" style="position: relative;">
      <p class="reference-name">${escapeHtml(ref.fromUserNameF || "Anonymous")}</p>
      <p class="reference-position">${escapeHtml(ref.positionF)}</p>
      <p class="reference-confirmation" style="margin-top: 10px;">✔ Confirmed ${year}</p>
      <div class="profile-edit-only" hidden style="margin-top: 14px;">
        <label class="muted" style="font-size: 0.85rem; display: block;">
          Reference name
          <input type="text" class="ref-name-input" value="${escapeHtml(ref.fromUserNameF || "")}" maxlength="120" style="margin-top: 4px; width: 100%; box-sizing: border-box;" />
        </label>
        <label class="muted" style="font-size: 0.85rem; display: block; margin-top: 10px;">
          Role or how you know them
          <input type="text" class="ref-position-input" value="${escapeHtml(ref.positionF || "")}" maxlength="120" style="margin-top: 4px; width: 100%; box-sizing: border-box;" />
        </label>
        <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
          <button type="button" class="ref-save-btn button button-secondary">Save reference</button>
          <button type="button" class="ref-delete-btn button" style="background: #d32f2f; color: white; border: none;">Hide</button>
        </div>
      </div>
    </div>
  `;
      }
      return `
    <div class="reference-item" style="position: relative;">
      <p class="reference-name">${escapeHtml(ref.fromUserNameF || "Anonymous")}</p>
      <p class="reference-position">${escapeHtml(ref.positionF)}</p>
      <p class="reference-confirmation">✔ Confirmed ${year}</p>
    </div>
  `;
    })
    .join("");

  const portfolioHref = normalizeExternalUrl(profileUser.portfolioF);
  const githubHref = normalizeExternalUrl(profileUser.githubF);
  const linkedinHref = normalizeExternalUrl(profileUser.linkedinF);

  const linksHTML =
    portfolioHref || githubHref || linkedinHref
      ? `<div class="profile-links-wrap">
        <p class="profile-links-kicker">View my work</p>
        <div class="profile-links">
        ${portfolioHref ? `<a href="${escapeHtml(portfolioHref)}" target="_blank" rel="noreferrer" class="profile-link-chip">Portfolio <span class="external-link-icon" aria-hidden="true"><svg viewBox="0 0 20 20" focusable="false"><path d="M11 4h5v5M10 10l6-6M16 11v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3"></path></svg></span></a>` : ""}
        ${githubHref ? `<a href="${escapeHtml(githubHref)}" target="_blank" rel="noreferrer" class="profile-link-chip">GitHub <span class="external-link-icon" aria-hidden="true"><svg viewBox="0 0 20 20" focusable="false"><path d="M11 4h5v5M10 10l6-6M16 11v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3"></path></svg></span></a>` : ""}
        ${linkedinHref ? `<a href="${escapeHtml(linkedinHref)}" target="_blank" rel="noreferrer" class="profile-link-chip">LinkedIn <span class="external-link-icon" aria-hidden="true"><svg viewBox="0 0 20 20" focusable="false"><path d="M11 4h5v5M10 10l6-6M16 11v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3"></path></svg></span></a>` : ""}
        </div>
      </div>`
      : "";

  mount.innerHTML = `
    ${otherProfileBanner}
    <div class="profile-public-view">
      <header class="profile-headline">
        <h1 id="profileNameHeading" class="profile-title">${escapeHtml(profileUser.nameF)}</h1>
        ${bio ? `<p id="profileBioHeading" class="profile-bio">${escapeHtml(bio)}</p>` : ""}
        ${linksHTML}
      </header>
      <div class="profile-divider" role="presentation"></div>
      <section class="references-block" aria-label="References">
      <h2 class="references-heading">References</h2>
      <p class="references-subtitle">People I've worked with who can vouch for my skills, work ethic, and professionalism.</p>
      ${references.length > 0 ? `<div class="stack profile-reference-list" style="gap: 16px;">${refList}</div>` : '<p class="muted profile-empty-state">No confirmed references yet.</p>'}
      </section>
      <div class="profile-bottom-note">
        <p>This page lists verified colleagues I've worked with.</p>
      </div>
    </div>
    ${editSection}
  `;

  if (isOwnProfile) {
    const profileEditPanel = document.getElementById("profileEditPanel");
    const profileEditOnlyBlocks = Array.from(document.querySelectorAll(".profile-edit-only"));
    const setProfileEditOpen = (open) => {
      profileEditPanel.hidden = !open;
      profileEditOnlyBlocks.forEach((el) => {
        el.hidden = !open;
      });
    };
    setDockEditAction(true, () => {
      const shouldOpen = profileEditPanel.hidden;
      setProfileEditOpen(shouldOpen);
      if (shouldOpen) {
        profileEditPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    setProfileEditOpen(false);

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
        profileUser.nameF = newName;
        const heading = document.getElementById("profileNameHeading");
        if (heading) heading.textContent = newName;
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

    document.getElementById("updateBioBtn").addEventListener("click", async () => {
      const btn = document.getElementById("updateBioBtn");
      const newBio = document.getElementById("bioInput").value.trim();
      try {
        btn.disabled = true;
        btn.textContent = "Saving...";
        await updateUserBio(currentUser.uid, newBio);
        profileUser.bioF = newBio;
        const bioEl = document.getElementById("profileBioHeading");
        if (newBio) {
          if (bioEl) {
            bioEl.textContent = newBio;
          } else {
            const heading = document.getElementById("profileNameHeading");
            if (heading) {
              const p = document.createElement("p");
              p.id = "profileBioHeading";
              p.className = "profile-bio";
              p.textContent = newBio;
              heading.insertAdjacentElement("afterend", p);
            }
          }
        } else if (bioEl) {
          bioEl.remove();
        }
        setEditStatus("Tagline updated.");
        btn.textContent = "Saved!";
        setTimeout(() => {
          btn.textContent = "Save tagline";
          btn.disabled = false;
        }, 1500);
      } catch (error) {
        console.error(error);
        setEditStatus(getFriendlyErrorMessage(error));
        btn.textContent = "Save tagline";
        btn.disabled = false;
      }
    });

    document.getElementById("updateSlugBtn").addEventListener("click", async () => {
      const btn = document.getElementById("updateSlugBtn");
      const newSlug = document.getElementById("slugInput").value.trim();
      if (!newSlug) {
        setEditStatus("Link name cannot be empty.");
        return;
      }
      try {
        btn.disabled = true;
        btn.textContent = "Saving...";
        await updateUserSlug(currentUser.uid, newSlug);
        profileUser.slugF = newSlug;
        setEditStatus("Link updated. Bookmark the new address if you changed it.");
        btn.textContent = "Saved!";
        const pathSlug = getSlug();
        if (pathSlug && pathSlug !== newSlug) {
          window.location.replace(`/${newSlug}`);
          return;
        }
        setTimeout(() => {
          btn.textContent = "Save link";
          btn.disabled = false;
        }, 1500);
      } catch (error) {
        console.error(error);
        setEditStatus(getFriendlyErrorMessage(error));
        btn.textContent = "Save link";
        btn.disabled = false;
      }
    });

    document.getElementById("updateLinksBtn").addEventListener("click", async () => {
      const btn = document.getElementById("updateLinksBtn");
      const portfolioVal = document.getElementById("portfolioInput").value.trim();
      const githubVal = document.getElementById("githubInput").value.trim();
      const linkedinVal = document.getElementById("linkedinInput").value.trim();
      const normalizedPortfolio = normalizeExternalUrl(portfolioVal);
      const normalizedGithub = normalizeExternalUrl(githubVal);
      const normalizedLinkedin = normalizeExternalUrl(linkedinVal);

      try {
        btn.disabled = true;
        btn.textContent = "Saving...";
        await updateUserLinks(currentUser.uid, {
          portfolio: normalizedPortfolio,
          github: normalizedGithub,
          linkedin: normalizedLinkedin,
        });
        profileUser.portfolioF = normalizedPortfolio;
        profileUser.githubF = normalizedGithub;
        profileUser.linkedinF = normalizedLinkedin;
        document.getElementById("portfolioInput").value = normalizedPortfolio;
        document.getElementById("githubInput").value = normalizedGithub;
        document.getElementById("linkedinInput").value = normalizedLinkedin;
        setEditStatus("Links updated.");
        btn.textContent = "Saved!";
        await render();
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
          setEditStatus("Add both a name and a short description.");
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
  } else {
    setDockEditAction(false);
  }
}
