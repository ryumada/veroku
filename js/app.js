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
        } else {
          sec.setAttribute('hidden', 'true');
        }
      });
    });
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
        last_service_date: lastServiceDate
      };

      const activeVeh = getActiveVehicle(state);
      activeVeh.services.push(newService);
      saveAppState(state);
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
        if (confirm(`Are you sure you want to delete tracking for: ${serviceName}?`)) {
          activeVeh.services.splice(serviceIndex, 1);
          saveAppState(state);
          renderAll(state);
          showToast('Component removed.', 'success');
        }
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
          document.getElementById('log-service-id').value = serviceId;
          document.getElementById('log-service-name').value = service.name;
          document.getElementById('log-service-cost').value = '';
          document.getElementById('log-service-notes').value = '';
          document.getElementById('modal-service-log').removeAttribute('hidden');
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
      if (confirm(`Remove task: "${taskName}"?`)) {
        list.splice(itemIndex, 1);
        saveAppState(state);
        renderAll(state);
        showToast('Checklist task removed.', 'success');
      }
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
        document.getElementById('modal-routine-desc-view')?.removeAttribute('hidden');
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
      document.getElementById('modal-add-routine')?.removeAttribute('hidden');
    }
  });

  document.getElementById('btn-close-add-routine')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-add-routine')?.addEventListener('click', closeModal);

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
  // CHECKLIST RESET ROUTINES
  // ==========================================================================
  function resetChecklist(type) {
    state.routine_checks[type].forEach(item => item.checked = false);
    saveAppState(state);
    renderAll(state);
    showToast(`Reset ${type} checklist tasks.`, 'success');
  }

  document.getElementById('btn-reset-daily')?.addEventListener('click', () => resetChecklist('daily'));
  document.getElementById('btn-reset-weekly')?.addEventListener('click', () => resetChecklist('weekly'));
  document.getElementById('btn-reset-monthly')?.addEventListener('click', () => resetChecklist('monthly'));
  document.getElementById('btn-reset-daily-modal')?.addEventListener('click', () => resetChecklist('daily'));
  document.getElementById('btn-reset-weekly-modal')?.addEventListener('click', () => resetChecklist('weekly'));
  document.getElementById('btn-reset-monthly-modal')?.addEventListener('click', () => resetChecklist('monthly'));

  // ==========================================================================
  // ROUTINES MODAL TRIGGERS
  // ==========================================================================
  document.getElementById('btn-open-daily')?.addEventListener('click', () => {
    document.getElementById('modal-daily')?.removeAttribute('hidden');
  });
  document.getElementById('btn-open-weekly')?.addEventListener('click', () => {
    document.getElementById('modal-weekly')?.removeAttribute('hidden');
  });
  document.getElementById('btn-open-monthly')?.addEventListener('click', () => {
    document.getElementById('modal-monthly')?.removeAttribute('hidden');
  });

  document.getElementById('btn-close-daily-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-confirm-daily-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-close-weekly-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-confirm-weekly-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-close-monthly-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-confirm-monthly-modal')?.addEventListener('click', closeModal);

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

  document.getElementById('btn-close-edit')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-edit')?.addEventListener('click', closeModal);

  // ==========================================================================
  // SETTINGS SUBMIT HANDLER
  // ==========================================================================
  const formSettings = document.getElementById('form-settings');
  if (formSettings) {
    formSettings.addEventListener('submit', (e) => {
      e.preventDefault();
      
      state.settings = {
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
        }
      };
      
      saveAppState(state);
      renderAll(state);
      showToast('Settings saved successfully.', 'success');
    });
  }

  // ==========================================================================
  // NOTIFICATION DUE ACTION BUTTONS
  // ==========================================================================
  document.getElementById('dashboard-notifications')?.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('.btn-action-notification');
    if (actionBtn) {
      const modalId = actionBtn.getAttribute('data-modal');
      if (modalId) {
        document.getElementById(modalId)?.removeAttribute('hidden');
      }
      return;
    }

    const logTriggerBtn = e.target.closest('.btn-log-service-trigger');
    if (logTriggerBtn) {
      const serviceId = logTriggerBtn.getAttribute('data-service-id');
      const activeVeh = getActiveVehicle(state);
      const service = activeVeh.services.find(s => s.id === serviceId);
      if (service) {
        document.getElementById('log-service-id').value = serviceId;
        document.getElementById('log-service-name').value = service.name;
        document.getElementById('log-service-cost').value = '';
        document.getElementById('log-service-notes').value = '';
        document.getElementById('modal-service-log').removeAttribute('hidden');
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
      const body = accordionCard.querySelector('.accordion-body');
      const isExpanded = accordionCard.classList.contains('expanded');
      
      if (isExpanded) {
        accordionCard.classList.remove('expanded');
        body?.setAttribute('hidden', 'true');
      } else {
        accordionCard.classList.add('expanded');
        body?.removeAttribute('hidden');
      }
    });
  }

  document.getElementById('btn-export-settings')?.addEventListener('click', exportData);
  document.getElementById('btn-import-settings')?.addEventListener('click', () => {
    document.getElementById('input-import')?.click();
  });
  
  document.getElementById('btn-load-example-data')?.addEventListener('click', () => {
    const activeVeh = getActiveVehicle(state);
    if (!activeVeh) return;

    activeVeh.services = [
      { id: generateId('srv'), name: 'Rantai Roda - Periksa & Lumasi (PL)', interval_km: 500, last_service_odometer: 0, warning_threshold: 450 },
      { id: generateId('srv'), name: 'Oli Mesin - Ganti (G)', interval_km: 4000, last_service_odometer: 0, warning_threshold: 3500 },
      { id: generateId('srv'), name: 'Saluran Bahan Bakar - Periksa (P)', interval_km: 4000, last_service_odometer: 0, warning_threshold: 3500 },
      { id: generateId('srv'), name: 'Cara Kerja Gas Tangan - Periksa (P)', interval_km: 4000, last_service_odometer: 0, warning_threshold: 3500 },
      { id: generateId('srv'), name: 'Pernapasan Bak Mesin - Bersihkan (B)', interval_km: 4000, last_service_odometer: 0, warning_threshold: 3500 },
      { id: generateId('srv'), name: 'Busi - Periksa / Ganti (PG)', interval_km: 4000, last_service_odometer: 0, warning_threshold: 3500 },
      { id: generateId('srv'), name: 'Jarak Renggang Klep - Periksa (P)', interval_km: 4000, last_service_odometer: 0, warning_threshold: 3500 },
      { id: generateId('srv'), name: 'Putaran Stasioner Mesin - Periksa (P)', interval_km: 4000, last_service_odometer: 0, warning_threshold: 3500 },
      { id: generateId('srv'), name: 'Minyak Rem - Periksa & Ganti Berkala (PG)', interval_km: 4000, last_service_odometer: 0, warning_threshold: 3500 },
      { id: generateId('srv'), name: 'Keausan Kampas Rem - Periksa (P)', interval_km: 4000, last_service_odometer: 0, warning_threshold: 3500 },
      { id: generateId('srv'), name: 'Sistem Rem - Periksa (P)', interval_km: 4000, last_service_odometer: 0, warning_threshold: 3500 },
      { id: generateId('srv'), name: 'Sakelar Lampu Rem - Periksa (P)', interval_km: 4000, last_service_odometer: 0, warning_threshold: 3500 },
      { id: generateId('srv'), name: 'Arah Sinar Lampu Depan - Periksa (P)', interval_km: 4000, last_service_odometer: 0, warning_threshold: 3500 },
      { id: generateId('srv'), name: 'Sistem Kopling - Periksa (P)', interval_km: 4000, last_service_odometer: 0, warning_threshold: 3500 },
      { id: generateId('srv'), name: 'Standar Samping - Periksa (P)', interval_km: 4000, last_service_odometer: 0, warning_threshold: 3500 },
      { id: generateId('srv'), name: 'Suspensi - Periksa (P)', interval_km: 4000, last_service_odometer: 0, warning_threshold: 3500 },
      { id: generateId('srv'), name: 'Mur, Baut, Pengencang - Periksa (P)', interval_km: 4000, last_service_odometer: 0, warning_threshold: 3500 },
      { id: generateId('srv'), name: 'Roda / Ban - Periksa (P)', interval_km: 4000, last_service_odometer: 0, warning_threshold: 3500 },
      { id: generateId('srv'), name: 'Saringan Udara - Ganti (G)', interval_km: 16000, last_service_odometer: 0, warning_threshold: 15000 },
      { id: generateId('srv'), name: 'Saringan Kasa Oli Mesin - Bersihkan (B)', interval_km: 12000, last_service_odometer: 0, warning_threshold: 11000 },
      { id: generateId('srv'), name: 'Saringan Sentrifugal Oli - Bersihkan (B)', interval_km: 12000, last_service_odometer: 0, warning_threshold: 11000 },
      { id: generateId('srv'), name: 'Bantalan Kepala Kemudi - Periksa (P)', interval_km: 12000, last_service_odometer: 0, warning_threshold: 11000 }
    ];

    activeVeh.routine_checks.daily = [
      {
        id: generateId('chk'),
        task: 'Persediaan Bahan Bakar',
        desc: `Cara cek: Periksa sisa bahan bakar melalui meter digital pada panel instrumen. Lakukan pengisian bensin jika volume sudah mendekati indikator berkedip (dua atau tiga balok terakhir).\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 28 (Penjelasan Meter Bahan Bakar) & Hal. 37 (Pengisian Bahan Bakar).`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Tinggi Permukaan Oli Mesin',
        desc: `Cara cek: Periksa level oli melalui tangkai pengukur (dipstick) dalam kondisi motor tegak. Pastikan posisinya berada di antara tanda batas teratas (upper) dan terbawah (lower), sekaligus amati jika ada tanda kebocoran cairan di sekitar mesin.\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 53 – 54 (58 - 59 PDF) (Oli Mesin → Memeriksa Oli Mesin dan Menambahkan Oli Mesin).`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Cara Kerja Gas Tangan',
        desc: `Cara cek: Putar gas tangan dari posisi tertutup hingga terbuka penuh pada semua posisi setang kemudi (belok kanan/kiri penuh). Pastikan gas tangan dapat menutup kembali secara otomatis dengan lancar.\n\nSpesifikasi: Jarak bebas putaran gas tangan yang ideal adalah 2–6 mm.\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 66 (71 PDF) (Cara Pemeriksaan Jarak Bebas Putaran Gas).`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Rem Depan (minyak rem, jarak bebas, kampas rem)',
        desc: `Cara cek: 1. Pastikan reservoir minyak rem berada dalam posisi horizontal dan ketinggian cairan berada di atas tanda batas LWR (Lower).\n2. Periksa ketebalan kampas rem melalui indikator keausan di kaliper cakram.\n3. Tarik tuas rem depan untuk merasakan "jarak bebas" fungsinya. Karena merupakan rem cakram hidrolik, tuas harus terasa kokoh/padat saat ditekan dan tidak terasa terlalu empuk atau "ngempos" (tidak ada angin palsu dalam sistem).\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 55 – 56 (60 - 61 PDF) (Pemeriksaan Minyak Rem & Kampas Rem Cakram).`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Rem Belakang (Panah dan Jarak Bebas)',
        desc: `Cara cek: Tekan pedal rem belakang dan periksa jarak mainnya sebelum rem mulai menggigit. Amati juga panah indikator keausan kampas rem tromol pada panel roda belakang saat pedal ditekan penuh (pastikan panah tidak melewati batas tanda aus).\n\nSpesifikasi: Jarak main bebas ujung pedal rem belakang adalah 20–30 mm.\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 57 – 60 (62 - 65 PDF) (Penyetelan Jarak Bebas Pedal & Keausan Rem Tromol Belakang).`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Jarak Bebas Kopling',
        desc: `Cara cek: Tarik tuas kopling dan pastikan transisinya halus. Periksa jarak main bebas pada ujung handel sebelum kopling mulai merenggang.\n\nSpesifikasi: Jarak main bebas ujung handel kopling yang ideal adalah 10–20 mm.\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 63 – 65 (68 - 70 PDF) (Pemeriksaan & Penyetelan Kopling).`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Kelonggaran Rantai & Mata Gir',
        desc: `Cara cek: Lakukan pemeriksaan visual secara cepat pada rantai roda. Pastikan kelonggarannya normal (tidak terlalu kendur hingga menyentuh swingarm atau terlalu tegang) serta mata gir tidak tajam/aus.\n\nSpesifikasi: Jarak main bebas rantai (naik-turun) di bagian tengah adalah 20–30 mm (jangan berkendara jika kekenduran melebihi 50 mm).\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 79 – 81 (Pemeriksaan Kelonggaran, Penyetelan, & Pelumasan Rantai Roda).`,
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
        task: 'Roda dan Ban',
        desc: `Cara cek: Periksa kondisi fisik tapak ban secara visual (apakah ada paku, sayatan, retak, atau keausan abnormal). Periksa juga tekanan angin ban dalam kondisi dingin.\n\nSpesifikasi: * Ban Depan: 25 psi\nBan Belakang: 29 psi (untuk berkendara sendiri) / 33 psi (untuk berboncengan)\n\nReferensi Buku Pedoman Pemilik (BPP): Hal. 8 (Spesifikasi tekanan angin ban dan setelan rantaisa) 53 – 56 (Spesifikasi Ban, Tekanan Udara, & Batas Keausan TWI).`,
        checked: false
      }
    ];

    activeVeh.routine_checks.weekly = [
      {
        id: generateId('chk'),
        task: 'Perawatan Rantai Roda (Setiap 500 km)',
        desc: `Gerakkan rantai ke atas-bawah untuk memeriksa kekendurannya (standar jarak main bebas 20–30 mm; jangan berkendara jika kendur melebihi 50 mm). Bersihkan rantai menggunakan kain kering/sikat halus dengan larutan titik nyala tinggi, lalu lumasi memakai pelumas khusus rantai atau oli transmisi SAE 80/90.`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Pernapasan Bak Mesin',
        desc: `Periksa bagian temmus pandang dari selang pembuangan. Bersihkan endapan di dalam selang dengan lebih sering jika motor sering dikendarai dalam kondisi hujan, kecepatan tinggi, atau setelah motor dicuci.`,
        checked: false
      },
      {
        id: generateId('chk'),
        task: 'Pembersihan Rangka dan Bodi',
        desc: `Cuci motor secara menyeluruh menggunakan selang tekanan rendah, terutama setelah melewati area pesisir pantai (air laut/garam) atau jalan berlumpur untuk menghindari korosi pada komponen aluminium dan rangka.`,
        checked: false
      }
    ];

    activeVeh.routine_checks.monthly = [
      {
        id: generateId('chk'),
        task: 'Penyetelan Jarak Renggang Klep',
        desc: `Periksa renggang klep dalam kondisi mesin dingin. Renggang yang salah menyebabkan kebisingan atau penurunan performa.\n\nSpesifikasi:\n* Klep Masuk (In): 0,10 ± 0,02 mm\n* Klep Buang (Ex): 0,15 ± 0,02 mm`,
        checked: false
      }
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
      const body = dangerAccordionCard.querySelector('.accordion-body');
      const isExpanded = dangerAccordionCard.classList.contains('expanded');
      
      if (isExpanded) {
        dangerAccordionCard.classList.remove('expanded');
        body?.setAttribute('hidden', 'true');
      } else {
        dangerAccordionCard.classList.add('expanded');
        body?.removeAttribute('hidden');
      }
    });
  }

  const deleteModal = document.getElementById('modal-delete-confirm');
  const deleteTextInput = document.getElementById('delete-text-input');
  const confirmDeleteBtn = document.getElementById('btn-confirm-delete');

  document.getElementById('btn-delete-data-trigger')?.addEventListener('click', () => {
    if (deleteTextInput) deleteTextInput.value = '';
    confirmDeleteBtn?.setAttribute('disabled', 'true');
    deleteModal?.removeAttribute('hidden');
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
    const confirmPrompt = confirm('Are you absolutely sure you want to delete all data? This cannot be undone.');
    if (confirmPrompt) {
      state = resetAppState();
      renderAll(state);
      closeModal();
      showToast('All browser data has been deleted.', 'success');
    }
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
      document.getElementById('modal-add-vehicle').removeAttribute('hidden');
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

  document.getElementById('btn-close-add-vehicle')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-add-vehicle')?.addEventListener('click', closeModal);

  // Service Confirmation Form Submit Handler
  const formServiceLog = document.getElementById('form-service-log');
  if (formServiceLog) {
    formServiceLog.addEventListener('submit', (e) => {
      e.preventDefault();
      const serviceId = document.getElementById('log-service-id').value;
      const cost = document.getElementById('log-service-cost').value;
      const notes = document.getElementById('log-service-notes').value.trim();
      
      if (!serviceId || cost === '') {
        showToast('Please enter a valid maintenance cost.', 'error');
        return;
      }
      
      markServiceDone(serviceId, Number(cost), notes);
      
      // Reload state
      state = getAppState();
      renderAll(state);
      closeModal();
      
      const activeVeh = getActiveVehicle(state);
      const service = activeVeh.services.find(s => s.id === serviceId);
      showToast(`Completed service for: ${service ? service.name : 'Component'}!`, 'success');
    });
  }

  document.getElementById('btn-close-service-log')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-service-log')?.addEventListener('click', closeModal);

  // Odometer History trigger listener (Event delegation from body)
  document.body.addEventListener('click', (e) => {
    const triggerBtn = e.target.closest('#btn-trigger-odo-history');
    if (triggerBtn) {
      window.odoHistoryPage = 0;
      populateOdometerHistoryModal(state, 0);
      document.getElementById('modal-odometer-history').removeAttribute('hidden');
    }
  });

  document.getElementById('btn-close-odo-history')?.addEventListener('click', closeModal);
  document.getElementById('btn-close-odo-history-footer')?.addEventListener('click', closeModal);

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
      document.getElementById('modal-edit-vehicle').removeAttribute('hidden');
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

  document.getElementById('btn-close-edit-vehicle')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-edit-vehicle')?.addEventListener('click', closeModal);

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
      deleteVehicleModal?.removeAttribute('hidden');
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
    const confirmPrompt = confirm('Are you absolutely sure you want to delete this vehicle profile? This cannot be undone.');
    if (confirmPrompt) {
      const activeVeh = getActiveVehicle(state);
      const name = activeVeh.name;
      const success = deleteActiveVehicleProfile(state);
      if (success) {
        saveAppState(state);
        renderAll(state);
        closeModal();
        showToast(`Vehicle profile "${name}" has been deleted.`, 'success');
      } else {
        showToast('Failed to delete vehicle profile.', 'error');
      }
    }
  });

  document.getElementById('btn-cancel-delete-vehicle')?.addEventListener('click', closeModal);

  // Routine Description modal close listeners
  document.getElementById('btn-close-routine-desc-view')?.addEventListener('click', closeModal);
  document.getElementById('btn-close-routine-desc-view-footer')?.addEventListener('click', closeModal);

  // ==========================================================================
  // SERVICE HISTORY DATE NAVIGATION ACTIONS
  // ==========================================================================
  const btnHistoryMonthly = document.getElementById('btn-history-monthly');
  const btnHistoryYearly = document.getElementById('btn-history-yearly');
  const btnHistoryPrev = document.getElementById('btn-history-prev');
  const btnHistoryNext = document.getElementById('btn-history-next');
  const btnHistoryNow = document.getElementById('btn-history-now');

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

    btnHistoryPrev.addEventListener('click', () => {
      const d = window.historyActiveDate;
      if (window.historyFilterMode === 'monthly') {
        window.historyActiveDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      } else {
        window.historyActiveDate = new Date(d.getFullYear() - 1, 0, 1);
      }
      const activeVeh = getActiveVehicle(state);
      renderServiceHistory(activeVeh, window.historyFilterMode, window.historyActiveDate);
    });

    btnHistoryNext.addEventListener('click', () => {
      const d = window.historyActiveDate;
      if (window.historyFilterMode === 'monthly') {
        window.historyActiveDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      } else {
        window.historyActiveDate = new Date(d.getFullYear() + 1, 0, 1);
      }
      const activeVeh = getActiveVehicle(state);
      renderServiceHistory(activeVeh, window.historyFilterMode, window.historyActiveDate);
    });

    btnHistoryNow?.addEventListener('click', () => {
      window.historyActiveDate = new Date();
      const activeVeh = getActiveVehicle(state);
      renderServiceHistory(activeVeh, window.historyFilterMode, window.historyActiveDate);
    });
  }

  // Register PWA service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('Service Worker registered successfully:', reg.scope))
        .catch((err) => console.error('Service Worker registration failed:', err));
    });
  }
});
