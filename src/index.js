import {
  auth,
  onAuthStateChanged,
  provider,
  signInWithPopup,
} from "./firebase.js";
import {
  createRequest,
  ensureUserDocument,
  getReferences,
  getUserById,
  signOutIfNeeded,
  updateUserSlug,
  updateUserLinks,
  updateUserName,
  getFriendlyErrorMessage,
} from "./data.js";

const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const authStatus = document.getElementById("authStatus");
const requestForm = document.getElementById("requestForm");
const requestHint = document.getElementById("requestHint");
const createdLink = document.getElementById("createdLink");
const createdLinkValue = document.getElementById("createdLinkValue");
const profileCard = document.getElementById("profileCard");
const infoSection = document.getElementById("infoSection");

function renderSignedOut() {
  requestForm.classList.add("hidden");
  requestHint.classList.remove("hidden");
  signInBtn.classList.remove("hidden");
  signOutBtn.classList.add("hidden");
  infoSection.classList.remove("hidden");
  authStatus.textContent = "Not signed in.";
  profileCard.innerHTML = '<p class="muted">No profile loaded yet.</p>';
}

async function renderSignedIn(user) {
  requestForm.classList.remove("hidden");
  requestHint.classList.add("hidden");
  infoSection.classList.add("hidden");
  signInBtn.classList.add("hidden");
  signOutBtn.classList.remove("hidden");
  authStatus.textContent = `Signed in as ${user.displayName || user.email}`;

  const profile = await getUserById(user.uid);
  if (profile) {
    const references = await getReferences(user.uid);
    const publicSlug = profile.slug || "";
    const portfolio = profile.portfolio || "";
    const github = profile.github || "";
    const linkedin = profile.linkedin || "";

    profileCard.innerHTML = `
      <div class="stack">
        <div style="display: grid; gap: 8px;">
          <label style="font-size: 0.95rem; color: var(--muted);">
            Your name
            <input id="nameInput" type="text" value="${profile.name}" maxlength="120" style="margin-top: 6px;" />
          </label>
          <button id="updateNameBtn" class="button button-secondary">Save name</button>
        </div>

        <div style="display: grid; gap: 8px; margin-top: 16px;">
          <label style="font-size: 0.95rem; color: var(--muted);">
            Your slug
            <input id="slugInput" type="text" value="${publicSlug}" maxlength="40" style="margin-top: 6px;" />
          </label>
          <button id="updateSlugBtn" class="button button-secondary">Save slug</button>
        </div>

        <div style="display: grid; gap: 8px; margin-top: 16px;">
          <p style="font-size: 0.95rem; color: var(--muted); margin: 0;">Profile links</p>
          <label style="font-size: 0.85rem; color: var(--muted);">
            Portfolio
            <input id="portfolioInput" type="url" value="${portfolio}" placeholder="https://example.com" style="margin-top: 4px;" />
          </label>
          <label style="font-size: 0.85rem; color: var(--muted);">
            GitHub
            <input id="githubInput" type="url" value="${github}" placeholder="https://github.com/username" style="margin-top: 4px;" />
          </label>
          <label style="font-size: 0.85rem; color: var(--muted);">
            LinkedIn
            <input id="linkedinInput" type="url" value="${linkedin}" placeholder="https://linkedin.com/in/username" style="margin-top: 4px;" />
          </label>
          <button id="updateLinksBtn" class="button button-secondary">Save links</button>
        </div>

        <p class="reference-confirmation">${references.length} confirmed reference${references.length === 1 ? "" : "s"}</p>
        <a href="/${publicSlug}" target="_blank" rel="noreferrer">Public profile</a>
      </div>
    `;

    document.getElementById("updateNameBtn").addEventListener("click", async () => {
      const btn = document.getElementById("updateNameBtn");
      const newName = document.getElementById("nameInput").value.trim();
      if (!newName) {
        authStatus.textContent = "Name cannot be empty.";
        return;
      }
      try {
        btn.disabled = true;
        btn.textContent = "Saving name...";
        await updateUserName(user.uid, newName);
        btn.textContent = "Name updated!";
        authStatus.textContent = "Name updated!";
        setTimeout(() => {
          btn.textContent = "Save name";
          btn.disabled = false;
          authStatus.textContent = `Signed in as ${user.displayName || user.email}`;
        }, 2000);
      } catch (error) {
        console.error(error);
        authStatus.textContent = getFriendlyErrorMessage(error);
        btn.textContent = "Save name";
        btn.disabled = false;
      }
    });

    document.getElementById("updateSlugBtn").addEventListener("click", async () => {
      const btn = document.getElementById("updateSlugBtn");
      const newSlug = document.getElementById("slugInput").value.trim();
      if (!newSlug) {
        authStatus.textContent = "Slug cannot be empty.";
        return;
      }
      try {
        btn.disabled = true;
        btn.textContent = "Saving slug...";
        await updateUserSlug(user.uid, newSlug);
        btn.textContent = "Slug updated!";
        authStatus.textContent = "Slug updated!";
        setTimeout(() => {
          btn.textContent = "Save slug";
          btn.disabled = false;
          authStatus.textContent = `Signed in as ${user.displayName || user.email}`;
        }, 2000);
      } catch (error) {
        console.error(error);
        authStatus.textContent = getFriendlyErrorMessage(error);
        btn.textContent = "Save slug";
        btn.disabled = false;
      }
    });

    document.getElementById("updateLinksBtn").addEventListener("click", async () => {
      const btn = document.getElementById("updateLinksBtn");
      const portfolio = document.getElementById("portfolioInput").value.trim();
      const github = document.getElementById("githubInput").value.trim();
      const linkedin = document.getElementById("linkedinInput").value.trim();

      try {
        btn.disabled = true;
        btn.textContent = "Saving links...";
        await updateUserLinks(user.uid, { portfolio, github, linkedin });
        btn.textContent = "Links updated!";
        authStatus.textContent = "Links updated!";
        setTimeout(() => {
          btn.textContent = "Save links";
          btn.disabled = false;
          authStatus.textContent = `Signed in as ${user.displayName || user.email}`;
        }, 2000);
      } catch (error) {
        console.error(error);
        authStatus.textContent = getFriendlyErrorMessage(error);
        btn.textContent = "Save links";
        btn.disabled = false;
      }
    });
  }
}

signInBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    await ensureUserDocument(result.user);
  } catch (error) {
    authStatus.textContent = getFriendlyErrorMessage(error);
  }
});

signOutBtn.addEventListener("click", async () => {
  try {
    await signOutIfNeeded();
    createdLink.classList.add("hidden");
    createdLinkValue.textContent = "";
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
    createdLink.classList.remove("hidden");
    createdLinkValue.textContent = result.link;
    createdLinkValue.href = result.link;
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
    renderSignedOut();
    return;
  }

  try {
    await ensureUserDocument(user);
    await renderSignedIn(user);
  } catch (error) {
    console.error(error);
    authStatus.textContent = getFriendlyErrorMessage(error);
  }
});
