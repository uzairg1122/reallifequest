# Real Life Quest

A working 17-screen mobile app built from the supplied UI reference and product documents. React + TypeScript, packaged for Android with Capacitor 8. The supplied documents are preserved unchanged.

## Try it

```sh
npm install
npm run dev
```

Open http://localhost:5173. First select **I'm a Parent**, enter a hero name and create a 4–8 digit parent PIN. Under More → Settings → Switch to child, select **I'm a Kid**. Complete a quest, then return through Settings → Parent access to approve it.

This is the **local family edition**: one child, one device. Start with 0 coins and Level 1; sample routine quests are real playable tasks, not fabricated progress. The reference's 1,250 coins and Level 5 are illustrative values.

## Included

1. Splash with adventure illustration
2. Welcome / introduction
3. Role selection
4. Family setup / parent PIN unlock
5. Child dashboard, XP, coins, streak and weekly activity
6. Routine view and a real two-minute pause/resume brushing timer
7. Quests with active, waiting, completed and touch-up states
8. Camera/gallery photo proof, compression and preview
9. Bonus deeds, child suggestions and weekend multiplier
10. Rewards vault with filters, affordability checks and history
11. Redemption celebration
12. Parent dashboard and bonus grants
13. Routine management, quest create/edit and adventure templates
14. Quest review, photo preview, approve and encouraging touch-up
15. Separate weekday/weekend schedules
16. In-app activity and reminders
17. Settings, profile, avatar, sound and role switch

Supporting dialogs cover profile setup, quest details, reward confirmation, creation forms, suggestions, photo enlargement and help. The PRD's additional screen names are represented by these dialogs instead of expanding the 17 main screens in the reference.

## Parent routine presets

Open **Parent Dashboard → Ready-made routines & tasks**, or **Routines → Preset Library**. Browse 34 presets with age/category filters, select individual tasks or one of five packs, review them and choose **Allow Tasks**. Allowed daily routines appear automatically for the child. Optional household tasks default to one time; parents can also choose every day, weekdays or weekends. One-time tasks do not reset after completion.

Use **Custom Task** for your own instructions and rewards. Existing tasks are recognized to avoid duplicates, and saved family progress is preserved. Research sources and selection rationale are in [PRESET_RESEARCH.md](PRESET_RESEARCH.md).

## Persistence and privacy

State is stored locally at `real_life_quest_state_v1_family`. Photos are resized to 1,000px and retained only while awaiting review; approval or touch-up removes them from app state. Fonts and illustration are bundled. No analytics, advertising, external font requests or public profiles. Android automatic backup is disabled.

The parent PIN is a local convenience lock, stored as a SHA-256 digest. It is not a server authentication/security boundary. Someone with device storage/developer access could alter local state. Clearing browser/app data erases progress; there is no account recovery or cross-device backup in this edition.

## Android

The native project is in `android/`. Application ID: `com.reallifequest.app`. Minimum SDK 24; compile and target SDK 36.

```sh
npm run android:sync
npm run android:open
```

Android Studio with JDK 21 and Android SDK 36 is needed. For a debug APK, open the project and build an APK, or run `android/gradlew.bat assembleDebug` from a terminal configured with Java and the Android SDK. For release, use Android Studio → Generate Signed App Bundle, create/use your own signing key, and choose release.

A manually triggered GitHub Actions workflow also builds a debug APK after the repository is uploaded. It has not been run here. Debug APKs are for testing; Play Store upload needs a signed release AAB.

**No APK/AAB has been compiled in this workspace:** Android Studio, Java and Android SDK were not found. Native camera, Android back behavior, permissions, accessibility, device rotation, and safe-area behavior still need real-device testing. The Android scaffold and web asset synchronization are generated successfully.

## Verification

```sh
npm run build
npm test
# With npm run dev running and Edge installed:
node tests/journey.mjs
node tests/screens.mjs
node tests/presets.mjs
```

The journey test checks setup, bonus grant, child task submission, gallery upload, approval, reward redemption and persistence. Screen checks cover templates, schedules, timer pause, suggestions and 320px/desktop overflow. Captured screenshots are in `artifacts/`.

The preset journey verifies pack review before assignment, duplicate prevention, age filtering, one-time tasks, custom task creation, child visibility, separate bedtime brushing submission, reload persistence and 320px layout. The 15 unit tests include preset matching and completion rollover behavior.

## Remaining before a public release

- Test and compile the native app on Android; generate your signed AAB.
- Confirm the final application ID, developer identity and support contact.
- Supply a hosted privacy policy and complete Play Console audience, content rating and Data safety declarations for a child-directed app.
- Prepare final store icon/screenshots and conduct the testing required by your Play Console account.
- If separate parent/child devices are required, add a backend for account authentication, family pairing, secure photo storage, synchronization and account deletion. This build intentionally does not show a fake email/password login.
- Push/scheduled OS notifications are not connected. Current reminders appear inside the app and do not enforce device curfews.
- Quest inspiration uses curated templates. A Gemini backend and live AI generation are not connected; no API keys are shipped.
- Final character art and native emoji appearance are close to the reference theme, not a pixel-identical reproduction of every illustrated icon.

Current platform references: [Capacitor setup](https://capacitorjs.com/docs/getting-started/environment-setup), [Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878).
