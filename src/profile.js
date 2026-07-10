import { copyText, initAuthSession } from "./ui.js";
import {
  ensureUserDocument,
  getReferences,
  getUserById,
  getUserBySlug,
  hasMutualReference,
  updateReference,
  deleteReference,
  updateUserName,
  updateUserBio,
  updateUserSlug,
  updateUserLinks,
  updateUserContact,
  getFriendlyErrorMessage,
} from "./data.js";
import { escapeHtml, normalizeExternalUrl } from "./utils.js";

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

function formatConfirmedDate(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : timestamp instanceof Date ? timestamp : null;
  if (!date) return "";
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(date);
}

function positionLineHtml(ref) {
  const position = String(ref?.positionF || "").trim();
  const company = String(ref?.companyF || "").trim();
  const label = company ? `${position} @ ${company}` : position;
  return `<p class="reference-position">${escapeHtml(label)}</p>`;
}

function confirmerNameHtml(ref, confirmerProfile) {
  const name = escapeHtml(ref.fromUserNameF || "Anonymous");
  const slug = confirmerProfile?.slugF;
  return slug ? `<a href="/${escapeHtml(slug)}">${name}</a>` : name;
}

function confirmedDateHtml(ref) {
  const formatted = formatConfirmedDate(ref.createdAtF);
  return formatted ? `<p class="reference-confirmed-date">Confirmed on ${escapeHtml(formatted)}</p>` : "";
}

function getProfileMount() {
  return document.getElementById("profileState");
}

let currentUser = null;
let profileUser = null;

