# Milestone Tracker

Personal health and milestone tracking web app with cloud sync, calorie/protein logging,
dashboard analytics, and **Pixel Secretary** — an AI health assistant embedded inside the
application.

**Live app:** https://poroboy.github.io/milestone-tracker/

---

## Version

| Field | Value |
|-------|-------|
| Version | v1.8.0 |
| Build | 2026.07.21.1 |
| Release | Nutrition Architecture — shared classifyFood() abstraction, deterministic enrichment, and heuristic protein estimation |

---

## Features

### Pixel Secretary AI

An AI health assistant embedded inside the app. It understands the app's current state,
can answer questions, and can perform actions through a function registry:

- **Natural language food logging** — "กินข้าวมันไก่" → logs with estimated kcal/protein
- **Natural language weight logging** — "วันนี้หนัก 72.3" → records weight
- **Natural language exercise logging** — "เดิน 30 นาที" → logs with kcal estimation
- **Natural language navigation** — "เปิด Dashboard" → switches tab
- **Health analytics** — "ทำไมน้ำหนักไม่ลง" → analyzes trends from live data
- **Confirmation flow** — write operations require user confirmation before execution

See [Pixel Secretary Architecture](#pixel-secretary-architecture) below.

### Daily Calorie & Protein Tracker

- Food logging with kcal and protein
- Exercise logging with kcal burn
- Daily base kcal / TDEE
- Net kcal calculation (food - exercise - base)
- Daily protein goal tracking
- Monthly summaries

### Weight Tracking

- Weight logging with history
- Predicted vs recorded weight chart
- 7-day moving average
- 30-day, 90-day, and yearly chart ranges
- Pace and plateau analysis
- Editable and removable history entries

### Dashboard

- Yearly overview
- Monthly kcal and protein trends
- Weight trend chart
- Health progress insights
- Body profile (gender, age, weight, height, activity)
- Estimated BMI, BMR, TDEE, and protein target

### Random Meal Wheel

- Random meal suggestion spinner
- Configurable food list

### Glucose / Insulin Insight

- Estimated carb, sugar, fiber, and protein for food logs
- Daily carb, sugar, and protein totals
- Glucose spike risk estimation (low/medium/high)
- Deterministic nutrition enrichment via classifyFood() normalization pipeline
- *Not a medical measurement*

### Account & Cloud Sync

- Google login with Firebase Authentication
- Firestore cloud sync per user
- Cross-device merge protection
- Split per-day sync (avoids 1MB document limit)
- Online/offline/pending sync status

### Data Management

- Export all data as JSON backup
- Import and restore from validated JSON
- Delete individual food/exercise entries
- Reset today's logs

---

## Pixel Secretary Architecture

```
User Message
    ↓
Intent Resolution (detectIntents)
    ↓  regex-based, 6 intents, deterministic
Context Builder (buildPixelContext)
    ↓  core + matched providers
Cloudflare Worker
    ↓  prompt assembly + Gemini call
Gemini API
    ↓  structured JSON response
Function Calling
    ↓  validate → confirm → execute
Nutrition Enrichment
    ↓  normalizeFoodMetabolicItem → classifyFood → estimate macros
State Update
    ↓  saveState → re-render → sync
```

### Live Context System

Before sending to Gemini, the frontend builds a complete snapshot of the app's current
state. This is split into two layers:

**Layer 1 — Core Context (always included)**
- Date/time/timezone (Asia/Bangkok)
- Active page
- User profile, BMI, BMR, TDEE
- Goals (start/current/final weight, protein goal, streak)
- Today's kcal summary, food log, exercise log
- Available function names

**Layer 2 — Context Providers (selected by intent)**
- `chatHistory` — always included
- `weightHistory` — weight-related intents
- `analytics` — analysis/trend intents
- `foodHistory` — food/nutrition history intents
- `exerciseHistory` — exercise history intents

### Intent Resolution

Uses regex patterns (not substring matching) to detect what the user wants:

| Intent | Example trigger | Activated by |
|--------|----------------|--------------|
| weight | "ทำไมไม่ผอม" | น้ำหนัก, ลด, ผอม, plateau, ไม่ลง |
| nutrition | "วันนี้กินอะไรดี" | กิน, อาหาร, แคล, มื้อ |
| exercise | "เดินทุกวัน" | วิ่ง, เดิน, cardio, ออกกำลัง |
| analytics | "ช่วงนี้ลดไม่ค่อยลง" | ทำไม, ช่วงนี้, แนวโน้ม, เดือน |
| time | "ตอนนี้กี่โมง" | เวลา, กี่โมง, วันอะไร |
| greeting | "สวัสดี" | สวัสดี, hello, ขอบคุณ |

Multiple intents can activate simultaneously. Providers are deduplicated.

### Context Providers

Independent modules with a single `build()` function. Adding a new provider requires
no changes to the selection logic.

### Function Registry

Four functions, each with `validate()` and `execute()`:

| Function | Confirmation | Purpose |
|----------|-------------|---------|
| addMeal | Yes | Log a meal (name, kcal, protein) |
| updateWeight | Yes | Record weight |
| addExercise | Yes | Log exercise (name, duration, kcal) |
| navigate | No | Switch tab/page |

Write operations show a confirmation dialog before execution.

### Worker

The Cloudflare Worker at `worker/src/index.js`:

- Receives the full context payload from the frontend
- Assembles a system prompt with live context
- Calls Gemini API with model fallback (gemini-2.5-flash-pro → gemini-2.5-flash → gemini-2.5-flash-lite)
- Validates the JSON response against the required schema
- Returns structured JSON to the frontend

The Worker is **stateless** — all user state lives on the frontend.

### Nutrition Enrichment Pipeline

Food items logged through Pixel Secretary are enriched with complete nutrition data before persistence:

```
AI identifies food (name, kcal)
  ↓
normalizeFoodMetabolicItem()
  ├── classifyFood(name)          → shared food classification
  ├── estimateFoodProteinFallback → heuristic protein estimation
  ├── estimateFoodMetabolicFallback → carb/sugar/fiber estimation
  └── estimateGlucoseSpikeRisk    → spike risk classification
  ↓
Item persisted with complete fields: carb, sugar, fiber, protein, spikeRisk
```

Key architectural decisions:

- **classifyFood(name)** — single source of truth for food classification patterns (rice, noodle, bread, meat, dessert, drink, vegetable). Both the carb/sugar/fiber estimator and protein estimator consume the same classification, preventing regex drift.

- **Heuristic protein estimator** — uses kcal % fractions (50%, 18%, 4%, 12%) optimized for spike-risk classification, not nutrition-label accuracy. Target: ±10g absolute error for common Thai meals. Replaceable with a nutrition database lookup if one becomes available.

- **Deterministic enrichment** — the AI only needs to identify the food name and estimate kcal. All macro fields (carb, sugar, fiber, protein) and spike risk are derived from the name + kcal, making the system self-contained and resilient to AI omissions.

- **Frontend/Worker synchronized** — both `index.html` and `worker/src/index.js` contain identical copies of `classifyFood()` and the normalization pipeline, ensuring consistent enrichment regardless of which path logs the food.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML / CSS / JavaScript (vanilla, no framework) |
| Hosting | GitHub Pages |
| Authentication | Firebase Authentication |
| Database | Firebase Firestore |
| AI Backend | Cloudflare Workers |
| AI Model | Google Gemini API (with model fallback) |

---

## Project Structure

```
milestone-tracker/
├── index.html                 # Main application (UI, state, sync, Pixel Secretary)
├── styles.css                 # All styles
├── manifest.webmanifest       # PWA manifest
├── service-worker.js          # Offline service worker
├── icon-192.png               # PWA icon
├── icon-512.png               # PWA icon
├── worker/
│   ├── package.json           # Worker dependencies
│   ├── wrangler.toml          # Cloudflare configuration
│   └── src/
│       └── index.js           # Worker — Gemini proxy + prompt assembly
├── docs/
│   ├── README.md              # This file — project documentation
│   ├── CHANGELOG.md           # Release history
│   ├── PROJECT_CONTEXT.md     # AI handoff document
│   ├── CHATGPT_CONTEXT.md     # ChatGPT development context
│   ├── CHATGPT_HISTORY.md     # Development history and decisions
│   ├── DECISIONS.md           # Architectural decision log
│   ├── AI_RULES_v4.1.md       # AI coding agent rules
│   └── reports/               # Investigation reports
│       ├── nutrition-enrichment-investigation.md
│       └── protein-estimation-investigation.md
├── .firebaserc                # Firebase project config
├── firebase.json              # Firebase hosting config
└── firestore.rules            # Firestore security rules
```

---

## Development

### Prerequisites

- Node.js (for Worker deployment)
- Cloudflare Wrangler CLI (`npm install -g wrangler`)
- Gemini API key set as a Wrangler secret: `npx wrangler secret put GEMINI_API_KEY`

### Local Development

The frontend is a static HTML site — open `index.html` in a browser or serve locally:

```bash
npx http-server .
```

### Worker Deployment

After making changes to `worker/src/index.js`:

```bash
cd worker
npx wrangler deploy
```

### Adding a New Context Provider

1. Add a `build()` function that returns `{ fieldName: data }`
2. Add an entry to `contextProviders[]` in `index.html`
3. Add an intent pattern if needed in `intentPatterns[]`
4. (Optional) Add extraction and a conditional section in the Worker prompt

### Adding a New Function

1. Add an entry to `PixelFunctionRegistry` with `requiresConfirmation`, `validate()`, `execute()`
2. Add the function name to the prompt examples in the Worker

---

## Security Notes

- Do not commit API keys or secrets
- The Gemini API key is stored as a Cloudflare Wrangler secret, not in source code
- Firestore security rules control per-user data access
- All user data is scoped to the authenticated user's UID

---

## Important Data Notes

The app stores user data in Firestore under a user-specific path. Do not change
the Firestore data path unless a migration plan is prepared.

Key data fields:
- `kcalDays` — daily food/exercise logs
- `proteinGoal` — daily protein target
- `weightLogs` — weight history
- `profile` — user body profile
- `aiChatHistory` — AI chat history
- `pixelState` — Pixel Secretary state

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full release history.

## Project Context

See [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for the AI handoff document with
architecture details, development principles, and working rules.
