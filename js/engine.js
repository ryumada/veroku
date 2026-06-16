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
 * Enrich a list of raw services with calculated attributes.
 * @param {Array<object>} services
 * @param {number} currentOdometer
 * @returns {Array<object>}
 */
function computeAllServices(services, currentOdometer) {
  if (!Array.isArray(services)) return [];
  return services.map(service => {
    const nextOdometer = computeNextOdometer(service.last_service_odometer, service.interval_km);
    const deltaRemaining = computeRemainingDelta(currentOdometer, nextOdometer);
    const status = classifyStatus(deltaRemaining, service.interval_km, service.warning_threshold);
    return {
      ...service,
      nextOdometer,
      deltaRemaining,
      status
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
      return weightB - weightA; // Higher weight first
    }
    
    // Within the same status, sort by deltaRemaining ascending (closest to limit first)
    return a.deltaRemaining - b.deltaRemaining;
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
