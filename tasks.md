---
title: tasks.md
category: Reference
description: Actionable task blueprint for PWA installation, icons, and menu integration
context: PWA / Manifest / Navigation / Service Worker
---

# 📋 Tasks: PWA App Installation, High-Resolution Branding Icons & Menu Integration

Reference: [implementation_plan.md](file:///home/ryumada/personal_projects/veroku/implementation_plan.md)

---

## 1. Icon Assets Creation
File: `icons/*`

- [x] **1.1** Create `./icons` directory in repository root.
- [x] **1.2** Create `icons/icon.svg` featuring a modern dark theme background (`#0b0f17`), neon cyan/blue gradient speedometer arc (`#38bdf8` to `#3b82f6`), precision gear wheel teeth, and central stylized "V" motorcycle/vehicle degradation motif.
- [x] **1.3** Generate `icons/icon-512.png` (512x512 PNG, full bleed, purpose: any) from the SVG asset.
- [x] **1.4** Generate `icons/icon-192.png` (192x192 PNG, purpose: any).
- [x] **1.5** Generate `icons/icon-maskable-512.png` (512x512 PNG with 80% safe zone inner circular diameter, purpose: maskable) to ensure Android squircle/circle masks do not clip the logo.
- [x] **1.6** Generate `icons/icon-maskable-192.png` (192x192 PNG with 80% safe zone padding).
- [x] **1.7** Generate `icons/apple-touch-icon.png` (180x180 PNG) for iOS Safari home screen.
- [x] **1.8** Generate `icons/favicon-32.png` and `favicon.ico` for desktop browser tab display.

---

## 2. Web App Manifest Configuration
File: `manifest.json`

- [x] **2.1** Update `manifest.json` with standard PWA properties:
  - `"id": "./"`
  - `"name": "Veroku Vehicle Degradation Tracker"`
  - `"short_name": "Veroku"`
  - `"description": "Offline-first dashboard to track vehicle parts degradation cycle and routine maintenance safety checklists."`
  - `"start_url": "./index.html"`
  - `"scope": "./"`
  - `"display": "standalone"`
  - `"background_color": "#0b0f17"`
  - `"theme_color": "#0b0f17"`
  - `"orientation": "any"`
  - `"categories": ["utilities", "productivity", "transportation"]`
- [x] **2.2** Replace data URI icons with static relative icon file entries:
  - `icons/icon-192.png` (sizes: 192x192, type: image/png, purpose: any)
  - `icons/icon-512.png` (sizes: 512x512, type: image/png, purpose: any)
  - `icons/icon-maskable-192.png` (sizes: 192x192, type: image/png, purpose: maskable)
  - `icons/icon-maskable-512.png` (sizes: 512x512, type: image/png, purpose: maskable)
  - `icons/icon.svg` (sizes: any, type: image/svg+xml, purpose: any)

---

## 3. Service Worker Asset Caching
File: `sw.js`

- [x] **3.1** Add mandatory 5-line signature header to top of `sw.js`.
- [x] **3.2** Bump cache name from `veroku-cache-v56` to `veroku-cache-v57`.
- [x] **3.3** Add `./icons/icon.svg`, `./icons/icon-192.png`, `./icons/icon-512.png`, `./icons/icon-maskable-192.png`, `./icons/icon-maskable-512.png`, and `./icons/apple-touch-icon.png` to the `ASSETS` pre-cache array.

---

## 4. HTML Shell & UI Components
File: `index.html`

- [x] **4.1** Preserve the 5-line file signature at the top of the file.
- [x] **4.2** In `<head>`, add favicon links, apple-touch-icon link, and PWA meta tags (`theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`).
- [x] **4.3** In `<nav id="main-nav">`, insert the Install App button:
  `<button type="button" id="btn-install-app" class="nav-btn nav-install-btn" title="Install Veroku as App" hidden>`
  `<span class="btn-icon">📲</span><span class="btn-label">Install App</span></button>`.
- [x] **4.4** In `#view-settings`, add a dedicated "Application & Installation" card containing PWA status ("Browser Mode" vs "Standalone App"), an "Install App" button, and offline badge.
- [x] **4.5** Add an Install Guide modal (`#modal-install-guide`) to provide visual fallback instructions for iOS Safari and unsupported desktop browsers.

---

## 5. CSS Styles & Responsive Navigation
File: `css/styles.css`

- [x] **5.1** Preserve the 5-line file signature at the top of the file.
- [x] **5.2** Add styling for `.nav-install-btn` with subtle accent border or badge styling.
- [x] **5.3** Adapt `.nav-install-btn` for compact sidebar rail (icon only) and expanded hover overlay.
- [x] **5.4** Adapt `.nav-install-btn` for mobile bottom navigation bar (`max-width: 900px`).
- [x] **5.5** Style the Settings PWA status card and the Install Guide modal.

---

## 6. App Controller & PWA Lifecycle Logic
File: `js/app.js`

- [x] **6.1** Preserve the 5-line file signature at the top of the file.
- [x] **6.2** Update tab navigation wiring (`document.querySelectorAll('.nav-btn')`) to only target buttons that have `[data-view]` (`document.querySelectorAll('.nav-btn[data-view]')`), ensuring `#btn-install-app` does not disrupt tab view switching.
- [x] **6.3** Add PWA installation state management:
  - Listen for `beforeinstallprompt`: stash `deferredPrompt`, unhide `#btn-install-app` and settings install button.
  - Wire click handlers for `#btn-install-app` and settings install button to trigger `deferredPrompt.prompt()` if available, or open `#modal-install-guide` otherwise.
  - Listen for `appinstalled`: update buttons to "Installed ✅", show toast notification, and reset prompt reference.
  - Detect standalone mode (`display-mode: standalone` or `navigator.standalone`) on initialization, updating UI to reflect installed status and hiding navigation clutter.

---

## 7. Verification

- [x] **7.1** Verify all icon files exist in `./icons/` and match standard dimensions (192x192, 512x512, 180x180).
- [x] **7.2** Validate `manifest.json` syntax with `python3 -m json.tool manifest.json`.
- [x] **7.3** Verify service worker script syntax with `node -c sw.js`.
- [x] **7.4** Verify `js/app.js` syntax with `node -c js/app.js`.
- [x] **7.5** Check that all modified files maintain their required 5-line file signatures.
