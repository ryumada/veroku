/**
 * @file notifications.js
 * @category Service
 * @description Client-side native OS notification manager handling permission negotiation, notification dispatch, and throttling.
 * @requires ServiceWorkerRegistration, Notification, js/engine.js
 */

(function () {
  'use strict';

  const NOTIF_STORAGE_PREFIX = 'v_notif_last_';
  const RATE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours per unique component/reminder

  /**
   * Check if Native Notifications and Service Worker are supported by the browser.
   * @returns {boolean}
   */
  function isSupported() {
    return ('Notification' in window);
  }

  /**
   * Get current native notification permission.
   * @returns {'granted' | 'denied' | 'default'}
   */
  function getPermission() {
    if (!isSupported()) return 'denied';
    return Notification.permission;
  }

  /**
   * Request native notification permission from the user.
   * @returns {Promise<'granted' | 'denied' | 'default'>}
   */
  async function requestPermission() {
    if (!isSupported()) {
      return 'denied';
    }
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      return 'denied';
    }
  }

  /**
   * Dispatch a native OS notification via the active Service Worker registration if available,
   * falling back to the standard window Notification constructor.
   * @param {string} title
   * @param {object} [options]
   * @returns {Promise<boolean>}
   */
  async function sendNotification(title, options = {}) {
    if (!isSupported() || getPermission() !== 'granted') {
      return false;
    }

    const defaultOptions = {
      icon: 'icons/icon-192.png',
      badge: 'icons/favicon-32.png',
      vibrate: [200, 100, 200],
      tag: 'veroku-alert',
      renotify: true,
      data: {
        url: './',
        timestamp: Date.now()
      }
    };

    const finalOptions = Object.assign({}, defaultOptions, options);

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && typeof registration.showNotification === 'function') {
          await registration.showNotification(title, finalOptions);
          return true;
        }
      }
      // Fallback to Window Notification API
      new Notification(title, finalOptions);
      return true;
    } catch (err) {
      console.warn('Failed to send native notification:', err);
      return false;
    }
  }

  /**
   * Send a test notification to verify OS sound, vibration, and banner display.
   * @returns {Promise<boolean>}
   */
  async function sendTestNotification() {
    const perm = getPermission();
    if (perm !== 'granted') {
      const newPerm = await requestPermission();
      if (newPerm !== 'granted') {
        return false;
      }
    }

    return sendNotification('🔔 Veroku Notification Test', {
      body: 'System notifications are working correctly! You will receive alerts when vehicle components are due.',
      tag: 'veroku-test-notification',
      data: { view: 'view-settings' }
    });
  }

  /**
   * Check if a specific alert has been dispatched within the rate limit window.
   * @param {string} id
   * @returns {boolean} true if alert can be sent
   */
  function canSendAlert(id) {
    const key = NOTIF_STORAGE_PREFIX + id;
    const lastSent = Number(localStorage.getItem(key)) || 0;
    const now = Date.now();
    return (now - lastSent) > RATE_LIMIT_MS;
  }

  /**
   * Mark an alert as dispatched now in localStorage.
   * @param {string} id
   */
  function markAlertSent(id) {
    const key = NOTIF_STORAGE_PREFIX + id;
    localStorage.setItem(key, String(Date.now()));
  }

  /**
   * Evaluate state and dispatch native OS notifications for overdue or warning components
   * and scheduled safety checklists according to user settings.
   * @param {object} state
   * @returns {Promise<number>} Number of notifications sent
   */
  async function checkAndDispatchAlerts(state) {
    if (!state || !state.settings) return 0;
    const notifSettings = state.settings.notifications || {
      enabled: false,
      critical: true,
      warning: false,
      checklists: true
    };

    if (!notifSettings.enabled || getPermission() !== 'granted') {
      return 0;
    }

    let sentCount = 0;
    const activeVeh = (typeof getActiveVehicle === 'function') ? getActiveVehicle(state) : state;
    if (!activeVeh) return 0;

    const currentOdo = activeVeh.meta?.current_odometer || 0;
    const services = activeVeh.services || [];

    // 1. Evaluate Component Wear
    if (typeof computeAllServices === 'function') {
      const enrichedServices = computeAllServices(services, currentOdo);

      for (const item of enrichedServices) {
        const isCritical = item.status && item.status.cssClass === 'status--critical';
        const isWarning = item.status && item.status.cssClass === 'status--warning';

        if (isCritical && notifSettings.critical && canSendAlert(`crit_${item.id}`)) {
          let deltaMsg = '';
          if (item.deltaRemainingKm !== null && item.deltaRemainingKm <= 0) {
            deltaMsg = `Overdue by ${Math.abs(item.deltaRemainingKm)} km.`;
          } else if (item.deltaRemainingDays !== null && item.deltaRemainingDays <= 0) {
            deltaMsg = `Overdue by ${Math.abs(item.deltaRemainingDays)} days.`;
          } else {
            deltaMsg = 'Immediate maintenance required.';
          }

          const success = await sendNotification(`🚨 Maintenance Overdue: ${item.name}`, {
            body: `${activeVeh.name || 'Vehicle'}: ${deltaMsg} Tap to record service.`,
            tag: `veroku-part-${item.id}`,
            data: { view: 'view-dashboard', serviceId: item.id }
          });

          if (success) {
            markAlertSent(`crit_${item.id}`);
            sentCount++;
          }
        } else if (isWarning && notifSettings.warning && canSendAlert(`warn_${item.id}`)) {
          let deltaMsg = '';
          if (item.deltaRemainingKm !== null) {
            deltaMsg = `${item.deltaRemainingKm} km remaining.`;
          } else if (item.deltaRemainingDays !== null) {
            deltaMsg = `${item.deltaRemainingDays} days remaining.`;
          }

          const success = await sendNotification(`⚠️ Maintenance Due Soon: ${item.name}`, {
            body: `${activeVeh.name || 'Vehicle'}: ${deltaMsg} Scheduled interval approaching.`,
            tag: `veroku-part-${item.id}`,
            data: { view: 'view-dashboard', serviceId: item.id }
          });

          if (success) {
            markAlertSent(`warn_${item.id}`);
            sentCount++;
          }
        }
      }
    }

    // 2. Evaluate Scheduled Safety Checklists
    if (notifSettings.checklists && typeof checkReminders === 'function') {
      const dueChecklists = checkReminders(state);
      for (const check of dueChecklists) {
        if (canSendAlert(`chk_${check.type}`)) {
          const success = await sendNotification(`${check.icon || '📋'} Routine Check Due: ${check.title}`, {
            body: check.message || 'Scheduled safety inspection due. Tap to complete tasks.',
            tag: `veroku-check-${check.type}`,
            data: { view: 'view-dashboard', modalId: check.modalId }
          });

          if (success) {
            markAlertSent(`chk_${check.type}`);
            sentCount++;
          }
        }
      }
    }

    return sentCount;
  }

  // Export API globally
  window.VerokuNotifications = {
    isSupported,
    getPermission,
    requestPermission,
    sendNotification,
    sendTestNotification,
    checkAndDispatchAlerts
  };
})();
