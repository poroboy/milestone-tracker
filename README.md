# Milestone Tracker

Personal health and milestone tracking web app with cloud sync, kcal/protein logging, AI health chat, and dashboard analytics.

Live app: https://poroboy.github.io/milestone-tracker/

## Current App Version

Current app version shown in the home page:

- Version: v1.6.12
- Build: 2026.06.21.12
- Notes: Restore login and reliable cross-device sync

## Current Features

### Account & Cloud Sync
- Google login with Firebase Authentication
- Firestore cloud sync per user
- Cross-device Firestore sync with merge protection
- Manual Sync Now button
- Automatic sync after save and app focus
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

This project currently uses a single-file app structure in `index.html`.

As the app grows, the next recommended refactor is to split the project into:
- index.html
- styles.css
- app.js
- firebase.js
- kcal.js
- dashboard.js
- ai.js

## Backup / Stable Version

Current stable tag: `stable-ai-dashboard-v1`

To inspect this stable version:

    git checkout stable-ai-dashboard-v1

To return to main branch after inspecting:

    git checkout main

## Security Notes

Do not commit API keys or secrets.

Gemini API key should be stored as a Cloudflare Wrangler secret, not inside source code.
