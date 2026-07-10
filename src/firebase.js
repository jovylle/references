import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app-check.js";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { firebaseConfig, recaptchaSiteKey } from "./firebase-config.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// App Check is opt-in: skip gracefully until a real reCAPTCHA v3 site key is configured
// (see ENVIRONMENT.md for the setup steps), so this doesn't break local/dev usage.
if (recaptchaSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
// Explicitly limit OAuth scopes to email only.
// setCustomParameters({ scope }) overrides Firebase's default which includes 'profile'
// (name + photo). Without 'profile', the Google consent screen only asks for email.
provider.setCustomParameters({ scope: "openid email" });
export const db = getFirestore(app);

export {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onAuthStateChanged,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  signInWithPopup,
  signOut,
  updateDoc,
  where,
};
