/**
 * @file db.js
 * @category Service
 * @description LocalStorage data layer for Vehicle Manager with export/import and schema validation.
 * @requires None
 */

const STORAGE_KEY = 'v_manager_db_v2';

/**
 * Create a default vehicle profile object structure.
 * @param {string} [id]
 * @param {string} [name]
 * @param {string} [icon]
 * @param {number} [timestamp]
 * @param {Array<object>} [odometerLog]
 * @returns {object}
 */
function createDefaultVehicleProfile(id = 'v-1', name = 'My Vehicle', icon = '🏍️', timestamp = 0, odometerLog = []) {
  return {
    id,
    name,
    icon: icon || '🏍️',
    meta: {
      current_odometer: 0,
      last_updated_timestamp: timestamp,
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
    odometer_log: odometerLog,
    fuel_log: []
  };
}

const DEFAULT_STATE = {
  active_vehicle_id: 'v-1',
  vehicles: {
    'v-1': createDefaultVehicleProfile('v-1')
  },
  settings: {
    theme: 'dark',
    toast_duration: 5,
    reminders: {
      daily: { enabled: false, time: '08:00' },
      weekly: { enabled: false, day: 0, time: '09:00' },
      monthly: { enabled: false, date: 1, time: '10:00' }
    },
    fuel_types: []
  }
};

const EXAMPLE_FUEL_TYPES = [
  { id: 'ft-1', name: 'Pertalite', price: 10000 },
  { id: 'ft-2', name: 'Pertamax', price: 12950 },
  { id: 'ft-3', name: 'Pertamax Turbo', price: 14400 },
  { id: 'ft-4', name: 'Shell Super', price: 13500 },
  { id: 'ft-5', name: 'Shell V-Power', price: 14500 }
];

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
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNum}`;
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
    state.vehicles[activeId] = createDefaultVehicleProfile(activeId);
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
  state.vehicles[newId] = createDefaultVehicleProfile(newId, name, icon, Date.now(), [
    { odometer: 0, timestamp: Date.now() }
  ]);
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
        },
        fuel_types: Array.isArray(parsed.settings?.fuel_types)
          ? parsed.settings.fuel_types
          : []
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

const SNAPSHOTS_KEY = 'v_manager_snapshots_v1';
const MAX_SNAPSHOTS = 5;

/**
 * Save a rolling auto-snapshot of the app state.
 * @param {object} state
 * @param {string} [reason='State Update']
 */
function recordAutoSnapshot(state, reason = 'State Update') {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    let snapshots = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(snapshots)) snapshots = [];

    const activeVeh = getActiveVehicle(state);
    const snap = {
      id: generateId('snp'),
      timestamp: Date.now(),
      dateStr: new Date().toLocaleString(),
      reason,
      vehicleName: activeVeh ? activeVeh.name : 'All Vehicles',
      stateData: JSON.parse(JSON.stringify(state))
    };

    // Replace if last snapshot is less than 5 seconds old, else unshift
    if (snapshots.length > 0 && Date.now() - snapshots[0].timestamp < 5000) {
      snapshots[0] = snap;
    } else {
      snapshots.unshift(snap);
    }

    if (snapshots.length > MAX_SNAPSHOTS) {
      snapshots = snapshots.slice(0, MAX_SNAPSHOTS);
    }

    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
  } catch (err) {
    console.warn('Could not record auto snapshot:', err);
  }
}

/**
 * Get the list of saved auto-snapshots.
 * @returns {Array<object>}
 */
function getAutoSnapshots() {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

/**
 * Restore an auto-snapshot by ID.
 * @param {string} snapshotId
 * @returns {boolean}
 */
function restoreAutoSnapshot(snapshotId) {
  try {
    const snapshots = getAutoSnapshots();
    const found = snapshots.find(s => s.id === snapshotId);
    if (found && found.stateData) {
      saveAppState(found.stateData);
      return true;
    }
  } catch (err) {
    console.error('Failed to restore snapshot:', err);
  }
  return false;
}

/**
 * Save application state to localStorage.
 * @param {object} state
 */
function saveAppState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    recordAutoSnapshot(state);
  } catch (e) {
    console.error('Could not save state to localStorage', e);
  }
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
  const filename = `veroku-vehicle-manager-backup-${dateStr}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Share current app state JSON directly to other apps using Web Share API.
 */
async function shareData() {
  const state = getAppState();
  const jsonString = JSON.stringify(state, null, 2);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const filename = `veroku-backup-${dateStr}.json`;

  const blob = new Blob([jsonString], { type: 'application/json' });
  const file = new File([blob], filename, { type: 'application/json' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: 'Veroku Vehicle Manager Backup',
        text: `Veroku maintenance backup (${dateStr})`,
        files: [file]
      });
      if (window.showToast) window.showToast('Backup shared successfully!', 'success');
      return;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Share error:', err);
      }
      return;
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Veroku Vehicle Manager Backup',
        text: jsonString
      });
      if (window.showToast) window.showToast('Backup shared successfully!', 'success');
      return;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Text share error:', err);
      }
      return;
    }
  }

  exportData();
  if (window.showToast) window.showToast('Sharing not supported on this browser. Backup downloaded instead.', 'info');
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
    reader.onload = function (event) {
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
    reader.onerror = function () {
      resolve({ ok: false, error: 'File reading failed.' });
    };
    reader.readAsText(file);
  });
}

