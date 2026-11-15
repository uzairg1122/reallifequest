# Invite your child and Share App

These are separate actions:

| Action | Location | Recipient outcome |
| --- | --- | --- |
| Invite your child / Invite another child | Parent dashboard and Children | Opens a private, one-time family invitation; child confirms their profile/PIN and joins the inviting parent's family. |
| Share App | Settings, preferably parent-facing | Shares the public store listing; recipient starts their own account or uses a separately supplied family code. No private invite token is included. |

The large first-child invitation card is now shown only when no child has joined. Once the family response contains a child, a compact button remains beside Your children, with another in Children. Merely creating an invitation does not hide onboarding. The membership check survives reload and follows server state.

## Recommended Android link flow (planned, not implemented)

Use a stable HTTPS URL on the production domain for invitations. Register and verify Android App Links for that domain, handle both cold-launch and already-running app URLs, validate the invite and open the join screen. Never sign out an existing account or join another family silently.

If the app is installed and the OS permits verified-link handling, the invitation opens in the app. Without the app, the same URL opens a small invitation landing page with Get it on Google Play, a copyable invitation code, and optionally Continue in browser. The website does not reliably know whether the app is installed; do not promise automatic install detection.

The Play Store install link can carry an opaque invite token in its encoded referrer parameter. Integrate Google Play Install Referrer in the Android app to recover it on first launch and resume the join flow. This requires native integration; a store link alone will not preserve the invitation. Retain the six-digit-code/reopen-link fallback. Current invite expiry is 24 hours, one use; installation does not extend validity. Server-side checks remain authoritative.

Use a public Play Store listing for Share App after publication. Never copy `location.href` for general sharing because it may contain a private invitation. Share App must not create a family invite.

## Current source findings

- Android application ID: com.reallifequest.app (capacitor.config.ts).
- AndroidManifest.xml currently has MAIN/LAUNCHER only; no verified HTTPS App Links filter.
- Existing invitation UI constructs URLs from location.origin and /?invite=. Native packaged builds need an explicit public web origin; localhost is not a shareable production domain.
- Web joins parse the invite from the initial URL. Native cold/warm launch handling and Install Referrer are not present.
- No confirmed published Play Store listing, production link host or Play app-signing SHA-256 certificate has been provided. Do not invent these or ship a nonfunctional store link.

## Release prerequisites

Confirm the public HTTPS domain, Play Store listing/package and Play app-signing certificate fingerprint. Publish /.well-known/assetlinks.json for the real package/signing certificate, add the Android intent filter and native URL routing, and implement the landing page/install-referrer handoff. Test installed/not-installed, expired/used invites, canceled installation, existing sessions, browser/WhatsApp link handling and parent versus child roles on a signed Android build.

Official references:
- https://developer.android.com/training/app-links/about
- https://developer.android.com/training/app-links/verify-applinks
- https://developer.android.com/google/play/installreferrer
