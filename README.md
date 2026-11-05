# Fitness&Fuel

A responsive personal fitness journal built with React, TypeScript, and Vite. Food, training, and progress with Google sign-in, private automatic cloud saving, and emergency Excel backups. Designed for phones, tablets, and laptops.

**Cloud configuration is required before Google sign-in works.** Follow [CLOUD_SETUP.md](CLOUD_SETUP.md). Before sign-in, the app shows a read-only, fictional two-week demo. Signing in opens the account's own cloud journal; demo records are not imported automatically.

## Run

Node.js 22.12+ and npm are required (developed with Node 22.20).

```sh
npm install
npm run dev -- --host 0.0.0.0
```

Open the local URL printed by Vite. To try a phone or tablet, connect it to the same network and use Vite's Network URL. Windows Firewall and network isolation may prevent access; do not disable your firewall. The dev server is for trusted local-network testing, not public hosting.

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

The local browser tests start an isolated Vite server on `127.0.0.1:5180`, without reusing other apps. Screenshots and failure traces are saved under `test-results`. Cloud browser tests use port 5181 and local Firebase emulators. See the setup guide for Java and test commands. Run `npm run format` to format source files.

## Publish Source To GitHub

The [.gitignore](.gitignore) excludes local environment files, `.firebaserc`, common credential files, private journal exports, backup archives, dependencies, compiled output, logs and test artifacts. Commit [.env.example](.env.example) with empty values, not `.env.local`. Keep exports with custom filenames outside this repository or inside the ignored `backups` directory. Do not upload the whole project as a ZIP: Git ignore rules do not filter an archive.

All `VITE_` values are embedded in the public website. Firebase web API keys and project identifiers are public client configuration, not secrets that can be hidden from visitors. Never put service-account credentials, OAuth client secrets or other private tokens in frontend code or a `VITE_` variable. Data protection depends on Firebase Authentication and the deployed [firestore.rules](firestore.rules), not on hiding the web API key. Verify the live rules separately before using real journal data.

Create an empty GitHub repository and choose its visibility deliberately. A private repository is a conservative starting point. Replace the placeholders below with your public commit name, the exact GitHub noreply address shown in GitHub Settings > Emails, and your repository URL. These identity settings apply only to this local repository.

```sh
git init -b main
git config user.name "YOUR_PUBLIC_COMMIT_NAME"
git config user.email "YOUR_GITHUB_NOREPLY_EMAIL"
git add --dry-run .
git add .
git diff --cached --stat
git diff --cached
```

Inspect the staged files before continuing. Do not commit local configuration, real health records, credentials or screenshots containing personal data. `.gitignore` cannot protect files already tracked by Git. If a real secret was previously committed or published, revoke or rotate it and remove it from history; simply deleting the current file is insufficient.

After reviewing the staged content:

```sh
git commit -m "Initial Fitness&Fuel source"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Use Git Credential Manager's browser sign-in when prompted. Never embed a token in the remote URL or paste credentials into chat. A new clone needs `npm ci` and its own local Firebase configuration for sign-in; the demo works without it. GitHub source publication does not deploy Firestore rules or host the app. For Firebase CLI commands, pass `--project YOUR_PROJECT_ID` explicitly because `.firebaserc` is intentionally local.

## Included

- Google sign-in and private per-account Firestore journals. Submitted adds, edits and deletes save automatically; connected devices update through listeners. Saves must be acknowledged by the server. Stale edits are rejected instead of silently overwriting newer records.
- Optional import of the existing browser journal with explicit account confirmation; originals stay intact. Import can be skipped and reopened from Settings.
- Emergency Excel download, optional Gmail send-only consent to email a backup to yourself, and validated merge restore with conflict previews and retry-safe batches.
- Food diary: calories, protein, carbs, fat, fiber, and total sugar; grams, milliliters, and defined servings; meal date/time; custom categories; favorites; copy meals or days; edit and delete entries.
- Food and exercise libraries: manual definitions, reusable selections, and archival without changing past logs.
- Completed workout logs: ordered exercises, reps and kg per set, optional RPE, duration, manual calories burned, exercise/session notes, and reusable routine templates.
- Daily goals with effective dates; dated body-weight measurements.
- Daily overview and weekly, monthly, custom-range, and all-time reports; prior-period comparisons; exercise load, reps, and external-load volume.
- A read-only fictional two-week demo before sign-in. Signed-in users can explicitly load sample records from the empty overview or Settings; those imports are added only once and do not overwrite existing records. Demo nutrition values are illustrative, not a reference food database.
- An orange-accented palette with green daily-goal rings and bar charts, off-white light surfaces, and softened neutral charcoal dark surfaces. Dark is the default, independent of device appearance; saved preferences are respected. The header switch toggles light/dark; Settings includes light, dark, and system preferences. The choice persists in this browser.

## Food Directory

Open **Food directory** (`/food-directory`) for the 60-entry starter catalog and **My foods** for your own library. Search by name, filter by group/preparation, add individual starters or merge the complete starter list, and create, edit, favorite, archive or restore your own foods. Foods saved here are immediately available in the food diary and existing Library page. Sign-in is required for personal changes; browsing and exporting starters does not require an account.

The project-owned database is [src/data/foods/starter.ts](src/data/foods/starter.ts). It includes fruits, vegetables, chicken, fish, goat/sheep mutton (boneless and bone-in), raw/cooked variants, eggs prepared several ways, rice and legumes. Every entry has calories, protein, carbs, fat, fiber, sugar, a 100 g basis, serving equivalent, group, preparation and source/portion notes. These are approximate generic reference values, not a certified nutrition dataset or individually verified FoodData Central records. Cuts, recipes, added fats and cooking yields vary; use package labels or a verified reference for precise tracking. Raw entries are nutrition references, not consumption recommendations.

All weights are **edible portions** in the listed preparation: bone-in entries require bone weight to be removed before logging. No fixed bone percentage or raw-to-cooked conversion is assumed. Goat and sheep are distinct foods, and egg shell weight is excluded. Fried/scrambled/omelet entries are generic recipe estimates, with cooking fat included.

**Export my food DB** downloads a versioned JSON file containing all personal foods, including archived entries, favorites and metadata. **Import food DB** validates that file and previews missing, identical and conflicting records before merging. Existing conflicts are retained by identifier; diary/workout records are never imported through this food-only action. Imported ownership is always reassigned to the signed-in user. Retry an interrupted merge; completed batches and stable food IDs avoid duplicate foods. These unencrypted files can intentionally be shared with another user. Maximum file size is 20 MB.

The normal **Settings > Download Excel backup** also includes the complete personal food library and its metadata automatically. Its existing restore flow restores foods alongside the rest of the journal. No second database or separate backup step is required. Deploy the updated [firestore.rules](firestore.rules) before using the new metadata fields against a live Firebase project.

## Two-Week Test Data

The inspectable fixture is [public/data/two-week-demo.json](public/data/two-week-demo.json). It contains 14 consecutive source dates (October 20 through November 2, 2026), 9 food definitions, 3 reusable meal plans expanded into 118 food entries, 4 exercises, 2 routines, 8 workouts, 14 body-weight measurements, and nutrition goals. All four meal categories are covered. One workout deliberately has no calorie-burn value.

Use **Settings > Load sample data** to populate the current journal. The importer shifts the dates so the last day is today. Use the selected-date control or custom report ranges to inspect older days. **Download two-week JSON** downloads the same checked-in fixture; its source dates are not changed by importing.

Pure `expandDemo` calculations are shared by local and cloud imports. Local `DemoDataService` uses one IndexedDB transaction. Cloud imports persist a stable plan and use resumable batches with account-scoped markers. Existing goals and same-day weights are preserved. Older 21-day demo records are also preserved. Use a separate browser profile for an isolated test rather than deleting personal records.

## Preserved Version

The original source, styles, tests, configuration, and lockfile were saved before the refactor in [backups/form-and-fuel-before-refactor-20261102-122753.zip](backups/form-and-fuel-before-refactor-20261102-122753.zip). The archive was verified. It excludes dependencies, generated build/test output, and browser data.

To compare the old implementation, extract the archive into a separate directory, run `npm ci`, then `npm run dev -- --port 5174`. Do not extract it over this project. The other port uses a separate browser storage origin. This source snapshot is not an IndexedDB backup; the current app retains the database name and applies versioned upgrades.

## Data Rules

When configured and signed in, Firestore is the source of truth at `users/{uid}/...`. Authentication determines ownership, and server rules isolate users. The app uses memory-only Firestore caching and online transactions, not a persistent offline journal or queued offline saves. Signing out unmounts account editors, stops listeners and discards the app's in-memory journal. Firebase maintains its own sign-in session; do not use a shared browser account for private health records.

The original IndexedDB database (`fitness-tracker`) is retained as a local import/export source. Clearing site data deletes that local copy. Different browsers, origins, devices, and ports have separate local stores. A configured cloud failure never silently falls back to browser-local saving.

Excel backups contain the full journal, including historical snapshots, six nutrients, archived records, category ordering and nested workout occurrence/set IDs. Readable sheets are for inspection; a versioned canonical payload preserves exact values for restore. SHA-256 detects corruption, not authenticity. Backups are not encrypted. Do not modify workbook sheets; keep your downloaded file private. Limits: 20 MB workbook/payload, 64 MB expanded ZIP, 50,000 records, 200 KB per record and 500 exercise occurrences per session.

Restore adds missing records, skips identical entries, and reports conflicts while keeping the current records. Chunks of up to 100 records are atomic and resumable, but the whole import is not globally atomic. Retry the same file after an interruption. Previously completed import chunks are not replayed; explicitly choose the restore-deleted-records option to start a fresh operation. All imported records belong to the currently signed-in account, regardless of the source identity in the file. Pause edits on other devices during resets or large restores.

Backups cover only the export time. Gmail API acceptance is not proof of delivery; after a timeout check Sent before retrying. Permission denial, missing Gmail service or send failure leaves the prepared download available. Normal cloud updates do not depend on exporting. Neither Firebase nor manual backups guarantee zero data loss.

Food and exercise snapshots preserve history when library definitions change. Editing a logged food quantity recalculates from its recorded nutrition basis, not the current library entry. Copying entries appends independent records to the selected date. Cloud retries of the same source revision/date are idempotent. Mass and volume are never implicitly converted; serving equivalents must be defined.

Sugar is total sugar in grams (part of carbs, not added to carbs or calories again). Version 2 adds missing sugar values as 0 to existing foods, meal nutrition/basis snapshots, and goals, preserving every other recorded value. For old records, 0 is a compatibility default, not proof that the food is sugar-free. Edit catalog foods and goals to supply known values; historical snapshots remain unchanged. Fresh sample imports include illustrative sugar values and a fictional goal, not a dietary recommendation. Already-imported sample history is not overwritten.

Weeks start on Monday and diary dates use the device's local calendar. Missing food days are not assumed to be fasting; averages are per logged day. Incomplete weeks/months compare against equivalent elapsed portions of the previous period. Full periods compare in full. Custom ranges compare to the immediately preceding equal-length range. All-time reports have no prior-period comparison.

Gym calorie values are manually recorded, may be unknown, and never increase nutrition targets. They are not total daily energy expenditure. Lifting volume is the sum of reps multiplied by external load; zero-load/bodyweight sets do not estimate body weight lifted. Routines are templates and only saved workout sessions contribute to reports.

## Structure

- `src/app/`: application entry, workspace shell, navigation, and error boundary.
- `src/domain/`: separate nutrition, training, profile, and reporting models and pure calculations.
- `src/data/database.ts`: the `FitnessDatabase` class and versioned IndexedDB schema, including the sugar upgrade.
- `src/data/repository.ts`: validated persistence operations; `src/data/hooks/` contains the React query hook.
- `src/data/cloud/`: Firebase client, scoped repository, live subscriptions, revision transactions and emulator tests.
- `src/data/backup/`: journal validation, Excel codec, legacy snapshot reads and self-addressed Gmail MIME/API support.
- `src/features/auth/`: Google sign-in, account lifecycle and optional local import.
- `src/data/demo/`: fixture validation, injectable `DemoDataService` class, loader, and tests.
- `src/features/`: feature pages and dedicated editor components. `WorkoutExerciseEditor` is shared by workout and routine editing.
- `src/shared/ui/`, `src/shared/hooks/`, `src/shared/utils/`, `src/shared/charts/`: reusable controls, action state, formatters, and charts.
- `src/theme/`: persisted preferences, system-theme subscription, provider, and controls.
- `src/styles/`: semantic light/dark tokens, base styles, app shell, shared controls, and per-feature styles. `index.css` declares the import order.
- `public/data/`: the downloadable two-week JSON fixture.
- `src/domain.test.ts`, `src/data/demo/DemoDataService.test.ts`, `tests/fitness.spec.ts`, `tests/themes.spec.ts`: domain, import, functional, responsive, and theme checks.

Classes are used for stateful database/import services; React UI remains functional components, and calculations remain pure functions. Add theme colors in `src/styles/tokens.css` instead of feature components. Small index files provide stable module entry points.

## Deferred

Email/password login, phone/SMS OTP, and public/private catalog sharing are not implemented. Google account recovery remains Google's responsibility. Phone SMS requires a billing-enabled Firebase plan and is intentionally excluded from the free-only setup.

Offline/PWA support, automatic Drive backups, barcode scanning, external nutrition APIs, wearable integrations, automatic calorie estimates, and live workout timers are not included. Browser-local persistence alone does not make the app available offline.

## Visual Assets

Fonts are bundled locally through Fontsource (Source Sans 3 and Manrope). Icons use Lucide. The locally stored illustrative [gym thumbnail](https://images.unsplash.com/photo-1534438327276-14e5300c3a48) originates from Unsplash, under the [Unsplash license](https://unsplash.com/license). It is not a user-uploaded photo or an exercise instruction.
