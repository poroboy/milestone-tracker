# Protein Estimation Investigation

**Date:** 2026-07-21
**Status:** Investigation Complete — changes implemented in v1.8.0 (Option D: shared classifyFood() + estimateFoodProteinFallback)

---

## 1. Why Protein Is Not Estimated

The enrichment pipeline (`normalizeFoodMetabolicItem` → `estimateFoodMetabolicFallback`) was designed exclusively for **metabolic** fields — those that affect glucose response. Protein is intentionally excluded at both levels.

### `estimateFoodMetabolicFallback()` at `index.html:5344`

```javascript
function estimateFoodMetabolicFallback(food){
  const name = String(food?.name || "").toLowerCase();
  const kcal = toMacroNumber(food?.kcal);
  const protein = toMacroNumber(food?.protein);    // ← READS protein from input
  ...
  let carb = 0;
  let sugar = 0;
  let fiber = 0;
  ...
  return { carb, sugar, fiber };                   // ← NEVER returns protein
}
```

The function:
- **Reads** `food.protein` for the residual carb fallback (line 5399-5401)
- **Calculates** only `carb`, `sugar`, `fiber`
- **Returns** only `{ carb, sugar, fiber }` — protein is never in the return type

### `normalizeFoodMetabolicItem()` at `index.html:5413`

```javascript
function normalizeFoodMetabolicItem(food){
  ...
  // Only checks carb, sugar, fiber
  const existingCarb = next.carb ?? next.carbs ?? next.carbohydrate;
  const existingSugar = next.sugar;
  const existingFiber = next.fiber;

  const hasAnyMetabolic =
    existingCarb !== undefined ||
    existingSugar !== undefined ||
    existingFiber !== undefined;                     // ← protein NOT checked

  if(hasAnyMetabolic){
    next.carb = toMacroNumber(existingCarb);         // ← protein NOT set
    next.sugar = toMacroNumber(existingSugar);
    next.fiber = toMacroNumber(existingFiber);
  }else{
    const estimated = estimateFoodMetabolicFallback(next);
    next.carb = estimated.carb;                      // ← protein NOT set
    next.sugar = estimated.sugar;
    next.fiber = estimated.fiber;
    next.metabolicEstimated = true;
  }

  if(!next.spikeRisk && !next.glucoseSpikeRisk){
    next.spikeRisk = estimateGlucoseSpikeRisk(next); // ← READS protein, doesn't set it
  }
  return next;
}
```

`next.protein` is **never read, never set, never checked**. The four fields handled are:
- `carb`, `sugar`, `fiber` — estimated or preserved
- `spikeRisk` — computed from the above three + protein

Protein is an **input** to spikeRisk calculation but is **never an output** of the enrichment layer.

---

## 2. Intentional Exclusion — Evidence

The design intent is clear from the return type:

```
estimateFoodMetabolicFallback → { carb, sugar, fiber }    // "metabolic" only
normalizeFoodMetabolicItem    → sets carb, sugar, fiber, spikeRisk
```

The function is named **Metabolic**Item — it's about glucose metabolism, not complete nutrition. Protein was excluded because:

1. **Scope** — The original feature (Glucose/Insulin Insight) needed carb, sugar, fiber, and spikeRisk. Protein was relevant only as an input to the spikeRisk calculation (line 5218: `protein < 15` threshold).

2. **AI capability** — Gemini can estimate protein reasonably well for Thai food. The original design trusted the AI to provide it.

3. **Estimation difficulty** — Protein varies more than carbs within the same food category. A rice dish could have 10g (plain rice) or 35g (with chicken). Pattern-based estimation is less reliable for protein.

---

## 3. Should Protein Estimation Belong to the Deterministic Layer?

**Yes, as a fallback.** The current architecture now relies on the deterministic layer for `carb`, `sugar`, `fiber`, and `spikeRisk`. Protein is the only remaining field that depends on AI output. This creates an inconsistency:

| Field | Source | Status |
|-------|--------|--------|
| kcal | AI estimate | ✅ Always populated |
| protein | AI estimate | ❌ **Missing when AI omits it** |
| carb | Deterministic enrichment | ✅ Populated |
| sugar | Deterministic enrichment | ✅ Populated |
| fiber | Deterministic enrichment | ✅ Populated |
| spikeRisk | Deterministic computation | ✅ Computed |

Adding a protein fallback would make the enrichment layer fully self-contained: the AI only needs to identify the food name and estimate kcal; everything else is derived deterministically.

---

## 4. Architecture Recommendation

### Option A: Add protein fallback inside `estimateFoodMetabolicFallback()`

