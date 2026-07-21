# DECISIONS.md

# Milestone Tracker --- Decision Log

> This document records **why** important architectural decisions were
> made.
>
> Unlike CHANGELOG (what changed) and PROJECT_CONTEXT (how the project
> works), this file explains **why specific decisions were chosen**.

------------------------------------------------------------------------

# Guiding Principle

When reviewing or changing the project, always ask:

> "Why was this designed this way?"

Preserve intentional design unless there is a clear technical benefit to
changing it.

------------------------------------------------------------------------

## Decision: Pixel is an AI Assistant, not a chatbot

Status: Accepted

Reason:

Pixel exists to operate inside the application using live data.

It should understand the current application state and help the user
complete tasks, not simply answer generic questions.

------------------------------------------------------------------------

## Decision: Use Function Calling

Status: Accepted

Reason:

AI should decide **what** to do.

The application should decide **how** to do it.

This separation improves safety and maintainability.

------------------------------------------------------------------------

## Decision: Require Confirmation

Status: Accepted

Reason:

Actions that modify user data (food, exercise, weight, navigation)
should never execute immediately.

Confirmation reduces accidental changes and increases user trust.

------------------------------------------------------------------------

## Decision: Live Context before Memory

Status: Accepted

Reason:

Accurate real-time context improves nearly every conversation.

Long-term memory is useful later but should not replace live application
state.

------------------------------------------------------------------------

## Decision: Core Context + Context Providers

Status: Accepted

Reason:

Always sending every dataset would increase token usage, latency, and
cost.

Core Context contains frequently needed information.

Context Providers load larger datasets only when relevant.

------------------------------------------------------------------------

## Decision: Intent Resolution

Status: Accepted

Reason:

Provider selection should be independent from context generation.

Deterministic intent matching keeps the system predictable and easy to
debug.

------------------------------------------------------------------------

## Decision: AI estimates exercise calories

Status: Accepted

Reason:

Pixel should feel like an intelligent assistant.

However, the frontend must provide a fallback estimate if AI omits the
calorie value.

Reliability is more important than perfection.

------------------------------------------------------------------------

## Decision: Business logic stays in the Frontend

Status: Accepted

Reason:

The Worker should focus on prompt construction and AI communication.

Application state and execution logic belong in the frontend.

------------------------------------------------------------------------

## Decision: Delay Avatar

Status: Deferred

Reason:

Avatar should reflect Pixel's real personality.

Personality should be shaped by actual usage, not assumptions.

------------------------------------------------------------------------

## Decision: Delay Emotion System

Status: Deferred

Reason:

Emotion should enhance interactions after the assistant becomes
genuinely useful.

------------------------------------------------------------------------

## Decision: Delay Long-term Memory

Status: Deferred

Reason:

Memory introduces additional complexity.

The current priority is stability, correctness, and real-world
usefulness.

------------------------------------------------------------------------

## Decision: Enrich Nutrition Data at Save Time

Status: Accepted (v1.8.0)

Context:

Food items logged through Pixel Secretary's `addMeal.execute()` were pushed
to the log without carb, sugar, fiber, or spikeRisk fields. The enrichment
function `normalizeFoodMetabolicItem()` was only called at render time
(Dashboard, totals), meaning data was persisted incomplete.

Decision:

Call `normalizeFoodMetabolicItem()` inside `addMeal.execute()` before
`push()` and `saveState()`. This ensures all items in storage have complete
nutrition fields.

Alternatives considered:

- Enrich at render time (existing behavior) — but LIVE CONTEXT reads data
  before first render call, so stale data leaks into the AI prompt.
- Enrich at context build time — would require modifying `buildCoreContext()`
  which is outside the enrichment layer's responsibility.

Why this approach:

Enriching at save time means the data is correct for all downstream consumers
equally: persistence, render, LIVE CONTEXT, and Firestore sync.

------------------------------------------------------------------------

## Decision: Shared classifyFood() Classification Layer

Status: Accepted (v1.8.0)

Context:

The original `estimateFoodMetabolicFallback()` contained 8 inline regex
patterns for food classification. Adding a protein estimator would require
either extending this function (changing its purpose) or writing a new
function that duplicates the same patterns.

Decision:

Extract all food classification regex patterns into a shared function:
`classifyFood(name)`. Both the metabolic estimator and protein estimator
consume the same classification object.

Alternatives considered:

- Option A: Extend `estimateFoodMetabolicFallback()` to return protein
  — the function is called "metabolic" (glucose metabolism), and protein
  is not a metabolic field. Semantic mismatch.
- Option B: New standalone `estimateFoodProteinFallback()` with its own
  regex patterns — duplicates classification logic, creating maintenance
  burden and risk of regex drift.
- Option D (selected): Shared `classifyFood()` + refactored metabolic
  estimator + new protein estimator — single source of truth, zero
  duplication, clear separation of concerns.

Why shared classification:

The classification is consumed by two separate functions. Extracting it
before writing the second consumer prevents duplication rather than
fixing it after the fact. The change to the existing function is
mechanical (8 const declarations → 1 destructuring) with zero
behavior change.

------------------------------------------------------------------------

## Decision: Heuristic Protein Estimation

Status: Accepted (v1.8.0)

Context:

Protein was the only macro field that depended entirely on AI output.
When Gemini omitted protein (which happened), the item had incomplete
nutrition data. A fallback was needed.

Decision:

Add `estimateFoodProteinFallback()` that estimates protein grams from
kcal + food classification using heuristic fractions:

| Classification | Fraction | Rationale |
|---------------|----------|-----------|
| proteinOnly | 50% | Compromise between lean meats (~75%) and eggs (~31%) |
| Rice/noodle/bread/starchy | 18% | Typical Thai mixed-dish ratio |
| Dessert/drink | 4% | Very low protein, sugar/fat dominated |
| Default | 12% | Median for soups, curries, stir-fries |

Target accuracy: ±10g absolute error for common Thai meals.

Why heuristic, not database:

- No reliable Thai food nutrition database is integrated with the app.
- The primary consumer of protein data is glucose-spike classification
  (thresholds at 10g and 15g), where ±10g accuracy is sufficient.
- A nutrition database would be more accurate but introduces dependency,
  latency, and maintenance overhead.
- The heuristic is documented as replaceable — if a database becomes
  available, the function should be swapped out, not expanded.

Risk analysis:

- Lean meats (อกไก่): underestimates by ~10g (conservative for spike risk)
- Fatty meats (หมูกรอบ): possibly overestimates (but total protein is low
  either way due to high fat content)
- Eggs: overestimates by ~4g (150kcal eggs → 19g estimate vs 12g actual)
- Worst case: ±15g for outliers (extremely lean or extremely fatty items)
- Direction of error: underestimation → more conservative spike risk
  (false "high" rather than false "low") — safer for a glucose tracking app.

------------------------------------------------------------------------

## Decision: Frontend/Worker Nutrition Pipeline Synchronization

Status: Accepted (v1.8.0)

Context:

Both the frontend (`index.html`) and the Worker (`worker/src/index.js`) have
independent copies of the nutrition enrichment functions. The Worker's copy
was added during the original AI assistant architecture but was not updated
during the v1.8.0 enrichment changes.

Decision:

Apply the same enrichment updates to the Worker:
- Add `classifyFood()` (identical to frontend)
- Refactor `estimateFoodMetabolicFallback()` to use `classifyFood()`
- Add `estimateFoodProteinFallback()`
- Wire protein estimation into `normalizeMetabolicItems()`

Why not share code:

The frontend and Worker are independent deployments (static site vs.
Cloudflare Worker). Sharing code would require a build step or package,
adding complexity that outweighs the duplication of ~60 lines of
deterministic helper functions.

------------------------------------------------------------------------

# Development Rules

-   Preserve working architecture.
-   Extend existing systems instead of replacing them.
-   Prefer modular additions.
-   Keep documentation updated with major milestones.
-   Make architectural changes intentionally, not reactively.

------------------------------------------------------------------------

# Before Implementing New Features

Ask:

1.  Does this solve a real problem observed during daily use?
2.  Can it extend an existing system?
3.  Does it increase unnecessary complexity?
4.  Is there a simpler approach?

If the answer to these questions is unclear, postpone the feature.

------------------------------------------------------------------------

# Review Frequency

Update this document whenever a major architectural decision is made or
an existing decision is intentionally reversed.
