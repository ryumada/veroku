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
/**
 * Render the Odometer HUD block at the top of Dashboard.
 * @param {object} state
 */
function renderOdometerHUD(state) {
  const container = document.getElementById('odometer-hud');
  if (!container) return;

  const activeVeh = getActiveVehicle(state);
  const currentOdo = activeVeh.meta.current_odometer || 0;
  const lastUpdated = activeVeh.meta.last_updated_timestamp;
  const timeString = lastUpdated
    ? new Date(lastUpdated).toLocaleString()
    : 'Never updated';

  const paddedOdo = formatOdometer(currentOdo);
  let digitsHTML = '';
  for (let char of paddedOdo) {
    digitsHTML += `<span class="digit">${char}</span>`;
  }

  const streak = activeVeh.meta.streak_days || 0;
  const streakHtml = streak > 0 ? `<div class="streak-badge">🔥 ${streak} Day Streak</div>` : '';

  const chartHtml = `
    <div class="mileage-chart-container">
      <div class="mileage-chart-title-bar">
        <span class="mileage-chart-title">Mileage Growth (Last 14 Logs)</span>
        <button type="button" id="btn-trigger-odo-history" class="btn-view-history">View All Logs</button>
      </div>
      <div id="chart-svg-wrapper">
        ${generateSvgChart(activeVeh.odometer_log || [])}
      </div>
    </div>
  `;

  container.innerHTML = `
    <div class="hud-reading">
      <span class="hud-label">${activeVeh.icon || '🏍️'} ${activeVeh.name || 'Vehicle'} - Current Odometer</span>
      <div class="hud-odometer-wrap">
        <div class="hud-odometer-digits">
          ${digitsHTML}
        </div>
        <span class="hud-unit">KM</span>
      </div>
      <div class="hud-timestamp">Last Synced: ${timeString}</div>
      ${streakHtml}
    </div>
    <div class="hud-input-panel">
      <label for="input-hud-odo">Update Log Reading (KM)</label>
      <form id="form-odometer" class="hud-form">
        <input type="number" id="input-hud-odo" min="${currentOdo}" value="${currentOdo}" required placeholder="${currentOdo}">
        <button type="submit" title="Submit new Odometer reading">LOG</button>
      </form>
    </div>
    <div style="width: 100%; flex-basis: 100%;">
      ${chartHtml}
    </div>
  `;
}

/**
 * Render maintenance parts tracker cards.
 * @param {Array<object>} enrichedServices
 * @param {object} activeVeh
 */