/**
 * Mark a service component as completed/serviced, updating its last serviced odometer and date.
 * @param {string} serviceId
 * @param {number} cost
 * @param {string} [notes]
 * @param {string} [serviceDate]
 */
function markServiceDone(serviceId, cost, notes, serviceDate) {
  const state = getAppState();
  const vehicle = getActiveVehicle(state);
  const service = vehicle.services.find(s => s.id === serviceId);
  if (service) {
    const todayStr = window.formatLocalDate ? window.formatLocalDate(new Date()) : new Date().toISOString().split('T')[0];
    const finalDate = serviceDate || todayStr;

    service.last_service_odometer = vehicle.meta.current_odometer;
    service.last_service_date = finalDate;

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
      service_date: finalDate,
      cost: Number(cost) || 0,
      timestamp: Date.now(),
      notes: notes || ''
    });

    saveAppState(state);
  }
}

/**
 * Add a new fuel log entry to the active vehicle.
 * @param {object} fuelData
 * @param {number} fuelData.odometer
 * @param {string} fuelData.fuel_type
 * @param {number} fuelData.price_per_liter
 * @param {number} fuelData.liters
 * @param {number} fuelData.total_cost
 * @param {boolean} fuelData.is_full_tank
 * @param {string} [fuelData.date]
 * @param {string} [fuelData.notes]
 */
function addFuelLog(fuelData) {
  const state = getAppState();
  const vehicle = getActiveVehicle(state);
  if (!vehicle) return;

  if (!Array.isArray(vehicle.fuel_log)) {
    vehicle.fuel_log = [];
  }

  const todayStr = window.formatLocalDate ? window.formatLocalDate(new Date()) : new Date().toISOString().split('T')[0];
  const finalDate = fuelData.date || todayStr;
  const odo = Number(fuelData.odometer) || 0;

  const entry = {
    id: generateId('fl'),
    timestamp: Date.now(),
    date: finalDate,
    odometer: odo,
    fuel_type: fuelData.fuel_type || 'Pertalite',
    price_per_liter: Number(fuelData.price_per_liter) || 0,
    liters: Number(fuelData.liters) || 0,
    total_cost: Number(fuelData.total_cost) || 0,
    is_full_tank: Boolean(fuelData.is_full_tank),
    notes: fuelData.notes || ''
  };

  vehicle.fuel_log.push(entry);

  // If refuel odometer is higher than current, update vehicle odometer and log it
  if (odo > (vehicle.meta.current_odometer || 0)) {
    vehicle.meta.current_odometer = odo;
    vehicle.meta.last_updated_timestamp = Date.now();
    if (!Array.isArray(vehicle.odometer_log)) {
      vehicle.odometer_log = [];
    }
    vehicle.odometer_log.push({
      odometer: odo,
      timestamp: Date.now(),
      notes: `Refuel: ${entry.fuel_type} (${entry.liters} L)`
    });
  }

  saveAppState(state);
  return entry;
}

/**
 * Delete a fuel log entry by ID.
 * @param {string} fuelLogId
 */
function deleteFuelLog(fuelLogId) {
  const state = getAppState();
  const vehicle = getActiveVehicle(state);
  if (!vehicle || !Array.isArray(vehicle.fuel_log)) return false;

  const idx = vehicle.fuel_log.findIndex(f => f.id === fuelLogId);
  if (idx !== -1) {
    vehicle.fuel_log.splice(idx, 1);
    saveAppState(state);
    return true;
  }
  return false;
}

/**
 * Update an existing fuel log entry by ID.
 * @param {string} fuelLogId
 * @param {object} updatedData
 */
function updateFuelLog(fuelLogId, updatedData) {
  const state = getAppState();
  const vehicle = getActiveVehicle(state);
  if (!vehicle || !Array.isArray(vehicle.fuel_log)) return false;

  const idx = vehicle.fuel_log.findIndex(f => f.id === fuelLogId);
  if (idx === -1) return false;

  const odo = Number(updatedData.odometer) || 0;
  vehicle.fuel_log[idx] = {
    ...vehicle.fuel_log[idx],
    date: updatedData.date || vehicle.fuel_log[idx].date,
    odometer: odo,
    fuel_type: updatedData.fuel_type || vehicle.fuel_log[idx].fuel_type,
    price_per_liter: Number(updatedData.price_per_liter) || 0,
    liters: Number(updatedData.liters) || 0,
    total_cost: Number(updatedData.total_cost) || 0,
    is_full_tank: Boolean(updatedData.is_full_tank),
    notes: updatedData.notes || ''
  };

  if (odo > (vehicle.meta.current_odometer || 0)) {
    vehicle.meta.current_odometer = odo;
    vehicle.meta.last_updated_timestamp = Date.now();
  }

  saveAppState(state);
  return vehicle.fuel_log[idx];
}

// Window exports
window.getAutoSnapshots = getAutoSnapshots;
window.restoreAutoSnapshot = restoreAutoSnapshot;
window.shareData = shareData;
window.addFuelLog = addFuelLog;
window.updateFuelLog = updateFuelLog;
window.deleteFuelLog = deleteFuelLog;
window.EXAMPLE_FUEL_TYPES = EXAMPLE_FUEL_TYPES;
