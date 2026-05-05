import { auth, onAuthStateChanged } from "./firebase.js";
import { getReferences, getUserBySlug, updateReference, deleteReference } from "./data.js";

function getSlug() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  if (slug) return slug;

  const segments = window.location.pathname.split("/").filter(Boolean);
  return segments[0] || "";
}

const profileState = document.getElementById("profileState");
let currentUser = null;
let profileUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (profileUser) render();
});

async function render() {
  const slug = getSlug();
  if (!slug) {
    profileState.innerHTML = '<p class="muted">Missing profile slug.</p>';
    return;
  }

  profileUser = await getUserBySlug(slug);
  if (!profileUser) {
    profileState.innerHTML = '<p class="muted">Profile not found.</p>';
    return;
  }

  const isOwnProfile = currentUser && currentUser.uid === profileUser.id;
  const references = await getReferences(profileUser.id);

  const refList = references
    .map((ref) => {
      const year = ref.createdAt?.toDate?.().getFullYear?.() || new Date().getFullYear();
      return `
    <div class="reference-item" id="ref-${ref.id}" style="position: relative;">
      <p class="reference-name">${ref.fromUserName || "Anonymous"}</p>
      <p class="reference-position">${ref.position}</p>
      <p class="reference-confirmation">✔ Confirmed ${year}</p>
      ${isOwnProfile ? `
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button class="ref-edit-btn" data-ref-id="${ref.id}" data-position="${ref.position.replace(/"/g, "&quot;")}" style="padding: 4px 8px; font-size: 0.85rem; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer;">Edit</button>
          <button class="ref-delete-btn" data-ref-id="${ref.id}" style="padding: 4px 8px; font-size: 0.85rem; background: #d32f2f; color: white; border: none; border-radius: 4px; cursor: pointer;">Hide</button>
        </div>
      ` : ""}
    </div>
  `;
    })
    .join("");

  const linksHTML = (profileUser.portfolio || profileUser.github || profileUser.linkedin)
    ? `<div style="display: flex; gap: 16px; margin: 16px 0;">
        ${profileUser.portfolio ? `<a href="${profileUser.portfolio}" target="_blank" rel="noreferrer" style="color: var(--text); text-decoration: none; font-weight: 500;">Portfolio ↗</a>` : ""}
        ${profileUser.github ? `<a href="${profileUser.github}" target="_blank" rel="noreferrer" style="color: var(--text); text-decoration: none; font-weight: 500;">GitHub ↗</a>` : ""}
        ${profileUser.linkedin ? `<a href="${profileUser.linkedin}" target="_blank" rel="noreferrer" style="color: var(--text); text-decoration: none; font-weight: 500;">LinkedIn ↗</a>` : ""}
      </div>`
    : "";

  profileState.innerHTML = `
    <div>
      <h1>${profileUser.name}</h1>
      ${linksHTML}
      <h2 style="margin-top: 32px; font-size: 1.2rem;">References</h2>
      ${references.length > 0 ? `<div>${refList}</div>` : '<p class="muted">No confirmed references yet.</p>'}
    </div>
  `;

  if (isOwnProfile) {
    document.querySelectorAll(".ref-edit-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const refId = btn.getAttribute("data-ref-id");
        const oldPosition = btn.getAttribute("data-position");
        const newPosition = prompt("Edit position:", oldPosition);
        if (newPosition !== null && newPosition.trim()) {
          try {
            await updateReference(refId, newPosition);
            render();
          } catch (error) {
            alert("Error updating reference: " + error.message);
          }
        }
      });
    });

    document.querySelectorAll(".ref-delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const refId = btn.getAttribute("data-ref-id");
        if (confirm("Hide this reference?")) {
          try {
            await deleteReference(refId);
            render();
          } catch (error) {
            alert("Error hiding reference: " + error.message);
          }
        }
      });
    });
  }
}

render().catch((error) => {
  profileState.innerHTML = `<p class="muted">${error.message || "Could not load profile."}</p>`;
});
