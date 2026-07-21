# Nutrition Enrichment Investigation

**Date:** 2026-07-21
**Author:** AI Code Analysis
**Status:** Investigation Complete — changes implemented in v1.8.0

---

## 1. Current Architecture — Data Flow Trace

### Complete Flow

```
User: "กินข้าวมันไก่"
  ↓
Gemini returns JSON action:
  { function: "addMeal", params: { name: "ข้าวมันไก่", kcal: 550, protein: 20 } }
  ↓
handlePixelMessage() receives response (index.html:4296)
  ↓
addMeal.validate(params)            (index.html:3967-3970)
  ↓  passes: name + kcal present
addMeal.execute(params)             (index.html:3972-3984)
  ↓
  const log = getDayLog(today);     (index.html:1336-1341)
  ↓  returns reference to state.kcalDays[today]
  log.food.push({ name, kcal, protein, source, createdAt });
  ↓
saveState();                        (index.html:3982)
  ↓  persists to localStorage + Firestore
renderKcalPage();                   (index.html:3983, defn at 1639)
  ↓  renders food list directly from log.food — NO enrichment call
buildCoreContext() for next AI turn (index.html:4092-4123)
  ↓  reads log.food directly — NO enrichment call
```

### Critical Observation

`normalizeFoodMetabolicItem()` is **never called** in:

1. `addMeal.execute()` — the push-to-storage path
2. `renderKcalPage()` — the Kcal tab food list render
3. `buildCoreContext()` — the LIVE CONTEXT builder

It IS called in:

- `getTodayMetabolicTotals()` (line 5434) — dashboard totals only
- Various render functions for the Dashboard and other pages

These calls happen **after** `saveState()` has already persisted incomplete data.

---

## 2. Object Trace

### Before `addMeal.execute()` — as returned by Gemini

```json
{
  "name": "ข้าวมันไก่",
  "kcal": 550,
  "protein": 20
}
```

### After `addMeal.execute()` — stored in `state.kcalDays[today].food[0]`

```json
{
  "name": "ข้าวมันไก่",
  "kcal": 550,
  "protein": 20,
  "source": "pixel",
  "createdAt": 1750542000000
}
```

**Fields missing:** `carb`, `sugar`, `fiber`, `spikeRisk`

### After `saveState()` → Firestore

Same as above — persisted without `carb`, `sugar`, `fiber`, `spikeRisk`.

### After `buildCoreContext()` → LIVE CONTEXT prompt

```json
{
  "name": "ข้าวมันไก่",
  "kcal": 550,
  "protein": 20,
  "source": "pixel",
  "createdAt": 1750542000000
}
```

No enrichment. The AI sees zeros for all metabolic fields in its own context.

### After `getTodayMetabolicTotals()` (Dashboard render) — in-memory only

```json
{
  "name": "ข้าวมันไก่",
  "kcal": 550,
  "protein": 20,
  "source": "pixel",
  "createdAt": 1750542000000,
  "carb": 121,          ← ADDED by estimateFoodMetabolicFallback
  "sugar": 0,            ← ADDED by estimateFoodMetabolicFallback
  "fiber": 1,            ← ADDED by estimateFoodMetabolicFallback
  "spikeRisk": "high",   ← ADDED by estimateGlucoseSpikeRisk
  "metabolicEstimated": true
}
```

But this enrichment happens **in-place** on the same object reference. If the Dashboard rendered **before** the next LIVE CONTEXT build, the context would see the enriched data. If not, it would see the raw data.

---

## 3. `normalizeFoodMetabolicItem()` — Implementation Analysis

Full implementation at `index.html:5396-5429`:

```javascript
function normalizeFoodMetabolicItem(food){
  if(!food || typeof food !== "object") return food;         // L5397 — early exit only for null/primitive

  const next = food;

  const existingCarb = next.carb ?? next.carbs ?? next.carbohydrate;  // L5401
  const existingSugar = next.sugar;                                     // L5402
  const existingFiber = next.fiber;                                     // L5403

  const hasAnyMetabolic =
    existingCarb !== undefined ||                                       // L5406
    existingSugar !== undefined ||                                      // L5407
    existingFiber !== undefined;                                        // L5408

  if(hasAnyMetabolic){                                                  // L5410
    next.carb = toMacroNumber(existingCarb);                            // L5411
    next.sugar = toMacroNumber(existingSugar);                          // L5412
    next.fiber = toMacroNumber(existingFiber);                          // L5413
  }else{
    const estimated = estimateFoodMetabolicFallback(next);              // L5415
    next.carb = estimated.carb;                                         // L5416
    next.sugar = estimated.sugar;                                       // L5417
    next.fiber = estimated.fiber;                                       // L5418
    next.metabolicEstimated = true;                                     // L5419
  }

  if(!next.spikeRisk && !next.glucoseSpikeRisk){                        // L5422
    next.spikeRisk = estimateGlucoseSpikeRisk(next);                    // L5423
  }else{
    next.spikeRisk = next.spikeRisk || next.glucoseSpikeRisk;           // L5425
  }

  return next;                                                          // L5428
}
```

