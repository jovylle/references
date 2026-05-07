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

