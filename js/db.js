/**
 * @file db.js
 * @category Service
 * @description LocalStorage data layer for Vehicle Manager with export/import and schema validation.
 * @requires None
 */

const STORAGE_KEY = 'v_manager_db_v2';

const DEFAULT_STATE = {
  active_vehicle_id: 'v-1',
  vehicles: {
    'v-1': {
      id: 'v-1',
      name: 'My Vehicle',
      icon: '🏍️',
      meta: {
        current_odometer: 0,
        last_updated_timestamp: 0,
        daily_reset_date: '',
        weekly_reset_week: '',
        streak_days: 0,
        streak_last_completed_date: ''
      },
      services: [],
      routine_checks: {
        daily: [],
        weekly: [],
        monthly: []
      },
      service_history: [],
      odometer_log: []
    }
  },
  settings: {
    theme: 'dark',
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
 * Get ISO week string for date comparison.
 * @param {Date} date
 * @returns {string}
 */
function getISOWeekString(date) {
  const tempDate = new Date(date.valueOf());
  const dayNum = (date.getDay() + 6) % 7;
  tempDate.setDate(tempDate.getDate() - dayNum + 3);
  const firstThursday = tempDate.valueOf();
  tempDate.setMonth(0, 1);
  if (tempDate.getDay() !== 4) {
    tempDate.setMonth(0, 1 + ((4 - tempDate.getDay() + 7) % 7));
  }
  const weekNum = 1 + Math.ceil((firstThursday - tempDate) / 604800000);
  return `${tempDate.getFullYear()}-W${weekNum}`;
}

/**
 * Retrieve active vehicle profile.
 * @param {object} state
 * @returns {object}
 */
function getActiveVehicle(state) {
  const activeId = state.active_vehicle_id || 'v-1';
  if (!state.vehicles) state.vehicles = {};
  if (!state.vehicles[activeId]) {
    state.vehicles[activeId] = {
      id: activeId,
      name: 'My Vehicle',
      icon: '🏍️',
      meta: {
        current_odometer: 0,
        last_updated_timestamp: 0,
        daily_reset_date: '',
        weekly_reset_week: '',
        streak_days: 0,
        streak_last_completed_date: ''
      },
      services: [],
      routine_checks: {
        daily: [],
        weekly: [],
        monthly: []
      },
      service_history: [],
      odometer_log: []
    };
  }
  return state.vehicles[activeId];
}

/**
 * Add a new vehicle profile to the state.
 * @param {object} state
 * @param {string} name
 * @param {string} icon
 * @returns {string} The new vehicle profile ID
 */
function addVehicleProfile(state, name, icon) {
  const newId = generateId('v');
  if (!state.vehicles) state.vehicles = {};
  state.vehicles[newId] = {
    id: newId,
    name: name,
    icon: icon || '🏍️',
    meta: {
      current_odometer: 0,
      last_updated_timestamp: Date.now(),
      daily_reset_date: '',
      weekly_reset_week: '',
      streak_days: 0,
      streak_last_completed_date: ''
    },
    services: [],
    routine_checks: {
      daily: [],
      weekly: [],
      monthly: []
    },
    service_history: [],
    odometer_log: [
      { odometer: 0, timestamp: Date.now() }
    ]
  };
  state.active_vehicle_id = newId;
  return newId;
}

/**
 * Update active vehicle profile name and icon.
 * @param {object} state
 * @param {string} name
 * @param {string} icon
 */
function updateActiveVehicleProfile(state, name, icon) {
  const activeVeh = getActiveVehicle(state);
  activeVeh.name = name;
  activeVeh.icon = icon || '🏍️';
}

/**
 * Delete the active vehicle profile.
 * @param {object} state
 * @returns {boolean} Whether deletion succeeded
 */
function deleteActiveVehicleProfile(state) {
  const activeId = state.active_vehicle_id || 'v-1';
  const vids = Object.keys(state.vehicles || {});
  
  if (vids.length <= 1) {
    return false;
  }
  
  delete state.vehicles[activeId];
  
  // Pick another active vehicle ID
  const remainingVids = Object.keys(state.vehicles);
  state.active_vehicle_id = remainingVids[0];
  return true;
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
    
    // Deep merge to ensure compatibility and default settings structure
    const state = {
      active_vehicle_id: parsed.active_vehicle_id || DEFAULT_STATE.active_vehicle_id,
      vehicles: parsed.vehicles || DEFAULT_STATE.vehicles,
      settings: {
        theme: parsed.settings?.theme || DEFAULT_STATE.settings.theme,
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

    // Auto reset check
    const activeVeh = getActiveVehicle(state);
    const todayStr = new Date().toISOString().split('T')[0];
    const thisWeekStr = getISOWeekString(new Date());

    let stateChanged = false;
    if (activeVeh.meta.daily_reset_date !== todayStr) {
      if (Array.isArray(activeVeh.routine_checks.daily)) {
        activeVeh.routine_checks.daily.forEach(c => c.checked = false);
      }
      activeVeh.meta.daily_reset_date = todayStr;
      stateChanged = true;
    }

    if (activeVeh.meta.weekly_reset_week !== thisWeekStr) {
      if (Array.isArray(activeVeh.routine_checks.weekly)) {
        activeVeh.routine_checks.weekly.forEach(c => c.checked = false);
      }
      activeVeh.meta.weekly_reset_week = thisWeekStr;
      stateChanged = true;
    }

    if (stateChanged) {
      saveAppState(state);
    }

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
        
        if (!parsed || typeof parsed !== 'object') {
          resolve({ ok: false, error: 'Invalid JSON file: Content must be a JSON object.' });
          return;
        }
        
        if (!parsed.active_vehicle_id || !parsed.vehicles || typeof parsed.vehicles !== 'object') {
          resolve({ ok: false, error: 'Invalid schema: Missing multi-vehicle structures.' });
          return;
        }
        
        for (const vid in parsed.vehicles) {
          const veh = parsed.vehicles[vid];
          if (!veh.id || !veh.name || !veh.meta || !Array.isArray(veh.services) || !veh.routine_checks) {
            resolve({ ok: false, error: `Invalid schema inside vehicle profile: ${vid}` });
            return;
          }
        }
        
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
 * @param {number} cost
 * @param {string} notes
 */
function markServiceDone(serviceId, cost, notes) {
  const state = getAppState();
  const vehicle = getActiveVehicle(state);
  const service = vehicle.services.find(s => s.id === serviceId);
  if (service) {
    service.last_service_odometer = vehicle.meta.current_odometer;
    service.last_service_date = new Date().toISOString().split('T')[0];
    
    // Clear one-time overrides
    service.one_time_limit_km = null;
    service.one_time_limit_date = null;
    
    if (!vehicle.service_history) {
      vehicle.service_history = [];
    }
    vehicle.service_history.push({
      id: generateId('sh'),
      service_id: serviceId,
      service_name: service.name,
      odometer_at_service: vehicle.meta.current_odometer,
      cost: Number(cost) || 0,
      timestamp: Date.now(),
      notes: notes || ''
    });
    
    saveAppState(state);
  }
}