function setDockProfileLink(dock, slug) {
  const path = slug ? `/${slug}` : "/profile.html";
  const label = slug ? path : "My profile";
  if (dock.profileUrlAnchor) {
    dock.profileUrlAnchor.href = path;
    dock.profileUrlAnchor.textContent = label;
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

function onSignedOut(dock) {
  dock.profileUrlLine?.classList.add("hidden");
  dock.createRequestLink?.classList.add("hidden");
  dock.signInBtn?.classList.remove("hidden");
  dock.signOutBtn?.classList.add("hidden");
  if (dock.authStatus) dock.authStatus.textContent = "Not signed in.";
  setDockProfileLink(dock, "");
  setDockEditAction(false);
}

function onSignedInImmediate(user, slug, dock) {
  dock.profileUrlLine?.classList.remove("hidden");
  dock.createRequestLink?.classList.remove("hidden");
  dock.signInBtn?.classList.add("hidden");
  dock.signOutBtn?.classList.remove("hidden");
  const fallbackName = user.email?.split("@")[0] || user.email || "Unknown";
  if (dock.authStatus) dock.authStatus.textContent = `Signed in as ${fallbackName}`;
  if (slug) setDockProfileLink(dock, slug);
}

async function onSignedIn(user, slug, dock) {
  const profile = await getUserById(user.uid);
  const resolvedName = String(profile?.nameF || "").trim() || user.email?.split("@")[0] || user.email || "Unknown";
  if (dock.authStatus) dock.authStatus.textContent = `Signed in as ${resolvedName}`;
  const resolvedSlug = slug || profile?.slugF || "";
  setDockProfileLink(dock, resolvedSlug);
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

async function onAuthResolved(user) {
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
}

initAuthSession({
  dockOptions: {
    includeProfileLink: true,
    includeCreateRequest: true,
    includeEditProfileAction: true,
    createRequestHref: "/create.html",
  },
  awaitReady: true,
  onSignedOut,
  onSignedInImmediate,
  onSignedIn,
  onAuthResolved,
});

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
      otherProfileBanner = `<p class="muted banner-notice">You're signed in as ${who}. This is someone else's page. <a href="/${escapeHtml(me.slugF)}">Open your profile</a> to make changes.</p>`;
    } else {
      otherProfileBanner = `<p class="muted banner-notice">You're signed in as ${who}, but this profile is for a different account. Go to the <a href="/">home page</a> to find yours.</p>`;
    }
  }

  const references = await getReferences(profileUser.id);
  const referenceExtras = await Promise.all(
    references.map(async (ref) => {
      const [confirmerProfile, mutual] = await Promise.all([
        getUserById(ref.fromUserIdF),
        hasMutualReference(profileUser.id, ref.fromUserIdF),
      ]);
      return { confirmerProfile, mutual };
    })
  );
  const mutualCount = referenceExtras.filter((extra) => extra.mutual).length;

  const publicSlug = profileUser.slugF || "";
  const bio = profileUser.bioF || "";
  const portfolio = profileUser.portfolioF || "";
  const github = profileUser.githubF || "";
  const linkedin = profileUser.linkedinF || "";
  const contactPhone = profileUser.contactPhoneF || "";
  const contactShareConsent = Boolean(profileUser.contactShareConsentF);

  const editSection = isOwnProfile
    ? `
    <div class="stack profile-edit-zone">
      <div id="profileEditPanel" hidden>
        <h2 class="edit-panel-heading">Edit your profile</h2>
        <p id="profileEditStatus" class="status edit-panel-status"></p>

        <div class="field-group-first">
          <label class="muted">
            Your name
            <input id="nameInput" type="text" value="${escapeHtml(profileUser.nameF)}" maxlength="120" class="field-input" />
          </label>
          <button type="button" id="updateNameBtn" class="button button-secondary">Save name</button>
        </div>

        <div class="field-group">
          <label class="muted">
            Tagline <span class="field-optional-hint">(e.g. Full Stack Developer)</span>
            <input id="bioInput" type="text" value="${escapeHtml(bio)}" maxlength="160" placeholder="e.g. Full Stack Developer" class="field-input" />
          </label>
          <button type="button" id="updateBioBtn" class="button button-secondary">Save tagline</button>
        </div>

        <div class="field-group">
          <label class="muted">
            Your public link name <span class="field-optional-hint">(the part after the site URL)</span>
            <input id="slugInput" type="text" value="${escapeHtml(publicSlug)}" maxlength="40" class="field-input" />
          </label>
          <button type="button" id="updateSlugBtn" class="button button-secondary">Save link</button>
        </div>

        <div class="field-group">
          <p class="field-kicker">Profile links</p>
          <label class="muted field-label-sm">
            Portfolio
            <input id="portfolioInput" type="url" value="${escapeHtml(portfolio)}" placeholder="https://example.com" class="field-input-sm" />
          </label>
          <label class="muted field-label-sm">
            GitHub
            <input id="githubInput" type="url" value="${escapeHtml(github)}" placeholder="https://github.com/username" class="field-input-sm" />
          </label>
          <label class="muted field-label-sm">
            LinkedIn
            <input id="linkedinInput" type="url" value="${escapeHtml(linkedin)}" placeholder="https://linkedin.com/in/username" class="field-input-sm" />
          </label>
          <button type="button" id="updateLinksBtn" class="button button-secondary">Save links</button>
        </div>

        <div class="field-group">
          <p class="field-kicker">Contact info</p>
          <label class="muted field-label-sm">
            Phone number
            <input id="contactPhoneInput" type="tel" value="${escapeHtml(contactPhone)}" placeholder="e.g. +1 555 123 4567" class="field-input-sm" />
          </label>
          <label class="muted field-label-sm checkbox-row">
            <input id="contactShareConsentInput" type="checkbox" class="checkbox-input" ${contactShareConsent ? "checked" : ""} />
            Share upon request (shown on your public profile)
          </label>
          <button type="button" id="updateContactBtn" class="button button-secondary">Save contact info</button>
        </div>

        <div class="field-group">
          <p class="field-kicker">Referly Verified badge</p>
          <p class="muted field-label-sm">Copy this snippet into LinkedIn, your resume site, or portfolio to link back to your profile.</p>
          <button type="button" id="copyEmbedBtn" class="button button-secondary">Copy embed code</button>
        </div>
      </div>
    </div>
  `
    : "";

  const refList = references
    .map((ref, index) => {
      const { confirmerProfile } = referenceExtras[index] || {};
      if (isOwnProfile) {
        return `
    <div class="reference-item" data-ref-id="${escapeHtml(ref.id)}">
      <p class="reference-name">${confirmerNameHtml(ref, confirmerProfile)}</p>
      ${positionLineHtml(ref)}
      ${confirmedDateHtml(ref)}
      <p
        class="reference-confirmation reference-confirmation-icon reference-confirmation-icon-tight"
        data-tooltip="Mutual confirmation: this person accepted and acknowledged this reference."
        aria-label="Mutually confirmed reference"
        tabindex="0"
      >
        <span aria-hidden="true">✔</span>
      </p>
      <div class="profile-edit-only" hidden>
        <label class="muted field-label-sm">
          Reference name
          <input type="text" class="ref-name-input field-input-sm" value="${escapeHtml(ref.fromUserNameF || "")}" maxlength="120" />
        </label>
        <label class="muted field-label-sm">
          Role or how you know them
          <input type="text" class="ref-position-input field-input-sm" value="${escapeHtml(ref.positionF || "")}" maxlength="120" />
        </label>
        <div class="ref-edit-actions">
          <button type="button" class="ref-save-btn button button-secondary">Save reference</button>
          <button type="button" class="ref-delete-btn button button-danger">Hide</button>
        </div>
      </div>
    </div>
  `;
      }
      return `
    <div class="reference-item">
      <p class="reference-name">${confirmerNameHtml(ref, confirmerProfile)}</p>
      ${positionLineHtml(ref)}
      ${confirmedDateHtml(ref)}
      <p
        class="reference-confirmation reference-confirmation-icon"
        data-tooltip="Mutual confirmation: this person accepted and acknowledged this reference."
        aria-label="Mutually confirmed reference"
        tabindex="0"
      >
        <span aria-hidden="true">✔</span>
      </p>
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

  const contactChipHTML =
    contactShareConsent && contactPhone
      ? `<p class="contact-available-chip">Contact available: ${escapeHtml(contactPhone)}</p>`
      : "";

  mount.innerHTML = `
    ${otherProfileBanner}
    <div class="profile-public-view">
      <header class="profile-headline">
        <h1 id="profileNameHeading" class="profile-title">${escapeHtml(profileUser.nameF)}</h1>
        ${bio ? `<p id="profileBioHeading" class="profile-bio">${escapeHtml(bio)}</p>` : ""}
        ${linksHTML}
        ${contactChipHTML}
      </header>
      <div class="profile-divider" role="presentation"></div>
      <section class="references-block" aria-label="References">
      <h2 class="references-heading">References</h2>
      <p class="references-subtitle">People I've worked with who can vouch for my skills, work ethic, and professionalism.</p>
      ${
        references.length > 0
          ? `<p class="references-trust-summary">${references.length} reference${references.length === 1 ? "" : "s"} · ${mutualCount} mutual</p>`
          : ""
      }
      ${references.length > 0 ? `<div class="stack profile-reference-list">${refList}</div>` : '<p class="muted profile-empty-state">No confirmed references yet.</p>'}
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

    document.getElementById("updateContactBtn").addEventListener("click", async () => {
      const btn = document.getElementById("updateContactBtn");
      const phone = document.getElementById("contactPhoneInput").value.trim();
      const consent = document.getElementById("contactShareConsentInput").checked;

      try {
        btn.disabled = true;
        btn.textContent = "Saving...";
        await updateUserContact(currentUser.uid, { phone, consent });
        profileUser.contactPhoneF = phone;
        profileUser.contactShareConsentF = consent;
        setEditStatus("Contact info updated.");
        btn.textContent = "Saved!";
        await render();
        setTimeout(() => {
          btn.textContent = "Save contact info";
          btn.disabled = false;
        }, 1500);
      } catch (error) {
        console.error(error);
        setEditStatus(getFriendlyErrorMessage(error));
        btn.textContent = "Save contact info";
        btn.disabled = false;
      }
    });

    document.getElementById("copyEmbedBtn").addEventListener("click", async () => {
      const btn = document.getElementById("copyEmbedBtn");
      const origin = globalThis.location.origin;
      const profileUrl = `${origin}/${profileUser.slugF}`;
      const snippet = `<a href="${profileUrl}"><img src="${origin}/badge.svg" alt="Referly Verified" height="20"></a>`;
      const copied = await copyText(snippet);
      btn.textContent = copied ? "Copied!" : "Copy failed";
      setTimeout(() => {
        btn.textContent = "Copy embed code";
      }, 1500);
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
