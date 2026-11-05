# Google Accounts And Free Cloud Setup

The application code is implemented, but this repository does not contain an active Firebase project or live Google credentials. Provider setup must be completed by the project owner. Never put service-account JSON, private keys, OAuth client secrets, passwords or SMTP credentials in this frontend or in chat.

## Keep Billing Disabled

Use Firebase **Spark**, a Standard Firestore database and static Firebase Hosting. Do not upgrade to Blaze, link a billing account, enable SMS authentication, or provision Cloud Functions, App Hosting, paid backups/PITR, or Cloud Storage uploads for this app.

Free quotas are finite. Firestore currently includes 1 GiB storage, 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day and 10 GiB outbound/month for one eligible database. With billing disabled, quota exhaustion can interrupt service. Fewer than ten users does not guarantee staying within quota. Review the current [Firestore quotas](https://firebase.google.com/docs/firestore/quotas) and [Hosting allowances](https://firebase.google.com/docs/hosting/usage-quotas-pricing) before provisioning.

The app subscribes to complete histories rather than silently truncating reports. Opening another device/tab and full exports read records again. Each committed mutation also writes the account revision. Watch Firebase usage, especially as history grows. For a private group, consider restricting the `own` function in the rules to your explicitly approved email addresses before publishing the URL.

## Firebase Console

1. Create a project at [Firebase Console](https://console.firebase.google.com/), keeping the Spark plan. Analytics is not required.
2. Register a web app. Obtain its public `apiKey`, `authDomain`, `projectId` and `appId`. Firebase web configuration is public identification, not an authorization secret.
3. Enable Authentication > Google. Choose a support email. Do not enable phone authentication.
4. Create the default Firestore database in **Standard edition**, choosing its region deliberately before confirmation. A nearby supported India region may be appropriate; region choices affect latency and cannot simply be changed afterward. Begin with locked/production rules.
5. Add `localhost`, `127.0.0.1` for emulator/local testing where appropriate, and the actual hosted domain to Authentication > Authorized domains. New projects may not authorize localhost automatically.
6. Create `.env.local` using the keys in [.env.example](.env.example). Set all four Firebase values and keep `VITE_FIREBASE_EMULATORS=false`. Restart Vite after changes. This file is ignored by Git, but all `VITE_` values are compiled into the public bundle.

Example structure, with your own public values:

```dotenv
VITE_FIREBASE_API_KEY=your-public-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_APP_ID=your-web-app-id
VITE_FIREBASE_EMULATORS=false
```

Deploy the rules before using live data. These commands do not create a database or upgrade billing:

```sh
npx firebase login
npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
npm run build
npx firebase deploy --only hosting --project YOUR_PROJECT_ID
```

Authenticate directly in the browser opened by the Firebase CLI. Do not send tokens or credentials to this assistant. Review the target project before deploying. Static Hosting uses the existing [firebase.json](firebase.json) and `dist`; do not initialize a paid backend.

Use the hosted HTTPS URL for phones and production OAuth. Plain HTTP LAN IP addresses are not a production Google sign-in solution. All users use the same Firebase project but see only their own UID-scoped journal. Other signed-in users cannot read those records under the supplied rules; the Firebase project operator still has administrative access. This is not end-to-end encryption.

## Optional Gmail Backup Permission

Basic Google sign-in does **not** request Gmail access. Only **Export & email to me** asks for `https://www.googleapis.com/auth/gmail.send` through account-matched reauthentication. It never asks for inbox-reading, drafts, Drive access, SMTP passwords or an app-owned mail service.

1. In the same Google Cloud project, enable the Gmail API. Do not accept an unexpected billing requirement; direct Excel downloads work without Gmail.
2. Configure Google Auth Platform/OAuth consent for the Google client used by Firebase, including the correct app name, support email, authorized domains and developer contact.
3. For testing, add the actual Google accounts as test users. For external production use, follow Google's sensitive-scope verification requirements. Having fewer than ten users is not a blanket exemption. Testing-mode permissions and Google policies can impose expiration or access restrictions.
4. Before publishing broadly, provide a real HTTPS privacy policy and support contact explaining Firebase journal storage, local originals, optional self-addressed Gmail backups, retention/deletion, and Google's Limited Use requirements. This repository does not invent an operator identity or legal policy for you.
5. Sign in with a Gmail-enabled Google account and explicitly consent to a test export. Verify the sender, recipient and attachment in Sent and Inbox, then download and restore the attachment into a separate test account. No real email has been sent by the automated tests.

The short-lived Gmail access token is held only for the current action. The generated artifact stays available for download when permission or sending fails. API acceptance is not confirmed delivery; after an ambiguous network failure, check Sent before sending another copy. Gmail sending/attachment limits and current provider policies apply. See [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) and [sending messages](https://developers.google.com/workspace/gmail/api/guides/sending).

## Existing Browser Data And Recovery

- On first sign-in, meaningful local data is offered for explicit import. Confirm the destination account. Skip does not delete or upload anything.
- Reopen the preview in Settings > Review existing browser data. An association marker suppresses unsolicited offers to another account; an explicit review still allows an intentional import.
- Local originals remain in the same browser/origin. A different port cannot see them. Use the original origin to export the old journal if needed.
- Downloaded Excel files contain private health data and are not encrypted. Keep a copy outside both Firebase and Gmail.
- Restore requires Firebase availability and a current sign-in. Readable sheets are not an editing/import template. Invalid formats, duplicate IDs/dates, formulas, oversized input and checksum failures are rejected before cloud writes.
- Merge keeps current conflicts. Large operations commit in batches; retry the same backup to resume. Use the explicit fresh-restore option only to resurrect records deleted after an earlier completed import.
- Clearing the cloud journal removes account records and import metadata in batches, then recreates the four standard categories. It does not delete the Google/Firebase Auth identity, root journal revision or old local browser data. Signing out deletes none of these.

## Tests And Tooling

Verification on November 5, 2026: 17 unit tests, 4 Firestore emulator tests, 20 local browser tests and 3 cloud browser tests passed. Build, typecheck and lint passed; the production dependency audit reported zero vulnerabilities. The full development-tool audit still reports 15 moderate advisories in Firebase CLI transitive dependencies, including glob, OpenTelemetry, re2 and uuid. These tools are not shipped in the browser bundle. Review and upgrade them with a compatible newer Node patch before relying on the CLI outside this trusted development workspace; do not run a broad forced downgrade. Firebase 12 is pinned for compatibility with the existing Node runtime, with targeted gRPC and ExcelJS uuid overrides.

Vite reports size warnings for the roughly 605 KB entry chunk and 940 KB optional Excel chunk (minified, before compression). Excel is loaded only for backup operations. Development mode also reports the existing public JSON fixture import warning; fixture and browser tests pass. Neither warning is a claim of failed saving or failed tests.

Node 22.12+ runs the app (developed on 22.20). Firestore emulator tests need Java 21. A portable runtime can be selected via `JAVA_HOME` and `PATH` without changing system Java. Current development-tool dependencies may require a newer Node patch release for all available security updates; review `npm audit` before distributing or upgrading tooling.

```sh
npm ci
npx playwright install chromium
npm test
npm run test:cloud
npm run test:e2e
npm run test:cloud:e2e
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

Run emulator suites one at a time; they share ports 8080/9099 and the reserved `demo-form-and-fuel` project. They do not use a live account or project. The separate [firebase.emulators.json](firebase.emulators.json) avoids a CLI rules-watcher startup race. It is **test-only**: its startup warning says rules are open until each suite's mandatory `initializeTestEnvironment` setup loads [firestore.rules](firestore.rules). A rule-load failure fails the suite before app clients run. Never use this test configuration for hosting or live data. The production deploy configuration always specifies the locked rules file.

`npm test` skips emulator-only cases when no emulator is running; run `test:cloud` explicitly. Cloud browser tests seed verified Google identities only inside the Auth emulator; this is not a production login bypass. They cover cross-client updates, account switching, offline write failure, workbook download/restore, cloud samples and explicit local migration. Gmail tests mock network requests and do not send mail.

Rules validate ownership, collection allowlists, revision changes, top-level fields, scalar types and nutrient values. Full nested workout/set validation, exact calendar-date validation and the stricter backup size limits are enforced by the application schema; Firestore rules do not recursively iterate arbitrary embedded exercise lists. Do not treat a manually edited Firebase document as a valid backup. Production Google consent, real Gmail delivery, physical devices and non-Chromium browsers still need live verification after setup.
