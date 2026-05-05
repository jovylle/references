# Reference System

Static frontend for a Google-authenticated reference request flow using Firebase Auth and Firestore.

## Files

- `index.html` main request creation app
- `confirm.html` approval page
- `profile.html` public profile page
- `src/firebase-config.js` place your Firebase config here
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