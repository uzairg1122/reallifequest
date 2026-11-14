# Real Life Quest — Complete Application & Design Specification

> **Version**: 1.0.0  
> **Target Audience**: Children (Ages 6–12) & Guardians / Parents  
> **Architecture**: Full-Stack TypeScript (Vite + React 18, Express, Google GenAI Gemini 3.8 Flash, Tailwind CSS, Web Audio API)

---

## 1. Executive Summary & Product Vision

**Real Life Quest** is a gamified daily habit and task companion designed to transform everyday routines into an engaging Role-Playing Game (RPG). Instead of nagging or repetitive reminders, real-world responsibilities—such as brushing teeth, cleaning bedrooms, finishing homework, and helping family members—are framed as heroic quests that reward Experience Points (XP) and Gold Coins.

The application bridges two distinct user viewpoints:
1. **The Young Adventurer (Leo)**: An empowering, playful game interface with tactile cards, cute avatars, animations, audio cues, and a Rewards Vault to cash in hard-earned coins.
2. **The Guardian / Guildmaster (Parent)**: A command center for reviewing photo proof of chores, approving quests, granting spontaneous bonuses for great behavior, adjusting curfews, and tuning schedules between weekdays and weekends.

---

## 2. Core Functional Modules

### 2.1. Daily Habits Hub (`HabitsScreen.tsx`)
The child’s morning and evening mission center.
- **Hero Dashboard**: Displays the child's hero profile (Leo, Level 5 Adventurer), current XP progress bar with shimmer animation, and active streak counter.
- **Routine Breakdown**:
  - **Morning Routine**: Teeth brushing, bed making, getting dressed.
  - **School & Homework Prep**: Backpack check, math workbook, reading.
  - **Tidy & Order**: Clothes hamper, bedroom floor, toy storage.
  - **Bedtime Wind-Down**: Curfew countdown timer, night meditation, pyjamas.
- **Consistency Tracking**:
  - **Current Streak Widget**: 6-day continuous habit streak with interactive fire indicators.
  - **7-Day Consistency Chart**: Visual bar graph showing completion rates for Monday through Sunday.
  - **Direct Shortcuts**: Instant navigation to pending quests and the rewards vault.

### 2.2. Quests & Missions (`QuestsScreen.tsx`)
The actionable checklist where children inspect and complete tasks.
- **Trophy Banner**: Prominently features a 3D Golden Trophy with real-time counters (e.g. `4/6 Quests Verified`).
- **Segmented Filter Pills**:
  - `All`: Full view of daily quests.
  - `Active`: Tasks ready to be performed.
  - `Waiting Check`: Tasks submitted by the child awaiting parent verification.
  - `Completed`: Tasks verified and finalized with green checkmarks.
- **Interactive Habit Tasks**:
  - **2-Minute Toothbrush Timer**: Built-in interactive timer with visual countdown, sparkling stars, and sound cues to ensure dentists' recommended brushing duration.
  - **Photo Proof Submission**: Prompts the child to take or upload a camera photo verifying task completion (e.g., clean bathroom or finished homework page).
  - **Time-Sensitive Badges**: Urgent warnings for curfew or morning departure tasks with countdown timers.
  - **Tactile Action Buttons**: Forward circle arrows (`➔`) that transform into green checkmarks (`✓`) upon completion.

### 2.3. Bonus Kind Deeds (`BonusScreen.tsx`)
Voluntary, high-value tasks promoting pro-social behavior and family harmony.
- **Extra Missions**: Tasks like "Help Sibling with Puzzle", "Organize Recycling Bin", or "Set the Dinner Table".
- **Generous Coin Drops**: High coin-to-effort ratios encouraging children to take initiative beyond routine chores.
- **Weekend Multiplier Alert**: Automatically indicates when 1.5x weekend coin boosts are active.
- **Suggest a Deed**: Children can propose their own custom good deeds for parent approval.

