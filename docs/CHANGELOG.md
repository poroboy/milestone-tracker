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

## v1.8.0

Release date: 2026-07-21

Summary: Nutrition Architecture — shared classifyFood() abstraction, deterministic enrichment pipeline, and heuristic protein estimation fallback.

### Added

- `classifyFood(name)` — shared classification layer extracting all food regex patterns into a single function
- `estimateFoodProteinFallback(food)` — heuristic protein estimator using kcal fractions (50%, 18%, 4%, 12%)
- Protein enrichment in `normalizeFoodMetabolicItem()` — runs before carb/sugar/fiber estimation so all downstream consumers (residual carb fallback, spike risk) receive complete protein data
- Protein enrichment in Worker's `normalizeMetabolicItems()` — synchronized with frontend
- `proteinEstimated` flag on enriched items
- Documentation: nutrition architecture section in README, Phase 9 in CHATGPT_HISTORY, decisions in DECISIONS.md
- Investigation reports: `docs/reports/nutrition-enrichment-investigation.md`, `docs/reports/protein-estimation-investigation.md`
- Project documentation directory (`docs/`) with architecture, decisions, history, and AI rules

### Changed

- `estimateFoodMetabolicFallback()` refactored to consume `classifyFood(name)` instead of maintaining 8 inline regex declarations — zero behavior change
- Nutrition enrichment now runs at save time (`addMeal.execute()`) before `saveState()`, ensuring all persisted items have complete fields
- Version bumped from v1.7.0 to v1.8.0, build from 2026.07.20.1 to 2026.07.21.1

### Fixed

- **Root Cause A**: `addMeal.execute()` now calls `normalizeFoodMetabolicItem()` before `saveState()` — previously items were persisted without carb/sugar/fiber/spikeRisk
- **Root Cause B**: LIVE CONTEXT (`buildCoreContext()`) now reads enriched data because enrichment happens at save time, not render time
- Protein omission by AI: when Gemini does not provide protein, the heuristic fallback estimates it from kcal + food classification

### Architecture

```
Nutrition Enrichment Pipeline (normalizeFoodMetabolicItem):
  classifyFood(name)
    → shared regex classification: hasRice, hasNoodle, hasBread, hasStarchy,
      hasSweetDrink, hasDessert, hasVeg, hasProteinName, proteinOnly
    → consumed by both:
      • estimateFoodMetabolicFallback  (carb/sugar/fiber)
      • estimateFoodProteinFallback    (protein)
    → single source of truth — no regex drift between estimators
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
