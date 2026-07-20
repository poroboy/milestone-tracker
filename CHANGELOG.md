# Changelog

All notable changes to Milestone Tracker are documented here.
Versions are ordered newest first.

---

## v1.7.0

Release date: 2026-07-20

Summary: Pixel Secretary — AI health assistant with Live Context, Intent Resolution,
and function calling.

### Added

- Pixel Secretary AI assistant (5th tab)
- Function Registry with four actions: addMeal, updateWeight, addExercise, navigate
- Live Context System (date/time, user profile, goals, today's summary, analytics)
- Context Providers (chatHistory, weightHistory, analytics, foodHistory, exerciseHistory)
- Intent Resolution (regex-based, 6 intents: weight, nutrition, exercise, analytics, time, greeting)
- Cloudflare Worker integration with Gemini API
- Confirmation Flow for write operations (meal, weight, exercise)
- Exercise kcal estimation fallback on the frontend
- Worker route `/pixel-secretary` with dedicated prompt and JSON validation
- Optional `validatorFn` parameter in `callGeminiModel`/`callGeminiWithFallback`
- `contextVersion` field in the context payload
- `PROJECT_CONTEXT.md` — AI handoff document

### Changed

- Refactored `buildPixelContext()` into modular core + provider architecture
- Replaced keyword substring matching with regex-based intent detection
- Restructured the Worker prompt with labelled context sections
- Worker prompt sections are now conditionally rendered based on provider data
- Updated Gemini system prompt to emphasize Pixel as an embedded app agent
- `.tab` width adjusted from 25% to 20% for the 5th tab

### Fixed

- Navigation case sensitivity — page name normalization via lookup map
- Exercise logging validation — `kcal` field no longer required in addExercise
- Confirmation dialog cleanup — confirm messages removed on both confirm and cancel
- Worker JSON validation in `isValidPixelSecretaryJson`

### Architecture

```
Frontend
  → Intent Resolution (regex)
  → Context Builder (core + providers)
  → Cloudflare Worker
  → Gemini API
  → Structured JSON response
  → Function Calling (validate → confirm → execute)
  → State Update (saveState + re-render + sync)
```

---

## vNext

Release date: TBD

Summary: —

### Added

-

### Changed

-

### Fixed

-

### Removed

-

---

## Earlier releases

See the [GitHub releases page](https://github.com/poroboy/milestone-tracker/releases) for
versions before v1.7.0.
