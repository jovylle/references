# Environment and Production Safety SOP

This project currently uses one online Firebase project for both live usage and team testing.
Because all writes hit production, safety depends on strict team discipline.

## 1) Project model

- `prod`: `referly-59bf0` (configured as both `default` and `prod` alias)
- no local database
- no separate online development project (for now)

## 2) Testing discipline policy

- Use test Google accounts only.
- Prefix all test-created values with `[TEST]` where possible.
- Never test with real personal or customer data.
- Clean test records from `requestsC` and `referencesC` on a regular schedule.

## 3) Deploy policy

- Test small changes with test accounts before broader use.
- Deploy Firestore rules/indexes only when needed.
- One designated deploy owner per release window.

Recommended command:

```bash
firebase deploy --project prod --only firestore:rules,firestore:indexes
```

## 4) Production security baseline

- Keep Firestore rules strict and explicit per collection.
- Keep writes authenticated and constrained by ownership checks.
- Enable App Check for production when ready.
- Keep only required Auth providers enabled.
- Restrict authorized domains to your real domains.

## 5) Monitoring and recovery

- Enable budget alerts for unusual usage spikes.
- Monitor read/write spikes and permission-denied anomalies.
- Keep backups enabled for production data.

## 6) Team release checklist

- [ ] Rules reviewed before deploy
- [ ] Test-account smoke test completed (sign in, create, confirm, profile)
- [ ] Test records marked and cleanup scheduled
- [ ] Firestore rules deployed to `prod`
- [ ] App Check and authorized domains reviewed

## 7) Security hardening checklist (requires Google Cloud / Firebase console access)

These steps require console access that isn't available in this environment, so they're
captured here as a precise checklist rather than applied directly. `src/firebase.js` already
has the App Check hook wired up (`initializeAppCheck` with `ReCaptchaV3Provider`) — it's a
no-op until `recaptchaSiteKey` in `src/firebase-config.js` is filled in, so completing step (a)
below is what actually turns it on.

**(a) Create the reCAPTCHA v3 key and wire it in**

- [ ] In [Google Cloud Console → reCAPTCHA Enterprise](https://console.cloud.google.com/security/recaptcha) (or the legacy [reCAPTCHA admin console](https://www.google.com/recaptcha/admin)), create a **v3** key scoped to the production domain(s) (and `localhost` for local dev, if desired).
- [ ] In Firebase Console → **App Check**, register the web app and select **reCAPTCHA v3** as the provider, pasting in the site key from the step above.
- [ ] Paste the same site key into `recaptchaSiteKey` in `src/firebase-config.js`.
- [ ] In Firebase Console → App Check, set Firestore to **Enforced** only after confirming real traffic is passing (check the App Check metrics tab first — enforcing too early will lock out all clients).
- [ ] Smoke test sign-in/create/confirm/profile flows after enforcement is turned on.

**(b) Restrict the Firebase Web API key by HTTP referrer**

- [ ] In [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials), find the API key matching `firebaseConfig.apiKey` in `src/firebase-config.js`.
- [ ] Under **Application restrictions**, choose **Websites** and add the production domain(s) (e.g. `https://yourdomain.com/*`), plus `http://localhost:8888/*` for local `netlify dev` testing if needed.
- [ ] Save, then smoke test sign-in from the production domain to confirm the restriction didn't break auth (Google Identity Toolkit calls use this same key).

**(c) Separate dev/staging Firebase project**

- [ ] Run `firebase projects:create referly-dev` (or similar) to create a second project.
- [ ] Enable Google sign-in + Firestore in the new project, matching the prod setup.
- [ ] Deploy the same `firestore.rules`/`firestore.indexes.json` to it: `firebase deploy --project dev --only firestore:rules,firestore:indexes`.
- [ ] Add a `dev` alias to `.firebaserc` pointing at the new project ID, alongside the existing `default`/`prod` aliases.
- [ ] Add a second config object to `src/firebase-config.js` (e.g. `firebaseConfigDev`) with the dev project's values, and branch `src/firebase.js` on `location.hostname` (e.g. `localhost`/a staging subdomain uses the dev config, everything else uses prod) so local/staging work never touches production data.
- [ ] Update `ENVIRONMENT.md` section 1 once this exists, and retire the "single cloud project" caveat.

