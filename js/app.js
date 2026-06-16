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
  
  // 2. Perform First Paint
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
  // ODOMETER HUD SUBMIT HANDLER
  // ==========================================================================
  document.body.addEventListener('submit', (e) => {
    if (e.target && e.target.id === 'form-odometer') {
      e.preventDefault();
      const inputOdo = document.getElementById('input-hud-odo');
      if (!inputOdo) return;

      const newOdo = parseInt(inputOdo.value, 10);
      const currentOdo = state.meta.current_odometer || 0;

      if (isNaN(newOdo) || newOdo < currentOdo) {
        showToast('Odometer reading cannot be decreased.', 'error');
        return;
      }

      state.meta.current_odometer = newOdo;
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
      const lastServiceInput = document.getElementById('add-last-service');

      const name = nameInput.value.trim();
      const interval = parseInt(intervalInput.value, 10);
      const lastService = parseInt(lastServiceInput.value, 10);

      if (!name || isNaN(interval) || isNaN(lastService)) {
        showToast('Please fill out all fields with valid data.', 'error');
        return;
      }

      const newService = {
        id: generateId('srv'),
        name: name,
        interval_km: interval,
        last_service_odometer: lastService
      };

      state.services.push(newService);
      saveAppState(state);
      renderAll(state);
      
      // Reset form
      formAddService.reset();
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
      const interval = parseInt(document.getElementById('edit-interval').value, 10);
      const lastService = parseInt(document.getElementById('edit-last-service').value, 10);

      if (!id || !name || isNaN(interval) || isNaN(lastService)) {
        showToast('Please enter valid updates.', 'error');
        return;
      }

      const service = state.services.find(s => s.id === id);
      if (service) {
        service.name = name;
        service.interval_km = interval;
        service.last_service_odometer = lastService;
        
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
  // EVENT DELEGATION: TABLE ACTIONS (EDIT/DELETE)
  // ==========================================================================
  const serviceTable = document.getElementById('service-table');
  if (serviceTable) {
    serviceTable.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.btn-edit');
      const deleteBtn = e.target.closest('.btn-delete');

      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        const service = state.services.find(s => s.id === id);
        if (service) {
          showModal(service);
        }
      }

      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        const serviceIndex = state.services.findIndex(s => s.id === id);
        if (serviceIndex !== -1) {
          const serviceName = state.services[serviceIndex].name;
          if (confirm(`Are you sure you want to delete tracking for: ${serviceName}?`)) {
            state.services.splice(serviceIndex, 1);
            saveAppState(state);
            renderAll(state);
            showToast('Component removed.', 'success');
          }
        }
      }
    });
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
        const service = state.services.find(s => s.id === serviceId);
        if (service) {
          markServiceDone(serviceId);
          // Reload state
          state = getAppState();
          renderAll(state);
          showToast(`Completed service for: ${service.name}!`, 'success');
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
    const list = state.routine_checks[type];
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

    // Toggle description expand action (Markdown descriptions view)
    if (nameEl) {
      e.stopPropagation();
      e.preventDefault();
      const descEl = itemEl.querySelector('.chk-desc');
      if (descEl) {
        const isExpanded = descEl.classList.contains('expanded');
        
        // Sync expanded states across views/modals
        const allMatchingItems = document.querySelectorAll(`.checklist-item[data-id="${id}"]`);
        allMatchingItems.forEach(matchItem => {
          const matchDesc = matchItem.querySelector('.chk-desc');
          if (matchDesc) {
            if (isExpanded) {
              matchDesc.classList.remove('expanded');
              matchItem.classList.remove('expanded');
            } else {
              matchDesc.classList.add('expanded');
              matchItem.classList.add('expanded');
            }
          }
        });
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

      state.routine_checks[type].push(newItem);
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
      localStorage.removeItem('v_manager_db');
      state = getAppState();
      saveAppState(state);
      renderAll(state);
      closeModal();
      showToast('All browser data has been deleted.', 'success');
    }
  });

  document.getElementById('btn-cancel-delete')?.addEventListener('click', closeModal);
});
