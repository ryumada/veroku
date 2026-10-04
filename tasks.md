---
title: tasks.md
category: Reference
description: Actionable task blueprint for Native OS & PWA Notifications
context: Notifications / PWA / Service Worker / Settings
---

# 📋 Tasks: Native OS & PWA Notifications

Reference: [implementation_plan.md](file:///home/ryumada/personal_projects/veroku/implementation_plan.md)

---

## 1. Native Notifications Engine
File: `js/notifications.js`

- [x] **1.1** Create `js/notifications.js` with mandatory 5-line file signature header:
  ```javascript
  /**
   * @file notifications.js
   * @category Service
   * @description Client-side native OS notification manager handling permission negotiation, notification dispatch, and throttling.
   * @requires ServiceWorkerRegistration, Notification, js/engine.js
   */
  ```
- [x] **1.2** Implement `isSupported()` checking for `'Notification' in window`.
- [x] **1.3** Implement `getPermission()` returning `Notification.permission` ('granted', 'denied', 'default').
- [x] **1.4** Implement `requestPermission()` returning a Promise that resolves to the permission state.
- [x] **1.5** Implement `sendNotification(title, options)`:
  - If Service Worker registration is ready, dispatch via `registration.showNotification(title, options)`.
  - Fallback to `new Notification(title, options)`.
  - Attach default icons (`icons/icon-192.png`, `icons/favicon-32.png`), vibration pattern `[200, 100, 200]`, and payload data.
- [x] **1.6** Implement `checkAndDispatchAlerts(state)`:
  - Check if notifications are enabled in settings and permission is granted.
  - Calculate component wear with `computeAllServices(services, odo)`.
  - Filter for overdue (critical) or warning components based on user preferences.
  - Check 24-hour rate limit key in `localStorage` (`v_notif_last_{id}`).
  - Dispatch notification and record dispatch timestamp.
- [x] **1.7** Implement `sendTestNotification()` for instant verification.
- [x] **1.8** Export API under `window.VerokuNotifications`.

---

## 2. Service Worker Notification Event Handling & Cache Bump
File: `sw.js`

- [x] **2.1** Preserve the mandatory 5-line file signature at the top of `sw.js`.
- [x] **2.2** Bump cache version constant `CACHE_NAME` to `'veroku-cache-v1.7'`.
- [x] **2.3** Add `'./js/notifications.js'` to the `ASSETS` pre-cache list.
- [x] **2.4** Add `self.addEventListener('notificationclick', ...)`:
  - Close the notification.
  - Match active window clients and focus the Veroku app window.
  - If no open client exists, call `clients.openWindow('./')`.

---

## 3. HTML Shell & Notification Settings Card
File: `index.html`

- [x] **3.1** Preserve the mandatory 5-line file signature at the top of `index.html`.
- [x] **3.2** Include `<script src="js/notifications.js"></script>` before `js/app.js`.
- [x] **3.3** In `#view-settings`, add the **Native Notifications** card containing:
  - Badge `NOTIFY` with title "System & OS Notifications".
  - Status row with permission indicator badge (`#notif-perm-badge`).
  - Master toggle checkbox (`#setting-notif-enabled`) for "Enable System Notifications".
  - Sub-options container (hidden if disabled):
    - Checkbox (`#setting-notif-critical`): "Alert on Overdue / Critical Components".
    - Checkbox (`#setting-notif-warning`): "Alert on Due Soon / Warning Components".
    - Checkbox (`#setting-notif-checklists`): "Alert on Scheduled Safety Checklists".
  - Action button (`#btn-test-notification`): "🔔 Send Test Notification".

---

## 4. CSS Styles
File: `css/styles.css`

- [x] **4.1** Preserve the mandatory 5-line file signature at the top of `css/styles.css`.
- [x] **4.2** Add styling for the notification settings card (`.notif-sub-options`, `.perm-badge`, `.notif-actions-row`).
- [x] **4.3** Ensure full responsiveness and proper light/dark theme contrast.

---

## 5. UI & State Mapping
File: `js/ui.js`

- [x] **5.1** Preserve the mandatory 5-line file signature at the top of `js/ui.js`.
- [x] **5.2** Update `renderSettings(state)` to populate notification settings values and refresh the permission status badge.

---

## 6. App Controller & Event Wiring
File: `js/app.js`

- [x] **6.1** Preserve the mandatory 5-line file signature at the top of `js/app.js`.
- [x] **6.2** Wire master toggle change event:
  - If checked and permission is not `'granted'`, trigger `VerokuNotifications.requestPermission()`.
  - Save notification preferences into `state.settings.notifications`.
- [x] **6.3** Wire `#btn-test-notification` click listener to call `VerokuNotifications.sendTestNotification()`.
- [x] **6.4** Hook `VerokuNotifications.checkAndDispatchAlerts(state)` on:
  - Initial load after DOM is ready.
  - Odometer HUD update handlers (save, quick adjust +10/+50/+100).
  - Component add/edit/delete actions.

---

## 7. Verification

- [x] **7.1** Run syntax verification with `node -c js/notifications.js`, `node -c sw.js`, `node -c js/ui.js`, and `node -c js/app.js`.
- [x] **7.2** Check that all modified and newly created files retain their mandatory 5-line file signatures.
- [x] **7.3** Verify offline operation and ensure no external network dependencies are introduced.
