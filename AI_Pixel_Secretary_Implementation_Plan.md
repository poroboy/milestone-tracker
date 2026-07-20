# AI Pixel Secretary — Implementation Plan (MVP)

## Overview

Pixel Secretary is a **dedicated 5th tab** inside Milestone Tracker. It is architecturally independent — it has its own UI, state, and services. It reads and updates data from other features only through function calling.

---

## Principles for MVP

1. **Minimize complexity** — no unnecessary abstractions
2. **Reuse existing architecture** — same patterns as the existing app (global state, inline code, direct DOM)
3. **No new files** — everything goes in `index.html` + `styles.css` + existing `worker/src/index.js`
4. **No new Cloudflare Worker** — add a route path to the existing worker
5. **Core functionality first** — chat, add meal, log weight, add exercise, navigate
6. **No visual polish** — emoji/icon status indicators, no pixel art, no animations
7. **No refactoring** of existing code

---

## File Changes

| File | Change |
|------|--------|
| `index.html` | Add 5th tab `#tabPixel`, page `#pagePixel`, and all Pixel JS logic |
| `styles.css` | Add Pixel Secretary styles |
| `worker/src/index.js` | Add `/pixel-secretary` route + system prompt |

Zero new files. Zero new infrastructure.

---

## Phase 1: Page Shell

### 1.1 New Tab Button

Add to the bottom nav bar in `index.html`:

```html
<button class="tab" id="tabPixel" onclick="switchTab('Pixel')"> Pixel </button>
```

### 1.2 New Page

```html
<div id="pagePixel" class="page">
  <div id="pixelSecretary">
    <!-- Status indicator -->
    <div id="pixelStatus">
      <span id="pixelStatusIcon">🧑</span>
      <span id="pixelStatusLabel">พร้อมทำงาน</span>
    </div>

    <!-- Activity log -->
    <div id="pixelActivityLog"></div>

    <!-- Chat dialogue -->
    <div id="pixelDialogue"></div>

    <!-- Input area -->
    <div id="pixelInputArea">
      <input type="text" id="pixelInput" placeholder="พิมพ์ข้อความ..." />
      <button id="pixelSendBtn">ส่ง</button>
    </div>

    <!-- Quick action bar -->
    <div id="pixelActions">
      <button onclick="pixelAction('clear')">ล้าง</button>
      <button onclick="pixelAction('help')">ช่วยเหลือ</button>
    </div>
  </div>
</div>
```

### 1.3 Layout

```
┌──────────────────────────────┐
│  🧑 พร้อมทำงาน               │  #pixelStatus
├──────────────────────────────┤
│  ⏳ วิเคราะห์อาหาร...         │  #pixelActivityLog (collapsible list)
│  ✅ บันทึกเรียบร้อย          │
├──────────────────────────────┤
│  👤 วันนี้กินข้าวมันไก่      │  #pixelDialogue
│  🤖 เพิ่ม 550 kcal เรียบร้อย │
│                              │
│  [พิมพ์ข้อความ...] [ส่ง]     │  #pixelInputArea
├──────────────────────────────┤
│  [ล้าง] [ช่วยเหลือ]          │  #pixelActions
└──────────────────────────────┘
```

### 1.4 Tab Switching

Patch `switchTab` to render Pixel Secretary when the Pixel tab is selected:

```javascript
const _pixelOrigSwitchTab = switchTab;
switchTab = function(name) {
  _pixelOrigSwitchTab(name);
  if (name === 'Pixel') renderPixelSecretary();
};
```

### 1.5 Status States

| State | Icon | Label |
|-------|------|-------|
| `idle` | 🧑 | พร้อมทำงาน |
| `thinking` | ⏳ | กำลังคิด... |
| `done` | ✅ | เสร็จเรียบร้อย |
| `error` | ❌ | เกิดข้อผิดพลาด |

---

## Phase 2: Core Logic

### 2.1 Pixel State

A single global object (same pattern as existing `state`):

```javascript
const pixelState = {
  status: 'idle',          // idle | thinking | done | error
  dialogue: [],            // [{role:'user'|'pixel', type:'text'|'action'|'confirm'|'error', text, actions, ts}]
  activityLog: [],         // [{step, status:'pending'|'done'|'error', label}]
  chatHistory: [],         // persisted to Firestore, max 30 messages
  pendingConfirmation: null, // {action, params, resolve, reject}
};
```

