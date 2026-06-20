/**
 * @file engine.js
 * @category Logic
 * @description Mathematical pure engines for maintenance interval delta computation and classification.
 * @requires None
 */

/**
 * Calculate target odometer for next maintenance event.
 * @param {number} lastServiceOdometer
 * @param {number} intervalKm
 * @returns {number}
 */
function computeNextOdometer(lastServiceOdometer, intervalKm) {
  return (lastServiceOdometer || 0) + (intervalKm || 0);
}

/**
 * Calculate remaining distance delta.
 * @param {number} currentOdometer
 * @param {number} nextOdometer
 * @returns {number}
 */
function computeRemainingDelta(currentOdometer, nextOdometer) {
  return (nextOdometer || 0) - (currentOdometer || 0);
}

/**
 * Classify the remaining delta into a functional status category.
 * @param {number} deltaRemaining
 * @param {number} intervalKm
 * @param {number} [warningThreshold] e.g. warn at 3000 KM for a 3500 KM target
 * @returns {{label: string, emoji: string, cssClass: string}}
 */
function classifyStatus(deltaRemaining, intervalKm, warningThreshold) {
  if (deltaRemaining <= 0) {
    return {
      label: '🚨 OVERDUE!',
      emoji: '🚨',
      cssClass: 'status--critical'
    };
  }
  
  const warningLimit = warningThreshold !== undefined && warningThreshold > 0
    ? Math.max(0, intervalKm - warningThreshold)
    : 200;

  if (deltaRemaining <= warningLimit) {
    return {
      label: '⚠️ Due Soon',
      emoji: '⚠️',
      cssClass: 'status--warning'
    };
  } else {
    return {
      label: '✅ Optimal',
      emoji: '✅',
      cssClass: 'status--optimal'
    };
  }
}

/**
 * Add value and unit duration to a date string.
 * @param {string} dateStr
 * @param {number} value
 * @param {string} unit
 * @returns {Date}
 */
function addTimeToDate(dateStr, value, unit) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date();
  const val = Number(value) || 0;
  if (unit === 'days') {
    d.setDate(d.getDate() + val);
  } else if (unit === 'months') {
    d.setMonth(d.getMonth() + val);
  } else if (unit === 'years') {
    d.setFullYear(d.getFullYear() + val);
  }
  return d;
}

/**
 * Get approximate number of warning days for time thresholds.
 * @param {number} value
 * @param {string} unit
 * @returns {number}
 */
function getWarningDays(value, unit) {
  const val = Number(value) || 0;
  if (unit === 'days') return val;
  if (unit === 'months') return val * 30;
  if (unit === 'years') return val * 365;
  return 7; // Default warning 7 days
}

/**
 * Enrich a list of raw services with calculated attributes.
 * @param {Array<object>} services
 * @param {number} currentOdometer
 * @returns {Array<object>}
 */