### Answers to Specific Questions

**Q: Does the function exit early?**
Only if `food` is falsy or not an object (line 5397). A valid food object **never** exits early — it always reaches the bottom.

**Q: Does it skip estimation when protein already exists?**
No. `protein` is never checked in the branching logic at lines 5405-5408. The existence of `protein` has zero effect on whether estimation runs.

**Q: Does it only estimate undefined values?**
Yes — the guard at line 5405-5408 checks if `carb`, `sugar`, or `fiber` are already defined. Estimation runs only when ALL three are `undefined`.

**Q: Does an explicit value of 0 prevent estimation?**
Yes. This is the critical finding:

```javascript
const existingCarb = next.carb ?? next.carbs ?? next.carbohydrate;   // L5401
```

If `next.carb` is explicitly set to `0`, the nullish coalescing (`??`) returns `0` — it treats `0` as a defined value. This means:

- `existingCarb` = `0` (not `undefined`)
- `hasAnyMetabolic` = `true` (because `0 !== undefined` is true)
- Estimation is **skipped**
- The value `0` is preserved as-is

**Q: Are carb/sugar/fiber intentionally preserved?**
Yes — the entire design of lines 5405-5413 intentionally preserves explicitly-set values. The estimation branch is a fallback for when nothing is set at all.

---

## 4. Root Cause

### The exact condition preventing enrichment

There are **two separate root causes**, both must be true for the bug to manifest:

### Root Cause A (Primary) — `normalizeFoodMetabolicItem()` is never called at save time

File: `index.html`, lines 3972-3984

```javascript
execute: (params) => {
  const today = todayStr();
  const log = getDayLog(today);
  log.food.push({                          // ← item pushed WITHOUT enrichment
    name: params.name,
    kcal: Math.round(Number(params.kcal) || 0),
    protein: Math.round(Number(params.protein) || 0),
    source: 'pixel',
    createdAt: Date.now()
  });
  saveState();                             // ← persisted WITHOUT carb/sugar/fiber/spikeRisk
  renderKcalPage();                        // ← renders WITHOUT enrichment call
  return { success: true };
}
```

The item pushed to `log.food` has `carb`, `sugar`, `fiber`, `spikeRisk` all **absent** (not even `0`). They are literally missing from the object.

### Root Cause B (Secondary) — LIVE CONTEXT reads un-enriched data

File: `index.html`, lines 4119

```javascript
today: {
  // ...
  foods: log.food || [],     // ← reads directly from state, no enrichment
}
```

