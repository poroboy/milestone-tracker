# Milestone Tracker

Personal health and milestone tracking web app with cloud sync, kcal/protein logging, AI health chat, and dashboard analytics.

Live app: https://poroboy.github.io/milestone-tracker/

## Current App Version

Current app version shown in the home page:

- Version: v1.6.31
- Build: 2026.07.15.31
- Notes: Adds faster app-aware AI and keeps high-risk meal details in a compact scrollable list

## Release v1.6.31

- Sends compact pre-calculated 7, 30, and 90-day app summaries to AI instead of the full database
- Lets AI answer questions about recorded weight direction, weekly pace, kcal balance, protein, goals, and data coverage
- Distinguishes recorded weight from app-estimated weight in the analytics context
- Sends profile metrics and Bangkok date/time context that the Worker already supports
- Shows clearer progress and request-timeout messages while AI is working
- Uses a low-latency model first and keeps larger models as fallbacks
- Keeps the same Firestore paths and does not change or migrate saved user data
- Lists the date, food name, estimated macros, and reason for every high-risk meal on the kcal and dashboard insights
- Keeps four high-risk meals visible and scrolls the remaining meals inside the card
- Normalizes Thai and English risk labels so older food records appear consistently

## Release v1.6.30

- Allows Build and release-note text to wrap inside narrow mobile screens
- Keeps all four bottom navigation buttons within the viewport at equal widths
- Adds safe-area-aware horizontal padding for mobile browser and installed PWA layouts
- Preserves all v1.6.29 features and uses the same Firestore data without migration

## Release v1.6.29

- Adds a predicted-vs-recorded weight chart with exact values on tap or click
- Adds 30-day, 90-day, and yearly chart ranges with a 7-day moving average
- Adds short-term weight pace and plateau analysis
- Adds in-page editing and deletion for recorded weight history
- Adds validated JSON Import / Restore alongside the existing Export Data backup
- Adds a readable Cloud status panel for online, offline, pending, successful, and failed sync states
- Keeps the existing Firestore paths and data format; no data migration or reset is required

## Current Features

### Account & Cloud Sync
- Google login with Firebase Authentication
- Firestore cloud sync per user
- Cross-device Firestore sync with merge protection
- Manual Sync Now button
- Automatic sync after save and app focus
- Clear online/offline, pending-change, and last-successful-sync status
- Split per-day Firestore sync to avoid 1MB document limit
- Local state plus cloud backup behavior

### Kcal & Protein Tracker
- Daily kcal tracking
- Manual food log
- Manual exercise log
- Protein tracking per food item
- Daily protein goal
- Monthly kcal summary
- Daily history by selected month

### Glucose / Insulin Insight
- Estimates carb, sugar, and fiber for food logs
- Shows daily carb and sugar insight on the kcal page
- Shows monthly glucose spike risk summary on the dashboard
- Uses estimated glucose spike risk: low, medium, or high
- This is not a medical insulin or blood glucose measurement

### AI Health Chat
- AI chat for food, kcal, protein, workout, and health suggestions
- Auto log food and exercise from natural language
- Estimates kcal and protein from Thai food portions
- Prevents duplicate logging when the user mentions an item as context
- Shows active AI model in chat
- Sends current date/time context to AI for more relevant suggestions

### AI Model Fallback

AI is powered by a Cloudflare Worker connected to Gemini API.

Model priority:
1. gemini-3.5-flash
2. gemini-2.5-flash
3. gemini-2.5-flash-lite

If the first model is unavailable or in high demand, the Worker automatically falls back to the next model.

### Energy Analytics
- Total kcal consumed
- Total kcal burned from base kcal plus exercise
- Accumulated kcal deficit or surplus
- Estimated fat loss using 7,700 kcal per 1 kg as an approximation
- Remaining kcal to the next estimated 1 kg milestone
- Daily, monthly, and yearly kcal chart comparing food intake vs total burn

### Dashboard
- Yearly dashboard
- Monthly kcal trend
- Monthly protein trend
- Daily history by selected month
- Weight history
- Predicted vs recorded weight trend chart for the selected year
- Tappable chart points showing the date, exact weight, and same-day difference
- 30-day, 90-day, and yearly weight chart ranges
- 7-day average weight line and 1–4 week pace/plateau analysis
- Editable and removable weight history entries
- Automatic direction summary: aligned, unclear, or moving in opposite directions
- Dashboard weight recorder linked to current weight and weight history
- Health progress insight
- Body profile fields:
  - gender
  - age
  - current weight
  - height
  - baseline activity
- Estimated BMI, BMR, TDEE, and protein target

### Data Management
- Export all app data as a JSON backup file
- Import and restore a JSON backup after validation and confirmation
- Delete individual food and exercise entries for today
- Reset today's food and exercise logs while preserving base kcal

### Realtime Context
- Shows current local date and time
- Uses Asia/Bangkok time context
- AI receives time/day-part context for better meal and activity suggestions

## Tech Stack

- HTML / CSS / JavaScript
- Firebase Authentication
- Firebase Firestore
- GitHub Pages
- Cloudflare Workers
- Gemini API

## Important Data Notes

The app stores user data in Firestore under a user-specific path.

Do not change the Firestore data path unless a migration plan is prepared.

Important data fields include:
- kcalDays
- proteinGoal
- weightLogs
- profile
- aiChatHistory

## Development Notes

This project is a static GitHub Pages app. The main app logic is still in `index.html`, while styling and install/offline support are split into:
- `styles.css`
- `manifest.webmanifest`
- `service-worker.js`
- `icon-192.png`
- `icon-512.png`

AI chat is handled by the Cloudflare Worker in `worker/src/index.js`.

As the app grows, the next recommended refactor is to split the project into:
- index.html
- styles.css
- app.js
- firebase.js
- kcal.js
- dashboard.js
- ai.js

## Backup / Stable Version

Current release tag: `v1.6.30`

Previous release tag: `v1.6.29`

Earlier stable tag: `stable-ai-dashboard-v1`

To inspect this stable version:

    git checkout stable-ai-dashboard-v1

To return to main branch after inspecting:

    git checkout main

## Security Notes

Do not commit API keys or secrets.

Gemini API key should be stored as a Cloudflare Wrangler secret, not inside source code.
