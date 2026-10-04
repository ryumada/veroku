# 🚀 Implementation Plan: Native OS & PWA Notifications for Veroku

---

## 1. Problem Summary / Objective
Veroku has been upgraded to a standalone Progressive Web Application (PWA) with installable manifest, custom app icons, and offline caching. However, notifications are currently restricted to in-app DOM alerts (`#dashboard-notifications` and floating UI toasts). 

The goal is to enable **native OS system notifications** (desktop banners, Android notification drawer alerts, lock screen reminders, and badge counts) powered by the browser's `Notification` and `ServiceWorkerRegistration.showNotification()` APIs. The system must remain **100% offline-first and private**, operating with zero external push servers.

---

## 2. Root Cause Analysis / Architectural Strategy

### Architecture Principles:
1. **Client-Side Native Notifications**:
   - Modern browsers (Chrome, Edge, Firefox, Android Chrome/Samsung Internet, Safari on macOS/iOS 16.4+ standalone) support the W3C Notifications API and `ServiceWorkerRegistration.showNotification(title, options)`.
   - By dispatching notifications through the active Service Worker registration, notifications display with the native Veroku icon (`icons/icon-192.png`), badge (`icons/favicon-32.png`), vibration pattern, and interactive click-to-open behavior.

2. **Trigger Points for Maintenance Alerts**:
   - **App Launch / State Load**: When the user opens Veroku, evaluate if any components have reached `Critical / Overdue` (or `Due Soon / Warning`) status and notify.
   - **Odometer Log Update**: When odometer distance is adjusted, evaluate degradation deltas. If a component crosses into overdue status, fire an instant system alert.
   - **Routine Inspection Schedule**: When scheduled Daily/Weekly/Monthly checklist times are reached and items remain unchecked, notify the user.
   - **Periodic Background Sync (Progressive Enhancement)**: Register `periodicSync` with tag `'veroku-maintenance-check'` if supported by the browser (Chromium Android/Desktop) to allow background wake-up evaluations.

3. **Notification Throttling & De-duplication**:
   - To avoid spamming the user on every page interaction, track the timestamp of the last dispatched notification for each component/reminder in `localStorage` (`v_last_notified_{id}`).
   - Only re-notify after a configurable interval (e.g. 24 hours) or when the status changes from Warning to Critical.

4. **Dedicated Settings Card & Permission Manager**:
   - Provide clear controls in the **Settings** view:
     - Master toggle: **Enable System / Push Notifications**.
     - Sub-options: Alert on Critical Parts, Alert on Due Soon Parts, Alert on Routine Checklists.
     - **Send Test Notification** button for immediate hardware verification (sound, vibration, banner).
     - Permission status badge (`Granted`, `Default / Needs Prompt`, `Denied / Blocked`).

---

## 3. Proposed Changes

### Component 1: Notifications Engine (`js/notifications.js`)
Create a dedicated client-side notification module (`window.VerokuNotifications`):
- `isSupported()`: Checks `'Notification' in window` and `'serviceWorker' in navigator`.
- `getPermissionStatus()`: Returns `'granted'`, `'denied'`, or `'default'`.
- `requestPermission()`: Prompts browser permission dialog.
- `sendNotification(title, options)`: Dispatches via `navigator.serviceWorker.ready -> registration.showNotification()` with fallback to `new Notification()`.
- `checkAndDispatchAlerts(state)`: Evaluates current vehicle components (using `computeAllServices`) and checklist reminders (using `checkReminders`). Dispatches OS notifications for newly overdue items subject to 24-hour rate limiting.
- `sendTestNotification()`: Sends a sample vehicle maintenance notification.

### Component 2: Service Worker Notification Handlers (`sw.js`)
- Add `notificationclick` event listener:
  - When the user clicks the notification, focus an existing open Veroku window/tab, or open a new window to `index.html`.
  - Parse `event.notification.data` to navigate directly to the relevant view (e.g., `#view-dashboard` or `#view-services`).
- Add `periodicsync` listener (optional background sync if supported by browser).
- Bump cache name to `veroku-cache-v1.7` and add `./js/notifications.js` to cached assets.

### Component 3: HTML Shell & Settings UI (`index.html`)
- Add `<script src="js/notifications.js"></script>` before `js/app.js`.
- Add a new **Native Notifications** card in `#view-settings` containing:
  - Header: badge `NOTIFY` with title "System & OS Notifications".
  - Status row with permission indicator badge (`Granted`, `Default`, `Blocked`).
  - Toggle: "Enable System Notifications".
  - Sub-checkboxes for:
    - 🚨 Overdue & Critical components
    - ⚠️ Warning / Due soon components
    - 📋 Scheduled daily/weekly/monthly checklist inspections
  - Action row: "Send Test Notification" button.

### Component 4: Styling (`css/styles.css`)
- Add styling for notification settings card, permission badges, and action buttons.

### Component 5: App Controller Wiring (`js/app.js` & `js/ui.js`)
- Wire permission request toggle and "Send Test Notification" button.
- Call `window.VerokuNotifications.checkAndDispatchAlerts(state)` upon:
  - Initial app startup (`DOMContentLoaded`).
  - Odometer HUD mileage updates (`btn-save-odometer`, quick +10/+50/+100).
  - Component edits/saves.

---

## 4. Files to Modify

| File | Change Description |
| :--- | :--- |
| `js/notifications.js` *(new)* | Native OS notification controller, permission requester, rate-limiting, and alert dispatcher. |
| `sw.js` | Add `notificationclick` handler, cache bump to `veroku-cache-v1.7`, pre-cache `js/notifications.js`. |
| `index.html` | Include `js/notifications.js`, add System Notifications card in Settings. |
| `css/styles.css` | Add styles for notification card controls, permission pill badges, and settings rows. |
| `js/ui.js` | Sync notification settings values during `renderSettings(state)`. |
| `js/app.js` | Event wiring for permission toggle, test button, and alert trigger hooks on odometer/app launch. |

---

## 5. User Flows

### Flow 1: Enabling Notifications
1. User navigates to **Settings** -> **System & OS Notifications**.
2. User toggles on "Enable System Notifications".
3. Browser displays native prompt: *"Veroku wants to send you notifications"*.
4. User clicks **Allow**.
5. UI updates permission badge to `Granted (Active)` and immediately fires a welcome notification with vibration.

### Flow 2: Maintenance Due Alert
1. User logs a new odometer reading of `14,200 km`.
2. Engine calculates that Engine Oil is overdue by `200 km`.
3. Veroku detects native notification permission is enabled.
4. OS fires a system banner:
   - **Title**: `🚨 Veroku: Engine Oil Overdue`
   - **Body**: `Exceeded maintenance interval by 200 km. Tap to log service.`
   - **Icon**: `icons/icon-192.png`
5. User clicks the banner -> OS focuses Veroku directly on the Dashboard.

### Flow 3: Testing Notifications
1. In Settings, user clicks **"Send Test Notification"**.
2. OS immediately plays notification chime and shows a test banner.

---

## 6. Open Questions & Decisions
1. **Default Notification Types**: By default, should notifications fire for both **Critical (Overdue)** and **Warning (Due Soon)**, or only **Critical**? (Recommendation: Default to Critical only to minimize noise, with a checkbox to enable Warning alerts).
2. **Frequency Cap**: Set re-notification frequency to 24 hours per component so the user isn't alerted multiple times on the same day if they haven't serviced the part yet.