function renderServiceCards(enrichedServices, activeVeh) {
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

  const avgMileage = computeDailyAvgMileage(activeVeh ? activeVeh.odometer_log : []);

  let html = '';
  enrichedServices.forEach(s => {
    const isCritical = s.status.cssClass === 'status--critical';
    const isWarning = s.status.cssClass === 'status--warning';

    const deltaText = s.displayDeltaText;

    let forecastHtml = '';
    if (s.deltaRemainingKm !== null && s.deltaRemainingKm <= 0) {
      forecastHtml = `<div class="forecast-label" style="color: var(--status-critical);">🚨 Past due (KM)! Service immediately.</div>`;
    } else if (s.deltaRemainingDays !== null && s.deltaRemainingDays <= 0) {
      forecastHtml = `<div class="forecast-label" style="color: var(--status-critical);">🚨 Past due (Time)! Service immediately.</div>`;
    } else if (avgMileage > 0 && s.deltaRemainingKm !== null && s.deltaRemainingKm > 0) {
      const daysUntil = Math.max(0, Math.ceil(s.deltaRemainingKm / avgMileage));
      forecastHtml = `<div class="forecast-label">⏳ Est. ${daysUntil} days remaining (~${avgMileage} KM/day)</div>`;
    } else {
      forecastHtml = `<div class="forecast-label">⏳ Forecast requires at least 2 odometer readings</div>`;
    }

    let intervalText = '';
    if (s.interval_km && s.interval_time_val) {
      intervalText = `${s.interval_km} KM / ${s.interval_time_val} ${s.interval_time_unit}`;
    } else if (s.interval_km) {
      intervalText = `${s.interval_km} KM`;
    } else if (s.interval_time_val) {
      intervalText = `${s.interval_time_val} ${s.interval_time_unit}`;
    } else {
      intervalText = '-';
    }

    let lastServiceText = `${s.last_service_odometer} KM`;
    if (s.last_service_date) {
      lastServiceText += ` (${s.last_service_date})`;
    }

    let nextExpectedText = '';
    if (s.nextOdometer !== null) {
      nextExpectedText += `${s.nextOdometer} KM`;
      if (s.one_time_limit_km) {
        nextExpectedText += ' <span style="color: var(--status-warning);">[Override]</span>';
      }
    }
    if (s.nextDueDate) {
      if (nextExpectedText) nextExpectedText += ' / ';
      nextExpectedText += s.nextDueDate;
      if (s.one_time_limit_date) {
        nextExpectedText += ' <span style="color: var(--status-warning);">[Override]</span>';
      }
    }
    if (!nextExpectedText) nextExpectedText = '-';

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
            ${forecastHtml}
          </div>

          <div class="tracker-stat">
            <span class="lbl">Interval Limit</span>
            <span class="val">${intervalText}</span>
          </div>
          <div class="tracker-stat">
            <span class="lbl">Last Serviced At</span>
            <span class="val">${lastServiceText}</span>
          </div>
          <div class="tracker-stat">
            <span class="lbl">Next Expected At</span>
            <span class="val">${nextExpectedText}</span>
          </div>
        </div>

        <div class="tracker-actions">
          ${s.notes ? `
            <button type="button" class="tracker-notes-btn" data-service-id="${s.id}">
              <span>📝</span> Notes
            </button>
          ` : ''}
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
 * Update components view mode visibility based on active view mode.
 */
function updateComponentsViewVisibility() {
  const mode = window.componentsViewMode || 'table';
  const btnTable = document.getElementById('btn-components-table-view');
  const btnCards = document.getElementById('btn-components-card-view');
  const tableContainer = document.getElementById('components-table-container');
  const cardsContainer = document.getElementById('components-cards-container');

  if (btnTable && btnCards && tableContainer && cardsContainer) {
    if (mode === 'table') {
      btnTable.classList.add('active');
      btnCards.classList.remove('active');
      tableContainer.removeAttribute('hidden');
      cardsContainer.setAttribute('hidden', 'true');
    } else {
      btnTable.classList.remove('active');
      btnCards.classList.add('active');
      tableContainer.setAttribute('hidden', 'true');
      cardsContainer.removeAttribute('hidden');
    }
  }
}

/**
 * Render service configuration table rows and cards.
 * @param {object} state
 */
function renderServiceTable(state) {
  const tableBody = document.getElementById('service-table');
  const cardsContainer = document.getElementById('components-cards-container');
  if (!tableBody || !cardsContainer) return;

  const services = state.services || [];
  if (services.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="table-empty">No components registered yet. Start adding items above.</td>
      </tr>
    `;
    cardsContainer.innerHTML = `
      <div class="table-empty" style="text-align: center; padding: 40px; color: var(--text-secondary); width: 100%; grid-column: 1 / -1;">
        No components registered yet. Start adding items above.
      </div>
    `;
    updateComponentsViewVisibility();
    return;
  }

  // Active odometer to compute dynamic status for config list view
  const currentOdo = state.meta?.current_odometer || 0;
  const enriched = computeAllServices(services, currentOdo);

  // Search filtering
  const componentsQuery = (window.componentsSearchQuery || '').toLowerCase().trim();
  const filteredEnriched = enriched.filter(s => {
    if (!componentsQuery) return true;
    const nameMatch = s.name ? s.name.toLowerCase().includes(componentsQuery) : false;
    const notesMatch = s.notes ? s.notes.toLowerCase().includes(componentsQuery) : false;
    const descMatch = s.desc ? s.desc.toLowerCase().includes(componentsQuery) : false;
    const descriptionMatch = s.description ? s.description.toLowerCase().includes(componentsQuery) : false;
    
    let numMatch = false;
    if (!isNaN(parseInt(componentsQuery, 10))) {
      const sInterval = String(s.interval_km || '');
      const sWarning = String(s.warning_threshold || '');
      const sLast = String(s.last_service_odometer || '');
      const sNext = String(s.nextOdometer || '');
      
      numMatch = sInterval.includes(componentsQuery) || 
                 sWarning.includes(componentsQuery) || 
                 sLast.includes(componentsQuery) || 
                 sNext.includes(componentsQuery);
    }
    
    return nameMatch || notesMatch || descMatch || descriptionMatch || numMatch;
  });

  const sortedEnriched = sortServices(filteredEnriched, window.componentsSortMode || 'default');

  // Pagination setup
  window.componentsPage = window.componentsPage || 1;
  window.componentsPerPage = parseInt(window.componentsPerPage, 10) || 10;
  const totalComponents = sortedEnriched.length;
  const totalPages = Math.ceil(totalComponents / window.componentsPerPage) || 1;

  if (window.componentsPage > totalPages) {
    window.componentsPage = totalPages;
  }
  if (window.componentsPage < 1) {
    window.componentsPage = 1;
  }

  const startIdx = (window.componentsPage - 1) * window.componentsPerPage;
  const endIdx = startIdx + window.componentsPerPage;
  const paginatedEnriched = sortedEnriched.slice(startIdx, endIdx);

  let tableHtml = '';
  let cardsHtml = '';

  paginatedEnriched.forEach(s => {
    // Formatting Intervals
    let intervalText = '';
    if (s.interval_km && s.interval_time_val) {
      intervalText = `${s.interval_km} KM / ${s.interval_time_val} ${s.interval_time_unit}`;
    } else if (s.interval_km) {
      intervalText = `${s.interval_km} KM`;
    } else if (s.interval_time_val) {
      intervalText = `${s.interval_time_val} ${s.interval_time_unit}`;
    } else {
      intervalText = '-';
    }

    // Formatting Warning Threshold
    let warningText = '';
    if (s.warning_threshold && s.warning_time_val) {
      warningText = `${s.warning_threshold} KM / ${s.warning_time_val} ${s.warning_time_unit}`;
    } else if (s.warning_threshold) {
      warningText = `${s.warning_threshold} KM`;
    } else if (s.warning_time_val) {
      warningText = `${s.warning_time_val} ${s.warning_time_unit}`;
    } else {
      warningText = 'Default';
    }

    // Formatting Last Service
    let lastServiceText = `${s.last_service_odometer} KM`;
    if (s.last_service_date) {
      lastServiceText += `<br><span class="lbl-desc">${s.last_service_date}</span>`;
    }

    // Formatting Next Expected
    let nextExpectedText = '';
    if (s.nextOdometer !== null) {
      nextExpectedText += `${s.nextOdometer} KM`;
      if (s.one_time_limit_km) {
        nextExpectedText += ` <span style="color: var(--status-warning);" title="One-time Odometer Override">*</span>`;
      }
    }
    if (s.nextDueDate) {
      if (nextExpectedText) nextExpectedText += '<br>';
      nextExpectedText += `<span class="lbl-desc">${s.nextDueDate}</span>`;
      if (s.one_time_limit_date) {
        nextExpectedText += ` <span style="color: var(--status-warning);" title="One-time Date Override">*</span>`;
      }
    }
    if (!nextExpectedText) nextExpectedText = '-';

    // Table Row HTML
    tableHtml += `
      <tr>
        <td>
          <strong>${s.name}</strong>
          ${s.notes ? `<div class="component-notes">${parseMarkdown(s.notes)}</div>` : ''}
        </td>
        <td class="cell-display">${intervalText}</td>
        <td class="cell-display">${warningText}</td>
        <td class="cell-display">${lastServiceText}</td>
        <td class="cell-display">${nextExpectedText}</td>
        <td>
          <div class="table-actions">
            <button class="tbl-btn btn-edit" data-id="${s.id}">Edit</button>
            <button class="tbl-btn btn-delete" data-id="${s.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;

    // Card HTML (for mobile / list)
    cardsHtml += `
      <div class="component-card">
        <div class="component-card-header">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <strong class="component-card-name">${s.name}</strong>
            ${s.notes ? `<div class="component-notes">${parseMarkdown(s.notes)}</div>` : ''}
          </div>
          <div class="component-card-actions">
            <button class="tbl-btn btn-edit" data-id="${s.id}">Edit</button>
            <button class="tbl-btn btn-delete" data-id="${s.id}">Delete</button>
          </div>
        </div>
        <div class="component-card-body">
          <div class="component-card-row">
            <span class="lbl">Interval</span>
            <span class="val">${intervalText}</span>
          </div>
          <div class="component-card-row">
            <span class="lbl">Warning Threshold</span>
            <span class="val">${warningText}</span>
          </div>
          <div class="component-card-row">
            <span class="lbl">Last Service</span>
            <span class="val">${s.last_service_odometer} KM ${s.last_service_date ? `(${s.last_service_date})` : ''}</span>
          </div>
          <div class="component-card-row">
            <span class="lbl">Next Expected</span>
            <span class="val">${s.nextOdometer !== null ? s.nextOdometer + ' KM' : ''} ${s.one_time_limit_km ? '[*]' : ''} ${s.nextDueDate ? `/ ${s.nextDueDate}` : ''} ${s.one_time_limit_date ? '[*]' : ''}</span>
          </div>
        </div>
      </div>
    `;
  });

  tableBody.innerHTML = tableHtml;
  cardsContainer.innerHTML = cardsHtml;

  updateComponentsViewVisibility();

  // Render pagination bar
  const paginationBar = document.getElementById('components-pagination');
  if (paginationBar) {
    if (totalComponents === 0) {
      paginationBar.setAttribute('hidden', 'true');
    } else {
      paginationBar.removeAttribute('hidden');

      const pageDisplay = document.getElementById('components-page-display');
      if (pageDisplay) {
        pageDisplay.textContent = `Page ${window.componentsPage} of ${totalPages}`;
      }

      const btnPrev = document.getElementById('btn-components-prev');
      if (btnPrev) {
        btnPrev.disabled = window.componentsPage === 1;
      }

      const btnNext = document.getElementById('btn-components-next');
      if (btnNext) {
        btnNext.disabled = window.componentsPage === totalPages;
      }

      const perPageSelect = document.getElementById('select-components-per-page');
      if (perPageSelect) {
        perPageSelect.value = window.componentsPerPage;
      }
    }
  }
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

  // Calculate warning/critical parts
  const currentOdo = state.meta?.current_odometer || 0;
  const enriched = computeAllServices(state.services || [], currentOdo);
  const partAlerts = enriched.filter(s => s.status.cssClass === 'status--critical' || s.status.cssClass === 'status--warning');

  if (due.length === 0 && partAlerts.length === 0) {
    container.innerHTML = '';
    return;
  }

  let html = '';

  // Render part alerts first (warning/critical parts moved to the top!)
  partAlerts.forEach(item => {
    const isCritical = item.status.cssClass === 'status--critical';
    const alertClass = isCritical ? 'alert-critical' : 'alert-warning';
    const icon = isCritical ? '🚨' : '⚠️';
    const badgeText = isCritical ? 'OVERDUE' : 'DUE SOON';

    let alertMsg = '';
    if (item.deltaRemaining <= 0) {
      alertMsg = `${item.name} is ${Math.abs(item.deltaRemaining)} KM overdue (Target: ${item.interval_km} KM).`;
    } else {
      alertMsg = `${item.name} has only ${item.deltaRemaining} KM remaining before target interval (${item.interval_km} KM).`;
    }

    html += `
      <div class="reminder-alert-card ${alertClass}" data-type="part-alert">
        <div class="alert-content">
          <div class="alert-icon">${icon}</div>
          <div class="alert-text">
            <h4>${icon} Part Tracker ${badgeText}: ${item.name}</h4>
            <p>${alertMsg}</p>
          </div>
        </div>
        <div class="alert-actions">
          <button type="button" class="action-btn submit-btn btn-log-service-trigger" data-service-id="${item.id}">
            Log Service
          </button>
        </div>
      </div>
    `;
  });

  // Render checklist reminders
  due.forEach(item => {
    html += `
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
    `;
  });

  container.innerHTML = html;
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

  // Toggle Load Example Data card visibility based on active vehicle profile state
  const activeVeh = getActiveVehicle(state);
  const exampleCard = document.getElementById('card-example-data');
  if (exampleCard) {
    if (activeVeh && (!activeVeh.services || activeVeh.services.length === 0)) {
      exampleCard.removeAttribute('hidden');
    } else {
      exampleCard.setAttribute('hidden', '');
    }
  }
}

/**
 * Run entire application UI repaints.
 * @param {object} state
 */
function renderAll(state) {
  // Sync the theme
  const theme = state.settings?.theme || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  const themeBtn = document.getElementById('btn-theme-toggle');
  if (themeBtn) {
    themeBtn.textContent = theme === 'light' ? '☀️' : '🌙';
  }

  // Populate vehicle list selector
  renderVehicleSelector(state);

  const activeVeh = getActiveVehicle(state);

  // Construct scoped state mimicking single-vehicle format
  const scopedState = {
    meta: activeVeh.meta,
    services: activeVeh.services,
    routine_checks: activeVeh.routine_checks,
    settings: state.settings
  };

  renderNotifications(scopedState);
  renderOdometerHUD(state);

  // Compute parts deltas
  const enriched = computeAllServices(activeVeh.services, activeVeh.meta.current_odometer);

  // Search filtering
  const dashboardQuery = (window.dashboardSearchQuery || '').toLowerCase().trim();
  const filteredEnriched = enriched.filter(s => {
    if (!dashboardQuery) return true;
    const nameMatch = s.name ? s.name.toLowerCase().includes(dashboardQuery) : false;
    const notesMatch = s.notes ? s.notes.toLowerCase().includes(dashboardQuery) : false;
    const descMatch = s.desc ? s.desc.toLowerCase().includes(dashboardQuery) : false;
    const descriptionMatch = s.description ? s.description.toLowerCase().includes(dashboardQuery) : false;
    
    let numMatch = false;
    if (!isNaN(parseInt(dashboardQuery, 10))) {
      const sInterval = String(s.interval_km || '');
      const sWarning = String(s.warning_threshold || '');
      const sLast = String(s.last_service_odometer || '');
      const sNext = String(s.nextOdometer || '');
      
      numMatch = sInterval.includes(dashboardQuery) || 
                 sWarning.includes(dashboardQuery) || 
                 sLast.includes(dashboardQuery) || 
                 sNext.includes(dashboardQuery);
    }
    
    return nameMatch || notesMatch || descMatch || descriptionMatch || numMatch;
  });

  const sorted = sortServices(filteredEnriched, window.dashboardSortMode || 'priority');

  renderServiceCards(sorted, activeVeh);
  renderServiceTable(scopedState);

  renderDailyChecklist(scopedState);
  renderWeeklyChecklist(scopedState);
  renderMonthlyChecklist(scopedState);
  renderModalChecklists(scopedState);
  renderSettings(state);

  // Render cost summary and history logs
  renderCostSummary(activeVeh);
  renderServiceHistory(activeVeh, window.historyFilterMode, window.historyActiveDate);
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
  document.getElementById('edit-interval').value = service.interval_km || '';
  document.getElementById('edit-warning-threshold').value = service.warning_threshold !== undefined ? service.warning_threshold : '';

  // Populate new time fields
  document.getElementById('edit-interval-time-val').value = service.interval_time_val || '';
  document.getElementById('edit-interval-time-unit').value = service.interval_time_unit || 'months';
  document.getElementById('edit-warning-time-val').value = service.warning_time_val || '';
  document.getElementById('edit-warning-time-unit').value = service.warning_time_unit || 'days';

  // Last service odometer and date
  document.getElementById('edit-last-service').value = service.last_service_odometer;

  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('edit-last-service-date').value = service.last_service_date || todayStr;

  // One-time overrides
  document.getElementById('edit-one-time-limit-km').value = service.one_time_limit_km || '';
  document.getElementById('edit-one-time-limit-date').value = service.one_time_limit_date || '';

  // Notes
  const editNotesEl = document.getElementById('edit-notes');
  if (editNotesEl) editNotesEl.value = service.notes || '';

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

/**
 * Render a mini bar chart of the last 14 odometer readings.
 * @param {Array<object>} log
 * @returns {string} SVG HTML string
 */
function generateSvgChart(log) {
  if (!Array.isArray(log) || log.length < 2) {
    return `<div style="text-align: center; padding: 20px 0; color: var(--text-secondary); font-size: 11px;">
              Log odometer updates to display growth chart (minimum 2 logs required).
            </div>`;
  }

  // Get last 14 entries and sort by timestamp ascending
  const sorted = [...log].sort((a, b) => a.timestamp - b.timestamp).slice(-14);
  const n = sorted.length;

  const odos = sorted.map(d => d.odometer);
  const maxOdo = Math.max(...odos);
  const minOdo = Math.min(...odos);
  const odoRange = maxOdo - minOdo || 1;

  // Dimensions
  const width = 500;
  const height = 60;
  const paddingLeft = 35;
  const paddingRight = 10;
  const paddingTop = 10;
  const paddingBottom = 15;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  // Calculate points / columns
  const colWidth = chartW / n;
  let svgContent = '';

  // Y-axis gridlines/ticks (min and max)
  svgContent += `<line x1="${paddingLeft}" y1="${paddingTop}" x2="${width - paddingRight}" y2="${paddingTop}" class="chart-line" />`;
  svgContent += `<line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" class="chart-line" />`;
  svgContent += `<text x="${paddingLeft - 8}" y="${paddingTop + 3}" class="chart-text" style="text-anchor: end;">${maxOdo}</text>`;
  svgContent += `<text x="${paddingLeft - 8}" y="${height - paddingBottom + 3}" class="chart-text" style="text-anchor: end;">${minOdo}</text>`;

  // Plot bars
  sorted.forEach((item, index) => {
    const x = paddingLeft + (index * colWidth) + (colWidth * 0.1);
    const w = colWidth * 0.8;

    // Normalize height relative to minOdo to show relative growth
    const valRatio = (item.odometer - minOdo) / odoRange;
    const h = Math.max(4, valRatio * chartH); // minimum height of 4px
    const y = height - paddingBottom - h;

    const dateStr = new Date(item.timestamp).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });

    svgContent += `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" class="chart-bar">
        <title>Odo: ${item.odometer} KM on ${dateStr}</title>
      </rect>
    `;

    // X-axis labels (draw first, middle, last to prevent overlap)
    if (index === 0 || index === Math.floor(n / 2) || index === n - 1) {
      svgContent += `
        <text x="${x + w / 2}" y="${height - 2}" class="chart-text">${dateStr}</text>
      `;
    }
  });

  return `<svg viewBox="0 0 ${width} ${height}" class="svg-chart">${svgContent}</svg>`;
}

/**
 * Populate the scrollable odometer log history list in its modal.
 * @param {object} state
 * @param {number} [page] Page number (0-indexed)
 */
function populateOdometerHistoryModal(state, page) {
  const listContainer = document.getElementById('odo-history-list');
  if (!listContainer) return;

  const activeVeh = getActiveVehicle(state);
  const log = activeVeh.odometer_log || [];

  const pageVal = page !== undefined ? page : (window.odoHistoryPage || 0);
  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.max(1, Math.ceil(log.length / ITEMS_PER_PAGE));

  // Update pagination DOM states
  const pageDisplay = document.getElementById('odo-page-display');
  const btnPrev = document.getElementById('btn-odo-prev');
  const btnNext = document.getElementById('btn-odo-next');

  if (pageDisplay) {
    pageDisplay.textContent = `Page ${pageVal + 1} of ${totalPages}`;
  }
  if (btnPrev) {
    if (pageVal === 0) {
      btnPrev.setAttribute('disabled', 'true');
    } else {
      btnPrev.removeAttribute('disabled');
    }
  }
  if (btnNext) {
    if (pageVal >= totalPages - 1) {
      btnNext.setAttribute('disabled', 'true');
    } else {
      btnNext.removeAttribute('disabled');
    }
  }

  if (log.length === 0) {
    listContainer.innerHTML = `<div class="history-item">No odometer logs recorded. Update your odometer to start tracking.</div>`;
    return;
  }

  // Sort log by timestamp descending (newest first)
  const sorted = [...log].sort((a, b) => b.timestamp - a.timestamp);

  const start = pageVal * ITEMS_PER_PAGE;
  const pageItems = sorted.slice(start, start + ITEMS_PER_PAGE);

  listContainer.innerHTML = pageItems.map(item => {
    const dateStr = new Date(item.timestamp).toLocaleString();
    return `
      <div class="history-item">
        <div class="history-item-header">
          <span class="history-item-date">${dateStr}</span>
          <span class="history-item-odo">${item.odometer} KM</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Populate the active vehicle dropdown menu and bind options.
 * @param {object} state
 */
function renderVehicleSelector(state) {
  const dropdown = document.getElementById('select-vehicle');
  if (!dropdown) return;

  const vehicles = state.vehicles || {};
  let html = '';
  for (const id in vehicles) {
    const v = vehicles[id];
    const selectedAttr = state.active_vehicle_id === id ? 'selected' : '';
    html += `<option value="${id}" ${selectedAttr}>${v.icon} ${v.name}</option>`;
  }
  dropdown.innerHTML = html;
}

/**
 * Render the aggregated cost summary block in View B.
 * @param {object} activeVeh
 */
function renderCostSummary(activeVeh) {
  const container = document.getElementById('cost-summary-content');
  if (!container) return;

  const history = activeVeh.service_history || [];
  const summary = computeCostSummary(history);

  if (history.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 16px; color: var(--text-secondary);">No services logged yet. Completing parts trackers will aggregate costs here.</div>`;
    return;
  }

  // Map per-service IDs to names for readability
  const servicesMap = {};
  if (Array.isArray(activeVeh.services)) {
    activeVeh.services.forEach(s => {
      servicesMap[s.id] = s.name;
    });
  }

  let componentsHtml = '';
  for (const sid in summary.perService) {
    const sName = servicesMap[sid] || `Removed Component (${sid})`;
    componentsHtml += `
      <div class="tracker-stat">
        <span class="lbl">${sName}</span>
        <span class="val" style="color: var(--status-optimal); font-weight: 600;">${summary.perService[sid].toLocaleString()} IDR</span>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="cost-total-label">
      Total Maintenance Cost: ${summary.total.toLocaleString()} IDR
    </div>
    <div class="cost-breakdown-container">
      <h4 class="per-component-title">Spend Per Component</h4>
      ${componentsHtml}
    </div>
  `;
}

/**
 * Render the timeline list of service histories inside View B.
 * @param {object} activeVeh
 * @param {string} [filterMode] 'monthly' | 'yearly'
 * @param {Date} [activeDate] Active date filter context
 */
function renderServiceHistory(activeVeh, filterMode, activeDate) {
  const container = document.getElementById('service-history-list');
  if (!container) return;

  const mode = filterMode || window.historyFilterMode || 'monthly';
  const date = activeDate || window.historyActiveDate || new Date();

  // Sync toggle buttons CSS states
  const monthlyBtn = document.getElementById('btn-history-monthly');
  const yearlyBtn = document.getElementById('btn-history-yearly');
  if (monthlyBtn && yearlyBtn) {
    if (mode === 'monthly') {
      monthlyBtn.classList.add('active');
      yearlyBtn.classList.remove('active');
    } else {
      monthlyBtn.classList.remove('active');
      yearlyBtn.classList.add('active');
    }
  }

  // Format navigation text display
  const displayLabel = document.getElementById('history-date-display');
  if (displayLabel) {
    const yearVal = date.getFullYear();
    if (mode === 'monthly') {
      const monthName = date.toLocaleString('default', { month: 'long' });
      displayLabel.textContent = `${monthName} ${yearVal}`;
    } else {
      displayLabel.textContent = `${yearVal}`;
    }
  }

  const history = activeVeh.service_history || [];
  if (history.length === 0) {
    container.innerHTML = `<div class="history-item">No service records found. Services will be displayed here as they are completed.</div>`;
    return;
  }

  // Filter history records
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth();

  const filtered = history.filter(item => {
    const itemDate = new Date(item.timestamp);
    if (mode === 'monthly') {
      return itemDate.getFullYear() === targetYear && itemDate.getMonth() === targetMonth;
    } else {
      return itemDate.getFullYear() === targetYear;
    }
  });

  if (filtered.length === 0) {
    const timeFrameStr = mode === 'monthly'
      ? date.toLocaleString('default', { month: 'long', year: 'numeric' })
      : targetYear.toString();
    container.innerHTML = `<div class="history-item">No service records found for ${timeFrameStr}.</div>`;
    return;
  }

  const sorted = [...filtered].sort((a, b) => b.timestamp - a.timestamp);

  container.innerHTML = sorted.map(item => {
    const dateStr = new Date(item.timestamp).toLocaleString();
    const notesHtml = item.notes ? `<div class="history-item-notes">${item.notes}</div>` : '';
    return `
      <div class="history-item">
        <div class="history-item-header">
          <span class="history-item-date">${dateStr}</span>
          <span class="history-item-cost">${item.cost.toLocaleString()} IDR</span>
        </div>
        <div class="history-item-header" style="margin-top: 4px;">
          <strong>${item.service_name}</strong>
          <span class="history-item-odo">${item.odometer_at_service} KM</span>
        </div>
        ${notesHtml}
      </div>
    `;
  }).join('');
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
window.populateOdometerHistoryModal = populateOdometerHistoryModal;
window.renderVehicleSelector = renderVehicleSelector;
window.renderCostSummary = renderCostSummary;
window.renderServiceHistory = renderServiceHistory;
window.updateComponentsViewVisibility = updateComponentsViewVisibility;