### 2.2 Status Rendering

```javascript
function setPixelStatus(status) {
  const icons = { idle: '🧑', thinking: '⏳', done: '✅', error: '❌' };
  const labels = { idle: 'พร้อมทำงาน', thinking: 'กำลังคิด...', done: 'เสร็จเรียบร้อย', error: 'เกิดข้อผิดพลาด' };
  pixelState.status = status;
  document.getElementById('pixelStatusIcon').textContent = icons[status];
  document.getElementById('pixelStatusLabel').textContent = labels[status];
}
```

### 2.3 Activity Log

```javascript
function startActivity(step, label) {
  pixelState.activityLog.push({ step, status: 'pending', label });
  renderActivityLog();
}
function completeActivity(step) {
  const entry = pixelState.activityLog.find(e => e.step === step);
  if (entry) { entry.status = 'done'; renderActivityLog(); }
}
function failActivity(step) {
  const entry = pixelState.activityLog.find(e => e.step === step);
  if (entry) { entry.status = 'error'; renderActivityLog(); }
}
function clearActivity() {
  pixelState.activityLog = [];
  renderActivityLog();
}
```

### 2.4 Dialogue Rendering

```javascript
function addDialogue(entry) {
  pixelState.dialogue.push(entry);
  renderDialogue();
  // Auto-scroll to bottom
  const el = document.getElementById('pixelDialogue');
  el.scrollTop = el.scrollHeight;
}
```

### 2.5 FunctionRegistry

A structured object with 4 core functions. Each function has:
- `requiresConfirmation` — whether user must approve
- `validate(params)` — returns error string or null
- `execute(params)` — performs the action, returns result

```javascript
const PixelFunctionRegistry = {
  addMeal: {
    requiresConfirmation: true,
    validate: (params) => {
      if (!params.name) return 'กรุณาระบุชื่ออาหาร';
      if (!params.kcal || params.kcal <= 0) return 'กรุณาระบุแคลอรี่';
      return null;
    },
    execute: (params) => {
      const today = getTodayStr();
      if (!state.kcalDays[today]) state.kcalDays[today] = { base: 1800, food: [], exercise: [] };
      state.kcalDays[today].food.push({
        name: params.name,
        kcal: params.kcal,
        protein: params.protein || 0,
        source: 'pixel',
        createdAt: Date.now()
      });
      saveState();
      return { success: true };
    }
  },

  updateWeight: {
    requiresConfirmation: true,
    validate: (params) => {
      if (!params.weight || params.weight <= 0) return 'กรุณาระบุน้ำหนัก';
      return null;
    },
    execute: (params) => {
      state.currentWeight = params.weight;
      upsertWeightLog(getTodayStr(), params.weight);
      checkMilestones();
      saveState();
      return { success: true };
    }
  },

  addExercise: {
    requiresConfirmation: true,
    validate: (params) => {
      if (!params.name) return 'กรุณาระบุชื่อกิจกรรม';
      if (!params.kcal || params.kcal <= 0) return 'กรุณาระบุแคลอรี่ที่เผาผลาญ';
      return null;
    },
    execute: (params) => {
      const today = getTodayStr();
      if (!state.kcalDays[today]) state.kcalDays[today] = { base: 1800, food: [], exercise: [] };
      state.kcalDays[today].exercise.push({
        name: params.name,
        kcal: params.kcal,
        source: 'pixel',
        createdAt: Date.now()
      });
      saveState();
      return { success: true };
    }
  },

  navigate: {
    requiresConfirmation: false,
    validate: (params) => {
      const validPages = ['Home', 'Wheel', 'Kcal', 'Dashboard', 'Pixel'];
      if (!validPages.includes(params.page)) return 'หน้าไม่ถูกต้อง';
      return null;
    },
    execute: (params) => {
      switchTab(params.page);
      return { success: true };
    }
  }
};
```

### 2.6 Confirmation Dialog

When a function requires confirmation, show inline in the dialogue:

```javascript
function showConfirmation(action, params) {
  return new Promise((resolve, reject) => {
    pixelState.pendingConfirmation = { action, params, resolve, reject };
    addDialogue({
      role: 'pixel',
      type: 'confirm',
      text: `ต้องการบันทึกข้อมูลต่อไปนี้หรือไม่?`,
      actions: [{ action, params }]
    });
    // Render confirm/cancel buttons
    renderConfirmButtons(action, params);
  });
}
```

User taps "ยืนยัน" → resolve → execute function
User taps "ยกเลิก" → reject → show cancellation message

### 2.7 AI Worker Call

```javascript
async function callPixelAI(message) {
  const url = 'https://milestone-kcal-ai.poroboy.workers.dev/pixel-secretary';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        userProfile: state.profile,
        profileMetrics: computeProfileMetrics(),
        currentWeight: state.currentWeight,
        todaySummary: computeTodaySummary(),
        todayFoodLog: getTodayFoodLog(),
        todayExerciseLog: getTodayExerciseLog(),
        goals: { startWeight: state.startWeight, finalGoal: state.finalGoal, streak: state.streak },
        chatHistory: pixelState.chatHistory.slice(-10),
        availableFunctions: Object.keys(PixelFunctionRegistry)
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    return await response.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}
```

### 2.8 Main Handler

```javascript
async function handlePixelMessage(message) {
  if (!message.trim()) return;

  setPixelStatus('thinking');
  addDialogue({ role: 'user', type: 'text', text: message, ts: Date.now() });
  clearActivity();
  startActivity('analyze', 'วิเคราะห์คำขอ...');

  try {
    const data = await callPixelAI(message);
    completeActivity('analyze');

    // Execute each action from the AI
    if (data.actions && data.actions.length > 0) {
      for (const action of data.actions) {
        const fn = PixelFunctionRegistry[action.function];
        if (!fn) {
          startActivity(action.function, `ไม่รู้จักคำสั่ง: ${action.function}`);
          failActivity(action.function);
          continue;
        }

        const validationError = fn.validate(action.params);
        if (validationError) {
          startActivity(action.function, validationError);
          failActivity(action.function);
          continue;
        }

        startActivity(action.function, `กำลัง${action.label || 'ดำเนินการ'}...`);

        if (fn.requiresConfirmation) {
          setPixelStatus('idle');
          const confirmed = await showConfirmation(action.function, action.params);
          if (!confirmed) {
            addDialogue({ role: 'pixel', type: 'text', text: 'ยกเลิกเรียบร้อย', ts: Date.now() });
            failActivity(action.function);
            continue;
          }
          setPixelStatus('thinking');
        }

        try {
          fn.execute(action.params);
          completeActivity(action.function);
        } catch (err) {
          failActivity(action.function);
          addDialogue({ role: 'pixel', type: 'error', text: `เกิดข้อผิดพลาด: ${err.message}`, ts: Date.now() });
        }
      }
    }

    // Add AI reply to dialogue
    addDialogue({ role: 'pixel', type: 'text', text: data.reply, ts: Date.now() });

    // Save to chat history
    pixelState.chatHistory.push({ role: 'user', text: message, ts: Date.now() });
    pixelState.chatHistory.push({ role: 'pixel', text: data.reply, intent: data.intent, actions: data.actions, ts: Date.now() });
    if (pixelState.chatHistory.length > 30) {
      pixelState.chatHistory = pixelState.chatHistory.slice(-30);
    }
    savePixelChatHistory();

    // Refresh UI if data was modified
    if (data.actions && data.actions.some(a => a.function !== 'navigate')) {
      renderKcalPage();
      renderDashboard();
    }

    setPixelStatus('done');

  } catch (err) {
    setPixelStatus('error');
    addDialogue({ role: 'pixel', type: 'error', text: `ไม่สามารถติดต่อ AI ได้: ${err.message}`, ts: Date.now() });
  }
}
```

---

## Phase 3: Worker Changes

### 3.1 Routing in Existing Worker

Add to `worker/src/index.js`:

```javascript
addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname === '/pixel-secretary') {
    event.respondWith(handlePixelSecretary(event.request));
  } else {
    event.respondWith(handleOriginalChat(event.request));
  }
});
```

### 3.2 System Prompt (for Pixel Secretary)

The existing system prompt is replaced with one that:
- Defines Pixel Secretary as a personal health agent
- Lists available functions with parameter schemas (addMeal, updateWeight, addExercise, navigate)
- Instructs AI to return structured `{ intent, reply, plan, actions }` JSON
- Instructs AI to use Thai language
- Provides today's context (date, time, user profile, goals, today's summary)