function computeAllServices(services, currentOdometer) {
  if (!Array.isArray(services)) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return services.map(service => {
    // 1. KM calculations
    let nextOdometer = null;
    let deltaRemainingKm = null;
    let kmStatus = 'status--optimal';

    const hasKmInterval = typeof service.interval_km === 'number' && service.interval_km > 0;
    
    if (hasKmInterval || service.one_time_limit_km) {
      if (service.one_time_limit_km) {
        nextOdometer = Number(service.one_time_limit_km);
      } else {
        nextOdometer = (Number(service.last_service_odometer) || 0) + Number(service.interval_km);
      }
      deltaRemainingKm = nextOdometer - currentOdometer;
      
      if (deltaRemainingKm <= 0) {
        kmStatus = 'status--critical';
      } else {
        const warnLimitKm = service.warning_threshold !== undefined && service.warning_threshold > 0
          ? Math.max(0, Number(service.interval_km) - Number(service.warning_threshold))
          : 200;
        if (deltaRemainingKm <= warnLimitKm) {
          kmStatus = 'status--warning';
        }
      }
    }

    // 2. Date calculations
    let nextDueDate = null;
    let deltaRemainingDays = null;
    let dateStatus = 'status--optimal';

    const hasTimeInterval = typeof service.interval_time_val === 'number' && service.interval_time_val > 0;
    
    if (hasTimeInterval || service.one_time_limit_date) {
      const lastDateStr = service.last_service_date || new Date().toISOString().split('T')[0];
      if (service.one_time_limit_date) {
        nextDueDate = new Date(service.one_time_limit_date);
      } else {
        nextDueDate = addTimeToDate(lastDateStr, service.interval_time_val, service.interval_time_unit);
      }
      nextDueDate.setHours(0, 0, 0, 0);
      
      const diffMs = nextDueDate.getTime() - today.getTime();
      deltaRemainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      
      if (deltaRemainingDays <= 0) {
        dateStatus = 'status--critical';
      } else {
        let warnLimitDays = 7; // Default 7 days
        if (typeof service.warning_time_val === 'number' && service.warning_time_val > 0) {
          warnLimitDays = getWarningDays(service.warning_time_val, service.warning_time_unit);
        }
        if (deltaRemainingDays <= warnLimitDays) {
          dateStatus = 'status--warning';
        }
      }
    }

    // 3. Combined status
    let finalStatusClass = 'status--optimal';
    let finalStatusLabel = '✅ Optimal';
    
    if (kmStatus === 'status--critical' || dateStatus === 'status--critical') {
      finalStatusClass = 'status--critical';
      finalStatusLabel = '🚨 OVERDUE!';
    } else if (kmStatus === 'status--warning' || dateStatus === 'status--warning') {
      finalStatusClass = 'status--warning';
      finalStatusLabel = '⚠️ Due Soon';
    }

    let displayDeltaText = '';
    let sortMetric = 999999;

    if (deltaRemainingKm !== null && deltaRemainingDays !== null) {
      // Both active: compare ratio of remaining values to see which limit is tighter
      const kmRatio = deltaRemainingKm / (Number(service.interval_km) || 1);
      const approxDaysInterval = service.interval_time_val ? getWarningDays(service.interval_time_val, service.interval_time_unit) : 30;
      const daysRatio = deltaRemainingDays / (approxDaysInterval || 1);
      
      if (kmRatio < daysRatio) {
        displayDeltaText = deltaRemainingKm <= 0 ? `${Math.abs(deltaRemainingKm)} KM OVERDUE` : `${deltaRemainingKm} KM Remaining`;
        sortMetric = deltaRemainingKm;
      } else {
        displayDeltaText = deltaRemainingDays <= 0 ? `${Math.abs(deltaRemainingDays)} days OVERDUE` : `${deltaRemainingDays} days Remaining`;
        sortMetric = deltaRemainingDays * 10;
      }
    } else if (deltaRemainingKm !== null) {
      displayDeltaText = deltaRemainingKm <= 0 ? `${Math.abs(deltaRemainingKm)} KM OVERDUE` : `${deltaRemainingKm} KM Remaining`;
      sortMetric = deltaRemainingKm;
    } else if (deltaRemainingDays !== null) {
      displayDeltaText = deltaRemainingDays <= 0 ? `${Math.abs(deltaRemainingDays)} days OVERDUE` : `${deltaRemainingDays} days Remaining`;
      sortMetric = deltaRemainingDays * 10;
    }

    return {
      ...service,
      nextOdometer,
      nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
      deltaRemainingKm,
      deltaRemainingDays,
      displayDeltaText,
      sortMetric,
      status: {
        label: finalStatusLabel,
        emoji: finalStatusClass === 'status--critical' ? '🚨' : (finalStatusClass === 'status--warning' ? '⚠️' : '✅'),
        cssClass: finalStatusClass
      }
    };
  });
}

/**
 * Sort enriched services in descending order of critical priority.
 * OVERDUE (critical) first, then Due Soon (warning), then Optimal.
 * @param {Array<object>} enrichedServices
 * @returns {Array<object>}
 */
function sortByPriority(enrichedServices) {
  if (!Array.isArray(enrichedServices)) return [];
  const statusWeight = {
    'status--critical': 3,
    'status--warning': 2,
    'status--optimal': 1
  };
  
  return [...enrichedServices].sort((a, b) => {
    const weightA = statusWeight[a.status.cssClass] || 0;
    const weightB = statusWeight[b.status.cssClass] || 0;
    
    if (weightA !== weightB) {
      return weightB - weightA;
    }
    
    return (a.sortMetric || 0) - (b.sortMetric || 0);
  });
}

/**
 * Calculate cost aggregation from service history.
 * @param {Array<object>} history
 * @returns {{total: number, perService: object}}
 */
function computeCostSummary(history) {
  const summary = { total: 0, perService: {} };
  if (!Array.isArray(history)) return summary;
  
  history.forEach(item => {
    const cost = Number(item.cost) || 0;
    summary.total += cost;
    if (item.service_id) {
      summary.perService[item.service_id] = (summary.perService[item.service_id] || 0) + cost;
    }
  });
  
  return summary;
}

