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
  profileState.innerHTML = `
    <div class="stack">
      <p class="reference-name">${user.name}</p>
      <p class="reference-position">${references[0]?.position || "Reference pending"}</p>
      <p class="reference-confirmation">${references.length ? "✔ Mutual confirmation" : "No confirmed reference yet"}</p>
    </div>
  `;
}

render().catch((error) => {
  profileState.innerHTML = `<p class="muted">${error.message || "Could not load profile."}</p>`;
});