Change the return type from `{ carb, sugar, fiber }` to `{ carb, sugar, fiber, protein }`. Estimate protein using the same pattern-based classification that already exists:

**Proposed estimation rules (inside the existing function):**

```javascript
let estimatedProtein = 0;

if (proteinOnly) {
  // Meat, eggs, whey, tofu — protein is primary macro
  estimatedProtein = Math.round(kcal / 4);  // ~25% kcal from protein
} else if (hasRice || hasNoodle || hasBread || hasStarchy) {
  // Mixed meal: some protein from meat/tofu component
  estimatedProtein = Math.round(kcal * 0.18 / 4);  // ~18% kcal from protein
} else if (hasSweetDrink || hasDessert) {
  // Minimal protein
  estimatedProtein = Math.round(kcal * 0.04 / 4);  // ~4% kcal from protein
} else {
  // Default fallback
  estimatedProtein = Math.round(kcal * 0.12 / 4);  // ~12% kcal from protein
}
```

Then in `normalizeFoodMetabolicItem()`, add after the existing estimation block:

```javascript
if (!next.protein || next.protein <= 0) {
  next.protein = estimated.protein;
}
```

**Pros:**
- Single function handles all estimation
- Reuses existing food classification (rice, noodle, meat, etc.)
- No new function needed

**Cons:**
- Changes the return type of a widely-used function
- `estimateFoodMetabolicFallback` is called from ~9 locations — all would receive the new `protein` field (harmless, but wider blast radius)
- `proteinOnly` items (อกไก่, ไข่) already have `hasRice/hasNoodle = false`, so the existing `proteinOnly` flag can drive the highest protein estimate

### Option B: New `estimateFoodProteinFallback()` function

A standalone function focused only on protein:

```javascript
function estimateFoodProteinFallback(food) {
  const name = String(food?.name || "").toLowerCase();
  const kcal = toMacroNumber(food?.kcal);

  if (/อกไก่|ไก่|หมู|เนื้อ|ปลา|ไข่|เวย์|โปรตีน|เต้าหู้/.test(name) &&
      !/ข้าว|เส้น|ก๋วยเตี๋ยว|บะหมี่|ขนมปัง|แป้ง|มัน|หวาน|เค้ก|ขนม/.test(name)) {
    return Math.round(kcal * 0.35 / 4);   // 35% from protein
  }
  if (/ข้าว|เส้น|ก๋วยเตี๋ยว|บะหมี่|ขนมปัง|แป้ง/.test(name)) {
    return Math.round(kcal * 0.18 / 4);   // 18% from protein
  }
  if (/น้ำหวาน|ชา|น้ำอัดลม|ขนม|เค้ก|โดนัท|ไอศกรีม/.test(name)) {
    return Math.round(kcal * 0.04 / 4);   // 4% from protein
  }
  return Math.round(kcal * 0.12 / 4);     // default 12%
}
```

Then call it in `normalizeFoodMetabolicItem()`:

```javascript
if (!next.protein || next.protein <= 0) {
  next.protein = estimateFoodProteinFallback(next);
}
```

**Pros:**
- Zero blast radius — existing callers of `estimateFoodMetabolicFallback` unchanged
- Clean separation: carb/sugar/fiber in one function, protein in another
- Easy to test independently

**Cons:**
- Duplicates some pattern matching from the existing function
- Slightly more code overall

### Option C: Keep AI as the sole protein source

Don't add estimation. Instead, ensure the AI prompt reliably produces `protein` in the action params by keeping the protein field in the prompt examples (which it already has).

**Pros:**
- Zero code change
- AI is more accurate for protein (understands specific dishes)

**Cons:**
- Already failing — AI sometimes omits protein despite the examples
- Prompt engineering is fragile; the AI's behavior shifts with model updates
- Inconsistent with the "AI identifies, code enriches" architecture

---

## Recommendation

**Option B (new `estimateFoodProteinFallback`) inside `normalizeFoodMetabolicItem()`.**

Rationale:
- Cleanest separation: metabolic fields stay in `estimateFoodMetabolicFallback`, protein gets its own function
- Zero blast radius — existing code that calls `estimateFoodMetabolicFallback` is unaffected
- Only two lines added to `normalizeFoodMetabolicItem`:
  ```javascript
  if (!next.protein || next.protein <= 0) {
    next.protein = estimateFoodProteinFallback(next);
  }
  ```
- The pattern matching for protein is simpler (only 3-4 categories) and doesn't need the full complexity of the carb estimation
- The estimation values can be tuned independently without touching carb/sugar/fiber logic
- Falls in line with the architecture: "AI identifies the food and kcal, code derives the macros"
