# Referly Theme Guide

Use this file as the source of truth for visual consistency.

## Where to set global theme

- Core design tokens live in `styles.css` under `:root`.
- This is where you set:
  - color scheme (`--bg`, `--text`, `--accent`, etc.)
  - typography (`--font-body`, `--font-heading`, weights)
  - spacing and shape (`--space-*`, `--radius-*`)
  - component tokens (`--external-icon-*`)

## Theme rules

- **Colors:** use CSS variables only; avoid hard-coded hex in components.
- **Typography:** body text uses `var(--font-body)`; headings use `var(--font-heading)`.
- **Spacing:** use the spacing scale (`--space-1` to `--space-7`) for gaps/margins/padding.
- **Corners:** controls use `--radius-control`; panels/cards use `--radius-panel`.
- **Links/icons:** use `external-link-icon` for outbound links to keep icon style consistent.

## Component styling locations

- Shared app styles: `styles.css`
- Home behavior and dynamic content: `src/index.js`
- Profile page rendering: `src/profile.js`
- Confirm page rendering: `src/confirm.js`

If you want a different brand look later, edit tokens in `:root` first before touching component CSS.
