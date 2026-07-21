# Report: Gemini LIVE CONTEXT Time Inconsistency

**Date:** 2026-07-21
**Author:** AI Code Analysis
**Status:** Analysis Complete (no changes implemented)

---

## Problem

Gemini is not consistently using the LIVE CONTEXT current time. The UI provides the correct time (e.g., 21:11 Asia/Bangkok), but the model answered 14:30.

---

## Investigation

### 1. How Current Time Is Injected

**Frontend** — `getCurrentTimeContext()` at `index.html:1808`:
- Uses `Intl.DateTimeFormat` with `timeZone: "Asia/Bangkok"`
- Returns: `timezone`, `locale`, `iso`, `weekday`, `day`, `month`, `year`, `hour`, `minute`, `second`, `time`, `dayPart`, `displayDate`, `displayTime`

**Payload** — `buildCoreContext()` at `index.html:4092`:
- Includes `time: getCurrentTimeContext()` in the request body sent to `/pixel-secretary`

**Worker** — `handlePixelSecretary` at `worker/src/index.js:405`:
- Extracts `const time = body.time || {};`
- Injects into prompt lines 439-444:
  ```
  ⏰ Time & Place
  - Date: ${time.displayDate || "unknown"}
  - Time: ${time.displayTime || "unknown"} (${time.timezone || "unknown"})
  - Weekday: ${time.weekday || "unknown"}
  - Day part: ${time.dayPart || "unknown"}
  ```

The injection mechanism is correct — a single, well-formatted time block.

---

### 2. Multiple Time Values in the Prompt

| Source | Location in prompt | Format | Problem? |
|--------|-------------------|--------|----------|
| `⏰ Time & Place` | Lines 439-444 | Thai long date + `HH:MM (Asia/Bangkok)` | ✅ Authoritative |
| `📅 Today` date | Line 461 | `YYYY-MM-DD` from `todayStr()` | Minor — different granularity, same date |
| **Chat history `ts` field** | Line 483 | Numeric Unix epoch ms (e.g. `1750422345000`) | ⚠️ **Major issue** |

Each chat history entry (`pixelState.chatHistory` at `index.html:4363-4364`) contains `ts: Date.now()`. These are raw Unix ms timestamps serialized into the prompt as-is:

```json
{"role":"user","text":"...","ts":1750422345000}
```

LLMs can interpret these as time values. A chat entry from 14:25 UTC carries a `ts` value near 14:25 UTC, directly contradicting the LIVE CONTEXT time of 21:11 ICT.

---

### 3. Chat History Contains Stale Timestamps

**This is the most likely root cause.**

Data flow:
- `index.html:4363` → `pixelState.chatHistory.push({ role: 'user', text: message, ts: Date.now() })`
- `index.html:4364` → `pixelState.chatHistory.push({ role: 'pixel', text: data.reply, ..., ts: Date.now() })`
- Worker `line 414` → `const chatHistory = Array.isArray(body.chatHistory) ? body.chatHistory.slice(-10) : [];`
- Worker `lines 482-483` → serialized as raw JSON with `ts` field intact

If the user had a conversation at 14:25 and then asks at 21:11, the model sees:
- LIVE CONTEXT: "21:11 (Asia/Bangkok)"
- Chat history: `"ts": 1750418700000` → model converts → ~14:25 UTC

The 14:30 answer is very close to 14:11 UTC (= 21:11 ICT). This strongly suggests the model is using the chat history `ts` values or defaulting to UTC instead of the LIVE CONTEXT time.

---

### 4. LIVE CONTEXT Prominence vs Conversation

Prompt structure:
```
=== YOUR CAPABILITIES ===
=== LIVE APPLICATION CONTEXT ===
  ⏰ Time & Place          ← early, prominent
  👤 User Profile
  🎯 Goals
  📅 Today
  📊 Analytics (optional)
  ⚖️ Weight History
  📜 Food History
  🏃 Exercise History
  💬 Recent Chat History   ← contains ts timestamps
=== YOUR RULES ===          ← appears AFTER chat history
  - Always use LIVE CONTEXT above...
  ...
=== OUTPUT FORMAT ===
Examples...
User message:
```

Issues:
- Chat history draws conversational attention
- `ts` fields embedded within each chat entry
- The "Always use LIVE CONTEXT" rule appears **after** the chat history section

---

### 5. Model Instruction Strength

Current instruction (line 487):
> "Always use the LIVE CONTEXT above to answer. Do not rely on general knowledge or assumptions."

Deficiencies:
- **No instruction to ignore time from chat history**
- **No timezone assertion** — model defaults to UTC
- **No explicit statement** that LIVE CONTEXT time is the authoritative source
- The phrase "LIVE CONTEXT above" is ambiguous

---

## Root Cause

| # | Issue | Impact |
|---|-------|--------|
| 1 | **Chat history `ts` field** contains stale Unix timestamps serialized into prompt | High |
| 2 | **No timezone instruction** — model defaults to UTC | High |
| 3 | **Instruction not explicit enough** about ignoring other time references | Medium |
| 4 | Chat history positioned before the rule telling model to use LIVE CONTEXT | Low-Medium |

---

## Recommendations

*Not implemented — analysis only.*

1. **Strip `ts` from chat history** before serializing in the prompt at `worker/src/index.js:482`. Only `role` and `text` are needed for conversation context.

2. **Add explicit timezone instruction** to RULES section:
   - "All times in LIVE CONTEXT are in Asia/Bangkok timezone."
   - "Ignore any numeric timestamps or time references in chat history — they are stale."

3. **Reinforce the LIVE CONTEXT rule** — add a brief reminder inside the `⏰ Time & Place` block itself, e.g.: *"This is the authoritative current time."*

4. **Preserve reasoning ability** — guide without hard-coding or removing analytical capabilities.

**Expected confidence (without implementation):** ~80% that removing `ts` alone fixes it; ~95% with explicit instruction additions.

---

## Files Examined

| File | Lines |
|------|-------|
| `worker/src/index.js` | 398-649, 429-586 (prompt assembly) |
| `index.html` | 1808-1844 (`getCurrentTimeContext`), 4092-4123 (`buildCoreContext`), 4186-4208 (`contextProviders`), 4230-4243 (`buildPixelContext`), 4363-4364 (chat history push) |

---

## Confidence

- **Analysis confidence:** 90%
- **Remaining uncertainty:** The exact 14:30 value could also be model hallucination. Live testing with `ts` removed is needed for confirmation.