### 2.4. Rewards Vault (`VaultScreen.tsx`)
The motivational payoff center where earned coins are redeemed.
- **Coin Bank Counter**: High-contrast gold coin display showing real-time balance with coin-drop sound effects.
- **Category Filters**:
  - `All Rewards`: Complete catalog.
  - `Screen Time`: 30-min tablet gaming, Friday movie night pass.
  - `Treats`: Ice cream parlor trip, favorite bakery cookie.
  - `Goals`: Long-term aspirational wishes (e.g., Lego Star Wars Millennium Falcon).
- **Redemption Logic**:
  - Validates child balance against item cost.
  - Generates instant celebratory toast and decrements wallet balance.
  - Sends redemption request into the parent's event log.
- **Wishlist Creator**: Children and parents can add new custom rewards with custom costs and icons.

### 2.5. Guardian Command Center (`GuildmasterScreen.tsx`)
The parent management and verification interface.
- **Pending Verifications Inbox**:
  - Displays submitted quests with thumbnail previews, submission timestamp (e.g. `18m ago`), and clarity tags (`Sharp`, `Needs Light`).
  - Photo preview modal allows parents to inspect submitted proof in full resolution.
- **Two-Action Review Flow**:
  - **Approve (Green Button)**: Grants full XP and coins, fires multi-color confetti, plays triumphant 3-tone bell chime, and updates streak stats.
  - **Touch-Up Needed (Orange Button)**: Friendly, non-punitive re-prompt (e.g., "Almost there! Please put shoes in closet too") that returns the quest to the child's active list without deduction.
- **Spontaneous Bonus Grant (`OnTheFlyBonusGrant.tsx`)**:
  - Instant coin awards for spontaneous good behavior (e.g. "+15 Coins for sharing dessert" or "+25 Coins for polite greeting to guests").
  - Includes preset tags and custom coin/reason inputs.
- **Schedule & Curfew Configuration (`ScheduleModal.tsx`)**:
  - Toggle between **Weekday Mode** (school rules, 8:30 PM curfew) and **Weekend Mode** (relaxed routine, 9:15 PM curfew, 1.5x coin multipliers).
  - Configurable curfew times with automatic child notification.

### 2.6. AI Quest Generator (Gemini 3.8 Flash)
Integrated AI assistant that creates imaginative, age-appropriate questlines.
- **Server Endpoint (`POST /api/generate-quests`)**: Calls Google Gemini 3.8 Flash with structured JSON schema.
- **Thematic Questlines**: Generates creative quests (e.g., *"Laundry Goblin Slayer"*, *"Hydration Potion Mastery"*, *"Spellbound Homework"*).
- **Graceful Fallback**: Contains curated high-quality templates if the API key is absent or offline.

---

## 3. UI Design Language & Aesthetic Philosophy

### 3.1. Visual Theme: "Pastel Playful Tactile"
The app intentionally rejects sterile, generic SaaS templates and corporate dark modes in favor of an inviting, tactile aesthetic reminiscent of modern Nintendo and Duolingo interfaces:
- **Card Backgrounds**: Soft pastel tints that differentiate categories:
  - **Pastel Pink** (`#fce7f3` / `#fbcfe8`): Good deeds, hygiene, morning routines.
  - **Pastel Blue** (`#e0f2fe` / `#bae6fd`): Homework, school prep, tidy tasks.
  - **Pastel Lavender** (`#ede9fe` / `#ddd6fe`): Evening tasks, mindfulness, bedtime.
  - **Pastel Amber / Gold** (`#fef3c7` / `#fde68a`): Big achievements, trophy banners, coin drops.
  - **Pastel Mint** (`#dcfce7` / `#bbf7d0`): Completed milestones and verified tasks.
- **Crisp Outlines**: Every card, pill, and button features a clean **1.5px solid slate border** (`#0f172a`), creating tactile physical depth and cartoon-like clarity.
- **Rounded Geometry**: Generous corner radiuses (`rounded-[28px]` on cards, `rounded-full` on pills and action buttons).

