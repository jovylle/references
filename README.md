# Reference System

Static frontend for a Google-authenticated reference request flow using Firebase Auth and Firestore.
<img width="1429" height="1283" alt="image" src="https://github.com/user-attachments/assets/241567e0-241a-4ac2-a431-5e268273d22c" />
<img width="413" height="480" alt="image" src="https://github.com/user-attachments/assets/5a1716d3-3461-461b-950f-a3bd790e51d3" />
<img width="876" height="749" alt="image" src="https://github.com/user-attachments/assets/2ec38d48-af0d-451b-aeb6-31f8b6ee3398" />

## Quick Local Development

- Use Netlify local dev so pretty routes (like `/<slug>`) work:
  - `npx netlify dev --port 8888`
- Open `http://localhost:8888`
- Avoid `python -m http.server` for route testing; it does not apply `_redirects`.





## Files

- `index.html` main request creation app
- `confirm.html` approval page
- `profile.html` public profile page
- `styles.css` global design tokens and shared styling
- `THEME_GUIDE.md` theme rules and where to edit colors/fonts/components
- `src/firebase-config.js` place your Firebase config here
- `src/ui.js` shared HTML template functions (account controls/footer links)
- `firestore.rules` Firestore security rules

## Setup

1. Create a Firebase project.
2. Enable Google sign-in in Firebase Authentication.
3. Create Firestore.
4. Paste your Firebase config into `src/firebase-config.js`.
5. Deploy the static files to Netlify.

## Routes

- `/` app home
- `/confirm.html?token=...` request confirmation
- `/<slug>` public profile

## UI Notes (for future AI chats)

- Shared UI structure now lives in `src/ui.js`.
  - `accountControlsTemplate(...)`
  - `renderFooterLinks(...)`
- Home (`src/index.js`) and confirm (`src/confirm.js`) both render account controls from the same template module.
- Global theme should be edited in `styles.css` `:root` tokens first, then component classes.

