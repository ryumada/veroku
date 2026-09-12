/**
 * @file app.js
 * @category Hook
 * @description Application initialization and event delegation framework linking UI actions to local storage updates.
 * @requires js/db.js, js/engine.js, js/ui.js
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initial State Load
  let state = getAppState();

  // Save initial default seed data if database is empty
  saveAppState(state);

  // Initialize Service History date navigation state (Monthly view by default)
  window.historyFilterMode = 'monthly';
  window.historyActiveDate = new Date();
  window.odoHistoryPage = 0;

  // Initialize sorting and pagination preferences from localStorage
  window.dashboardSortMode = localStorage.getItem('v_dashboard_sort_mode') || 'priority';
  window.dashboardSortReversed = localStorage.getItem('v_dashboard_sort_reversed') === 'true';
  window.dashboardPage = 1;
  window.dashboardPerPage = parseInt(localStorage.getItem('v_dashboard_per_page'), 10) || 12;
  window.componentsSortMode = localStorage.getItem('v_components_sort_mode') || 'default';
  window.componentsSortReversed = localStorage.getItem('v_components_sort_reversed') === 'true';
  window.componentsPage = 1;
  window.componentsPerPage = parseInt(localStorage.getItem('v_components_per_page'), 10) || 10;
  window.dashboardSearchQuery = '';
  window.componentsSearchQuery = '';

  // Sync sort select element dropdown values and direction button states
  const dashboardSortSelect = document.getElementById('select-dashboard-sort');
  if (dashboardSortSelect) {
    dashboardSortSelect.value = window.dashboardSortMode;
  }
  const dashboardSortRevBtn = document.getElementById('btn-dashboard-sort-reverse');
  if (dashboardSortRevBtn) {
    dashboardSortRevBtn.classList.toggle('active', window.dashboardSortReversed);
    dashboardSortRevBtn.title = window.dashboardSortReversed ? 'Sort Order: Reversed (Click to normal)' : 'Sort Order: Normal (Click to reverse)';
    const icon = dashboardSortRevBtn.querySelector('.sort-dir-icon');
    if (icon) icon.textContent = window.dashboardSortReversed ? '⬆️' : '⬇️';
  }
  const dashboardPerPageSelect = document.getElementById('select-dashboard-per-page');
  if (dashboardPerPageSelect) {
    dashboardPerPageSelect.value = window.dashboardPerPage;
  }
  const componentsSortSelect = document.getElementById('select-components-sort');
  if (componentsSortSelect) {
    componentsSortSelect.value = window.componentsSortMode;
  }
  const componentsSortRevBtn = document.getElementById('btn-components-sort-reverse');
  if (componentsSortRevBtn) {
    componentsSortRevBtn.classList.toggle('active', window.componentsSortReversed);
    componentsSortRevBtn.title = window.componentsSortReversed ? 'Sort Order: Reversed (Click to normal)' : 'Sort Order: Normal (Click to reverse)';
    const icon = componentsSortRevBtn.querySelector('.sort-dir-icon');
    if (icon) icon.textContent = window.componentsSortReversed ? '⬆️' : '⬇️';
  }
  const componentsPerPageSelect = document.getElementById('select-components-per-page');
  if (componentsPerPageSelect) {
    componentsPerPageSelect.value = window.componentsPerPage;
  }

  const searchDashboardInput = document.getElementById('search-dashboard');
  if (searchDashboardInput) {
    searchDashboardInput.addEventListener('input', (e) => {
      window.dashboardSearchQuery = e.target.value;
      window.dashboardPage = 1; // reset pagination page on search query change
      renderAll(state);
    });
  }

  const searchComponentsInput = document.getElementById('search-components');
  if (searchComponentsInput) {
    searchComponentsInput.addEventListener('input', (e) => {
      window.componentsSearchQuery = e.target.value;
      window.componentsPage = 1; // reset pagination page on search query change
      renderAll(state);
    });
  }

  // 2. Perform First Paint
  const addLastServiceDate = document.getElementById('add-last-service-date');
  if (addLastServiceDate) {
    addLastServiceDate.value = new Date().toISOString().split('T')[0];
  }
  renderAll(state);

  // ==========================================================================
  // TAB NAVIGATION WIRING
  // ==========================================================================
  const navButtons = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.view-section');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-view');

      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      sections.forEach(sec => {
        if (sec.id === targetId) {
          sec.removeAttribute('hidden');
          sec.style.display = '';
        } else {
          sec.setAttribute('hidden', 'true');
          sec.style.display = 'none';
        }
      });
    });
  });

  // ==========================================================================
  // NUMERIC INPUT VALIDATION & ALPHABETICAL RESTRICTION
  // ==========================================================================
  let lastNonNumericToastTime = 0;

  // Proactively prevent alphabetical / invalid keystrokes on numeric fields
  document.addEventListener('keydown', (e) => {
    const target = e.target;
    if (target && target.tagName === 'INPUT' && target.type === 'number') {
      // Allow navigation and editing control keys (Backspace, Tab, Delete, Arrows, Enter, Ctrl/Cmd shortcuts)
      const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', 'Escape'];
      if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      // Block 'e', 'E', '+', '-', and non-digit characters
      if (['e', 'E', '+', '-'].includes(e.key) || !/^\d$/.test(e.key)) {
        e.preventDefault();
        const now = Date.now();
        if (now - lastNonNumericToastTime > 1200) {
          lastNonNumericToastTime = now;
          showToast('Only numbers (0-9) are allowed in this field.', 'error');
        }
      }
    }
  });

  // Sanitize any non-numeric characters pasted into number inputs
  document.addEventListener('paste', (e) => {
    const target = e.target;
    if (target && target.tagName === 'INPUT' && target.type === 'number') {
      const pasteData = (e.clipboardData || window.clipboardData)?.getData('text');
      if (pasteData && !/^\d+$/.test(pasteData)) {
        e.preventDefault();
        const sanitized = pasteData.replace(/\D/g, '');
        if (sanitized) {
          document.execCommand('insertText', false, sanitized);
        }
        showToast('Non-numeric characters were removed from pasted text.', 'error');
      }
    }
  });

  // ==========================================================================
  // COMPONENTS VIEW TOGGLE WIRING
  // ==========================================================================
  window.componentsViewMode = localStorage.getItem('v_components_view_mode') || 'table';

  document.getElementById('btn-components-table-view')?.addEventListener('click', () => {
    window.componentsViewMode = 'table';
    localStorage.setItem('v_components_view_mode', 'table');
    window.updateComponentsViewVisibility();
  });

  document.getElementById('btn-components-card-view')?.addEventListener('click', () => {
    window.componentsViewMode = 'cards';
    localStorage.setItem('v_components_view_mode', 'cards');
    window.updateComponentsViewVisibility();
  });

  // Responsive switch for components view mode (cards on mobile <= 900px)
  window.addEventListener('resize', () => {
    window.updateComponentsViewVisibility?.();
  });

  // ==========================================================================
  // SORTING CONTROLS WIRING
  // ==========================================================================
  document.getElementById('select-dashboard-sort')?.addEventListener('change', (e) => {
    window.dashboardSortMode = e.target.value;
    localStorage.setItem('v_dashboard_sort_mode', e.target.value);
    window.dashboardPage = 1;
    renderAll(state);
  });

  document.getElementById('btn-dashboard-sort-reverse')?.addEventListener('click', () => {
    window.dashboardSortReversed = !window.dashboardSortReversed;
    localStorage.setItem('v_dashboard_sort_reversed', String(window.dashboardSortReversed));
    const btn = document.getElementById('btn-dashboard-sort-reverse');
    if (btn) {
      btn.classList.toggle('active', window.dashboardSortReversed);
      btn.title = window.dashboardSortReversed ? 'Sort Order: Reversed (Click to normal)' : 'Sort Order: Normal (Click to reverse)';
      const icon = btn.querySelector('.sort-dir-icon');
      if (icon) icon.textContent = window.dashboardSortReversed ? '⬆️' : '⬇️';
    }
    window.dashboardPage = 1;
    renderAll(state);
  });

  document.getElementById('select-dashboard-per-page')?.addEventListener('change', (e) => {
    window.dashboardPerPage = parseInt(e.target.value, 10);
    localStorage.setItem('v_dashboard_per_page', e.target.value);
    window.dashboardPage = 1;
    renderAll(state);
  });

  document.getElementById('btn-dashboard-prev')?.addEventListener('click', () => {
    if (window.dashboardPage > 1) {
      window.dashboardPage--;
      renderAll(state);
    }
  });

  document.getElementById('btn-dashboard-next')?.addEventListener('click', () => {
    window.dashboardPage++;
    renderAll(state);
  });

  document.getElementById('select-components-sort')?.addEventListener('change', (e) => {
    window.componentsSortMode = e.target.value;
    localStorage.setItem('v_components_sort_mode', e.target.value);
    window.componentsPage = 1;
    renderAll(state);
  });

  document.getElementById('btn-components-sort-reverse')?.addEventListener('click', () => {
    window.componentsSortReversed = !window.componentsSortReversed;
    localStorage.setItem('v_components_sort_reversed', String(window.componentsSortReversed));
    const btn = document.getElementById('btn-components-sort-reverse');
    if (btn) {
      btn.classList.toggle('active', window.componentsSortReversed);
      btn.title = window.componentsSortReversed ? 'Sort Order: Reversed (Click to normal)' : 'Sort Order: Normal (Click to reverse)';
      const icon = btn.querySelector('.sort-dir-icon');
      if (icon) icon.textContent = window.componentsSortReversed ? '⬆️' : '⬇️';
    }
    window.componentsPage = 1;
    renderAll(state);
  });

  document.getElementById('select-components-per-page')?.addEventListener('change', (e) => {
    window.componentsPerPage = parseInt(e.target.value, 10);
    localStorage.setItem('v_components_per_page', e.target.value);
    window.componentsPage = 1;
    renderAll(state);
  });

  document.getElementById('btn-components-prev')?.addEventListener('click', () => {
    if (window.componentsPage > 1) {
      window.componentsPage--;
      renderAll(state);
    }
  });

  document.getElementById('btn-components-next')?.addEventListener('click', () => {
    window.componentsPage++;
    renderAll(state);
  });

  // ==========================================================================
  // ODOMETER HUD SUBMIT HANDLER
  // ==========================================================================
  document.body.addEventListener('submit', (e) => {
    if (e.target && e.target.id === 'form-odometer') {
      e.preventDefault();
      const inputOdo = document.getElementById('input-hud-odo');
      if (!inputOdo) return;

      const newOdo = parseInt(inputOdo.value, 10);
      const activeVeh = getActiveVehicle(state);
      const currentOdo = activeVeh.meta.current_odometer || 0;

      if (isNaN(newOdo) || newOdo < currentOdo) {
        showToast('Odometer reading cannot be decreased.', 'error');
        return;
      }

      activeVeh.meta.current_odometer = newOdo;
      activeVeh.meta.last_updated_timestamp = Date.now();
      if (!activeVeh.odometer_log) activeVeh.odometer_log = [];
      activeVeh.odometer_log.push({
        timestamp: Date.now(),
        odometer: newOdo
      });

      saveAppState(state);
      renderAll(state);
      showToast(`Odometer logged at ${newOdo} KM`, 'success');
    }
  });

  // ==========================================================================
  // ADD SERVICE FORM WIRING
  // ==========================================================================
  const formAddService = document.getElementById('form-add-service');
  if (formAddService) {
    formAddService.addEventListener('submit', (e) => {
      e.preventDefault();

      const nameInput = document.getElementById('add-name');
      const intervalInput = document.getElementById('add-interval');
      const warningInput = document.getElementById('add-warning-threshold');
      const lastServiceInput = document.getElementById('add-last-service');
      const lastServiceDateInput = document.getElementById('add-last-service-date');

      const intervalTimeValInput = document.getElementById('add-interval-time-val');
      const intervalTimeUnitSelect = document.getElementById('add-interval-time-unit');
      const warningTimeValInput = document.getElementById('add-warning-time-val');
      const warningTimeUnitSelect = document.getElementById('add-warning-time-unit');

      const name = nameInput.value.trim();
      const interval = intervalInput.value ? parseInt(intervalInput.value, 10) : undefined;
      const warningVal = warningInput.value ? parseInt(warningInput.value, 10) : undefined;
      const lastService = parseInt(lastServiceInput.value, 10);
      const lastServiceDate = lastServiceDateInput.value;
      const notesInput = document.getElementById('add-notes');
      const notes = notesInput ? notesInput.value.trim() : '';

      const intervalTimeVal = intervalTimeValInput.value ? parseInt(intervalTimeValInput.value, 10) : undefined;
      const intervalTimeUnit = intervalTimeUnitSelect.value;
      const warningTimeVal = warningTimeValInput.value ? parseInt(warningTimeValInput.value, 10) : undefined;
      const warningTimeUnit = warningTimeUnitSelect.value;

      if (!name || isNaN(lastService) || !lastServiceDate) {
        showToast('Please fill out all required fields with valid data.', 'error');
        return;
      }

      if ((interval === undefined || isNaN(interval)) && (intervalTimeVal === undefined || isNaN(intervalTimeVal))) {
        showToast('Please specify either an Odometer interval (KM) or a Time interval.', 'error');
        return;
      }

      const newService = {
        id: generateId('srv'),
        name: name,
        interval_km: interval,
        warning_threshold: warningVal,
        interval_time_val: intervalTimeVal,
        interval_time_unit: intervalTimeUnit,
        warning_time_val: warningTimeVal,
        warning_time_unit: warningTimeUnit,
        last_service_odometer: lastService,
        last_service_date: lastServiceDate,
        notes: notes
      };

      const activeVeh = getActiveVehicle(state);
      activeVeh.services.push(newService);
      saveAppState(state);
      window.componentsPage = 1;
      renderAll(state);

      // Reset form and re-fill default date
      formAddService.reset();
      if (lastServiceDateInput) {
        lastServiceDateInput.value = new Date().toISOString().split('T')[0];
      }
      showToast(`Registered component: ${name}`, 'success');
    });
  }

  // ==========================================================================
  // EDIT SERVICE FORM SUBMIT
  // ==========================================================================
  const formEditService = document.getElementById('form-edit-service');
  if (formEditService) {
    formEditService.addEventListener('submit', (e) => {
      e.preventDefault();

      const id = document.getElementById('edit-id').value;
      const name = document.getElementById('edit-name').value.trim();
      const interval = document.getElementById('edit-interval').value ? parseInt(document.getElementById('edit-interval').value, 10) : undefined;
      const warningVal = document.getElementById('edit-warning-threshold').value ? parseInt(document.getElementById('edit-warning-threshold').value, 10) : undefined;

      const intervalTimeVal = document.getElementById('edit-interval-time-val').value ? parseInt(document.getElementById('edit-interval-time-val').value, 10) : undefined;
      const intervalTimeUnit = document.getElementById('edit-interval-time-unit').value;
      const warningTimeVal = document.getElementById('edit-warning-time-val').value ? parseInt(document.getElementById('edit-warning-time-val').value, 10) : undefined;
      const warningTimeUnit = document.getElementById('edit-warning-time-unit').value;

      const lastService = parseInt(document.getElementById('edit-last-service').value, 10);
      const lastServiceDate = document.getElementById('edit-last-service-date').value;
      const editNotesInput = document.getElementById('edit-notes');
      const notes = editNotesInput ? editNotesInput.value.trim() : '';

      // One-time overrides
      const oneTimeLimitKm = document.getElementById('edit-one-time-limit-km').value ? parseInt(document.getElementById('edit-one-time-limit-km').value, 10) : null;
      const oneTimeLimitDate = document.getElementById('edit-one-time-limit-date').value || null;

      if (!id || !name || isNaN(lastService) || !lastServiceDate) {
        showToast('Please enter valid updates.', 'error');
        return;
      }

      if ((interval === undefined || isNaN(interval)) && (intervalTimeVal === undefined || isNaN(intervalTimeVal))) {
        showToast('Please specify either an Odometer interval (KM) or a Time interval.', 'error');
        return;
      }

      const activeVeh = getActiveVehicle(state);
      const service = activeVeh.services.find(s => s.id === id);
      if (service) {
        service.name = name;
        service.interval_km = interval;
        service.warning_threshold = warningVal;
        service.interval_time_val = intervalTimeVal;
        service.interval_time_unit = intervalTimeUnit;
        service.warning_time_val = warningTimeVal;
        service.warning_time_unit = warningTimeUnit;
        service.last_service_odometer = lastService;
        service.last_service_date = lastServiceDate;
        service.notes = notes;

        // One-time overrides
        service.one_time_limit_km = oneTimeLimitKm;
        service.one_time_limit_date = oneTimeLimitDate;

        saveAppState(state);
        renderAll(state);
        closeModal();
        showToast('Component updated successfully.', 'success');
      } else {
        showToast('Target component not found.', 'error');
      }
    });
  }

  // ==========================================================================
  // EVENT DELEGATION: COMPONENT ACTIONS (EDIT/DELETE)
  // ==========================================================================
  const serviceTable = document.getElementById('service-table');
  const serviceCardsContainer = document.getElementById('components-cards-container');

  function handleServiceAction(e) {
    const editBtn = e.target.closest('.btn-edit');
    const deleteBtn = e.target.closest('.btn-delete');

    const activeVeh = getActiveVehicle(state);
    const notesBtn = e.target.closest('.btn-view-service-notes');

    if (notesBtn) {
      const id = notesBtn.getAttribute('data-id');
      const service = activeVeh.services.find(s => s.id === id);
      if (service && service.notes) {
        const titleEl = document.getElementById('service-notes-title');
        const bodyEl = document.getElementById('service-notes-body');
        if (titleEl) titleEl.textContent = `${service.name} Notes`;
        if (bodyEl) bodyEl.innerHTML = parseMarkdown(service.notes);
        openModal('modal-service-notes-view');
      }
      return;
    }

    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      const service = activeVeh.services.find(s => s.id === id);
      if (service) {
        showModal(service);
      }
    }

    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      const serviceIndex = activeVeh.services.findIndex(s => s.id === id);
      if (serviceIndex !== -1) {
        const serviceName = activeVeh.services[serviceIndex].name;
        showCustomConfirmModal({
          title: '🗑️ Delete Component Tracker',
          message: `Are you sure you want to delete tracking for "${serviceName}"? This will remove all interval thresholds and tracking records for this part.`,
          confirmText: 'Delete Tracker',
          confirmClass: 'danger-btn',
          headerClass: 'header-danger',
          onConfirm: () => {
            activeVeh.services.splice(serviceIndex, 1);
            saveAppState(state);
            window.componentsPage = 1;
            renderAll(state);
            triggerHaptic('light');
            showToast('Component tracker deleted.', 'success');
          }
        });
      }
    }
  }

  if (serviceTable) {
    serviceTable.addEventListener('click', handleServiceAction);
  }
  if (serviceCardsContainer) {
    serviceCardsContainer.addEventListener('click', handleServiceAction);
  }

  // ==========================================================================
  // EVENT DELEGATION: TRACKER CARDS (MARK AS DONE)
  // ==========================================================================
  const serviceCards = document.getElementById('service-cards');
  if (serviceCards) {
    serviceCards.addEventListener('click', (e) => {
      const doneBtn = e.target.closest('.tracker-done-btn');
      if (doneBtn) {
        const serviceId = doneBtn.getAttribute('data-service-id');
        const activeVeh = getActiveVehicle(state);
        const service = activeVeh.services.find(s => s.id === serviceId);
        if (service) {
          // Open cost and notes confirmation modal
          const todayStr = (window.formatLocalDate || formatLocalDate)(new Date());
          document.getElementById('log-service-id').value = serviceId;
          document.getElementById('log-service-name').value = service.name;
          document.getElementById('log-service-date').value = todayStr;
          document.getElementById('log-service-cost').value = '';
          document.getElementById('log-service-notes').value = '';
          openModal('modal-service-log');
        }
        return;
      }

      const notesBtn = e.target.closest('.tracker-notes-btn') || e.target.closest('.btn-view-service-notes');
      if (notesBtn) {
        const serviceId = notesBtn.getAttribute('data-id') || notesBtn.getAttribute('data-service-id');
        const activeVeh = getActiveVehicle(state);
        const service = activeVeh.services.find(s => s.id === serviceId);
        if (service && service.notes) {
          const titleEl = document.getElementById('service-notes-title');
          const bodyEl = document.getElementById('service-notes-body');
          if (titleEl) titleEl.textContent = `${service.name} Notes`;
          if (bodyEl) bodyEl.innerHTML = parseMarkdown(service.notes);
          openModal('modal-service-notes-view');
        }
      }
    });
  }

  // ==========================================================================
  // EVENT DELEGATION: CHECKLIST BOX TOGGLING & DELETE ACTIONS
  // ==========================================================================
  function handleChecklistClick(e) {
    const itemEl = e.target.closest('.checklist-item');
    const deleteBtn = e.target.closest('.btn-delete-chk');
    const nameEl = e.target.closest('.chk-name');
    const checkboxWrap = e.target.closest('.chk-checkbox-wrap');

    if (!itemEl) return;

    const type = itemEl.getAttribute('data-type');
    const id = itemEl.getAttribute('data-id');
    const activeVeh = getActiveVehicle(state);
    const list = activeVeh.routine_checks[type];
    const itemIndex = list.findIndex(item => item.id === id);

    if (itemIndex === -1) return;

    // Delete item action
    if (deleteBtn) {
      e.stopPropagation();
      e.preventDefault();
      const taskName = list[itemIndex].task;
      showCustomConfirmModal({
        title: '🗑️ Delete Routine Task',
        message: `Are you sure you want to delete "${taskName}" from your checklist?`,
        confirmText: 'Delete Task',
        confirmClass: 'danger-btn',
        headerClass: 'header-danger',
        onConfirm: () => {
          list.splice(itemIndex, 1);
          saveAppState(state);
          renderAll(state);
          triggerHaptic('light');
          showToast('Checklist task removed.', 'success');
        }
      });
      return;
    }

    // Show routine description modal view
    if (nameEl) {
      e.stopPropagation();
      e.preventDefault();
      const descEl = itemEl.querySelector('.chk-desc');
      if (descEl) {
        const titleEl = document.getElementById('routine-desc-title');
        const bodyEl = document.getElementById('routine-desc-body');
        if (titleEl) titleEl.textContent = list[itemIndex].task;
        if (bodyEl) bodyEl.innerHTML = descEl.innerHTML;
        openModal('modal-routine-desc-view');
      }
      return;
    }

    // Toggle check action (fires on clicking checkbox or other card areas)
    const input = itemEl.querySelector('input[type="checkbox"]');
    if (e.target !== input) {
      input.checked = !input.checked;
    }

    list[itemIndex].checked = input.checked;
    const allMatchingItems = document.querySelectorAll(`.checklist-item[data-id="${id}"]`);
    allMatchingItems.forEach(matchItem => {
      const matchInput = matchItem.querySelector('input[type="checkbox"]');
      if (matchInput) matchInput.checked = input.checked;

      if (input.checked) {
        matchItem.classList.add('checked');
      } else {
        matchItem.classList.remove('checked');
      }
    });

    saveAppState(state);

    // Update streak if daily checks completed
    if (type === 'daily') {
      const updatedStreak = computeStreakUpdate(activeVeh.meta, activeVeh.routine_checks.daily);
      activeVeh.meta.streak_days = updatedStreak.streak_days;
      activeVeh.meta.streak_last_completed_date = updatedStreak.streak_last_completed_date;
      saveAppState(state);
    }
    renderAll(state);
  }

  // Apply to lists in main panel and modals
  document.getElementById('daily-checklist')?.addEventListener('click', handleChecklistClick);
  document.getElementById('weekly-checklist')?.addEventListener('click', handleChecklistClick);
  document.getElementById('monthly-checklist')?.addEventListener('click', handleChecklistClick);
  document.getElementById('modal-daily-list')?.addEventListener('click', handleChecklistClick);
  document.getElementById('modal-weekly-list')?.addEventListener('click', handleChecklistClick);
  document.getElementById('modal-monthly-list')?.addEventListener('click', handleChecklistClick);

  // ==========================================================================
  // ADD ROUTINE MODAL TRIGGERS AND FORM HANDLER
  // ==========================================================================
  document.body.addEventListener('click', (e) => {
    const trigger = e.target.closest('.btn-add-routine-trigger');
    if (trigger) {
      const type = trigger.getAttribute('data-type');
      const typeSelect = document.getElementById('routine-type');
      if (typeSelect) {
        typeSelect.value = type;
      }
      openModal('modal-add-routine');
    }
  });

  const formAddRoutine = document.getElementById('form-add-routine');
  if (formAddRoutine) {
    formAddRoutine.addEventListener('submit', (e) => {
      e.preventDefault();

      const type = document.getElementById('routine-type').value;
      const task = document.getElementById('routine-task').value.trim();
      const desc = document.getElementById('routine-desc').value.trim();

      if (!task) {
        showToast('Please enter a task name.', 'error');
        return;
      }

      const newItem = {
        id: generateId(type === 'daily' ? 'd' : (type === 'weekly' ? 'w' : 'm')),
        task: task,
        desc: desc,
        checked: false
      };

      const activeVeh = getActiveVehicle(state);
      activeVeh.routine_checks[type].push(newItem);
      saveAppState(state);
      renderAll(state);

      formAddRoutine.reset();
      closeModal();
      showToast(`Added routine safety task: ${task}`, 'success');
    });
  }

  // ==========================================================================
  // HAPTIC FEEDBACK & CHECKLIST ACTIONS
  // ==========================================================================
  function triggerHaptic(type = 'light') {
    if (!navigator.vibrate) return;
    try {
      if (type === 'light') navigator.vibrate(10);
      else if (type === 'medium') navigator.vibrate(25);
      else if (type === 'success') navigator.vibrate([15, 30, 20]);
    } catch (_) {}
  }

  function checkAllTasks(type) {
    const activeVeh = getActiveVehicle(state);
    if (activeVeh.routine_checks && activeVeh.routine_checks[type]) {
      activeVeh.routine_checks[type].forEach(item => item.checked = true);
    }
    if (type === 'daily') {
      const updatedStreak = computeStreakUpdate(activeVeh.meta, activeVeh.routine_checks.daily);
      activeVeh.meta.streak_days = updatedStreak.streak_days;
      activeVeh.meta.streak_last_completed_date = updatedStreak.streak_last_completed_date;
    }
    saveAppState(state);
    renderAll(state);
    triggerHaptic('success');
    showToast(`All ${type} safety checks completed!`, 'success');
  }

  function resetChecklist(type) {
    const activeVeh = getActiveVehicle(state);
    if (activeVeh.routine_checks && activeVeh.routine_checks[type]) {
      activeVeh.routine_checks[type].forEach(item => item.checked = false);
    }
    saveAppState(state);
    renderAll(state);
    triggerHaptic('light');
    showToast(`Reset ${type} checklist tasks.`, 'success');
  }

  ['daily', 'weekly', 'monthly'].forEach(type => {
    document.getElementById(`btn-check-all-${type}`)?.addEventListener('click', () => checkAllTasks(type));
    document.getElementById(`btn-check-all-${type}-modal`)?.addEventListener('click', () => checkAllTasks(type));
    document.getElementById(`btn-reset-${type}`)?.addEventListener('click', () => resetChecklist(type));
    document.getElementById(`btn-reset-${type}-modal`)?.addEventListener('click', () => resetChecklist(type));
  });

  // Quick Odometer Increment Chips
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip-odo-quick');
    if (chip) {
      const addVal = parseInt(chip.getAttribute('data-add'), 10) || 0;
      const input = document.getElementById('input-hud-odo');
      if (input) {
        const current = parseInt(input.value, 10) || 0;
        input.value = current + addVal;
        triggerHaptic('light');
      }
    }
  });

  // ==========================================================================
  // ROUTINES MODAL TRIGGERS
  // ==========================================================================
  document.getElementById('btn-open-daily')?.addEventListener('click', () => {
    triggerHaptic('light');
    openModal('modal-daily');
  });
  document.getElementById('btn-open-weekly')?.addEventListener('click', () => {
    triggerHaptic('light');
    openModal('modal-weekly');
  });
  document.getElementById('btn-open-monthly')?.addEventListener('click', () => {
    triggerHaptic('light');
    openModal('modal-monthly');
  });

  // ==========================================================================
  // BACKUP & RESTORE DATA WIRING (EXPORT & TWO-STEP IMPORT)
  // ==========================================================================
  document.getElementById('btn-export')?.addEventListener('click', exportData);

  document.getElementById('btn-import-trigger')?.addEventListener('click', () => {
    document.getElementById('input-import')?.click();
  });

  const inputImport = document.getElementById('input-import');
  if (inputImport) {
    inputImport.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        showImportConfirmModal(file);
      }
      // Reset file picker value so the change event triggers again on selecting the same file
      inputImport.value = '';
    });
  }

  // Two-step text listener for typing 'IMPORT'
  const confirmTextInput = document.getElementById('confirm-text-input');
  const confirmBtn = document.getElementById('btn-confirm-import');

  confirmTextInput?.addEventListener('input', (e) => {
    const val = e.target.value.trim().toUpperCase();
    if (val === 'IMPORT') {
      confirmBtn.removeAttribute('disabled');
    } else {
      confirmBtn.setAttribute('disabled', 'true');
    }
  });

  // Action clicks inside Two-step Modal
  confirmBtn?.addEventListener('click', async () => {
    const file = getPendingImportFile();
    if (file) {
      const res = await importData(file);
      if (res.ok) {
        state = getAppState();
        renderAll(state);
        showToast('Backup restored successfully!', 'success');
      } else {
        showToast(`Restore failed: ${res.error}`, 'error');
      }
    }
    closeModal();
  });

  document.getElementById('btn-cancel-import')?.addEventListener('click', closeModal);

  // ==========================================================================
  // GLOBAL MODAL EXIT WIRE (CLICK OUTSIDE CARD OR CLOSE BUTTON)
  // ==========================================================================
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      // Exit if clicking outside the modal-card panel itself
      if (e.target === overlay) {
        closeModal();
      }
    });
  });

  const modalCloseBtnIds = [
    'btn-close-daily-modal', 'btn-confirm-daily-modal',
    'btn-close-weekly-modal', 'btn-confirm-weekly-modal',
    'btn-close-monthly-modal', 'btn-confirm-monthly-modal',
    'btn-close-edit', 'btn-cancel-edit',
    'btn-cancel-import', 'btn-cancel-delete',
    'btn-close-add-routine', 'btn-cancel-add-routine',
    'btn-close-add-vehicle', 'btn-cancel-add-vehicle',
    'btn-close-service-log', 'btn-cancel-service-log',
    'btn-close-odo-history', 'btn-close-odo-history-footer',
    'btn-close-edit-vehicle', 'btn-cancel-edit-vehicle',
    'btn-cancel-delete-vehicle',
    'btn-close-routine-desc-view', 'btn-close-routine-desc-view-footer',
    'btn-close-service-notes-view', 'btn-close-service-notes-view-footer',
    'btn-close-custom-confirm', 'btn-cancel-custom-confirm',
    'btn-close-log-fuel', 'btn-cancel-log-fuel'
  ];
  modalCloseBtnIds.forEach(id => {
    document.getElementById(id)?.addEventListener('click', closeModal);
  });

  document.getElementById('btn-action-custom-confirm')?.addEventListener('click', () => {
    triggerHaptic('light');
    if (typeof handleCustomConfirmAction === 'function') {
      handleCustomConfirmAction();
    }
  });

  // ==========================================================================
  // SETTINGS SUBMIT HANDLER
  // ==========================================================================
  const formSettings = document.getElementById('form-settings');
  if (formSettings) {
    formSettings.addEventListener('submit', (e) => {
      e.preventDefault();

      state.settings = {
        theme: state.settings?.theme || 'dark',
        toast_duration: Number(document.getElementById('setting-toast-duration')?.value ?? 5),
        reminders: {
          daily: {
            enabled: document.getElementById('reminder-daily-enabled').checked,
            time: document.getElementById('reminder-daily-time').value || '08:00'
          },
          weekly: {
            enabled: document.getElementById('reminder-weekly-enabled').checked,
            day: Number(document.getElementById('reminder-weekly-day').value),
            time: document.getElementById('reminder-weekly-time').value || '09:00'
          },
          monthly: {
            enabled: document.getElementById('reminder-monthly-enabled').checked,
            date: Number(document.getElementById('reminder-monthly-date').value) || 1,
            time: document.getElementById('reminder-monthly-time').value || '10:00'
          }
        },
        fuel_types: Array.from(document.querySelectorAll('#fuel-types-list .fuel-type-editor-row')).map((row, i) => ({
          id: `ft-${i + 1}`,
          name: row.querySelector('.fuel-type-name-input')?.value.trim() || 'Fuel',
          price: Number(row.querySelector('.fuel-type-price-input')?.value) || 0
        })).filter(f => f.name.length > 0)
      };

      saveAppState(state);
      if (typeof populateFuelTypeDropdown === 'function') {
        populateFuelTypeDropdown(state.settings.fuel_types);
      }
      renderAll(state);
      showToast('Settings saved successfully.', 'success');
    });
  }

  // Add Fuel Type Row in Settings
  document.getElementById('btn-add-fuel-type')?.addEventListener('click', () => {
    const list = document.getElementById('fuel-types-list');
    if (!list) return;
    const div = document.createElement('div');
    div.className = 'fuel-type-editor-row';
    div.innerHTML = `
      <div class="fuel-type-col-name">
        <label class="fuel-type-label">Fuel Name</label>
        <input type="text" class="fuel-type-name-input" value="" placeholder="e.g., BP 92" required>
      </div>
      <div class="fuel-type-col-price">
        <label class="fuel-type-label">Price / Liter (IDR)</label>
        <input type="number" class="fuel-type-price-input" min="0" value="15000" placeholder="15000" required>
      </div>
      <button type="button" class="btn-remove-fuel-type" title="Remove fuel type">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    `;
    list.appendChild(div);
    div.querySelector('.fuel-type-name-input')?.focus();
    triggerHaptic('light');
  });

  // Remove Fuel Type Row delegation
  document.getElementById('fuel-types-list')?.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.btn-remove-fuel-type');
    if (removeBtn) {
      const row = removeBtn.closest('.fuel-type-editor-row');
      if (row) {
        row.remove();
        triggerHaptic('light');
      }
    }
  });

  // Load Example Fuel Presets in Settings
  document.getElementById('btn-load-example-fuel-types')?.addEventListener('click', () => {
    const list = window.EXAMPLE_FUEL_TYPES || [
      { id: 'ft-1', name: 'Pertalite', price: 10000 },
      { id: 'ft-2', name: 'Pertamax', price: 12950 },
      { id: 'ft-3', name: 'Pertamax Turbo', price: 14400 },
      { id: 'ft-4', name: 'Shell Super', price: 13500 },
      { id: 'ft-5', name: 'Shell V-Power', price: 14500 }
    ];
    if (typeof renderFuelTypesEditor === 'function') {
      renderFuelTypesEditor(list);
      triggerHaptic('success');
      showToast('Loaded standard Indonesian fuel presets. Tap "Save Settings" to apply.', 'info');
    }
  });

  // ==========================================================================
  // NOTIFICATION DUE ACTION BUTTONS
  // ==========================================================================
  document.getElementById('dashboard-notifications')?.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('.btn-action-notification');
    if (actionBtn) {
      const modalId = actionBtn.getAttribute('data-modal');
      if (modalId) {
        openModal(modalId);
      }
      return;
    }

    const logTriggerBtn = e.target.closest('.btn-log-service-trigger');
    if (logTriggerBtn) {
      const serviceId = logTriggerBtn.getAttribute('data-service-id');
      const activeVeh = getActiveVehicle(state);
      const service = activeVeh.services.find(s => s.id === serviceId);
      if (service) {
        const todayStr = (window.formatLocalDate || formatLocalDate)(new Date());
        document.getElementById('log-service-id').value = serviceId;
        document.getElementById('log-service-name').value = service.name;
        document.getElementById('log-service-date').value = todayStr;
        document.getElementById('log-service-cost').value = '';
        document.getElementById('log-service-notes').value = '';
        openModal('modal-service-log');
      }
    }
  });

  // ==========================================================================
  // SETTINGS MENU ACCORDION AND DATA MGMT TRIGGERS
  // ==========================================================================
  const accordionHeader = document.getElementById('btn-toggle-data-mgmt');
  const accordionCard = document.getElementById('accordion-data-mgmt');
  if (accordionHeader && accordionCard) {
    accordionHeader.addEventListener('click', () => {
      const isExpanded = accordionCard.classList.toggle('expanded');
      accordionHeader.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    });
    accordionHeader.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const isExpanded = accordionCard.classList.toggle('expanded');
        accordionHeader.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      }
    });
  }

  // Service History CSV Export
  function exportServiceHistoryCSV() {
    const activeVeh = getActiveVehicle(state);
    const history = activeVeh.service_history || [];
    if (history.length === 0) {
      showToast('No service history records to export.', 'warning');
      return;
    }

    const headers = ['Vehicle', 'Date', 'Component', 'Odometer (KM)', 'Cost (IDR)', 'Notes'];
    const rows = history.map(item => {
      const dateStr = item.service_date || (item.timestamp ? new Date(item.timestamp).toISOString().split('T')[0] : '');
      const escape = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
      return [
        escape(activeVeh.name),
        escape(dateStr),
        escape(item.service_name),
        item.odometer_at_service || 0,
        item.cost || 0,
        escape(item.notes || '')
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeVehName = (activeVeh.name || 'vehicle').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const dateStamp = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `veroku_service_log_${safeVehName}_${dateStamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerHaptic('success');
    showToast('Exported service log CSV spreadsheet.', 'success');
  }

  document.getElementById('btn-export-csv')?.addEventListener('click', exportServiceHistoryCSV);

  // Auto Snapshot Restore Event Delegation
  document.addEventListener('click', (e) => {
    const restoreBtn = e.target.closest('.snapshot-restore-btn');
    if (restoreBtn) {
      const snapId = restoreBtn.getAttribute('data-snapshot-id');
      const snapshots = typeof getAutoSnapshots === 'function' ? getAutoSnapshots() : [];
      const snap = snapshots.find(s => s.id === snapId);
      const timeLabel = snap ? snap.dateStr : 'this point in time';

      showCustomConfirmModal({
        title: '⏱️ Restore Auto-Snapshot',
        message: `Restore vehicle data to the snapshot saved on ${timeLabel}? Any unsaved changes made since then will be reverted.`,
        confirmText: 'Restore Snapshot',
        confirmClass: 'submit-btn',
        headerClass: 'header-warning',
        onConfirm: () => {
          const ok = typeof restoreAutoSnapshot === 'function' && restoreAutoSnapshot(snapId);
          if (ok) {
            state = getAppState();
            renderAll(state);
            triggerHaptic('success');
            showToast('State successfully restored from snapshot!', 'success');
          } else {
            showToast('Failed to restore snapshot.', 'error');
          }
        }
      });
    }
  });

  document.getElementById('btn-export-settings')?.addEventListener('click', () => {
    triggerHaptic('light');
    exportData();
  });
  document.getElementById('btn-share-settings')?.addEventListener('click', () => {
    triggerHaptic('light');
    if (typeof shareData === 'function') {
      shareData();
    } else {
      exportData();
    }
  });
  document.getElementById('btn-import-settings')?.addEventListener('click', () => {
    triggerHaptic('light');
    document.getElementById('input-import')?.click();
  });

  document.getElementById('btn-load-example-data')?.addEventListener('click', () => {
    const activeVeh = getActiveVehicle(state);
    if (!activeVeh) return;

    const todayStr = new Date().toISOString().split('T')[0];

    activeVeh.services = [
      {
        id: generateId('srv'),
        name: 'Rantai Roda - Periksa & Lumasi (PL)',
        interval_km: 500,
        last_service_odometer: 1398,
        warning_threshold: 450,
        interval_time_val: '1',
        interval_time_unit: 'weeks',
        warning_time_val: '6',
        warning_time_unit: 'days',
        notes: 'Bersihkan dengan WD-40 lalu lumasi dengan oli gardan 80W-90',
        last_service_date: '2026-09-05',
        one_time_limit_km: null,
        one_time_limit_date: null
      },
      {
        id: generateId('srv'),
        name: 'Oli Mesin - Ganti (G)',
        interval_km: 3500,
        last_service_odometer: 557,
        warning_threshold: 3250,
        interval_time_unit: 'months',
        warning_time_unit: 'months',
        notes: 'Gunakan oli mesin 10W-40 Enduro Racing 4T, Shell Advance X7. Spesifikasi oli:\n\n● Standar JASO T 903*1: MA\n\n● Standar SAE*2: 10W- 30\n\n● Klasifikasi API * 3: SJ atau lebih tinggi.',
        last_service_date: '2026-07-26',
        one_time_limit_km: 3600,
        one_time_limit_date: null
      },
      {
        id: generateId('srv'),
        name: 'Saluran Bahan Bakar - Periksa (P)',
        interval_km: 4000,
        last_service_odometer: 0,
        warning_threshold: 3500,
        interval_time_val: '12',
        interval_time_unit: 'months',
        warning_time_val: '11',
        warning_time_unit: 'months',
        notes: 'Coba cek mandiri dulu di Youtube.'
      },
      {
        id: generateId('srv'),
        name: 'Cara Kerja Gas Tangan - Periksa (P)',
        interval_km: 4000,
        last_service_odometer: 0,
        warning_threshold: 3500,
        interval_time_val: '6',
        interval_time_unit: 'months',
        warning_time_val: '5',
        warning_time_unit: 'months',
        notes: 'Putar gas tangan dari posisi tertutup hingga terbuka penuh pada semua posisi setang kemudi (belok kanan/kiri penuh). Pastikan gas tangan dapat menutup kembali secara otomatis dengan lancar.\n\nSpesifikasi: Jarak bebas putaran gas tangan yang ideal adalah 2–6 mm.\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 66 (71 PDF - Cara Pemeriksaan Jarak Bebas Putaran Gas).'
      },
      {
        id: generateId('srv'),
        name: 'Pernapasan Bak Mesin - Bersihkan (B)',
        interval_km: 4000,
        last_service_odometer: 0,
        warning_threshold: 3500,
        interval_time_val: '6',
        interval_time_unit: 'months',
        warning_time_val: '5',
        warning_time_unit: 'months',
        notes: 'Servis lebih sering jika seringkali dikendarai dalam hujan atau pada kecepatan tinggi.'
      },
      {
        id: generateId('srv'),
        name: 'Busi - Periksa / Ganti (PG)',
        interval_km: 4000,
        last_service_odometer: 0,
        warning_threshold: 3500,
        interval_time_val: 12,
        interval_time_unit: 'months',
        warning_time_val: 11,
        warning_time_unit: 'months',
        notes: 'Gunakan busi NGK CPR9 (standar) Busi dingin atau Denso U20FS-U. Periksa di 4000 km pertama lalu 4000 selanjutnya ganti (disarankan).',
        last_service_date: '2026-07-03',
        one_time_limit_km: null,
        one_time_limit_date: null
      },
      {
        id: generateId('srv'),
        name: 'Jarak Renggang Klep - Periksa (P)',
        interval_km: 4000,
        last_service_odometer: 0,
        warning_threshold: 3500,
        interval_time_val: '12',
        interval_time_unit: 'months',
        warning_time_val: '12',
        warning_time_unit: 'months',
        notes: 'Pakai feeler, lihat di youtube cara buka kop mesin dan setel klep. Periksa renggang klep dalam kondisi mesin dingin. Renggang yang salah menyebabkan kebisingan atau penurunan performa.\n\nSpesifikasi:\n* Klep Masuk (In): 0,10 ± 0,02 mm\n* Klep Buang (Ex): 0,15 ± 0,02 mm'
      },
      {
        id: generateId('srv'),
        name: 'Putaran Stasioner Mesin - Periksa (P)',
        interval_km: 4000,
        last_service_odometer: 0,
        warning_threshold: 3500,
        interval_time_val: '12',
        interval_time_unit: 'months',
        warning_time_val: '11',
        warning_time_unit: 'months'
      },
      {
        id: generateId('srv'),
        name: 'Minyak Rem - Periksa',
        interval_km: 4000,
        last_service_odometer: 0,
        warning_threshold: 3500
      },
      {
        id: generateId('srv'),
        name: 'Minyak Rem - Ganti Berkala',
        interval_km: 24000,
        last_service_odometer: 0,
        warning_threshold: 23500,
        interval_time_val: '2',
        interval_time_unit: 'years',
        warning_time_val: '23',
        warning_time_unit: 'months',
        notes: 'Ganti oli rem setiap 2 tahun sekali agar kinerja rem tetap optimal. Minyak Rem Honda DOT 3 atau DOT 4 atau yang setara.'
      },
      {
        id: generateId('srv'),
        name: 'Keausan Kampas Rem - Periksa (P)',
        interval_km: 4000,
        last_service_odometer: 0,
        warning_threshold: 3500,
        interval_time_val: 1,
        interval_time_unit: 'years',
        warning_time_val: 11,
        warning_time_unit: 'months',
        last_service_date: '2026-08-30',
        notes: 'Kalau rem saat dipakai berbunyi decit, harus diganti. Cek visual dulu.',
        one_time_limit_km: null,
        one_time_limit_date: null
      },
      {
        id: generateId('srv'),
        name: 'Sistem Rem - Periksa (P)',
        interval_km: 4000,
        last_service_odometer: 0,
        warning_threshold: 3500,
        interval_time_val: '12',
        interval_time_unit: 'months',
        warning_time_val: '11',
        warning_time_unit: 'months',
        notes: 'Coba cek mandiri dulu di Youtube.'
      },
      {
        id: generateId('srv'),
        name: 'Sakelar Lampu Rem - Periksa (P)',
        interval_km: 4000,
        last_service_odometer: 0,
        warning_threshold: 3500,
        interval_time_val: '12',
        interval_time_unit: 'months',
        warning_time_val: '11',
        warning_time_unit: 'months'
      },
      {
        id: generateId('srv'),
        name: 'Arah Sinar Lampu Depan - Periksa (P) Anak Panah Headlamp',
        interval_km: 4000,
        last_service_odometer: 0,
        warning_threshold: 3500,
        interval_time_val: 12,
        interval_time_unit: 'months',
        warning_time_val: 11,
        warning_time_unit: 'months',
        last_service_date: '2026-08-30',
        notes: 'Di bagian headlamp ada anak panah. Pastikan itu tepat mengarah ke indikator.',
        one_time_limit_km: null,
        one_time_limit_date: null
      },
      {
        id: generateId('srv'),
        name: 'Sistem Kopling - Periksa (P)',
        interval_km: 4000,
        last_service_odometer: 0,
        warning_threshold: 3500,
        interval_time_val: '12',
        interval_time_unit: 'months',
        warning_time_val: '11',
        warning_time_unit: 'months',
        notes: '1. Tarik tuas kopling dan pastikan transisinya halus. Periksa jarak main bebas pada ujung handel sebelum kopling mulai merenggang.\n\n2. Spesifikasi: Jarak main bebas ujung handel kopling yang ideal adalah 10–20 mm.\n\n3. Referensi Buku Pedoman Pemilik (BPP): Hal. 63–65 (68-70 PDF - Pemeriksaan & Penyetelan Kopling).'
      },
      {
        id: generateId('srv'),
        name: 'Standar Samping - Periksa (P)',
        interval_km: 4000,
        last_service_odometer: 0,
        warning_threshold: 3500,
        interval_time_val: '12',
        interval_time_unit: 'months',
        warning_time_val: '11',
        warning_time_unit: 'months',
        notes: 'Cek buku panduan hal. 61 (66 PDF Memeriksa Standar Samping)'
      },
      {
        id: generateId('srv'),
        name: 'Suspensi - Periksa (P)',
        interval_km: 4000,
        last_service_odometer: 0,
        warning_threshold: 3500,
        interval_time_val: '12',
        interval_time_unit: 'months',
        warning_time_val: '11',
        warning_time_unit: 'months'
      },
      {
        id: generateId('srv'),
        name: 'Mur, Baut, Pengencang - Periksa (P)',
        interval_km: 8000,
        last_service_odometer: 0,
        warning_threshold: 7500,
        interval_time_val: '12',
        interval_time_unit: 'months',
        warning_time_val: '11',
        warning_time_unit: 'months'
      },
      {
        id: generateId('srv'),
        name: 'Roda / Ban - Periksa (P)',
        interval_km: 4000,
        last_service_odometer: 0,
        warning_threshold: 3500,
        interval_time_val: '12',
        interval_time_unit: 'months',
        warning_time_val: '11',
        warning_time_unit: 'months',
        notes: 'Cara cek: Periksa kondisi fisik tapak ban secara visual (apakah ada paku, sayatan, retak, atau keausan abnormal). Periksa juga tekanan angin ban dalam kondisi dingin.\n\nSpesifikasi: * Ban Depan: 25 psi\nBan Belakang: 29 psi (untuk berkendara sendiri) / 33 psi (untuk berboncengan)\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 8 (Spesifikasi tekanan angin ban dan setelan rantaisa), 53–56 (Spesifikasi Ban, Tekanan Udara, & Batas Keausan TWI), 45-47 (50-52 PDF - Memeriksa/Mengganti Ban).'
      },
      {
        id: generateId('srv'),
        name: 'Saringan Udara - Ganti atau Bersihkan (Filter)',
        interval_km: 16000,
        last_service_odometer: 0,
        warning_threshold: 15000,
        interval_time_val: 12,
        interval_time_unit: 'months',
        warning_time_val: 11,
        warning_time_unit: 'months',
        last_service_date: '2026-08-30',
        notes: '',
        one_time_limit_km: null,
        one_time_limit_date: null
      },
      {
        id: generateId('srv'),
        name: 'Saringan Kasa Oli Mesin (Filter) - Bersihkan (B)',
        interval_km: 12000,
        last_service_odometer: 0,
        warning_threshold: 11250,
        interval_time_val: 12,
        interval_time_unit: 'months',
        warning_time_val: 11,
        warning_time_unit: 'months',
        last_service_date: '2026-08-30',
        notes: '',
        one_time_limit_km: null,
        one_time_limit_date: null
      },
      {
        id: generateId('srv'),
        name: 'Saringan Sentrifugal Oli - Bersihkan (B)',
        interval_km: 12000,
        last_service_odometer: 0,
        warning_threshold: 11250
      },
      {
        id: generateId('srv'),
        name: 'Bantalan Kepala Kemudi - Periksa (P), Bersihkan Komstir/Konex/Bearing Steer',
        interval_km: 12000,
        last_service_odometer: 0,
        warning_threshold: 11250,
        interval_time_unit: 'months',
        warning_time_unit: 'days',
        last_service_date: '2026-08-30',
        notes: 'Periksa komstir/konex ganti gemuk/grease.',
        one_time_limit_km: null,
        one_time_limit_date: null
      },
      {
        id: generateId('srv'),
        name: 'Oli Shock dan Stang Shock Depan',
        interval_km: 10000,
        warning_threshold: 10000,
        interval_time_val: 12,
        interval_time_unit: 'months',
        warning_time_val: 12,
        warning_time_unit: 'months',
        last_service_odometer: 0,
        last_service_date: '2026-08-30',
        notes: 'Harus segera diganti jika seal shock sudah bocor atau redaman terasa terlalu keras/lembek sebelum waktunya.'
      },
      {
        id: generateId('srv'),
        name: 'Bos Arm Belakang (Bukan Bearing)',
        interval_km: 15000,
        warning_threshold: 10000,
        interval_time_val: 6,
        interval_time_unit: 'months',
        warning_time_val: 6,
        warning_time_unit: 'months',
        last_service_odometer: 0,
        last_service_date: '2026-08-30',
        notes: '# Panduan Perawatan Bearing dan Arm Belakang Sepeda Motor\n\nPerawatan komponen *bearing* (klaher) dan *swing arm* belakang sangat penting untuk menjaga kestabilan berkendara dan memperpanjang umur pakai komponen.\n\n## ⏱️ Jadwal Perawatan Rutin\n\nSecara umum, lakukan pengecekan dan pembersihan setiap **6 bulan sekali** atau setiap **10.000 km – 15.000 km** (mana yang tercapai lebih dulu).\n\n### Penyesuaian Berdasarkan Kondisi Jalan:\n*   **Kondisi Normal (Perkotaan):** Bersihkan setiap **10.000 km**.\n*   **Musim Hujan / Sering Banjir:** Cek setiap **3 bulan** atau langsung bersihkan setelah motor terendam banjir.\n*   **Medan Berdebu / Off-road:** Cek setiap **5.000 km** untuk mencegah debu merusak lapisan *grease* (gemuk).\n\n---\n\n## 🚨 Tanda Komponen Harus Segera Diperiksa\n\nJangan menunda perawatan jika Anda merasakan gejala-gejala berikut:\n*   **Goyang:** Motor terasa tidak stabil atau membuang ke arah samping saat menikung.\n*   **Bunyi:** Muncul suara berdecit, derit, atau gesekan kasar dari area belakang.\n*   **Seret:** Roda belakang terasa berat saat diputar manual (posisi standar tengah).\n*   **Oblak:** Ban belakang terasa longgar/bergeser saat digoyang ke kanan dan kiri dengan tangan.\n\n---\n\n## 🛠️ Langkah Singkat Pengecekan & Pembersihan\n\n1.  **Membongkar Area Roda & Arm:** Lepaskan roda belakang dan copot as *swing arm* dari rangka.\n2.  **Pembersihan:** Bersihkan sisa *grease* lama, debu, dan karat menggunakan cairan pembersih (seperti *brake cleaner* atau bensin) lalu keringkan.\n3.  **Inspeksi Fisik:** Putar *bearing* dengan jari. Jika terasa seret, bopeng, atau oblak, segera ganti dengan yang baru.\n4.  **Pemberian Pelumas (*Re-greasing*):** Lapisi kembali *bearing* dan as *arm* dengan *grease* (gemuk) khusus otomotif berjenis *chassis* atau *heavy duty high-temperature*.\n5.  **Perakitan Kembali:** Pasang semua komponen sesuai standar pabrikan dan pastikan kekencangan baut sudah pas.',
        one_time_limit_km: null,
        one_time_limit_date: null
      },
      {
        id: generateId('srv'),
        name: 'Bearing Ban',
        interval_km: 4000,
        warning_threshold: 4000,
        interval_time_val: 4,
        interval_time_unit: 'months',
        warning_time_val: 4,
        warning_time_unit: 'months',
        last_service_odometer: 0,
        last_service_date: '2026-08-30',
        notes: '# Panduan Perawatan Bearing Roda (Ban) Sepeda Motor\n\n*Bearing* (laher) roda berfungsi menjaga roda berputar dengan lancar serta menahan beban kendaraan. Komponen ini langsung berhadapan dengan guncangan jalan dan rentan terkena air serta debu.\n\n## ⏱️ Jadwal Pemeriksaan Rutin\n\nSangat disarankan untuk melakukan pemeriksaan kondisi bearing roda setiap **4 bulan sekali** atau setiap **4.000 km** (mana yang tercapai lebih dulu). \n\n### Kondisi yang Mempercepat Kerusakan:\n*   **Sering Menerjang Banjir/Hujan:** Air kotor dapat merusak karet pelindung (*seal*) as roda, masuk ke dalam gotri bearing, dan melarutkan pelumas (*grease*).\n*   **Jalanan Rusak & Berlubang:** Menghantam lubang atau marka jalan dengan kecepatan tinggi memberikan tekanan ekstrem yang dapat merusak kepresisian bulir laher.\n*   **Beban Berlebih:** Sering membawa muatan yang melebihi kapasitas standar motor.\n\n*Catatan: Secara umum, usia pakai bearing roda berkisar antara **3 tahun** pada pemakaian normal sebelum akhirnya harus diganti baru.*\n\n---\n\n## 🚨 Gejala Bearing Roda Mulai Rusak\n\nSegera lakukan pemeriksaan mandiri jika motor Anda menunjukkan tanda-tanda berikut:\n1.  **Kemudi Oleng/Tidak Stabil:** Motor terasa "ngebuang" ke arah kanan atau kiri, terutama saat dipakai bermanuver atau menikung.\n2.  **Getaran Tidak Normal:** Muncul getaran kasar yang menjalar hingga ke stang kemudi (jika roda depan rusak) atau terasa di jok/footpeg (jika roda belakang rusak).\n3.  **Suara Kasar/Berdengung:** Terdengar bunyi gesekan material, derit, atau dengung dari area tromol saat motor melaju.\n4.  **Putaran Roda Seret:** Roda terasa berat atau tersendat-sendat saat diputar manual dalam posisi motor digantung.\n\n---\n\n## 🛠️ Cara Cek Mandiri (Tanpa Bongkar Roda)\n\nAnda bisa mendeteksi kelayakan bearing roda di rumah dengan metode berikut:\n\n### Langkah 1: Cek Putaran Roda\n*   Posisikan motor menggunakan standar tengah (atau gunakan standar *paddock* jika roda depan yang ingin dicek).\n*   Putar roda dengan tangan sekencang mungkin. \n*   Pegang area *shockbreaker* depan atau *swing arm* belakang. Jika terasa ada getaran kasar (*gradakan*) selama roda berputar, berarti gotri di dalam bearing sudah mulai aus.\n\n### Langkah 2: Cek Jarak Main (Oblak)\n*   Pegang ban pada posisi atas dan bawah (atau sisi kanan dan kiri) menggunakan kedua tangan.\n*   Goyangkan atau dorong ban ke arah samping berlawanan secara bergantian (goyangan masuk-keluar).\n*   Jika terasa ada kelonggaran (*speling* atau oblak) dan terdengar bunyi klik kecil, maka bearing sudah wajib diganti.\n\n---\n\n## ⚠️ Tips Penting Saat Penggantian\n*   **Ganti Sepasang sekaligus:** Roda motor umumnya ditopang oleh dua buah bearing (kanan dan kiri). Jika salah satu sisi rusak, disarankan untuk langsung mengganti keduanya bersamaan agar tingkat keseimbangan dan masa pakainya tetap seimbang.\n*   **Bearing Tidak Bisa Diperbaiki:** Jika bulir laher sudah aus atau rumahnya longgar, komponen ini tidak dapat diservis dan wajib diganti dengan suku cadang baru.'
      },
      {
        id: generateId('srv'),
        name: 'Saringan Bahan Bakar (Filter) - Beli Top 1 MC Booster',
        interval_km: 20000,
        warning_threshold: 20000,
        interval_time_val: 2,
        interval_time_unit: 'years',
        warning_time_val: 2,
        warning_time_unit: 'years',
        last_service_odometer: 0,
        last_service_date: '2026-08-30',
        notes: 'Komponen ini berupa bantalan kain filter (sering disebut *pampers* fuel pump) yang terletak di dalam tangki bensin, menyatu dengan pompa bahan bakar (*fuel pump modul*). Tugasnya adalah menyaring partikel kotoran, karat tangki, dan air sebelum bensin diisap oleh pompa.\n\n### ⏱️ Jadwal Penggantian berkala:\n*   **Idealnya:** Diganti setiap **20.000 km – 30.000 km** atau sekitar **2 tahun sekali**.\n*   *Catatan khusus:* Jika Anda sering mengisi bensin eceran atau kualitas bahan bakarnya kurang bersih, filter ini bisa kotor jauh lebih cepat. Jika warnanya sudah berubah dari putih menjadi hitam pekat, filter wajib diganti baru.\n\n### 🚨 Gejala Clogged/Kotor:\n*   Tarikan motor terasa tertahan atau mendadak *brebet* saat digas di putaran tinggi.\n*   Motor sulit dihidupkan di pagi hari (mesin *cranking* lama).\n*   Mesin sering mati mendadak saat posisi stasioner/idle (lampu merah).',
        one_time_limit_km: null,
        one_time_limit_date: null
      },
      {
        id: generateId('srv'),
        name: 'Saringan Injektor (Filter) - Beli Top 1 MC Booster',
        interval_km: 10000,
        warning_threshold: 9500,
        interval_time_unit: 'months',
        warning_time_unit: 'months',
        last_service_odometer: 0,
        last_service_date: '2026-08-30',
        notes: 'Banyak pemilik motor tidak mengetahui bahwa di bagian atas lubang masuk (*inlet*) setiap komponen injektor, terdapat filter mikro berbentuk silinder sangat kecil (seukuran pentol korek api). Filter ini adalah "benteng pertahanan terakhir" untuk memastikan bensin yang masuk ke lubang *nozzle* injektor benar-benar steril dari residu super halus.\n\n### ⏱️ Jadwal Perawatan & Penggantian:\n*   **Pembersihan (Infus Injektor):** Lakukan setiap **10.000 km**. Menggunakan metode "infus" di bengkel akan membantu membersihkan kerak dan kotoran yang menempel pada saringan mikro ini tanpa harus membongkarnya.\n*   **Penggantian Fisik:** Diganti baru setiap **40.000 km** atau bersamaan saat Anda merasa tarikan motor tetap loyo meskipun injektor sudah diinfus/dibersihkan berkala.\n\n### 🚨 Gejala Clogged/Kotor:\n*   Mesin kehilangan tenaga (*loss power*) secara drastis karena pasokan bensin ke ruang bakar berkurang.\n*   Konsumsi bahan bakar terasa lebih boros karena pengabutan bensin dari injektor tidak berupa kabut halus melainkan berupa tetesan kotor yang sulit terbakar.\n*   Terdengar suara knalpot meletup-letup akibat pasokan campuran bahan bakar terlalu miskin (*lean*).',
        one_time_limit_km: null,
        one_time_limit_date: null
      }
    ];

    activeVeh.routine_checks.daily = [
      {
        id: generateId('chk'),
        task: 'Sarung tangan',
        desc: `Gunakan sarung tangan jika jarak jauh. Jika jarak dekat tidak pakai tidak apa.`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Sepatu',
        desc: `Gunakan sepatu jika jarak jauh. Jika jarak dekat tidak pakai tidak apa.`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Jaket',
        desc: `Gunakan jaket jika jarak jauh. Jika jarak dekat tidak pakai tidak apa.`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Helm',
        desc: `Gunakan helm jika jarak jauh. Jika jarak dekat tidak pakai tidak apa.`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Jas hujan',
        desc: `Bila musim hujan selalu bawa jas hujan dan berencana bepergian jarak jauh.`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Roda dan Ban',
        desc: `Cara cek: Periksa kondisi fisik tapak ban secara visual (apakah ada paku, sayatan, retak, atau keausan abnormal). Periksa juga tekanan angin ban dalam kondisi dingin.\n\nSpesifikasi: * Ban Depan: 25 psi\nBan Belakang: 29 psi (untuk berkendara sendiri) / 33 psi (untuk berboncengan)\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 8 (Spesifikasi tekanan angin ban dan setelan rantaisa) 53–56 (Spesifikasi Ban, Tekanan Udara, & Batas Keausan TWI), 45-47 (50-52 PDF - Memeriksa/Mengganti Ban).`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Cek kunci ganda cakram',
        desc: `Pastikan kunci ganda cakram dapat berfungsi dengan baik dan lepas dari cakram jika ingin berkendara. Bawa selalu kunci ganda cakram.`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Baut plat nomor',
        desc: `Pastikan plat nomor terpasang dengan kencang dan tidak longgar. Goyang sedikit plat nomor untuk mengecek apakah kencang. Tidak boleh ada jarak atau celah antara plat nomor dan tempat pemasangannya, pastikan posisi plat nomor menempel erat di tempat pemasangannya. Tidak boleh ada celah, getaran, atau goyangan pada plat nomor saat dikendarai.\n\nUntuk plat nomor jenis lama (yang memiliki lubang di keempat sisinya), pastikan menggunakan baut yang sesuai (biasanya baut 10) untuk mengencangkan plat nomor ke braket plat nomor. Selain memastikan tidak ada celah atau goyangan, baut yang longgar pada plat nomor dapat berpotensi tersangkut pada pakaian orang lain dan menimbulkan kecelakaan.`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Tinggi Permukaan Oli Mesin',
        desc: `Cara cek: Periksa level oli melalui tangkai pengukur (dipstick) dalam kondisi motor tegak. Pastikan posisinya berada di antara tanda batas teratas (upper) dan terbawah (lower), sekaligus amati jika ada tanda kebocoran cairan di sekitar mesin.\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 53 – 54 (58 - 59 PDF Oli Mesin → Memeriksa Oli Mesin dan Menambahkan Oli Mesin).`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Rem Belakang (Panah dan Jarak Bebas)',
        desc: `Cara cek: Tekan pedal rem belakang dan periksa jarak mainnya sebelum rem mulai menggigit. Amati juga panah indikator keausan kampas rem tromol pada panel roda belakang saat pedal ditekan penuh (pastikan panah tidak melewati batas tanda aus).\n\nSpesifikasi: Jarak main bebas ujung pedal rem belakang adalah 20–30 mm.\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 57–60 (62-65 PDF - Penyetelan Jarak Bebas Pedal & Keausan Rem Tromol Belakang).`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Rem Depan (minyak rem, jarak bebas, kampas rem)',
        desc: `Cara cek: 1. Pastikan reservoir minyak rem berada dalam posisi horizontal dan ketinggian cairan berada di atas tanda batas LWR (Lower).\n2. Periksa ketebalan kampas rem melalui indikator keausan di kaliper cakram.\n3. Tarik tuas rem depan untuk merasakan "jarak bebas" fungsinya. Karena merupakan rem cakram hidrolik, tuas harus terasa kokoh/padat saat ditekan dan tidak terasa terlalu empuk atau "ngempos" (tidak ada angin palsu dalam sistem).\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 55–56 (60-61 PDF - Pemeriksaan Minyak Rem & Kampas Rem Cakram).`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Cara Kerja Gas Tangan',
        desc: `Cara cek: Putar gas tangan dari posisi tertutup hingga terbuka penuh pada semua posisi setang kemudi (belok kanan/kiri penuh). Pastikan gas tangan dapat menutup kembali secara otomatis dengan lancar.\n\nSpesifikasi: Jarak bebas putaran gas tangan yang ideal adalah 2–6 mm.\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 66 (71 PDF - Cara Pemeriksaan Jarak Bebas Putaran Gas).`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Jarak Bebas Kopling',
        desc: `Cara cek: Tarik tuas kopling dan pastikan transisinya halus. Periksa jarak main bebas pada ujung handel sebelum kopling mulai merenggang.\n\nSpesifikasi: Jarak main bebas ujung handel kopling yang ideal adalah 10–20 mm.\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 63–65 (68-70 PDF - Pemeriksaan & Penyetelan Kopling).`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Kelonggaran Rantai & Mata Gir',
        desc: `Cara cek: Lakukan pemeriksaan visual secara cepat pada rantai roda. Pastikan kelonggarannya normal (tidak terlalu kendur hingga menyentuh swingarm atau terlalu tegang) serta mata gir tidak tajam/aus.\n\nSpesifikasi: Jarak main bebas rantai (naik-turun) di bagian tengah adalah 20–30 mm (jangan berkendara jika kekenduran melebihi 50 mm).\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 62 (67 PDF Kelonggaran rantai), 43-44 (48-49 PDF Keausan gir, Membersihkan dan Melumasi Rantai)`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Persediaan Bahan Bakar',
        desc: `Cara cek: Periksa sisa bahan bakar melalui meter digital pada panel instrumen. Lakukan pengisian bensin jika volume sudah mendekati indikator berkedip (dua atau tiga balok terakhir).\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 20 (Penjelasan Meter Bahan Bakar) & Hal. 30 (Pengisian Bahan Bakar).`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Lampu-lampu dan Klakson',
        desc: `Cara cek: Nyalakan kunci kontak ke posisi ON, lalu uji fungsi:\n\nLampu depan (dekat dan jauh)\nLampu sein (kanan, kiri, depan, belakang)\nLampu rem (menyala lebih terang saat tuas/pedal rem ditekan)\nIndikator panel instrumen (lampu netral, MIL, lampu jauh)\nSuara klakson (harus terdengar nyaring dan normal)\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 43 (Daftar Pemeriksaan Sebelum Berkendara).`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Cek Spion',
        desc: `Cara cek: Pastikan posisi spion berada pada ketinggian yang sesuai sehingga Anda dapat melihat kendaraan di belakang Anda dengan jelas dari posisi berkendara normal.\n\nPastikan spion terpasang dengan kencang dan tidak goyang. Goyang sedikit spion untuk mengecek apakah kencang. Tidak boleh ada jarak atau celah antara spion dan tempat pemasangannya, pastikan posisi spion menempel erat di tempat pemasangannya. Tidak boleh ada celah, getaran, atau goyangan pada spion saat dikendarai.`,
        checked: false
      },
    ];

    activeVeh.routine_checks.weekly = [
      {
        id: generateId('chk'),
        task: 'Perawatan Rantai Roda (Setiap 500 km)',
        desc: `Gerakkan rantai ke atas-bawah untuk memeriksa kekendurannya (standar jarak main bebas 20–30 mm; jangan berkendara jika kendur melebihi 50 mm). Bersihkan rantai menggunakan kain kering/sikat halus dengan larutan titik nyala tinggi, lalu lumasi memakai pelumas khusus rantai atau oli gardan/transmisi SAE 80/90.\n\nCek buku panduan Hal 44 (49 PDF)`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Pernapasan Bak Mesin',
        desc: `Periksa bagian tembus pandang dari selang pembuangan. Bersihkan endapan di dalam selang dengan lebih sering jika motor sering dikendarai dalam kondisi hujan, kecepatan tinggi, atau setelah motor dicuci.\n\nCek panduan hal. 45 (50 PDF)`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Pembersihan Rangka, Bodi, dan Teleskopik Shock Depan',
        desc: `Cuci motor secara menyeluruh menggunakan selang tekanan rendah, terutama setelah melewati area pesisir pantai (air laut/garam) atau jalan berlumpur untuk menghindari korosi pada komponen aluminium, dan rangka, serta teleskopik shock depan dilap dengan kanebo. Cek buku panduan hal 84-87 (89-92 PDF Merawat Kendaraan Anda)`,
        checked: false
      },
    ];

    activeVeh.routine_checks.monthly = [
      {
        id: generateId('chk'),
        task: 'Cek kondisi aki',
        desc: `Pastikan aki terpasang kencang dan terminal bersih dari korosi. Cek indikator level cairan jika menggunakan aki basah.\n\nTips: Hindari membiarkan motor terlalu lama tanpa digunakan untuk mencegah aki tekor. Cek buku panduan hal. 52 (57 PDF Pembukaan cover samping), 40 (45 PDF), 49-50 (54-55 Pemasangan Aki)`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Cek kondisi sekring',
        desc: `Cek sekring yang putus. Cek buku panduan hal. 41 (46 PDF Memeriksa dan Mengganti Sekring), 79 (84 PDF Sekring Putus)`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Cek suspensi belakang',
        desc: `Cek buku panduan hal. 67 (72 PDF Menyetel Suspensi Belakang)`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Malfunction Indicator Lamp (MIL) PGM-FI (Prgrammed Fuel Injection)',
        desc: `Jika indikator menyala saat mesin menyala, segera matikan mesin, tunggu 10 detik, lalu hidupkan kembali. Jika lampu tetap menyala, bawa motor ke bengkel AHASS terdekat.`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Kerusakan meter bahan bakar',
        desc: `Cek buku panduan hal. 72 (77 PDF Indikasi Kerusakan Meter Bahan Bakar).`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Bohlam lampu mati',
        desc: `Cek buku panduan hal. 75-78 (80-83 PDF Bohlam Lamput Mati).`,
        checked: false
      },
    ];

    saveAppState(state);
    renderAll(state);
    showToast('Example CB150 Verza data loaded successfully!', 'success');
  });

  // ==========================================================================
  // DANGER ZONE ACCORDION AND WIPE DATA TRIGGERS
  // ==========================================================================
  const dangerAccordionHeader = document.getElementById('btn-toggle-danger-zone');
  const dangerAccordionCard = document.getElementById('accordion-danger-zone');
  if (dangerAccordionHeader && dangerAccordionCard) {
    dangerAccordionHeader.addEventListener('click', () => {
      const isExpanded = dangerAccordionCard.classList.toggle('expanded');
      dangerAccordionHeader.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    });
    dangerAccordionHeader.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const isExpanded = dangerAccordionCard.classList.toggle('expanded');
        dangerAccordionHeader.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      }
    });
  }

  const deleteModal = document.getElementById('modal-delete-confirm');
  const deleteTextInput = document.getElementById('delete-text-input');
  const confirmDeleteBtn = document.getElementById('btn-confirm-delete');

  document.getElementById('btn-delete-data-trigger')?.addEventListener('click', () => {
    if (deleteTextInput) deleteTextInput.value = '';
    confirmDeleteBtn?.setAttribute('disabled', 'true');
    openModal('modal-delete-confirm');
  });

  deleteTextInput?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val === 'DELETE') {
      confirmDeleteBtn?.removeAttribute('disabled');
    } else {
      confirmDeleteBtn?.setAttribute('disabled', 'true');
    }
  });

  confirmDeleteBtn?.addEventListener('click', () => {
    state = resetAppState();
    renderAll(state);
    closeModal();
    triggerHaptic('success');
    showToast('All browser data has been deleted.', 'success');
  });

  document.getElementById('btn-cancel-delete')?.addEventListener('click', closeModal);

  // ==========================================================================
  // ADDITIONAL CUSTOM ACTIONS: THEME TOGGLE, SERVICE LOG, ODOMETER HISTORY & VEHICLE MANAGER
  // ==========================================================================

  // Theme switch click listener
  const themeToggleBtn = document.getElementById('btn-theme-toggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = state.settings?.theme || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      state.settings = state.settings || {};
      state.settings.theme = newTheme;
      saveAppState(state);
      renderAll(state);
      showToast(`Switched to ${newTheme} mode`, 'success');
    });
  }

  // Active Vehicle Dropdown change listener
  const selectVehicleDropdown = document.getElementById('select-vehicle');
  if (selectVehicleDropdown) {
    selectVehicleDropdown.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      if (selectedId && state.vehicles[selectedId]) {
        state.active_vehicle_id = selectedId;
        saveAppState(state);
        window.componentsPage = 1;
        window.dashboardSearchQuery = '';
        window.componentsSearchQuery = '';
        const searchDash = document.getElementById('search-dashboard');
        if (searchDash) searchDash.value = '';
        const searchComp = document.getElementById('search-components');
        if (searchComp) searchComp.value = '';
        renderAll(state);
        showToast(`Switched active profile`, 'success');
      }
    });
  }

  // Add vehicle trigger listener
  const addVehicleTrigger = document.getElementById('btn-add-vehicle-trigger');
  if (addVehicleTrigger) {
    addVehicleTrigger.addEventListener('click', () => {
      document.getElementById('new-vehicle-name').value = '';
      document.getElementById('new-vehicle-icon').value = '🏍️';
      openModal('modal-add-vehicle');
    });
  }

  // Add Vehicle Form Submit Handler
  const formAddVehicle = document.getElementById('form-add-vehicle');
  if (formAddVehicle) {
    formAddVehicle.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('new-vehicle-name').value.trim();
      const icon = document.getElementById('new-vehicle-icon').value.trim();

      if (!name || !icon) {
        showToast('Please specify a valid vehicle name and emoji.', 'error');
        return;
      }

      addVehicleProfile(state, name, icon);
      saveAppState(state);
      renderAll(state);
      closeModal();
      showToast(`Added new vehicle profile: ${name}`, 'success');
    });
  }

  // Service Confirmation Form Submit Handler
  const formServiceLog = document.getElementById('form-service-log');
  if (formServiceLog) {
    formServiceLog.addEventListener('submit', (e) => {
      e.preventDefault();
      const serviceId = document.getElementById('log-service-id').value;
      const serviceDate = document.getElementById('log-service-date').value;
      const cost = document.getElementById('log-service-cost').value;
      const notes = document.getElementById('log-service-notes').value.trim();

      if (!serviceId || cost === '') {
        showToast('Please enter a valid maintenance cost.', 'error');
        return;
      }

      markServiceDone(serviceId, Number(cost), notes, serviceDate);

      // Reload state
      state = getAppState();
      renderAll(state);
      closeModal();

      const activeVeh = getActiveVehicle(state);
      const service = activeVeh.services.find(s => s.id === serviceId);
      showToast(`Completed service for: ${service ? service.name : 'Component'}!`, 'success');
    });
  }

  // Odometer History trigger listener (Event delegation from body)
  document.body.addEventListener('click', (e) => {
    const triggerBtn = e.target.closest('#btn-trigger-odo-history');
    if (triggerBtn) {
      window.odoHistoryPage = 0;
      populateOdometerHistoryModal(state, 0);
      openModal('modal-odometer-history');
    }
  });

  // Odometer History pagination controls
  const btnOdoPrev = document.getElementById('btn-odo-prev');
  const btnOdoNext = document.getElementById('btn-odo-next');

  btnOdoPrev?.addEventListener('click', () => {
    if (window.odoHistoryPage > 0) {
      window.odoHistoryPage--;
      populateOdometerHistoryModal(state, window.odoHistoryPage);
    }
  });

  btnOdoNext?.addEventListener('click', () => {
    const activeVeh = getActiveVehicle(state);
    const log = activeVeh.odometer_log || [];
    const totalPages = Math.ceil(log.length / 5);
    if (window.odoHistoryPage < totalPages - 1) {
      window.odoHistoryPage++;
      populateOdometerHistoryModal(state, window.odoHistoryPage);
    }
  });

  // ==========================================================================
  // VEHICLE ACTIONS DROPDOWN MENU
  // ==========================================================================
  const dropdownTrigger = document.getElementById('btn-vehicle-actions-trigger');
  const dropdownMenu = document.getElementById('vehicle-actions-menu');

  if (dropdownTrigger && dropdownMenu) {
    dropdownTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = dropdownMenu.hasAttribute('hidden');
      if (isHidden) {
        dropdownMenu.removeAttribute('hidden');
      } else {
        dropdownMenu.setAttribute('hidden', 'true');
      }
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.vehicle-actions-dropdown')) {
        dropdownMenu.setAttribute('hidden', 'true');
      }
    });
  }

  // ==========================================================================
  // EDIT VEHICLE PROFILE ACTIONS
  // ==========================================================================
  const editVehicleTrigger = document.getElementById('btn-edit-vehicle-trigger');
  if (editVehicleTrigger) {
    editVehicleTrigger.addEventListener('click', () => {
      dropdownMenu?.setAttribute('hidden', 'true');
      const activeVeh = getActiveVehicle(state);
      document.getElementById('edit-vehicle-name').value = activeVeh.name || '';
      document.getElementById('edit-vehicle-icon').value = activeVeh.icon || '🏍️';
      openModal('modal-edit-vehicle');
    });
  }

  const formEditVehicle = document.getElementById('form-edit-vehicle');
  if (formEditVehicle) {
    formEditVehicle.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('edit-vehicle-name').value.trim();
      const icon = document.getElementById('edit-vehicle-icon').value.trim();

      if (!name || !icon) {
        showToast('Please specify a valid vehicle name and emoji.', 'error');
        return;
      }

      updateActiveVehicleProfile(state, name, icon);
      saveAppState(state);
      renderAll(state);
      closeModal();
      showToast(`Updated vehicle profile to: ${name}`, 'success');
    });
  }

  // ==========================================================================
  // DELETE VEHICLE PROFILE ACTIONS (WITH TWO-STEP VERIFICATION)
  // ==========================================================================
  const deleteVehicleTrigger = document.getElementById('btn-delete-vehicle-trigger');
  const deleteVehicleModal = document.getElementById('modal-delete-vehicle-confirm');
  const deleteVehicleTextInput = document.getElementById('delete-vehicle-text-input');
  const confirmDeleteVehicleBtn = document.getElementById('btn-confirm-delete-vehicle');

  if (deleteVehicleTrigger) {
    deleteVehicleTrigger.addEventListener('click', () => {
      dropdownMenu?.setAttribute('hidden', 'true');
      const vids = Object.keys(state.vehicles || {});
      if (vids.length <= 1) {
        showToast('Cannot delete the only vehicle profile. Create another profile first.', 'error');
        return;
      }

      if (deleteVehicleTextInput) deleteVehicleTextInput.value = '';
      confirmDeleteVehicleBtn?.setAttribute('disabled', 'true');
      openModal('modal-delete-vehicle-confirm');
    });
  }

  deleteVehicleTextInput?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val === 'DELETE VEHICLE') {
      confirmDeleteVehicleBtn?.removeAttribute('disabled');
    } else {
      confirmDeleteVehicleBtn?.setAttribute('disabled', 'true');
    }
  });

  confirmDeleteVehicleBtn?.addEventListener('click', () => {
    const activeVeh = getActiveVehicle(state);
    const name = activeVeh.name;
    const success = deleteActiveVehicleProfile(state);
    if (success) {
      saveAppState(state);
      renderAll(state);
      closeModal();
      triggerHaptic('light');
      showToast(`Vehicle profile "${name}" has been deleted.`, 'success');
    } else {
      showToast('Failed to delete vehicle profile.', 'error');
    }
  });

  // ==========================================================================
  // COST SUMMARY FILTER & DATE NAVIGATION ACTIONS
  // ==========================================================================
  window.costFilterMode = window.costFilterMode || 'yearly';
  window.costActiveDate = window.costActiveDate || new Date();

  const btnCostMonthly = document.getElementById('btn-cost-monthly');
  const btnCostYearly = document.getElementById('btn-cost-yearly');
  const btnCostAll = document.getElementById('btn-cost-all');
  const btnCostPrev = document.getElementById('btn-cost-prev');
  const btnCostNext = document.getElementById('btn-cost-next');
  const btnCostNow = document.getElementById('btn-cost-now');
  const costMonthPicker = document.getElementById('cost-month-picker');

  if (btnCostMonthly && btnCostYearly && btnCostAll) {
    btnCostMonthly.addEventListener('click', () => {
      window.costFilterMode = 'monthly';
      const activeVeh = getActiveVehicle(state);
      renderCostSummary(activeVeh, window.costFilterMode, window.costActiveDate);
    });

    btnCostYearly.addEventListener('click', () => {
      window.costFilterMode = 'yearly';
      const activeVeh = getActiveVehicle(state);
      renderCostSummary(activeVeh, window.costFilterMode, window.costActiveDate);
    });

    btnCostAll.addEventListener('click', () => {
      window.costFilterMode = 'all';
      const activeVeh = getActiveVehicle(state);
      renderCostSummary(activeVeh, window.costFilterMode, window.costActiveDate);
    });

    const stepCostDate = (step) => {
      const d = window.costActiveDate;
      if (window.costFilterMode === 'monthly') {
        window.costActiveDate = new Date(d.getFullYear(), d.getMonth() + step, 1);
      } else {
        window.costActiveDate = new Date(d.getFullYear() + step, 0, 1);
      }
      const activeVeh = getActiveVehicle(state);
      renderCostSummary(activeVeh, window.costFilterMode, window.costActiveDate);
    };

    btnCostPrev?.addEventListener('click', () => stepCostDate(-1));
    btnCostNext?.addEventListener('click', () => stepCostDate(1));
    btnCostNow?.addEventListener('click', () => {
      window.costActiveDate = new Date();
      const activeVeh = getActiveVehicle(state);
      renderCostSummary(activeVeh, window.costFilterMode, window.costActiveDate);
    });

    if (costMonthPicker) {
      costMonthPicker.addEventListener('change', (e) => {
        if (e.target.value) {
          const [yr, mo] = e.target.value.split('-').map(Number);
          window.costActiveDate = new Date(yr, mo - 1, 1);
          const activeVeh = getActiveVehicle(state);
          renderCostSummary(activeVeh, window.costFilterMode, window.costActiveDate);
        }
      });
    }
  }

  // ==========================================================================
  // SERVICE HISTORY DATE NAVIGATION & MONTH PICKER ACTIONS
  // ==========================================================================
  window.historyFilterMode = window.historyFilterMode || 'monthly';
  window.historyActiveDate = window.historyActiveDate || new Date();

  const btnHistoryMonthly = document.getElementById('btn-history-monthly');
  const btnHistoryYearly = document.getElementById('btn-history-yearly');
  const btnHistoryPrev = document.getElementById('btn-history-prev');
  const btnHistoryNext = document.getElementById('btn-history-next');
  const btnHistoryNow = document.getElementById('btn-history-now');
  const historyMonthPicker = document.getElementById('history-month-picker');

  if (btnHistoryMonthly && btnHistoryYearly && btnHistoryPrev && btnHistoryNext) {
    btnHistoryMonthly.addEventListener('click', () => {
      window.historyFilterMode = 'monthly';
      const activeVeh = getActiveVehicle(state);
      renderServiceHistory(activeVeh, window.historyFilterMode, window.historyActiveDate);
    });

    btnHistoryYearly.addEventListener('click', () => {
      window.historyFilterMode = 'yearly';
      const activeVeh = getActiveVehicle(state);
      renderServiceHistory(activeVeh, window.historyFilterMode, window.historyActiveDate);
    });

    const stepHistoryDate = (step) => {
      const d = window.historyActiveDate;
      if (window.historyFilterMode === 'monthly') {
        window.historyActiveDate = new Date(d.getFullYear(), d.getMonth() + step, 1);
      } else {
        window.historyActiveDate = new Date(d.getFullYear() + step, 0, 1);
      }
      const activeVeh = getActiveVehicle(state);
      renderServiceHistory(activeVeh, window.historyFilterMode, window.historyActiveDate);
    };

    btnHistoryPrev.addEventListener('click', () => stepHistoryDate(-1));
    btnHistoryNext.addEventListener('click', () => stepHistoryDate(1));
    btnHistoryNow?.addEventListener('click', () => {
      window.historyActiveDate = new Date();
      const activeVeh = getActiveVehicle(state);
      renderServiceHistory(activeVeh, window.historyFilterMode, window.historyActiveDate);
    });

    if (historyMonthPicker) {
      historyMonthPicker.addEventListener('change', (e) => {
        if (e.target.value) {
          const [yr, mo] = e.target.value.split('-').map(Number);
          window.historyActiveDate = new Date(yr, mo - 1, 1);
          const activeVeh = getActiveVehicle(state);
          renderServiceHistory(activeVeh, window.historyFilterMode, window.historyActiveDate);
        }
      });
    }
  }

  // ==========================================================================
  // FUEL REFUEL TRACKING HANDLERS
  // ==========================================================================
  function openFuelModal() {
    const activeVeh = getActiveVehicle(state);
    const todayStr = window.formatLocalDate ? window.formatLocalDate(new Date()) : new Date().toISOString().split('T')[0];

    const editIdInput = document.getElementById('fuel-log-edit-id');
    const modalTitle = document.getElementById('modal-log-fuel-title');
    if (editIdInput) editIdInput.value = '';
    if (modalTitle) modalTitle.textContent = '⛽ Log Fuel Refuel';

    const dateInput = document.getElementById('fuel-log-date');
    const odoInput = document.getElementById('fuel-log-odometer');
    if (dateInput) dateInput.value = todayStr;
    if (odoInput) odoInput.value = activeVeh ? (activeVeh.meta.current_odometer || 0) : 0;

    if (typeof populateFuelTypeDropdown === 'function') {
      populateFuelTypeDropdown(state.settings?.fuel_types);
    }

    const typeSelect = document.getElementById('fuel-log-type');
    const priceInput = document.getElementById('fuel-log-price');
    if (typeSelect && typeSelect.options.length > 0) {
      typeSelect.selectedIndex = 0;
      const opt = typeSelect.options[0];
      const p = opt?.getAttribute('data-price');
      if (priceInput) priceInput.value = p || '';
    }
    const costInput = document.getElementById('fuel-log-cost');
    const litersInput = document.getElementById('fuel-log-liters');
    const fullTankSwitch = document.getElementById('fuel-log-full-tank');
    const notesInput = document.getElementById('fuel-log-notes');

    if (costInput) costInput.value = '';
    if (litersInput) litersInput.value = '';
    if (fullTankSwitch) fullTankSwitch.checked = true;
    if (notesInput) notesInput.value = '';

    triggerHaptic('light');
    openModal('modal-log-fuel');
  }

  // Open Fuel Modal click delegation (works across dynamic re-renders)
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-hud-log-fuel') || e.target.closest('#btn-open-fuel-log-view-b')) {
      openFuelModal();
    }
  });

  // Dynamic Fuel price selection
  const fuelTypeSelect = document.getElementById('fuel-log-type');
  const fuelPriceInput = document.getElementById('fuel-log-price');
  const fuelCostInput = document.getElementById('fuel-log-cost');
  const fuelLitersInput = document.getElementById('fuel-log-liters');

  fuelTypeSelect?.addEventListener('change', (e) => {
    const selectedOption = e.target.options[e.target.selectedIndex];
    const price = selectedOption.getAttribute('data-price');
    if (price && fuelPriceInput) {
      fuelPriceInput.value = price;
      const cost = parseFloat(fuelCostInput?.value || '0');
      if (cost > 0 && parseFloat(price) > 0 && fuelLitersInput) {
        fuelLitersInput.value = (cost / parseFloat(price)).toFixed(2);
      }
    }
  });

  fuelPriceInput?.addEventListener('input', () => {
    const price = parseFloat(fuelPriceInput.value) || 0;
    const cost = parseFloat(fuelCostInput?.value || '0') || 0;
    if (price > 0 && cost > 0 && fuelLitersInput) {
      fuelLitersInput.value = (cost / price).toFixed(2);
    }
  });

  // Bidirectional cost <-> liters instant calculation
  fuelCostInput?.addEventListener('input', () => {
    const cost = parseFloat(fuelCostInput.value) || 0;
    const price = parseFloat(fuelPriceInput?.value || '0') || 0;
    if (price > 0 && cost > 0 && fuelLitersInput) {
      fuelLitersInput.value = (cost / price).toFixed(2);
    }
  });

  fuelLitersInput?.addEventListener('input', () => {
    const liters = parseFloat(fuelLitersInput.value) || 0;
    const price = parseFloat(fuelPriceInput?.value || '0') || 0;
    if (price > 0 && liters > 0 && fuelCostInput) {
      fuelCostInput.value = Math.round(liters * price);
    }
  });

  // Submit Fuel Log (Create or Edit)
  const formLogFuel = document.getElementById('form-log-fuel');
  formLogFuel?.addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('fuel-log-edit-id')?.value;
    const date = document.getElementById('fuel-log-date')?.value;
    const odo = parseInt(document.getElementById('fuel-log-odometer')?.value, 10) || 0;
    const fuelType = document.getElementById('fuel-log-type')?.value;
    const pricePerLiter = parseFloat(document.getElementById('fuel-log-price')?.value) || 0;
    const totalCost = parseFloat(document.getElementById('fuel-log-cost')?.value) || 0;
    const liters = parseFloat(document.getElementById('fuel-log-liters')?.value) || 0;
    const isFullTank = Boolean(document.getElementById('fuel-log-full-tank')?.checked);
    const notes = document.getElementById('fuel-log-notes')?.value.trim() || '';

    if (liters <= 0 || totalCost <= 0) {
      showToast('Please enter valid fuel amount and cost.', 'error');
      return;
    }

    const payload = {
      date,
      odometer: odo,
      fuel_type: fuelType,
      price_per_liter: pricePerLiter,
      total_cost: totalCost,
      liters,
      is_full_tank: isFullTank,
      notes
    };

    if (editId) {
      if (typeof updateFuelLog === 'function') {
        updateFuelLog(editId, payload);
      }
      showToast('Refuel record updated!', 'success');
    } else {
      if (typeof addFuelLog === 'function') {
        addFuelLog(payload);
      }
      showToast('Refuel logged successfully!', 'success');
    }

    state = getAppState();
    renderAll(state);
    closeModal();
    triggerHaptic('success');
  });

  // Refuel Log History Actions (Edit & Delete delegation)
  document.getElementById('fuel-history-list')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit-fuel');
    if (editBtn) {
      const fuelId = editBtn.getAttribute('data-id');
      const activeVeh = getActiveVehicle(state);
      const entry = (activeVeh?.fuel_log || []).find(f => f.id === fuelId);
      if (entry) {
        document.getElementById('fuel-log-edit-id').value = entry.id;
        const modalTitle = document.getElementById('modal-log-fuel-title');
        if (modalTitle) modalTitle.textContent = '✏️ Edit Fuel Refuel';

        document.getElementById('fuel-log-date').value = entry.date || new Date(entry.timestamp).toISOString().split('T')[0];
        document.getElementById('fuel-log-odometer').value = entry.odometer || 0;
        document.getElementById('fuel-log-type').value = entry.fuel_type || 'Pertalite';
        document.getElementById('fuel-log-price').value = entry.price_per_liter || 0;
        document.getElementById('fuel-log-cost').value = entry.total_cost || 0;
        document.getElementById('fuel-log-liters').value = entry.liters || 0;
        document.getElementById('fuel-log-full-tank').checked = Boolean(entry.is_full_tank);
        document.getElementById('fuel-log-notes').value = entry.notes || '';

        triggerHaptic('light');
        openModal('modal-log-fuel');
      }
      return;
    }

    const deleteBtn = e.target.closest('.btn-delete-fuel');
    if (deleteBtn) {
      const fuelId = deleteBtn.getAttribute('data-id');
      showCustomConfirmModal({
        title: '🗑️ Delete Refuel Log',
        message: 'Are you sure you want to delete this refuel record? Fuel economy stats will be recomputed.',
        confirmText: 'Delete Record',
        confirmClass: 'danger-btn',
        headerClass: 'header-danger',
        onConfirm: () => {
          if (typeof deleteFuelLog === 'function') {
            deleteFuelLog(fuelId);
          }
          state = getAppState();
          renderAll(state);
          triggerHaptic('light');
          showToast('Refuel record deleted.', 'success');
        }
      });
    }
  });

  // Register PWA service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('Service Worker registered successfully:', reg.scope))
        .catch((err) => console.error('Service Worker registration failed:', err));
    });
  }
});
