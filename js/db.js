/**
 * @file db.js
 * @category Service
 * @description LocalStorage data layer for Vehicle Manager with export/import and schema validation.
 * @requires None
 */

const STORAGE_KEY = 'v_manager_db';

const DEFAULT_STATE = {
  meta: {
    current_odometer: 0,
    last_updated_timestamp: 0
  },
  services: [],
  routine_checks: {
    daily: [],
    weekly: [],
    monthly: []
  },
  settings: {
    reminders: {
      daily: { enabled: false, time: '08:00' },
      weekly: { enabled: false, day: 0, time: '09:00' },
      monthly: { enabled: false, date: 1, time: '10:00' }
    }
  }
};

/**
 * Generate a random UUID-like unique identifier.
 * @param {string} prefix
 * @returns {string}
 */
function generateId(prefix) {
  return `${prefix}-${Math.random().toString(16).substring(2, 10)}`;
}

/**
 * Fetch the application state from local storage.
 * @returns {object}
 */
function getAppState() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (!rawData) {
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
    const parsed = JSON.parse(rawData);
    // Deep merge with defaults to ensure missing sections are present
    const state = {
      meta: { ...DEFAULT_STATE.meta, ...parsed.meta },
      services: parsed.services || [],
      routine_checks: {
        daily: parsed.routine_checks?.daily || [],
        weekly: parsed.routine_checks?.weekly || [],
        monthly: parsed.routine_checks?.monthly || []
      },
      settings: {
        reminders: {
          daily: {
            enabled: parsed.settings?.reminders?.daily?.enabled ?? DEFAULT_STATE.settings.reminders.daily.enabled,
            time: parsed.settings?.reminders?.daily?.time || DEFAULT_STATE.settings.reminders.daily.time
          },
          weekly: {
            enabled: parsed.settings?.reminders?.weekly?.enabled ?? DEFAULT_STATE.settings.reminders.weekly.enabled,
            day: parsed.settings?.reminders?.weekly?.day ?? DEFAULT_STATE.settings.reminders.weekly.day,
            time: parsed.settings?.reminders?.weekly?.time || DEFAULT_STATE.settings.reminders.weekly.time
          },
          monthly: {
            enabled: parsed.settings?.reminders?.monthly?.enabled ?? DEFAULT_STATE.settings.reminders.monthly.enabled,
            date: parsed.settings?.reminders?.monthly?.date ?? DEFAULT_STATE.settings.reminders.monthly.date,
            time: parsed.settings?.reminders?.monthly?.time || DEFAULT_STATE.settings.reminders.monthly.time
          }
        }
      }
    };
    return state;
  } catch (e) {
    console.error('Error reading from localStorage, resetting to defaults.', e);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

/**
 * Save the application state to local storage.
 * @param {object} state
 */
function saveAppState(state) {
  if (!state || typeof state !== 'object') return;
  state.meta = state.meta || {};
  state.meta.last_updated_timestamp = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Reset state to default state in local storage.
 * @returns {object}
 */
function resetAppState() {
  const defaults = JSON.parse(JSON.stringify(DEFAULT_STATE));
  saveAppState(defaults);
  return defaults;
}

/**
 * Export current app state to a JSON file download.
 */
function exportData() {
  const state = getAppState();
  const jsonString = JSON.stringify(state, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const filename = `vehicle-manager-backup-${dateStr}.json`;
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  // Clean up
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import and validate JSON data file.
 * @param {File} file
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
function importData(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve({ ok: false, error: 'No file selected.' });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const parsed = JSON.parse(event.target.result);
        
        // Schema Validation
        if (!parsed || typeof parsed !== 'object') {
          resolve({ ok: false, error: 'Invalid JSON file: Content must be a JSON object.' });
          return;
        }
        
        if (!parsed.meta || typeof parsed.meta !== 'object') {
          resolve({ ok: false, error: 'Invalid schema: Missing metadata.' });
          return;
        }
        
        if (typeof parsed.meta.current_odometer !== 'number') {
          resolve({ ok: false, error: 'Invalid schema: current_odometer must be a number.' });
          return;
        }
        
        if (!Array.isArray(parsed.services)) {
          resolve({ ok: false, error: 'Invalid schema: services must be an array.' });
          return;
        }
        
        // Validate each service structure
        for (const s of parsed.services) {
          if (!s.id || typeof s.name !== 'string' || typeof s.interval_km !== 'number' || typeof s.last_service_odometer !== 'number') {
            resolve({ ok: false, error: 'Invalid schema: Each service must contain id, name, interval_km (number), and last_service_odometer (number).' });
            return;
          }
        }
        
        if (!parsed.routine_checks || typeof parsed.routine_checks !== 'object') {
          resolve({ ok: false, error: 'Invalid schema: Missing routine_checks object.' });
          return;
        }
        
        if (!Array.isArray(parsed.routine_checks.daily) || !Array.isArray(parsed.routine_checks.monthly)) {
          resolve({ ok: false, error: 'Invalid schema: routine_checks must contain daily and monthly arrays.' });
          return;
        }
        
        // Successful validation
        saveAppState(parsed);
        resolve({ ok: true });
      } catch (e) {
        resolve({ ok: false, error: `JSON Parse error: ${e.message}` });
      }
    };
    reader.onerror = function() {
      resolve({ ok: false, error: 'File reading failed.' });
    };
    reader.readAsText(file);
  });
}

/**
 * Mark a service as completed, updating its last_service_odometer to current odometer.
 * @param {string} serviceId
 */
function markServiceDone(serviceId) {
  const state = getAppState();
  const service = state.services.find(s => s.id === serviceId);
  if (service) {
    service.last_service_odometer = state.meta.current_odometer;
    saveAppState(state);
  }
}
