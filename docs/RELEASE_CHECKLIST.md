# Release Checklist — Pixel Secretary

Standard release procedure. Follow in order for every release.

---

## Pre-release

- [ ] Feature implementation is complete and tested
- [ ] Regression tests pass (desktop + mobile viewports)
- [ ] Documentation changes reviewed
- [ ] CHANGELOG entries written (Added, Changed, Fixed, Architecture)

---

## Versioning

Update in `index.html`:

- [ ] `APP_VERSION_V1` — e.g. `v1.9.0`
- [ ] `APP_BUILD_V1` — e.g. `2026.07.22.1`
- [ ] `APP_VERSION_NOTE_V1` — one-line release summary
- [ ] Version badge renders correctly in the app

Update in `README.md` and `docs/README.md`:

- [ ] Version table updated

---

## Service Worker

Update in `service-worker.js`:

- [ ] `CACHE_NAME` bumped — e.g. `milestone-tracker-v1.9.0`
- [ ] `APP_SHELL` includes all required assets (`./styles.css`, `./index.html`, etc.)
- [ ] `activate()` handler removes previous `milestone-tracker-*` caches (confirm logic)

---

## Documentation

- [ ] `docs/CHANGELOG.md` — release section added
- [ ] `docs/CHATGPT_HISTORY.md` — new phase added if architecture changed
- [ ] `docs/PROJECT_CONTEXT.md` — updated if milestone or principles changed
- [ ] `docs/README.md` — updated if features or structure changed
- [ ] `docs/DECISIONS.md` — updated if new architectural decisions made
- [ ] `docs/RELEASE_CHECKLIST.md` — reviewed; update if procedure changed

---

## Git

- [ ] `git diff` reviewed — only intended files changed
- [ ] Changes staged and committed with descriptive message
- [ ] Pushed to `origin/main`
- [ ] GitHub repository reflects latest commits

---

## Deployment (GitHub Pages)

- [ ] Pages deployment completed (check Actions tab)
- [ ] App version badge matches release
- [ ] Desktop UI verified (all tabs, features, Pixel Secretary)
- [ ] Android/mobile UI verified (touch interactions, responsive layout)
- [ ] Service worker updated (check Application > Service Workers in DevTools)
- [ ] Cache invalidation confirmed (old `milestone-tracker-*` caches cleared)

---

## Release Complete

| Field | Value |
|-------|-------|
| Version | |
| Build | |
| Commit hash | |
| Release date | |
