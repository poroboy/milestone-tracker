# CHATGPT_HISTORY.md

# Development History --- Milestone Tracker

> Historical development journal for future ChatGPT sessions and AI
> assistants.
>
> Unlike `CHATGPT_CONTEXT.md`, this document focuses on **why**
> decisions were made.

------------------------------------------------------------------------

# Project Origin

Milestone Tracker originally began as a calorie and weight tracking
application.

During development, the project direction shifted from a traditional
tracker toward an AI-assisted health application.

The central idea became:

**"Pixel Secretary"**

An AI assistant embedded inside the application rather than a standalone
chatbot.

------------------------------------------------------------------------

# Major Milestones

## Phase 1 --- Basic Tracker

Implemented:

-   Calorie tracking
-   Weight tracking
-   Dashboard
-   Daily summaries

Goal:

Create a reliable manual tracking application.

------------------------------------------------------------------------

## Phase 2 --- Pixel Secretary

Pixel was introduced as a dedicated application tab.

Initial objective:

Natural language interaction.

Example:

-   "เพิ่มข้าวมันไก่ 550 แคล"
-   "ไปหน้า Dashboard"

Pixel initially produced replies but did not execute application
actions.

------------------------------------------------------------------------

## Phase 3 --- Function Calling

A Function Registry was introduced.

Current actions:

-   addMeal
-   updateWeight
-   addExercise
-   navigate

This separated AI reasoning from application execution.

------------------------------------------------------------------------

## Phase 4 --- Confirmation Flow

Originally, Pixel executed actions immediately.

Decision:

Require user confirmation before changing application state.

Reason:

Prevent accidental logging and improve trust.

Current flow:

AI

↓

Confirmation

↓

Execution

------------------------------------------------------------------------

## Phase 5 --- Worker Architecture

Cloudflare Worker became responsible for:

-   Prompt construction
-   Gemini communication
-   JSON validation
-   Structured responses

Business logic intentionally remained in the frontend.

------------------------------------------------------------------------

## Phase 6 --- Live Context

A major architectural milestone.

Pixel now receives live application state including:

-   Current date/time
-   Active page
-   User profile
-   BMI/BMR/TDEE
-   Today's meals
-   Today's exercise
-   Goals

Reason:

Pixel should answer from application state rather than generic AI
knowledge.

------------------------------------------------------------------------

## Phase 7 --- Context Providers

Instead of sending every dataset on every request:

Core Context

-   

Optional Providers

were introduced.

Examples:

-   Analytics
-   Weight History
-   Food History
-   Exercise History
-   Chat History

Reason:

Reduce unnecessary prompt size and improve scalability.

------------------------------------------------------------------------

## Phase 8 --- Intent Resolution

Provider selection originally used simple keyword matching.

Later replaced by deterministic intent resolution using regex patterns.

Reason:

Separate context selection from context generation.

------------------------------------------------------------------------

## Phase 9 --- Nutrition Architecture

A major data integrity milestone.

### Problem

Food items logged through Pixel Secretary were missing carb, sugar, fiber, and
spikeRisk fields at save time. The enrichment pipeline (`normalizeFoodMetabolicItem`)
ran only at render time (Dashboard, totals), meaning:

- Persisted data (localStorage + Firestore) was incomplete
- LIVE CONTEXT included zeros for these fields
- Downstream consumers saw stale data until the first render call

Additionally, protein was the only macro that depended entirely on AI output.
When Gemini omitted protein (which happened), the item had no protein data.

### Solution

Two related changes:

**Fix A**: `normalizeFoodMetabolicItem()` is now called inside `addMeal.execute()`
before `saveState()`. Enrichment runs at save time, not render time.

**Fix B**: `estimateFoodProteinFallback()` added as a heuristic fallback when
the AI does not provide protein.

### Architectural Decision: Shared Classification

Rather than duplicating regex patterns in a new protein estimator, the existing
food classification logic was extracted into a shared function:

```
classifyFood(name)
  → { hasSweetDrink, hasDessert, hasRice, hasNoodle, hasBread,
      hasStarchy, hasVeg, hasProteinName, proteinOnly }
  → consumed by both:
      • estimateFoodMetabolicFallback  (carb/sugar/fiber)
      • estimateFoodProteinFallback    (protein)
```

This prevents regex drift and keeps the classification logic in one place.

### Why Heuristic Estimation

Protein is estimated as a fraction of kcal based on food category:

- proteinOnly → 50% (lean meats, fish, eggs, tofu, whey)
- rice/noodle/bread/starchy → 18% (mixed dishes)
- dessert/drink → 4% (minimal protein)
- default → 12% (soups, curries, stir-fries)

The fractions are heuristic approximations derived from Thai food nutrition
references, optimized for glucose-spike classification (±10g typical error)
rather than nutrition-label accuracy. If a reliable nutrition database becomes
available, the heuristic should be replaced with deterministic lookup.

### Worker Synchronization

The Worker (`worker/src/index.js`) received identical copies of all enrichment
functions, ensuring consistent behavior regardless of the logging path.

### Result

| Before | After |
|--------|-------|
| Items saved without carb/sugar/fiber/spikeRisk | Complete nutrition data at save time |
| Protein missing when AI omitted it | Protein estimated from kcal + food type |
| LIVE CONTEXT read stale zeros | Enriched data visible to AI immediately |
| Two regex sets if protein estimator was added | Single classifyFood() for all estimators |

---

# Important Bugs Solved

## Navigation

Problem:

"dashboard"

did not equal

"Dashboard"

Solution:

Normalize page names before validation.

------------------------------------------------------------------------

## Exercise Logging

Problem:

Gemini sometimes returned:

durationMinutes

without

kcal

Solution:

AI estimates calories first.

Frontend provides a fallback estimate if kcal is missing.

------------------------------------------------------------------------

## Worker Validation

Problem:

Worker validated Pixel responses using the legacy schema.

Solution:

Separate validation logic for Pixel Secretary.

------------------------------------------------------------------------

# Architectural Principles

These decisions should be preserved.

-   Architecture before shortcuts.
-   Reuse existing systems.
-   Avoid unnecessary refactoring.
-   Prefer modular components.
-   Keep frontend and worker responsibilities separate.
-   Keep context scalable.

------------------------------------------------------------------------

# Deliberately Deferred Features

These are postponed intentionally.

-   Avatar
-   Emotion System
-   Long-term Memory
-   Proactive AI
-   Sleep Tracking
-   Water Tracking
-   Habit Tracking

Reason:

The foundation should become stable before expanding capability.

------------------------------------------------------------------------

# Lessons Learned

1.  Working software is more valuable than constant refactoring.

2.  Live Context improved answer quality more than prompt tuning alone.

3.  Separating reasoning from execution made the system easier to
    maintain.

4.  Documentation is part of the architecture.

------------------------------------------------------------------------

# Future Sessions

Before proposing major changes:

1.  Read README.md
2.  Read PROJECT_CONTEXT.md
3.  Read CHATGPT_CONTEXT.md
4.  Read this file

Understand the existing architecture before introducing new systems.

Extend the project instead of replacing working components.

------------------------------------------------------------------------

# Current State

Release:

v1.8.0 (\^ v1.7.0)

Status:

Stable

Git:

Merged into main

Nutrition enrichment is fully deterministic. The application no longer depends on
the AI to provide macro fields. All items logged through Pixel Secretary are
enriched with complete nutrition data (carb, sugar, fiber, protein, spikeRisk)
at save time.

Future work should be driven by real usage rather than speculation.
