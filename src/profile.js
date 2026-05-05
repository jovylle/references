import { getReferences, getUserBySlug } from "./data.js";

function getSlug() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  if (slug) return slug;

  const segments = window.location.pathname.split("/").filter(Boolean);
  return segments[0] || "";
}

const profileState = document.getElementById("profileState");

async function render() {
  const slug = getSlug();
  if (!slug) {
    profileState.innerHTML = '<p class="muted">Missing profile slug.</p>';
    return;
  }

  const user = await getUserBySlug(slug);
  if (!user) {
    profileState.innerHTML = '<p class="muted">Profile not found.</p>';
    return;
  }

  const references = await getReferences(user.id);
  const refList = references
    .map((ref) => {
      const year = ref.createdAt?.toDate?.().getFullYear?.() || new Date().getFullYear();
      return `
    <div class="reference-item">
      <p class="reference-name">${ref.fromUserName || "Anonymous"}</p>
      <p class="reference-position">${ref.position}</p>
      <p class="reference-confirmation">✔ Confirmed ${year}</p>
    </div>
  `;
    })
    .join("");

  const linksHTML = (user.portfolio || user.github || user.linkedin)
    ? `<div style="display: flex; gap: 16px; margin: 16px 0;">
        ${user.portfolio ? `<a href="${user.portfolio}" target="_blank" rel="noreferrer" style="color: var(--text); text-decoration: none; font-weight: 500;">Portfolio ↗</a>` : ""}
        ${user.github ? `<a href="${user.github}" target="_blank" rel="noreferrer" style="color: var(--text); text-decoration: none; font-weight: 500;">GitHub ↗</a>` : ""}
        ${user.linkedin ? `<a href="${user.linkedin}" target="_blank" rel="noreferrer" style="color: var(--text); text-decoration: none; font-weight: 500;">LinkedIn ↗</a>` : ""}
      </div>`
    : "";

  profileState.innerHTML = `
    <div>
      <h1>${user.name}</h1>
      ${linksHTML}
      <h2 style="margin-top: 32px; font-size: 1.2rem;">References</h2>
      ${references.length > 0 ? `<div>${refList}</div>` : '<p class="muted">No confirmed references yet.</p>'}
    </div>
  `;
}

render().catch((error) => {
  profileState.innerHTML = `<p class="muted">${error.message || "Could not load profile."}</p>`;
});