### 3.2. Typography Pairing
- **Display & Headings**: `Quicksand` (Weights: 600, 700, 800)
  - Warm, rounded geometric sans-serif that feels playful, friendly, and easily legible for young readers.
- **Body & Captions**: `Nunito Sans` (Weights: 500, 600, 700)
  - Highly legible, spacious x-height ensuring effortless readability on both mobile screens and desktop monitors.

### 3.3. Tactile Controls & Micro-Interactions
- **Circular Forward Buttons (`.btn-circle-action`)**:
  - 40px × 40px circular buttons with white background and 1.5px slate borders.
  - Crisp black `➔` indicates action ready; transforms into green `✓` when verified.
- **Bouncy Button Feedback (`.btn-bouncy`)**:
  - Tactile scale down to `0.96` on touch/click with `cubic-bezier(0.4, 0, 0.2, 1)`.
- **Floating Bottom Capsule Dock (`BottomNav.tsx`)**:
  - Fixed floating capsule at screen bottom with blurred backdrop and shadow.
  - Active tab highlighted by an indigo pill indicator with bouncy icon animation.

---

## 4. Web Audio Engine & Haptic Soundscape (`src/audio.ts`)

To avoid external asset loading errors or network latency, all sound effects are synthesized live in the browser using the **Web Audio API**:

| Sound Effect | Waveform / Frequencies | Musical Logic | Purpose |
| :--- | :--- | :--- | :--- |
| **Approval Chime** | Sine + Triangle Overtones (C5 523Hz → G5 784Hz → C6 1046Hz) | Triumphant ascending major triad | Fired when a parent approves a quest |
| **Coin Clink** | Exponential Pitch Sweep (B5 988Hz → E6 1318Hz) | Bright metallic bell attack | Fired when collecting or spending coins |
| **Touch-Up Note** | Warm Triangle Wave (G4 392Hz → E4 330Hz) | Non-punitive descending mellow note | Fired when a parent requests chore redo |
| **Tactile Pop** | Fast Sine Sweep (A4 440Hz → A5 880Hz, 60ms) | Crisp physical mechanical click | Fired on tab clicks and filter toggles |

*Global mute toggle is located in the top header and persists in browser `localStorage`.*

---

## 5. Gamification Economics & Behavioral Psychology

1. **Immediate Positive Reinforcement**:
   - Every task clearly states its exact reward (e.g. `+45 XP`, `+30 Coins`).
   - Celebratory visual feedback (confetti, audio chimes, level bar fills) provides dopamine hits that reinforce positive habits.
2. **Non-Punitive Parenting Flow**:
   - There is no "Fail" or "Punish" button. If a child doesn't complete a task properly, the parent clicks **"Needs Touch-up"** with helpful guidance. The quest stays open for another try.
3. **Delayed Gratification & Goal Setting**:
   - The Rewards Vault teaches budgeting and financial literacy. Kids can choose immediate micro-rewards (30 min gaming) or save for long-term dream goals (Lego set).
4. **Autonomous Motivation**:
   - Bonus Deeds allow children to take initiative and earn extra without parental nagging.

---

## 6. Data Architecture & Persistence

All application state is synchronized to `localStorage` under `real_life_quest_state_v1_*`:
- `_child`: Level, current XP, coin balance, streak days, verified today count, schedule mode.
- `_reviews`: Guardian approval queue items with attached photo URLs and timestamps.
- `_weekday_quests` & `_weekend_quests`: Active daily routine task catalogs.
- `_bonus_quests`: Voluntary kind deeds.
- `_rewards`: Vault items, costs, redemption counts, and wishlist goals.
- `_bonus_grants`: Audit log of spontaneous parent coin rewards.

---

## 7. Security & Frame Permissions
- **Camera Frame Permission**: Declared in `metadata.json` (`requestFramePermissions: ["camera"]`) to allow live snapshot taking on supported mobile devices.
- **Server-Side API Key Isolation**: Gemini API keys are never exposed to the client; all generation calls proxy through the secure Express server route `/api/generate-quests`.