/**
 * Compute average daily mileage based on odometer history.
 * @param {Array<object>} log
 * @returns {number} Average daily km
 */
function computeDailyAvgMileage(log) {
  if (!Array.isArray(log) || log.length < 2) return 0;
  
  // Sort log by timestamp ascending
  const sorted = [...log].sort((a, b) => a.timestamp - b.timestamp);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  
  const odoDiff = (last.odometer || 0) - (first.odometer || 0);
  const timeDiffMs = last.timestamp - first.timestamp;
  const timeDiffDays = timeDiffMs / (1000 * 60 * 60 * 24);
  
  if (timeDiffDays < 0.1 || odoDiff <= 0) return 0;
  
  return Number((odoDiff / timeDiffDays).toFixed(1));
}

/**
 * Update daily check completion streak count.
 * @param {object} meta
 * @param {Array<object>} dailyChecks
 * @returns {object} updated streak metadata properties
 */
function computeStreakUpdate(meta, dailyChecks) {
  const updated = {
    streak_days: meta.streak_days || 0,
    streak_last_completed_date: meta.streak_last_completed_date || ''
  };
  
  if (!Array.isArray(dailyChecks) || dailyChecks.length === 0) return updated;
  
  const allChecked = dailyChecks.every(c => c.checked);
  if (!allChecked) return updated;
  
  const todayStr = new Date().toISOString().split('T')[0];
  if (updated.streak_last_completed_date === todayStr) {
    return updated; // Already logged today
  }
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  if (updated.streak_last_completed_date === yesterdayStr) {
    updated.streak_days += 1;
  } else {
    updated.streak_days = 1;
  }
  updated.streak_last_completed_date = todayStr;
  
  return updated;
}

/**
 * Sort services by the specified criteria.
 * @param {Array<object>} services
 * @param {string} criteria
 * @returns {Array<object>}
 */
function sortServices(services, criteria) {
  if (!Array.isArray(services)) return [];
  const list = [...services];
  
  if (criteria === 'priority') {
    return sortByPriority(list);
  }
  
  return list.sort((a, b) => {
    switch (criteria) {
      case 'name': {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }
      case 'interval_km': {
        const valA = typeof a.interval_km === 'number' && a.interval_km > 0 ? a.interval_km : Infinity;
        const valB = typeof b.interval_km === 'number' && b.interval_km > 0 ? b.interval_km : Infinity;
        if (valA === Infinity && valB === Infinity) return 0;
        if (valA === Infinity) return 1;
        if (valB === Infinity) return -1;
        return valA - valB;
      }
      case 'next_due_km': {
        const valA = a.nextOdometer !== null && a.nextOdometer !== undefined ? a.nextOdometer : Infinity;
        const valB = b.nextOdometer !== null && b.nextOdometer !== undefined ? b.nextOdometer : Infinity;
        if (valA === Infinity && valB === Infinity) return 0;
        if (valA === Infinity) return 1;
        if (valB === Infinity) return -1;
        return valA - valB;
      }
      case 'next_due_date': {
        const valA = a.nextDueDate ? new Date(a.nextDueDate).getTime() : Infinity;
        const valB = b.nextDueDate ? new Date(b.nextDueDate).getTime() : Infinity;
        if (valA === Infinity && valB === Infinity) return 0;
        if (valA === Infinity) return 1;
        if (valB === Infinity) return -1;
        return valA - valB;
      }
      case 'last_service_km': {
        const valA = typeof a.last_service_odometer === 'number' ? a.last_service_odometer : -Infinity;
        const valB = typeof b.last_service_odometer === 'number' ? b.last_service_odometer : -Infinity;
        if (valA === -Infinity && valB === -Infinity) return 0;
        if (valA === -Infinity) return 1;
        if (valB === -Infinity) return -1;
        return valB - valA;
      }
      case 'last_service_date': {
        const valA = a.last_service_date ? new Date(a.last_service_date).getTime() : -Infinity;
        const valB = b.last_service_date ? new Date(b.last_service_date).getTime() : -Infinity;
        if (valA === -Infinity && valB === -Infinity) return 0;
        if (valA === -Infinity) return 1;
        if (valB === -Infinity) return -1;
        return valB - valA;
      }
      default:
        return 0; // Default / Unsorted (creation order)
    }
  });
}
