# Project Context — Milestone Tracker

This document is intended for AI assistants and future developers working on this project.
It explains the architecture, design decisions, and development conventions at a high level.

---

## Project Vision

Milestone Tracker is a personal health tracking web application that helps users manage
calories, weight, exercise, and health milestones. It runs as a static site on GitHub Pages
with a Cloudflare Worker backend for AI features.

Pixel Secretary is an AI health assistant **embedded inside** the application, not a
generic chatbot bolted on. It has live access to the user's data, understands the
application's current state, and can perform actions through a function registry.

---

## Current Architecture

```
User
  ↓
Frontend (index.html)
  ├── Intent Resolution      (regex-based intent detection)
  ├── Context Builder        (core + matched providers)
  ├── Pixel Function Registry (addMeal, updateWeight, addExercise, navigate)
  ├── Confirmation Flow      (user confirms write actions)
  └── State Management       (saveState, getDayLog, dayTotals)
  ↓
Cloudflare Worker (worker/src/index.js)
  ├── Gemini API calls       (callGeminiModel / callGeminiWithFallback)
  ├── Prompt assembly        (system prompt + live context)
  └── JSON validation        (isValidPixelSecretaryJson)
  ↓
Gemini API
  └── Structured JSON response → { intent, reply, plan, actions }
  ↓
Function Calling (frontend)
  ├── validate(params) → error or null
  ├── execute(params)   → update state, re-render
  └── confirmation if required
  ↓
Application State Updated
  └── saveState → localStorage + Firestore sync
```

### Layers

**Frontend** — Single-page application in `index.html`. Contains all UI, state management,
sync logic, and the Pixel Secretary client. No framework; vanilla HTML/CSS/JS.

**Worker** — Cloudflare Worker at `worker/src/index.js`. Receives the full live context from
the frontend, calls Gemini with a structured prompt, validates the JSON response, and returns
it. The Worker is stateless — all state lives on the frontend.

**Gemini** — Google's Gemini API. Receives a prompt describing the app, the live context,
available functions, and the user's message. Returns structured JSON. Uses model fallback
(gemini-2.5-flash-pro → gemini-2.5-flash → gemini-2.5-flash-lite).

---

## Pixel Secretary Architecture

### Live Context System

Before sending to Gemini, the frontend builds a complete snapshot of the application's
current state. This context is split into two layers:

**Layer 1 — Core Context (always included)**
- Date/time/timezone
- Active page
- User profile, BMI, BMR, TDEE
- Goals (start/current/final weight, protein goal, streak)
- Today's summary (base kcal, food kcal, exercise kcal, net kcal, protein)
- Today's food log and exercise log
- Available function names

**Layer 2 — Optional Context Providers (included when relevant)**
- `chatHistory` — always included
- `weightHistory` — triggered by weight-related intents
- `analytics` — triggered by analysis/trend intents
- `foodHistory` — triggered by food/nutrition history intents
- `exerciseHistory` — triggered by exercise history intents

### Intent Resolution

Instead of keyword substring matching, the project uses regex-based intent detection:

```javascript
detectIntents(message) → { intents: [...], providers: [...] }
```

Six intents are defined: `weight`, `nutrition`, `exercise`, `analytics`, `time`, `greeting`.
Each intent has regex patterns and maps to one or more context providers. Multiple intents
can activate simultaneously; providers are deduplicated via a Set.

### Context Providers

Providers are independent modules with a `build()` function that returns data to merge into
the context payload. Adding a new provider requires no changes to the selection logic.

### Function Registry

Four functions exist, each with `validate()` and `execute()`:

| Function | Requires confirmation | Purpose |
|----------|----------------------|---------|
| `addMeal` | Yes | Log a meal with name, kcal, protein |
| `updateWeight` | Yes | Record a new weight value |
| `addExercise` | Yes | Log exercise with name, duration, kcal |
| `navigate` | No | Switch to another tab/page |

Functions that modify data go through a **confirmation dialog**. The user sees a summary
and must confirm before execution. Navigate does not require confirmation.

### State Management

The app uses a global `state` object persisted to `localStorage`. Changes flow:

```
execute → update state → saveState() → render affected pages → Firestore sync
```

Helper functions (`getDayLog`, `dayTotals`, `calcProfileMetrics`) derive computed values
from the raw state.

---

## Current Milestone (v1.7.0)

Completed features:

- Pixel Secretary AI with function calling
- Food logging via natural language
- Weight logging via natural language
- Exercise logging with automatic kcal estimation
- Navigation via natural language
- Live Context System (time, user, goals, today, analytics, history)
- Intent Resolution (regex-based, 6 intents)
- Context Providers (5 providers, modular by design)
- Confirmation Flow for write operations
- Dashboard analytics
- Calorie/protein tracking
- Weight tracking with trends
- Cloud sync via Firebase/Firestore
- Gemini integration with model fallback

---

## Development Principles

1. **Prefer architecture over hacks.** Build scalable, modular systems from the start.
2. **Do not break existing behavior.** Changes should be additive and backward-compatible.
3. **Keep Function Registry modular.** Each function is self-contained (validate + execute).
4. **Keep Context Providers independent.** A provider has a single `build()` and a name.
5. **Avoid sending unnecessary context to Gemini.** Use intent detection to select providers.
6. **Use deterministic logic whenever possible.** Intent detection is regex-based, not LLM-based.
7. **Keep the Worker stateless.** All user state lives on the frontend.
8. **Preserve the release architecture.** The v1.7.0 architecture is the foundation.

---

## Future Roadmap

*These are ideas, not commitments. Marked as future work.*

- Memory (long-term conversation history)
- Avatar / character system
- Emotion / mood tracking
- Proactive AI (daily summaries, reminders)
- Sleep tracking
- Water intake tracking
- Habit tracking
- Body fat / measurement tracking
- Expanded analytics provider

---

## Working Rules for Future AI

1. **Understand the architecture before changing code.** Read this document and the relevant
   source files before making modifications.
2. **Preserve backwards compatibility.** Do not change the Worker output format or the
   function registry interface without a version migration plan.
3. **Prefer extending Context Providers over rewriting them.** Add new providers, don't
   restructure the existing ones.
4. **Keep the Worker and Frontend synchronized.** If you add a new field to the context
   payload, ensure the Worker extracts and uses it.
5. **Preserve the release architecture.** The v1.7.0 layered architecture (core + providers)
   is the foundation for all future additions.
6. **Test locally before deploying.** Run `npx wrangler deploy` after Worker changes.
7. **Commit meaningful messages.** Follow the existing commit style.

---

## File Structure

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
│       └── index.js           # Worker (Gemini proxy, prompt assembly)
├── README.md                  # Project documentation
├── CHANGELOG.md               # Release history
├── PROJECT_CONTEXT.md         # This file — AI handoff document
├── AI_Pixel_Secretary_Vision.md           # Original specification (historical)
├── AI_Pixel_Secretary_Implementation_Plan.md  # Implementation plan (historical)
├── .firebaserc                # Firebase project config
├── firebase.json              # Firebase hosting config
├── firestore.rules            # Firestore security rules
└── .gitignore
```
