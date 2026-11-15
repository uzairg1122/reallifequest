# Current architecture — Android + Hostinger shared hosting

Confirmed by the owner on 9 November 2026: Android frontend bundled inside the APK/AAB; PHP API, MySQL database, private photo proof and family history on Hostinger shared Web Hosting. Parents sign in with Google; kids keep family code + name/PIN. No VPS, Node server, Firebase Functions, Firestore or Firebase Storage is required for this edition. The existing NomoLabs marketing website stays on Vercel.

## How login works

Android Credential Manager opens Google's native account chooser. The app sends a short-lived Google ID token and a server-issued nonce over HTTPS to the PHP backend. PHP checks Google's signature, expiry, audience, issuer, verified email and nonce, then uses the stable Google subject to find/create the parent in MySQL and issue the app session. Returning sign-in retains the same family/history. The app never receives a Google password.

There is no parent email/password registration, password change or app password reset in the Hostinger build. Google account recovery is at https://accounts.google.com/signin/recovery. Child PIN reset stays under the primary parent's account controls. Sensitive account/family deletion requires fresh Google verification. New co-parents join using a one-use invitation plus their own Google account, without creating a duplicate family. Older email/password-only accounts are not automatically merged by matching an email; arrange a verified migration if any real legacy data must be kept.

The Google Cloud/Firebase project already registered can supply Google OAuth clients. Its Web OAuth client ID is a public identifier used as the PHP token audience and native server client ID. This flow does not use Firebase Authentication sessions or store application records in Firebase. There is no need to upgrade Firebase billing/Blaze. Existing Firebase resources have not been deleted. The previous FIREBASE-SETUP.md is superseded; its deployment command was removed from active package scripts.

## Proposed addresses (not live yet)

- Main website: `https://nomolabs.pro` → Vercel, unchanged.
- App PHP API: `https://api.nomolabs.pro/api` → Hostinger shared hosting.
- Public policy/invite pages: `https://api.nomolabs.pro/real-life-quest` → the same Hostinger site. These are supporting pages, not the app frontend.

DNS was inspected read-only: no `api` record existed at that time. Do not replace the root `@`, `www`, nameservers or mail records. The existing FTP record is not sufficient proof of the hosting server's current IP. Confirm the server IP in hPanel before adding an `api` A record.

## Hostinger owner steps — one screen at a time

1. hPanel → Websites → add/configure a **Custom PHP/HTML** site for `api.nomolabs.pro` on the existing Web Hosting plan. If the root domain already has a Hostinger site entry, the subdomain option may be available in that dashboard; otherwise add the subdomain as its own site. Do not move the Vercel marketing site or change root DNS. Verify the chosen site's document root and server IP.
2. Point only DNS name `api` to that confirmed Hostinger server IP. Wait for DNS and enable Hostinger SSL for that subdomain.
3. Create a dedicated MySQL database/user in hPanel. Keep the database password private; set it directly in `api/config.php`, copied from `api/config.example.php` on the server. Preserve `parent_auth_mode => google`, the supplied Web client ID, allowed native origin `https://localhost`, and the actual public app URL.
4. In phpMyAdmin, **new empty DB only:** import `database/schema.sql`, then migrations003 through010 in order. Existing databases: back up first and apply only missing migrations; never import base schema over live data.
5. Extract the package's `upload/` contents into the `api.nomolabs.pro` site's document root. It contains only the PHP `api/` folder and `real-life-quest/` supporting pages. Keep the package's `database/`, README, configs with credentials, dumps, keystores and local test files outside the public document root. No React dist upload is required: frontend assets belong in the Android package.
6. Use PHP8.1+ with PDO MySQL, mbstring, OpenSSL, cURL, outbound HTTPS/valid CA trust and `.htaccess` rewrite/deny rules. Set PHP post_max_size high enough for two compressed photos (at least8M). The Authorization header forwarding rule is included for shared-hosting PHP/FCGI.
7. Run `node scripts/check-production.mjs https://api.nomolabs.pro/api`, then verify actual Google sign-in, parent→child invite, photo submission/review, coins/XP, session restoration and Google-confirmed deletion on the hosting server. Health alone does not prove the full flow. Review policy wording before publishing, monitor support@nomolabs.pro, configure moderation operators and private backups/restore checks.

Photos are currently stored as private image data in MySQL and served only through authorized PHP API endpoints. They are not public photo URLs and do not go to Firebase. The review list is paged and proof is loaded separately. Watch database/storage capacity and backup size as history grows. No push notification service was added; in-app updates poll while open.

## Android and Google configuration

The current Google Web OAuth client ID is `771794282164-1c01eddpmelkubpeeoo5rdghh5mkqb0v.apps.googleusercontent.com` from project `real-life-quest-792fa`. It must match `google_client_id` in Hostinger config. No client secret or service-account private key belongs in the APK or package.

Configure an Android OAuth client in that same project for `com.reallifequest.app` and the actual debug signing SHA-1 during development; add Google Play's **app signing** SHA-1 for Play-installed builds. These are separate from the upload certificate. Configure OAuth branding/audience/verification as Console requires and test another Google account using the Play-installed app. Parent Google sign-in is native Android; no embedded WebView Google login is used.

After the backend is deployed and verified, copy `.env.hostinger.example` to ignored `.env.hostinger.local` (already prepared locally with proposed addresses), then:

```powershell
npm run build:hostinger
npx cap sync android
```

These build assets explicitly use PHP + Google-only parents, and produce release metadata for Gradle's guard. Build success does not establish that the proposed server is reachable. Use Android Studio to generate a signed release AAB after live tests. Do not upload a debug APK, localhost bundle or a Firebase-mode bundle. Keep signing passwords/backups private. Current code has not been independently installed/tested on a phone for this Hostinger-only change.

Publish `/.well-known/assetlinks.json` on `api.nomolabs.pro` with the Play app signing SHA-256 to enable verified invite links; the package includes a template outside the upload tree. Until configured, the landing page lets parents copy the six-digit code. Finish Play Internal/Closed testing, app access instructions, Data safety, target audience/Families declarations, privacy/deletion URLs and production access requirements. A Personal account may require 12 testers continuously for14days; follow its displayed Console requirements.

## Local continuity and limits

The previous local PHP database and device-only saves are preserved. Legacy local/audit configs keep their earlier auth mode so existing fixture tests can run. `build:hostinger` is the current production direction; the Firebase code remains inactive and is excluded from the hosting ZIP. No DNS mutations, live upload, billing upgrade or production data migration was done as part of preparation. Public availability, signed AAB, real phone Google login and deployment testing remain required.
