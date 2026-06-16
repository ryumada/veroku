/**
 * @file ui.js
 * @category UI
 * @description UI rendering engine for DOM repaints, toast popups, modal controllers.
 * @requires js/db.js, js/engine.js
 */

// Module state for import file tracking
let pendingImportFile = null;

/**
 * Format odometer to a padded string of digits.
 * @param {number} value
 * @param {number} length
 * @returns {string}
 */
function formatOdometer(value, length = 6) {
  const valString = Math.floor(value || 0).toString();
  if (valString.length >= length) return valString;
  return valString.padStart(length, '0');
}

/**
 * Display toast notification.
 * @param {string} message
 * @param {'success'|'error'} type
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✅' : '❌';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  
  container.appendChild(toast);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'modalFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) reverse';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}

/**
 * Render the Odometer HUD block at the top of Dashboard.
 * @param {object} state
 */
function renderOdometerHUD(state) {
  const container = document.getElementById('odometer-hud');
  if (!container) return;

  const currentOdo = state.meta.current_odometer || 0;
  const lastUpdated = state.meta.last_updated_timestamp;
  const timeString = lastUpdated 
    ? new Date(lastUpdated).toLocaleString() 
    : 'Never updated';

  const paddedOdo = formatOdometer(currentOdo);
  let digitsHTML = '';
  for (let char of paddedOdo) {
    digitsHTML += `<span class="digit">${char}</span>`;
  }

  container.innerHTML = `
    <div class="hud-reading">
      <span class="hud-label">Current Odometer</span>
      <div class="hud-odometer-wrap">
        <div class="hud-odometer-digits">
          ${digitsHTML}
        </div>
        <span class="hud-unit">KM</span>
      </div>
      <div class="hud-timestamp">Last Synced: ${timeString}</div>
    </div>
    <div class="hud-input-panel">
      <label for="input-hud-odo">Update Log Reading (KM)</label>
      <form id="form-odometer" class="hud-form">
        <input type="number" id="input-hud-odo" min="${currentOdo}" value="${currentOdo}" required placeholder="${currentOdo}">
        <button type="submit" title="Submit new Odometer reading">LOG</button>
      </form>
    </div>
  `;
}

/**
 * Render maintenance parts tracker cards.
 * @param {Array<object>} enrichedServices
 */