### 3.3 Response Format

Same format as the original plan — no change needed:

```json
{
  "intent": "log_food" | "log_weight" | "log_exercise" | "navigate" | "chat" | "clarify" | "mixed",
  "reply": "รับทราบค่ะ เพิ่มข้าวมันไก่ 550 kcal เรียบร้อย",
  "plan": [
    { "step": "analyze", "label": "วิเคราะห์อาหาร" },
    { "step": "addMeal", "label": "บันทึกมื้ออาหาร" }
  ],
  "actions": [
    {
      "function": "addMeal",
      "params": { "name": "ข้าวมันไก่", "kcal": 550, "protein": 25 },
      "label": "บันทึกมื้ออาหาร"
    }
  ]
}
```

### 3.4 Model Priority

Same fallback chain as existing worker (no changes needed):

1. `gemini-3.1-flash-lite`
2. `gemini-3.5-flash`
3. `gemini-2.5-flash-lite`

---

## Phase 4: Firestore Chat History

### 4.1 Document Path

```
users/{uid}/pixel/chatHistory
```

### 4.2 Document Structure

A single document (not a subcollection) storing the last 30 messages:

```javascript
{
  messages: [
    { role: "user" | "pixel", text: "...", intent: "log_food" | "chat", actions: [...], ts: 1234567890 },
    // ... up to 30 messages
  ],
  updatedAt: serverTimestamp()
}
```

### 4.3 Save Function

```javascript
async function savePixelChatHistory() {
  if (!currentUser) return;
  try {
    await setDoc(doc(db, 'users', currentUser.uid, 'pixel', 'chatHistory'), {
      messages: pixelState.chatHistory,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('Failed to save Pixel chat history:', err);
  }
}
```

### 4.4 Load Function

```javascript
async function loadPixelChatHistory() {
  if (!currentUser) return;
  try {
    const snap = await getDoc(doc(db, 'users', currentUser.uid, 'pixel', 'chatHistory'));
    if (snap.exists()) {
      pixelState.chatHistory = snap.data().messages || [];
      renderDialogue();
    }
  } catch (err) {
    console.warn('Failed to load Pixel chat history:', err);
  }
}
```

### 4.5 When to Save

- After each AI interaction (in `handlePixelMessage`)
- Debounced (same pattern as existing `saveState()`)

---

## Implementation Order

| Phase | What | Files Changed |
|-------|------|---------------|
| **Phase 1** | Add 5th tab + page div + basic layout + CSS + status indicators + activity log + dialogue + input | `index.html`, `styles.css` |
| **Phase 2** | Add Pixel state, FunctionRegistry (4 functions), confirmation dialog, AI call, main handler | `index.html` |
| **Phase 3** | Add `/pixel-secretary` route + system prompt to existing worker | `worker/src/index.js` |
| **Phase 4** | Add Firestore chat history save/load | `index.html` |

---

## What's Post-MVP

| Feature | Reason |
|---------|--------|
| Pixel art character | Visual polish, not core functionality |
| Character animations | Visual polish |
| 10+ character states | 4 states are sufficient |
| `updateMeal` / `deleteMeal` functions | Not in MVP scope |
| `updateGoal` function | Not in MVP scope |
| `searchFood` function | Not in MVP scope |
| `generateReport` function | Not in MVP scope |
| `readAnalytics` function | Not in MVP scope |
| Voice mode | Future feature |
| Daily brief | Future feature |
| Achievement reactions | Future feature |
| Multi-model AI selection | Future feature |
| Worker rollback/undo | Overengineered for MVP |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Gemini returns invalid JSON | Worker validates; client shows friendly error |
| AI hallucinates function params | Client-side validation in `FunctionRegistry.validate()` |
| Network failure during AI call | 30s timeout + error message with retry suggestion |
| User sends duplicate messages | Debounce send button (1s cooldown) |
| Firestore chat history write fails | Silently fail (console.warn only); no user-facing error |
| 5th tab overflows mobile nav | Use shorter label text or icon; test on narrow viewports |
| Confusion between Pixel and existing AI chat | Separate tab, separate state, separate history |