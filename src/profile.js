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

  profileState.innerHTML = `
    <div>
      <h1>${user.name}</h1>
      ${references.length > 0 ? `<div>${refList}</div>` : '<p class="muted">No confirmed references yet.</p>'}
    </div>
  `;
}

render().catch((error) => {
  profileState.innerHTML = `<p class="muted">${error.message || "Could not load profile."}</p>`;
});