function renderServiceCards(enrichedServices) {
  const container = document.getElementById('service-cards');
  if (!container) return;

  if (enrichedServices.length === 0) {
    container.innerHTML = `
      <div class="tracker-empty">
        <span class="tracker-empty-icon">🏍️</span>
        <h3>No Trackers Configured</h3>
        <p>Get started by registering a maintenance item or importing your data profile.</p>
        <button class="action-btn" onclick="document.querySelector('[data-view=view-services]').click()">
          Configure Parts Now
        </button>
      </div>
    `;
    return;
  }

  let html = '';
  enrichedServices.forEach(s => {
    const isCritical = s.status.cssClass === 'status--critical';
    const isWarning = s.status.cssClass === 'status--warning';
    
    let deltaText = '';
    if (s.deltaRemaining <= 0) {
      deltaText = `${Math.abs(s.deltaRemaining)} KM OVERDUE`;
    } else {
      deltaText = `${s.deltaRemaining} KM Remaining`;
    }

    html += `
      <div class="tracker-card ${s.status.cssClass}">
        <div class="tracker-header">
          <span class="tracker-name">${s.name}</span>
          <span class="tracker-status-tag">${s.status.label}</span>
        </div>
        
        <div class="tracker-body">
          <div class="tracker-remaining">
            <span class="tracker-remaining-header">Maintenance Delta</span>
            <span class="tracker-remaining-value">${deltaText}</span>
          </div>
          
          <div class="tracker-stat">
            <span class="lbl">Interval Limit</span>
            <span class="val">${s.interval_km} KM</span>
          </div>
          <div class="tracker-stat">
            <span class="lbl">Last Serviced At</span>
            <span class="val">${s.last_service_odometer} KM</span>
          </div>
          <div class="tracker-stat">
            <span class="lbl">Next Expected At</span>
            <span class="val">${s.nextOdometer} KM</span>
          </div>
        </div>
        
        <div class="tracker-actions">
          <button class="tracker-done-btn" data-service-id="${s.id}">
            <span>✓</span> Mark as Done
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Render service configuration table rows.
 * @param {object} state
 */
function renderServiceTable(state) {
  const container = document.getElementById('service-table');
  if (!container) return;

  const services = state.services || [];
  if (services.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty">No components registered yet. Start adding items above.</td>
      </tr>
    `;
    return;
  }

  let html = '';
  services.forEach(s => {
    const nextKm = s.last_service_odometer + s.interval_km;
    html += `
      <tr>
        <td><strong>${s.name}</strong></td>
        <td class="cell-display">${s.interval_km} KM</td>
        <td class="cell-display">${s.last_service_odometer} KM</td>
        <td class="cell-display">${nextKm} KM</td>
        <td>
          <div class="table-actions">
            <button class="tbl-btn btn-edit" data-id="${s.id}">Edit</button>
            <button class="tbl-btn btn-delete" data-id="${s.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  });

  container.innerHTML = html;
}

/**
 * Simple markdown parser converting subset of markdown (bold, italics, code, bullet lists, newlines) to HTML.
 * @param {string} text
 * @returns {string}
 */
function parseMarkdown(text) {
  if (!text) return '';
  // Escape HTML to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Bold: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italics: *text*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Inline code: `code`
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // Parse bullet points
  const lines = html.split('\n');
  let inList = false;
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.substring(2);
      let prefix = '';
      if (!inList) {
        inList = true;
        prefix = '<ul class="markdown-list">';
      }
      return prefix + `<li>${content}</li>`;
    } else {
      let prefix = '';
      if (inList) {
        inList = false;
        prefix = '</ul>';
      }
      return prefix + line;
    }
  });
  if (inList) {
    processedLines.push('</ul>');
  }
  return processedLines.join('<br>')
    .replace(/<\/ul><br>/g, '</ul>')
    .replace(/<ul class="markdown-list"><br>/g, '<ul class="markdown-list">');
}

/**
 * Generate checklist HTML for checkboxes.
 * @param {Array<object>} items
 * @param {string} type 'daily' | 'monthly'
 * @returns {string}
 */
function generateChecklistHTML(items, type) {
  if (items.length === 0) {
    return `<p class="table-empty">No tasks added yet. Click "+ Add Task" to get started.</p>`;
  }

  return items.map(item => {
    const checkedAttr = item.checked ? 'checked' : '';
    const checkedClass = item.checked ? 'checked' : '';
    const hasDescClass = item.desc ? 'has-desc' : '';
    const parsedDesc = item.desc ? parseMarkdown(item.desc) : '';
    
    return `
      <div class="checklist-item ${checkedClass} ${hasDescClass}" data-type="${type}" data-id="${item.id}">
        <div class="chk-checkbox-wrap">
          <input type="checkbox" ${checkedAttr} id="chk-${type}-${item.id}">
          <span class="chk-checkmark"></span>
        </div>
        <div class="chk-details">
          <div class="chk-name" data-id="${item.id}">${item.task}</div>
          ${item.desc ? `<div class="chk-desc" data-desc-id="${item.id}">${parsedDesc}</div>` : ''}
        </div>
        <button class="btn-delete-chk" data-type="${type}" data-id="${item.id}" title="Remove Task">&times;</button>
      </div>
    `;
  }).join('');
}

/**
 * Render checklist views.
 * @param {object} state
 */
function renderDailyChecklist(state) {
  const container = document.getElementById('daily-checklist');
  if (container) {
    container.innerHTML = generateChecklistHTML(state.routine_checks.daily, 'daily');
  }
}

function renderWeeklyChecklist(state) {
  const container = document.getElementById('weekly-checklist');
  if (container) {
    container.innerHTML = generateChecklistHTML(state.routine_checks.weekly, 'weekly');
  }
}

function renderMonthlyChecklist(state) {
  const container = document.getElementById('monthly-checklist');
  if (container) {
    container.innerHTML = generateChecklistHTML(state.routine_checks.monthly, 'monthly');
  }
}

/**
 * Sync and render checklist copies in modals.
 * @param {object} state
 */
function renderModalChecklists(state) {
  const dailyModal = document.getElementById('modal-daily-list');
  const weeklyModal = document.getElementById('modal-weekly-list');
  const monthlyModal = document.getElementById('modal-monthly-list');
  
  if (dailyModal) {
    dailyModal.innerHTML = generateChecklistHTML(state.routine_checks.daily, 'daily');
  }
  if (weeklyModal) {
    weeklyModal.innerHTML = generateChecklistHTML(state.routine_checks.weekly, 'weekly');
  }
  if (monthlyModal) {
    monthlyModal.innerHTML = generateChecklistHTML(state.routine_checks.monthly, 'monthly');
  }
}

/**
 * Check routine checklists to see which reminders are currently due.
 * @param {object} state
 * @returns {Array<object>}
 */
function checkReminders(state) {
  if (!state.settings || !state.settings.reminders) return [];
  
  const due = [];
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  
  const checkTimePast = (timeStr) => {
    if (!timeStr) return false;
    const [schedHour, schedMin] = timeStr.split(':').map(Number);
    return (currentHour > schedHour) || (currentHour === schedHour && currentMin >= schedMin);
  };
  
  // 1. Daily Checklist
  const daily = state.settings.reminders.daily;
  if (daily?.enabled) {
    const hasUnchecked = state.routine_checks.daily.length > 0 && 
                         state.routine_checks.daily.some(item => !item.checked);
    if (hasUnchecked && checkTimePast(daily.time)) {
      due.push({
        type: 'daily',
        title: 'Daily Pre-Ride Checklist',
        icon: '☀️',
        message: `Scheduled for ${daily.time}. Some safety items are unchecked.`,
        modalId: 'modal-daily'
      });
    }
  }
  
  // 2. Weekly Checklist
  const weekly = state.settings.reminders.weekly;
  if (weekly?.enabled) {
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday...
    const hasUnchecked = state.routine_checks.weekly.length > 0 && 
                         state.routine_checks.weekly.some(item => !item.checked);
    if (hasUnchecked && currentDay === Number(weekly.day) && checkTimePast(weekly.time)) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      due.push({
        type: 'weekly',
        title: 'Weekly Protocol Inspection',
        icon: '📅',
        message: `Scheduled for ${days[weekly.day]}s at ${weekly.time}. Some tasks are unchecked.`,
        modalId: 'modal-weekly'
      });
    }
  }
  
  // 3. Monthly Checklist
  const monthly = state.settings.reminders.monthly;
  if (monthly?.enabled) {
    const currentDate = now.getDate();
    const hasUnchecked = state.routine_checks.monthly.length > 0 && 
                         state.routine_checks.monthly.some(item => !item.checked);
    if (hasUnchecked && currentDate === Number(monthly.date) && checkTimePast(monthly.time)) {
      due.push({
        type: 'monthly',
        title: 'Monthly Protocol Maintenance',
        icon: '🌙',
        message: `Scheduled for day ${monthly.date} at ${monthly.time}. Some checks are unchecked.`,
        modalId: 'modal-monthly'
      });
    }
  }
  
  return due;
}

/**
 * Render reminders notifications panel on the dashboard.
 * @param {object} state
 */
function renderNotifications(state) {
  const container = document.getElementById('dashboard-notifications');
  if (!container) return;
  
  const due = checkReminders(state);
  if (due.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = due.map(item => `
    <div class="reminder-alert-card alert-due" data-type="${item.type}">
      <div class="alert-content">
        <div class="alert-icon">${item.icon}</div>
        <div class="alert-text">
          <h4>🚨 Routine Check Due: ${item.title}</h4>
          <p>${item.message}</p>
        </div>
      </div>
      <div class="alert-actions">
        <button type="button" class="action-btn submit-btn btn-action-notification" data-modal="${item.modalId}">
          Start Inspection
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * Populate settings menu forms with saved state values.
 * @param {object} state
 */
function renderSettings(state) {
  if (!state.settings || !state.settings.reminders) return;
  
  const r = state.settings.reminders;
  
  const dailyEnabled = document.getElementById('reminder-daily-enabled');
  const dailyTime = document.getElementById('reminder-daily-time');
  if (dailyEnabled) dailyEnabled.checked = r.daily.enabled;
  if (dailyTime) dailyTime.value = r.daily.time;
  
  const weeklyEnabled = document.getElementById('reminder-weekly-enabled');
  const weeklyDay = document.getElementById('reminder-weekly-day');
  const weeklyTime = document.getElementById('reminder-weekly-time');
  if (weeklyEnabled) weeklyEnabled.checked = r.weekly.enabled;
  if (weeklyDay) weeklyDay.value = r.weekly.day;
  if (weeklyTime) weeklyTime.value = r.weekly.time;
  
  const monthlyEnabled = document.getElementById('reminder-monthly-enabled');
  const monthlyDate = document.getElementById('reminder-monthly-date');
  const monthlyTime = document.getElementById('reminder-monthly-time');
  if (monthlyEnabled) monthlyEnabled.checked = r.monthly.enabled;
  if (monthlyDate) monthlyDate.value = r.monthly.date;
  if (monthlyTime) monthlyTime.value = r.monthly.time;
}

/**
 * Run entire application UI repaints.
 * @param {object} state
 */
function renderAll(state) {
  renderNotifications(state);
  renderOdometerHUD(state);
  
  // Compute parts deltas
  const enriched = computeAllServices(state.services, state.meta.current_odometer);
  const sorted = sortByPriority(enriched);
  
  renderServiceCards(sorted);
  renderServiceTable(state);
  
  renderDailyChecklist(state);
  renderWeeklyChecklist(state);
  renderMonthlyChecklist(state);
  renderModalChecklists(state);
  renderSettings(state);
}

/**
 * Show Edit Modal populated with existing item data.
 * @param {object} service
 */
function showModal(service) {
  const modal = document.getElementById('modal-edit');
  if (!modal) return;

  document.getElementById('edit-id').value = service.id;
  document.getElementById('edit-name').value = service.name;
  document.getElementById('edit-interval').value = service.interval_km;
  document.getElementById('edit-last-service').value = service.last_service_odometer;

  modal.removeAttribute('hidden');
}

/**
 * Show Import Confirmation Modal (Two-Step).
 * @param {File} file
 */
function showImportConfirmModal(file) {
  const modal = document.getElementById('modal-import');
  if (!modal) return;

  pendingImportFile = file;
  
  // Reset fields
  const textInput = document.getElementById('confirm-text-input');
  if (textInput) textInput.value = '';
  
  const confirmBtn = document.getElementById('btn-confirm-import');
  if (confirmBtn) confirmBtn.setAttribute('disabled', 'true');

  modal.removeAttribute('hidden');
}

/**
 * Close all active overlay modals.
 */
function closeModal() {
  const overlays = document.querySelectorAll('.modal-overlay');
  overlays.forEach(modal => {
    modal.setAttribute('hidden', 'true');
  });
  pendingImportFile = null;
}

// Assign helpers to global object for DOM actions and app.js access
window.renderAll = renderAll;
window.showToast = showToast;
window.showModal = showModal;
window.showImportConfirmModal = showImportConfirmModal;
window.closeModal = closeModal;
window.getPendingImportFile = () => pendingImportFile;
window.renderDailyChecklist = renderDailyChecklist;
window.renderWeeklyChecklist = renderWeeklyChecklist;
window.renderMonthlyChecklist = renderMonthlyChecklist;
window.renderNotifications = renderNotifications;
window.renderSettings = renderSettings;
