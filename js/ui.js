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
 * Test whether a service matches a search query string.
 * @param {object} service
 * @param {string} query
 * @returns {boolean}
 */
function matchesServiceQuery(service, query) {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  if (!q) return true;

  const nameMatch = service.name ? service.name.toLowerCase().includes(q) : false;
  const notesMatch = service.notes ? service.notes.toLowerCase().includes(q) : false;
  const descMatch = service.desc ? service.desc.toLowerCase().includes(q) : false;
  const descriptionMatch = service.description ? service.description.toLowerCase().includes(q) : false;

  let numMatch = false;
  if (!isNaN(parseInt(q, 10))) {
    const sInterval = String(service.interval_km || '');
    const sWarning = String(service.warning_threshold || '');
    const sLast = String(service.last_service_odometer || '');
    const sNext = String(service.nextOdometer || '');

    numMatch = sInterval.includes(q) || sWarning.includes(q) || sLast.includes(q) || sNext.includes(q);
  }

  return nameMatch || notesMatch || descMatch || descriptionMatch || numMatch;
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
  toast.innerHTML = `<span>${icon}</span> <span style="flex-grow: 1;">${message}</span> <span style="cursor: pointer; opacity: 0.7; font-size: 15px; margin-left: 8px;" title="Dismiss">&times;</span>`;

  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    toast.style.transition = 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)';
    setTimeout(() => {
      if (toast.isConnected) toast.remove();
    }, 210);
  };

  toast.addEventListener('click', dismiss);
  container.appendChild(toast);

  // Determine timeout from global state (default 5 seconds)
  const durationSec = window._appState?.settings?.toast_duration !== undefined
    ? Number(window._appState.settings.toast_duration)
    : 5;

  if (durationSec > 0) {
    setTimeout(() => {
      if (toast.isConnected) {
        dismiss();
      }
    }, durationSec * 1000);
  }
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

  // Calculate fuel efficiency stats
  const fuelStats = typeof computeFuelEfficiency === 'function' ? computeFuelEfficiency(activeVeh.fuel_log || []) : null;
  let fuelBadgeHtml = '';
  if (fuelStats && fuelStats.avgKmL !== null) {
    fuelBadgeHtml = `
      <div class="fuel-hud-badge" title="Average full-to-full fuel efficiency">
        ⛽ <span class="fuel-km-val">${fuelStats.avgKmL} KM/L</span>
        ${fuelStats.costPerKm ? `<span class="fuel-cost-val">• Rp ${fuelStats.costPerKm.toLocaleString()}/KM</span>` : ''}
      </div>
    `;
  }

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
      ${fuelBadgeHtml}
    </div>
    <div class="hud-input-panel">
      <label for="input-hud-odo">Update Log Reading (KM)</label>
      <div class="hud-form-row">
        <form id="form-odometer" class="hud-form">
          <input type="number" id="input-hud-odo" min="${currentOdo}" value="${currentOdo}" required placeholder="${currentOdo}">
          <button type="submit" title="Submit new Odometer reading">LOG</button>
        </form>
        <button type="button" class="btn-hud-refuel" id="btn-hud-log-fuel" title="Log Fuel Refuel">
          <span>⛽</span> Log Fuel
        </button>
      </div>
      <div class="quick-odo-chips">
        <span class="quick-chip-label">Quick Add:</span>
        <button type="button" class="chip-odo-quick" data-add="10">+10</button>
        <button type="button" class="chip-odo-quick" data-add="25">+25</button>
        <button type="button" class="chip-odo-quick" data-add="50">+50</button>
        <button type="button" class="chip-odo-quick" data-add="100">+100</button>
        <button type="button" class="chip-odo-quick" data-add="500">+500</button>
      </div>
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
  const paginationBar = document.getElementById('dashboard-pagination');
  const fleetSummaryContainer = document.getElementById('fleet-health-summary');
  if (!container) return;

  // Render Fleet Health Summary Badges
  if (fleetSummaryContainer) {
    const allServices = activeVeh && Array.isArray(activeVeh.services) ? enrichedServices : [];
    const countCritical = allServices.filter(s => s.status && s.status.cssClass === 'status--critical').length;
    const countWarning = allServices.filter(s => s.status && s.status.cssClass === 'status--warning').length;
    const countOptimal = allServices.filter(s => s.status && s.status.cssClass === 'status--optimal').length;

    fleetSummaryContainer.innerHTML = `
      <div class="health-chip chip-optimal" title="Components in optimal condition">
        <span class="health-dot dot-optimal"></span> ${countOptimal} Optimal
      </div>
      <div class="health-chip chip-warning" title="Components near maintenance threshold">
        <span class="health-dot dot-warning"></span> ${countWarning} Warning
      </div>
      <div class="health-chip chip-critical" title="Components overdue for service">
        <span class="health-dot dot-critical"></span> ${countCritical} Overdue
      </div>
    `;
  }

  if (enrichedServices.length === 0) {
    if (paginationBar) paginationBar.setAttribute('hidden', 'true');
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

  // Dashboard pagination calculations
  const totalTrackers = enrichedServices.length;
  const perPage = window.dashboardPerPage || 12;
  const totalPages = Math.max(1, Math.ceil(totalTrackers / perPage));
  if (window.dashboardPage > totalPages) {
    window.dashboardPage = totalPages;
  }
  if (!window.dashboardPage || window.dashboardPage < 1) {
    window.dashboardPage = 1;
  }

  const startIndex = (window.dashboardPage - 1) * perPage;
  const paginatedTrackers = enrichedServices.slice(startIndex, startIndex + perPage);

  let html = '';
  paginatedTrackers.forEach(s => {
    const isCritical = s.status.cssClass === 'status--critical';
    const isWarning = s.status.cssClass === 'status--warning';

    const deltaText = s.displayDeltaText;
    const forecast = computeServiceForecast(s, avgMileage);

    const forecastHtml = forecast.isOverdue
      ? `<div class="forecast-label" style="color: var(--status-critical);">${forecast.message}</div>`
      : `<div class="forecast-label">${forecast.message}</div>`;

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
    } else if (forecast && forecast.forecastDate) {
      if (nextExpectedText) nextExpectedText += ' / ';
      nextExpectedText += `<span style="opacity: 0.85;">Est. ${forecast.forecastDate}</span>`;
    }
    if (!nextExpectedText) nextExpectedText = '-';

    // Compute comprehensive degradation progress percentage (higher of KM or Time progress)
    let kmPercent = 0;
    if (s.interval_km && s.deltaRemainingKm !== null) {
      const elapsedKm = Number(s.interval_km) - s.deltaRemainingKm;
      kmPercent = Math.min(100, Math.max(0, Math.round((elapsedKm / Number(s.interval_km)) * 100)));
    }

    let timePercent = 0;
    if (s.interval_time_val && s.last_service_date) {
      const parseFunc = window.parseLocalDate || parseLocalDate;
      const lastDate = parseFunc(s.last_service_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const elapsedDays = Math.max(0, Math.round((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)));
      const totalDays = convertToDays(s.interval_time_val, s.interval_time_unit);
      if (totalDays > 0) {
        timePercent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
      }
    }

    // Render Dual Gauges (KM and Time)
    let gaugesHtml = '';
    const r = 20;
    const circ = 2 * Math.PI * r; // ~125.66

    if (s.interval_km) {
      const safeKmPercent = Math.min(100, Math.max(0, kmPercent));
      const kmOffset = circ - (safeKmPercent / 100) * circ;
      const kmStatusClass = (s.deltaRemainingKm !== null && s.deltaRemainingKm <= 0) ? 'status--critical' : (kmPercent >= 80 ? 'status--warning' : 'status--optimal');
      const kmSub = s.deltaRemainingKm !== null ? (s.deltaRemainingKm < 0 ? `${Math.abs(s.deltaRemainingKm)} KM overdue` : `${s.deltaRemainingKm} KM left`) : '';

      gaugesHtml += `
        <div class="tracker-gauge-item ${kmStatusClass}">
          <div class="gauge-ring-wrap">
            <svg class="gauge-svg" viewBox="0 0 52 52">
              <circle class="gauge-bg" cx="26" cy="26" r="${r}" />
              <circle class="gauge-fill" cx="26" cy="26" r="${r}"
                stroke-dasharray="${circ.toFixed(2)}"
                stroke-dashoffset="${kmOffset.toFixed(2)}" />
            </svg>
            <span class="gauge-center-text">${safeKmPercent}%</span>
          </div>
          <div class="gauge-info">
            <span class="gauge-title">Mileage Wear</span>
            <span class="gauge-val">Due: ${s.nextOdometer !== null ? `${s.nextOdometer} KM` : `${s.interval_km} KM`}</span>
            ${kmSub ? `<span class="gauge-sub">${kmSub}</span>` : ''}
          </div>
        </div>
      `;
    }

    if (s.interval_time_val || (forecast && forecast.days !== null)) {
      const isExplicitTime = !!s.interval_time_val;
      const targetDateStr = s.nextDueDate || (forecast ? forecast.forecastDate : null);
      const daysRemaining = isExplicitTime ? s.deltaRemainingDays : (forecast ? forecast.days : null);
      const safeTimePercent = Math.min(100, Math.max(0, timePercent));
      const timeOffset = circ - (safeTimePercent / 100) * circ;
      const isOverdue = daysRemaining !== null && daysRemaining <= 0;
      const timeStatusClass = isOverdue ? 'status--critical' : (safeTimePercent >= 80 ? 'status--warning' : 'status--optimal');
      const timeSub = daysRemaining !== null ? (daysRemaining < 0 ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d left`) : '';
      const gaugeTitle = isExplicitTime ? 'Time Wear' : 'Est. Time Wear';
      const gaugeVal = targetDateStr ? `Due: ${targetDateStr}` : (isExplicitTime ? `${s.interval_time_val} ${s.interval_time_unit}` : 'Calculating...');

      gaugesHtml += `
        <div class="tracker-gauge-item ${timeStatusClass}">
          <div class="gauge-ring-wrap">
            <svg class="gauge-svg" viewBox="0 0 52 52">
              <circle class="gauge-bg" cx="26" cy="26" r="${r}" />
              <circle class="gauge-fill" cx="26" cy="26" r="${r}"
                stroke-dasharray="${circ.toFixed(2)}"
                stroke-dashoffset="${timeOffset.toFixed(2)}" />
            </svg>
            <span class="gauge-center-text">${safeTimePercent}%</span>
          </div>
          <div class="gauge-info">
            <span class="gauge-title">${gaugeTitle}</span>
            <span class="gauge-val">${gaugeVal}</span>
            ${timeSub ? `<span class="gauge-sub">${timeSub}</span>` : ''}
          </div>
        </div>
      `;
    }

    html += `
      <div class="tracker-card ${s.status.cssClass}">
        <div class="tracker-header">
          <span class="tracker-name">${s.name}</span>
          <span class="tracker-status-tag">${s.status.label}</span>
        </div>

        <div class="tracker-body">
          <div class="tracker-remaining">
            <span class="tracker-remaining-header">MAINTENANCE DELTA</span>
            <span class="tracker-remaining-value">${deltaText}</span>
            ${forecastHtml}
          </div>

          ${gaugesHtml ? `<div class="tracker-gauges-grid">${gaugesHtml}</div>` : ''}

          <div class="tracker-details-grid">
            <div class="detail-item">
              <span class="detail-label">Interval:</span>
              <span class="detail-val">${intervalText}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Last Log:</span>
              <span class="detail-val">${lastServiceText}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Next Expected:</span>
              <span class="detail-val">${nextExpectedText}</span>
            </div>
          </div>
        </div>

        <div class="tracker-actions">
          ${s.notes ? `
            <button class="tracker-notes-btn btn-view-service-notes" data-id="${s.id}" data-service-id="${s.id}">
              <span>📝</span> View Notes
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

  // Render pagination bar
  if (paginationBar) {
    paginationBar.removeAttribute('hidden');

    const pageDisplay = document.getElementById('dashboard-page-display');
    if (pageDisplay) {
      pageDisplay.textContent = `Page ${window.dashboardPage} of ${totalPages}`;
    }

    const btnPrev = document.getElementById('btn-dashboard-prev');
    if (btnPrev) {
      btnPrev.disabled = window.dashboardPage === 1;
    }

    const btnNext = document.getElementById('btn-dashboard-next');
    if (btnNext) {
      btnNext.disabled = window.dashboardPage === totalPages;
    }

    const perPageSelect = document.getElementById('select-dashboard-per-page');
    if (perPageSelect) {
      perPageSelect.value = perPage;
    }
  }
}

/**
 * Update components view mode visibility based on active view mode and viewport size.
 * Automatically defaults to Cards view on mobile (< 900px).
 */
function updateComponentsViewVisibility() {
  const isMobile = window.innerWidth <= 900;
  const mode = isMobile ? 'cards' : (window.componentsViewMode || 'table');
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
  const activeVeh = (typeof getActiveVehicle === 'function') ? getActiveVehicle(state) : state;
  const currentOdo = state.meta?.current_odometer || 0;
  const avgMileage = computeDailyAvgMileage(activeVeh ? activeVeh.odometer_log : []);
  const enriched = computeAllServices(services, currentOdo);

  // Search filtering
  const componentsQuery = window.componentsSearchQuery || '';
  const filteredEnriched = enriched.filter(s => matchesServiceQuery(s, componentsQuery));

  const sortedEnriched = sortServices(
    filteredEnriched,
    window.componentsSortMode || 'default',
    !!window.componentsSortReversed
  );

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
    const itemForecast = computeServiceForecast(s, avgMileage);
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
    } else if (itemForecast && itemForecast.forecastDate) {
      if (nextExpectedText) nextExpectedText += '<br>';
      nextExpectedText += `<span class="lbl-desc" style="font-style: italic;">Est. ${itemForecast.forecastDate}</span>`;
    }
    if (!nextExpectedText) nextExpectedText = '-';

    // Table Row HTML
    tableHtml += `
      <tr>
        <td>
          <strong>${s.name}</strong>
          ${s.notes ? `<button type="button" class="notes-link-btn btn-view-service-notes" data-id="${s.id}">📝 View Notes</button>` : ''}
        </td>
        <td class="cell-display">${intervalText}</td>
        <td class="cell-display">${warningText}</td>
        <td class="cell-display">${lastServiceText}</td>
        <td class="cell-display">${nextExpectedText}</td>
        <td>
          <div class="table-actions">
            <button class="tbl-btn btn-edit" data-id="${s.id}" title="Edit Component">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              <span>Edit</span>
            </button>
            <button class="tbl-btn btn-delete" data-id="${s.id}" title="Delete Component">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              <span>Delete</span>
            </button>
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
            ${s.notes ? `<button type="button" class="notes-link-btn btn-view-service-notes" data-id="${s.id}">📝 View Notes</button>` : ''}
          </div>
          <div class="component-card-actions">
            <button class="tbl-btn btn-edit" data-id="${s.id}" title="Edit Component">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              <span>Edit</span>
            </button>
            <button class="tbl-btn btn-delete" data-id="${s.id}" title="Delete Component">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              <span>Delete</span>
            </button>
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
            <span class="val">${s.nextOdometer !== null ? s.nextOdometer + ' KM' : ''} ${s.one_time_limit_km ? '[*]' : ''} ${s.nextDueDate ? `/ ${s.nextDueDate}` : (itemForecast && itemForecast.forecastDate ? `/ Est. ${itemForecast.forecastDate}` : '')} ${s.one_time_limit_date ? '[*]' : ''}</span>
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
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>');

  // Bullet points
  const lines = html.split('\n');
  let inList = false;
  const processed = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('● ')) {
      const content = trimmed.replace(/^[-*●]\s+/, '');
      const prefix = inList ? '' : '<ul class="markdown-list">';
      inList = true;
      return `${prefix}<li>${content}</li>`;
    }
    const prefix = inList ? '</ul>' : '';
    inList = false;
    return `${prefix}${line}`;
  });
  if (inList) processed.push('</ul>');

  return processed.join('<br>')
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
          <span class="chk-checkmark">
            <svg class="chk-svg" viewBox="0 0 24 24" width="14" height="14" fill="none">
              <path class="chk-path" d="M4.5 12.5L9.5 17.5L19.5 6.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </div>
        <div class="chk-details">
          <div class="chk-name" data-id="${item.id}">${item.task}</div>
          ${item.desc ? `<div class="chk-desc" data-desc-id="${item.id}">${parsedDesc}</div>` : ''}
        </div>
        <button type="button" class="btn-delete-chk" data-type="${type}" data-id="${item.id}" title="Remove Task">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
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
  const activeVeh = (state && state.vehicles) ? getActiveVehicle(state) : state;
  const services = activeVeh?.services || [];
  const currentOdo = activeVeh?.meta?.current_odometer || 0;
  const enriched = computeAllServices(services, currentOdo);
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
    if (isCritical) {
      if (item.deltaRemainingKm !== null && item.deltaRemainingKm <= 0 && item.deltaRemainingDays !== null && item.deltaRemainingDays <= 0) {
        alertMsg = `${item.name} is ${Math.abs(item.deltaRemainingKm)} KM and ${Math.abs(item.deltaRemainingDays)} days overdue!`;
      } else if (item.deltaRemainingKm !== null && item.deltaRemainingKm <= 0) {
        alertMsg = `${item.name} is ${Math.abs(item.deltaRemainingKm)} KM overdue (Target: ${item.nextOdometer} KM).`;
      } else if (item.deltaRemainingDays !== null && item.deltaRemainingDays <= 0) {
        alertMsg = `${item.name} is ${Math.abs(item.deltaRemainingDays)} days overdue (Due: ${item.nextDueDate}).`;
      } else {
        alertMsg = `${item.name} is overdue for scheduled maintenance.`;
      }
    } else {
      if (item.deltaRemainingKm !== null && item.deltaRemainingDays !== null) {
        alertMsg = `${item.name} is due soon: ${item.deltaRemainingKm} KM / ${item.deltaRemainingDays} days remaining before target.`;
      } else if (item.deltaRemainingKm !== null) {
        alertMsg = `${item.name} is due soon: only ${item.deltaRemainingKm} KM remaining before target (${item.nextOdometer} KM).`;
      } else if (item.deltaRemainingDays !== null) {
        alertMsg = `${item.name} is due soon: only ${item.deltaRemainingDays} days remaining (Due: ${item.nextDueDate}).`;
      } else {
        alertMsg = `${item.name} is approaching its scheduled maintenance interval.`;
      }
    }

    html += `
      <div class="reminder-alert-card ${alertClass}" data-type="part-alert">
        <div class="alert-content">
          <div class="alert-icon">${icon}</div>
          <div class="alert-text">
            <h4>Part Tracker ${badgeText}: ${item.name}</h4>
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
            <h4>Routine Check Due: ${item.title}</h4>
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

  const toastDuration = document.getElementById('setting-toast-duration');
  if (toastDuration) toastDuration.value = state.settings?.toast_duration !== undefined ? state.settings.toast_duration : 5;

  // Render dynamic fuel types editor
  renderFuelTypesEditor(state.settings?.fuel_types);

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
  window._appState = state;

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
  const dashboardQuery = window.dashboardSearchQuery || '';
  const filteredEnriched = enriched.filter(s => matchesServiceQuery(s, dashboardQuery));

  const sorted = sortServices(
    filteredEnriched,
    window.dashboardSortMode || 'priority',
    !!window.dashboardSortReversed
  );

  renderServiceCards(sorted, activeVeh);
  renderServiceTable(scopedState);

  renderDailyChecklist(scopedState);
  renderWeeklyChecklist(scopedState);
  renderMonthlyChecklist(scopedState);
  renderModalChecklists(scopedState);
  renderSettings(state);
  renderAutoSnapshots();

  // Render cost summary and history logs
  renderCostSummary(activeVeh, window.costFilterMode || 'yearly', window.costActiveDate || new Date());
  renderServiceHistory(activeVeh, window.historyFilterMode || 'monthly', window.historyActiveDate || new Date());
  renderFuelHistory(activeVeh);
  populateFuelTypeDropdown(state.settings?.fuel_types);
}

/**
 * Render rolling auto-snapshot history inside Data Portability settings.
 */
function renderAutoSnapshots() {
  const container = document.getElementById('auto-snapshots-list');
  if (!container) return;

  const snapshots = typeof getAutoSnapshots === 'function' ? getAutoSnapshots() : [];
  if (snapshots.length === 0) {
    container.innerHTML = `<div class="snapshot-empty">No auto-snapshots recorded yet. Major actions will automatically create recovery points here.</div>`;
    return;
  }

  container.innerHTML = snapshots.map(s => {
    return `
      <div class="snapshot-item">
        <div class="snapshot-info">
          <span class="snapshot-time">${s.dateStr}</span>
          <span class="snapshot-reason">${s.vehicleName} • ${s.reason}</span>
        </div>
        <button type="button" class="action-btn outline-btn snapshot-restore-btn" data-snapshot-id="${s.id}" title="Restore this auto-saved state">
          ↩️ Restore
        </button>
      </div>
    `;
  }).join('');
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

  openModal(modal);
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

  openModal(modal);
}

/**
 * Open a modal overlay safely by ID or element.
 * @param {string|HTMLElement} modalTarget
 */
function openModal(modalTarget) {
  const modal = typeof modalTarget === 'string' ? document.getElementById(modalTarget) : modalTarget;
  if (!modal) return;
  modal.removeAttribute('hidden');
  modal.style.display = '';
}

/**
 * Close all active overlay modals.
 */
function closeModal() {
  const overlays = document.querySelectorAll('.modal-overlay');
  overlays.forEach(modal => {
    modal.setAttribute('hidden', 'true');
    modal.style.display = '';
  });
  pendingImportFile = null;
  currentConfirmCallback = null;
}

let currentConfirmCallback = null;

/**
 * Open the custom M3 confirmation modal.
 * @param {object} options
 * @param {string} [options.title]
 * @param {string} [options.message]
 * @param {string} [options.confirmText]
 * @param {string} [options.confirmClass]
 * @param {string} [options.headerClass]
 * @param {Function} options.onConfirm
 */
function showCustomConfirmModal({
  title = '⚠️ Confirm Action',
  message = 'Are you sure you want to proceed with this action?',
  confirmText = 'Confirm',
  confirmClass = 'danger-btn',
  headerClass = 'header-danger',
  onConfirm
}) {
  const titleEl = document.getElementById('custom-confirm-title');
  const messageEl = document.getElementById('custom-confirm-message');
  const confirmBtn = document.getElementById('btn-action-custom-confirm');
  const headerEl = document.getElementById('custom-confirm-header');

  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;

  if (headerEl) {
    headerEl.className = `modal-header ${headerClass}`;
  }

  if (confirmBtn) {
    confirmBtn.textContent = confirmText;
    confirmBtn.className = `action-btn ${confirmClass}`;
  }

  currentConfirmCallback = onConfirm || null;
  openModal('modal-custom-confirm');
}

function handleCustomConfirmAction() {
  const cb = currentConfirmCallback;
  currentConfirmCallback = null;
  closeModal();
  if (typeof cb === 'function') {
    cb();
  }
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
 * @param {string} [filterMode] 'monthly' | 'yearly' | 'all'
 * @param {Date} [activeDate] Active date filter context
 */
function renderCostSummary(activeVeh, filterMode, activeDate) {
  const container = document.getElementById('cost-summary-content');
  if (!container) return;

  const mode = filterMode || window.costFilterMode || 'yearly';
  const date = activeDate || window.costActiveDate || new Date();

  // Sync toggle buttons
  const monthlyBtn = document.getElementById('btn-cost-monthly');
  const yearlyBtn = document.getElementById('btn-cost-yearly');
  const allBtn = document.getElementById('btn-cost-all');
  if (monthlyBtn && yearlyBtn && allBtn) {
    monthlyBtn.classList.toggle('active', mode === 'monthly');
    yearlyBtn.classList.toggle('active', mode === 'yearly');
    allBtn.classList.toggle('active', mode === 'all');
  }

  // Sync date navigation bar visibility and labels
  const navControls = document.getElementById('cost-date-nav-controls');
  const displayLabel = document.getElementById('cost-date-display');
  const monthPicker = document.getElementById('cost-month-picker');

  if (navControls) {
    if (mode === 'all') {
      navControls.setAttribute('hidden', 'true');
    } else {
      navControls.removeAttribute('hidden');
    }
  }

  const yearVal = date.getFullYear();
  const monthIdx = date.getMonth();
  const monthValStr = `${yearVal}-${String(monthIdx + 1).padStart(2, '0')}`;

  if (displayLabel) {
    if (mode === 'monthly') {
      const monthName = date.toLocaleString('default', { month: 'long' });
      displayLabel.innerHTML = `${monthName} ${yearVal} <span class="picker-cal-icon">📅</span>`;
    } else {
      displayLabel.innerHTML = `${yearVal} <span class="picker-cal-icon">📅</span>`;
    }
  }

  if (monthPicker) {
    monthPicker.value = monthValStr;
  }

  const history = activeVeh.service_history || [];
  if (history.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 16px; color: var(--text-secondary);">No services logged yet. Completing parts trackers will aggregate costs here.</div>`;
    return;
  }

  // Filter history based on mode
  let filtered = history;
  let timeFrameStr = 'All Time';

  if (mode === 'monthly') {
    timeFrameStr = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    filtered = history.filter(item => {
      const itemDate = new Date(item.timestamp);
      return itemDate.getFullYear() === yearVal && itemDate.getMonth() === monthIdx;
    });
  } else if (mode === 'yearly') {
    timeFrameStr = `${yearVal}`;
    filtered = history.filter(item => {
      const itemDate = new Date(item.timestamp);
      return itemDate.getFullYear() === yearVal;
    });
  }

  const summary = computeCostSummary(filtered);

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 16px; color: var(--text-secondary);">No service costs logged for ${timeFrameStr}.</div>`;
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

  // Monthly Spending Trend Bar Chart (Last 6 Months)
  const trends = typeof computeMonthlySpendTrends === 'function' ? computeMonthlySpendTrends(history, 6) : [];
  const maxTotal = Math.max(...trends.map(t => t.total), 1);
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const chartBarsHtml = trends.map(t => {
    const heightPercent = t.total > 0 ? Math.max(12, Math.round((t.total / maxTotal) * 100)) : 0;
    const formattedCost = t.total > 0 ? `${t.total.toLocaleString()} IDR` : '0 IDR';
    const isCurrent = t.monthKey === currentMonthKey;
    return `
      <div class="spend-bar-col ${isCurrent ? 'current-month' : ''}" title="${t.monthLabel} ${t.year}: ${formattedCost}">
        <div class="spend-bar-track">
          <div class="spend-bar ${t.total > 0 ? 'has-spend' : ''}" style="height: ${heightPercent}%;">
            <span class="spend-bar-tooltip">${formattedCost}</span>
          </div>
        </div>
        <span class="spend-bar-month">${t.monthLabel}</span>
      </div>
    `;
  }).join('');

  const chartHtml = trends.length > 0 ? `
    <div class="spend-trend-chart-card">
      <div class="spend-trend-header">
        <span class="spend-trend-title">📊 Spending Trend (Last 6 Months)</span>
      </div>
      <div class="spend-trend-grid">
        ${chartBarsHtml}
      </div>
    </div>
  ` : '';

  container.innerHTML = `
    <div class="cost-total-label">
      Total Maintenance Cost (${timeFrameStr}): ${summary.total.toLocaleString()} IDR
    </div>
    ${chartHtml}
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

  // Format navigation text display & month picker value
  const displayLabel = document.getElementById('history-date-display');
  const monthPicker = document.getElementById('history-month-picker');
  const yearVal = date.getFullYear();
  const monthIdx = date.getMonth();
  const monthValStr = `${yearVal}-${String(monthIdx + 1).padStart(2, '0')}`;

  if (displayLabel) {
    if (mode === 'monthly') {
      const monthName = date.toLocaleString('default', { month: 'long' });
      displayLabel.innerHTML = `${monthName} ${yearVal} <span class="picker-cal-icon">📅</span>`;
    } else {
      displayLabel.innerHTML = `${yearVal} <span class="picker-cal-icon">📅</span>`;
    }
  }

  if (monthPicker) {
    monthPicker.value = monthValStr;
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

/**
 * Render the list of fuel refuel logs inside View B.
 * @param {object} activeVeh
 */
function renderFuelHistory(activeVeh) {
  const container = document.getElementById('fuel-history-list');
  if (!container) return;

  const fuelLog = activeVeh && Array.isArray(activeVeh.fuel_log) ? activeVeh.fuel_log : [];
  if (fuelLog.length === 0) {
    container.innerHTML = `<div class="history-item">No refuel logs recorded yet. Tap "Log Refuel" to record gas fill-ups and compute KM/L efficiency.</div>`;
    return;
  }

  const fuelStats = typeof computeFuelEfficiency === 'function' ? computeFuelEfficiency(fuelLog) : { enrichedLog: fuelLog };
  const enriched = fuelStats.enrichedLog || fuelLog;

  container.innerHTML = enriched.map(item => {
    const dateStr = item.date || new Date(item.timestamp).toISOString().split('T')[0];
    const efficiencyHtml = item.segmentKmL !== null
      ? `<span class="fuel-eff-tag optimal">⚡ ${item.segmentKmL} KM/L</span>`
      : (item.is_full_tank ? `<span class="fuel-eff-tag">🏁 Full Tank</span>` : `<span class="fuel-eff-tag partial">Partial Tank</span>`);

    const costPerKmHtml = item.segmentCostPerKm !== null
      ? `<span class="fuel-cost-tag">Rp ${item.segmentCostPerKm.toLocaleString()}/KM</span>`
      : '';

    const notesHtml = item.notes ? `<div class="history-item-notes">${item.notes}</div>` : '';

    return `
      <div class="history-item fuel-item" data-id="${item.id}">
        <div class="history-item-header">
          <div class="fuel-title-wrap">
            <span class="fuel-type-badge">${item.fuel_type}</span>
            <span class="history-item-date">${dateStr}</span>
          </div>
          <div class="fuel-cost-header">
            <span class="history-item-cost">${item.total_cost.toLocaleString()} IDR</span>
            <div class="fuel-card-actions">
              <button type="button" class="btn-edit-fuel" data-id="${item.id}" title="Edit refuel record">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
              <button type="button" class="btn-delete-fuel" data-id="${item.id}" title="Delete fuel log">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div class="fuel-item-details">
          <span>📊 ${item.liters} L @ Rp ${item.price_per_liter.toLocaleString()}</span>
          <span class="history-item-odo">${item.odometer.toLocaleString()} KM</span>
        </div>
        <div class="fuel-efficiency-row">
          ${efficiencyHtml}
          ${costPerKmHtml}
        </div>
        ${notesHtml}
      </div>
    `;
  }).join('');
}

/**
 * Render the dynamic list of fuel types in Settings.
 * @param {Array<object>} fuelTypes
 */
function renderFuelTypesEditor(fuelTypes) {
  const container = document.getElementById('fuel-types-list');
  if (!container) return;

  const list = Array.isArray(fuelTypes) ? fuelTypes : [];
  if (list.length === 0) {
    container.innerHTML = `
      <div class="fuel-types-empty-state">
        No custom fuel types added yet. Tap <strong>"+ Add Fuel Type"</strong> to add your own, or <strong>"⚡ Load Example Presets"</strong> to load Indonesian standard fuels (Pertalite, Pertamax, Shell, etc.).
      </div>
    `;
    return;
  }

  container.innerHTML = list.map((item, idx) => `
    <div class="fuel-type-editor-row" data-index="${idx}">
      <div class="fuel-type-col-name">
        <label class="fuel-type-label">Fuel Name</label>
        <input type="text" class="fuel-type-name-input" value="${item.name || ''}" placeholder="e.g., Pertamax" required>
      </div>
      <div class="fuel-type-col-price">
        <label class="fuel-type-label">Price / Liter (IDR)</label>
        <input type="number" class="fuel-type-price-input" min="0" value="${item.price || 0}" placeholder="10000" required>
      </div>
      <button type="button" class="btn-remove-fuel-type" title="Remove fuel type">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
  `).join('');
}

/**
 * Populate the fuel type dropdown options using dynamic fuel types array.
 * @param {Array<object>} [fuelTypes]
 */
function populateFuelTypeDropdown(fuelTypes) {
  const select = document.getElementById('fuel-log-type');
  if (!select) return;

  const currentVal = select.value;
  const list = Array.isArray(fuelTypes) ? fuelTypes : [];
  const customOptionHtml = '<option value="Custom" data-price="">Custom Fuel / Price</option>';

  if (list.length === 0) {
    select.innerHTML = customOptionHtml;
  } else {
    select.innerHTML = list.map(item => `
      <option value="${item.name}" data-price="${item.price}">${item.name} (Rp ${Number(item.price).toLocaleString()} / L)</option>
    `).join('') + customOptionHtml;
  }

  if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
    select.value = currentVal;
  }
}

// Assign helpers to global object for DOM actions and app.js access
window.renderAll = renderAll;
window.showToast = showToast;
window.showModal = showModal;
window.openModal = openModal;
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
window.renderFuelHistory = renderFuelHistory;
window.renderFuelTypesEditor = renderFuelTypesEditor;
window.populateFuelTypeDropdown = populateFuelTypeDropdown;
window.updateComponentsViewVisibility = updateComponentsViewVisibility;
window.showCustomConfirmModal = showCustomConfirmModal;
window.handleCustomConfirmAction = handleCustomConfirmAction;