Even if enrichment happened at render time (e.g., via Dashboard's `getTodayMetabolicTotals`), the LIVE CONTEXT builder reads `log.food` without applying `normalizeFoodMetabolicItem`. If the Dashboard hasn't rendered yet, the data is still raw.

### Why protein is populated correctly

Protein is set **directly by Gemini** in the action params:

```
"params": { "name": "ข้าวมันไก่", "kcal": 550, "protein": 20 }
```

The `addMeal.execute()` function passes `params.protein` through:

```javascript
protein: Math.round(Number(params.protein) || 0),    // 20
```

Protein doesn't need enrichment — the AI provides it. The missing fields (carb, sugar, fiber, spikeRisk) are the ones that depend on the enrichment pipeline.

---

## 5. Recommended Fix

### What to change

Add a single call to `normalizeFoodMetabolicItem()` inside `addMeal.execute()` **before** `saveState()`.

```javascript
execute: (params) => {
  const today = todayStr();
  const log = getDayLog(today);
  const item = {
    name: params.name,
    kcal: Math.round(Number(params.kcal) || 0),
    protein: Math.round(Number(params.protein) || 0),
    source: 'pixel',
    createdAt: Date.now()
  };
  normalizeFoodMetabolicItem(item);   // ← fills carb, sugar, fiber, spikeRisk
  log.food.push(item);
  saveState();                         // ← persisted WITH complete nutrition data
  renderKcalPage();
  return { success: true };
}
```

### Why it fixes the issue

- `normalizeFoodMetabolicItem` sees `carb` = `undefined`, `sugar` = `undefined`, `fiber` = `undefined`
- `hasAnyMetabolic` = `false`
- Enters the estimation branch: calls `estimateFoodMetabolicFallback(item)` which classifies the food name and derives carb/sugar/fiber from kcal
- Sets `item.metabolicEstimated = true`
- Then calls `estimateGlucoseSpikeRisk(item)` to compute spikeRisk from the estimated macros
- Item is now complete: `{ name, kcal, protein, carb, sugar, fiber, spikeRisk, metabolicEstimated, source, createdAt }`
- `saveState()` persists complete data
- Subsequent LIVE CONTEXT builds read complete data
- Firestore records are complete

### Regression risk

**Low-Medium.** The function is already called extensively throughout the app (9+ call sites in render/display code). Adding it at the save point ensures data is complete before any downstream consumer reads it.

**Specific risks:**
1. **Double estimation:** If a render function also calls `normalizeFoodMetabolicItem` later, it will skip estimation (because `hasAnyMetabolic` will be `true` after the first call). No double-counting.
2. **Missing spikeRisk:** The function handles this correctly — it checks `spikeRisk` separately from the carb/sugar/fiber check.
3. **Object mutation:** The function mutates the item in place. This is the existing pattern used throughout the app, so all downstream code already handles it.

**Not affected:**
- Render logic — already calls `normalizeFoodMetabolicItem` and handles enriched data
- `dayTotals()` — only reads `kcal` and `protein` from food items
- Firestore sync — saves the entire object, newly enriched fields included
- Old food items (logged before fix) — `normalizeFoodMetabolicItem` handles undefined values gracefully via the estimation branch

---

## 6. Verification Plan

### Test Case 1: ข้าวมันไก่ (rice-based, mixed macros)

| Input | Expected |
|-------|----------|
| name: "ข้าวมันไก่" | |
| kcal: 550 | |
| protein: 20 | |
| | |
| **After normalizeFoodMetabolicItem:** | |
| carb | ~121 (550 × 0.88 ÷ 4) |
| sugar | 0 |
| fiber | 1 |
| spikeRisk | "high" (carb ≥ 70) |

### Test Case 2: อกไก่ (protein-only)

| Input | Expected |
|-------|----------|
| name: "อกไก่" | |
| kcal: 200 | |
| protein: 40 | |
| | |
| **After normalizeFoodMetabolicItem:** | |
| carb | 0 (proteinOnly path) |
| sugar | 0 |
| fiber | 0 |
| spikeRisk | "low" |

### Test Case 3: ชานม (sweet drink)

| Input | Expected |
|-------|----------|
| name: "ชานมไข่มุก" | |
| kcal: 300 | |
| protein: 2 | |
| | |
| **After normalizeFoodMetabolicItem:** | |
| carb | ~56 (300 × 0.75 ÷ 4) |
| sugar | ~56 (same as carb) |
| fiber | 0 |
| spikeRisk | "high" (sugar ≥ 25) |

### Test Case 4: สุกี้น้ำ (mixed, vague name)

| Input | Expected |
|-------|----------|
| name: "สุกี้น้ำ" | |
| kcal: 300 | |
| protein: 15 | |
| | |
| **After normalizeFoodMetabolicItem:** | |
| carb | ~21 (residual fallback: (300 - 15×4) × 0.35 ÷ 4) |
| sugar | 0 |
| fiber | 0 |
| spikeRisk | "medium" (carb ≥ 35? → 21 < 35 → no. sugar ≥ 12? → 0 < 12 → no. carb ≥ 25 && fiber < 2 && protein < 10? → 21 < 25 → no. → "low") |

Wait — this reveals a potential issue. "สุกี้น้ำ" doesn't match any food category pattern (no ข้าว, no เส้น, no ผัก, etc.), so it falls through to the residual fallback. The computed spikeRisk is "low" which might be incorrect for a noodle dish. But this is an existing limitation of the estimation function, not a regression introduced by the fix.

### Edge Cases to Verify

| Case | Concern | Expected |
|------|---------|----------|
| Empty name | `String("").toLowerCase()` is `""` → no patterns match → residual fallback with kcal | carb > 0 if kcal > 0 |
| kcal = 0 | All carb/sugar/fiber remain 0 | spikeRisk = "low" |
| Protein very high relative to kcal | `residual = max(0, kcal - protein×4)` → could be 0 → carb = 0 | spikeRisk = "low" |
| Already has carb from AI | `existingCarb !== undefined` → estimation skipped → AI's value preserved | `metabolicEstimated` is NOT set |
| Already has spikeRisk from AI | `!next.spikeRisk` is false → estimation skipped → AI's value preserved | |
| Multiple items in same meal | Each item enriched independently | |

### How to verify without deploying

```javascript
// Test harness — run in browser console after fix
const testItem = { name: "ข้าวมันไก่", kcal: 550, protein: 20 };
normalizeFoodMetabolicItem(testItem);
console.log(testItem);
// Expected: { name: "ข้าวมันไก่", kcal: 550, protein: 20, carb: 121, sugar: 0, fiber: 1, spikeRisk: "high", metabolicEstimated: true }
```

---

## Summary

| Component | Status | Evidence |
|-----------|--------|----------|
| AI correctly identifies food | ✅ | Gemini returns `{ name, kcal, protein }` |
| AI populates protein correctly | ✅ | Protein is in the action params |
| `normalizeFoodMetabolicItem` works | ✅ | Verified: function handles undefined correctly |
| `estimateFoodMetabolicFallback` classifies correctly | ✅ | Rice patterns match "ข้าวมันไก่" |
| `estimateGlucoseSpikeRisk` computes correctly | ✅ | Reads enriched carb/sugar/fiber/protein |
| `addMeal.execute` calls enrichment | ❌ | **Root Cause A** — no call to `normalizeFoodMetabolicItem` before `saveState()` |
| `buildCoreContext` enriches data | ❌ | **Root Cause B** — reads `log.food` directly |
| Data persisted completely | ❌ | `saveState()` runs before any enrichment call |
