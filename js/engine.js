/**
 * @file engine.js
 * @category Logic
 * @description Mathematical pure engines for maintenance interval delta computation and classification.
 * @requires None
 */


/**
 * Calculate the remaining distance margin at which the warning status triggers.
 * Supports both milestone distance (e.g. 3500 KM on a 4000 KM interval -> 500 KM remaining)
 * and absolute odometer reading (e.g. 8789 KM target on 9000 KM next odometer -> 211 KM remaining).
 * @param {number} warningThreshold
 * @param {number} intervalKm
 * @param {number} [nextOdometer]
 * @param {number} [lastServiceOdo]
 * @returns {number} warnMarginKm
 */
function computeKmWarningMargin(warningThreshold, intervalKm, nextOdometer, lastServiceOdo) {
  if (typeof warningThreshold !== 'number' || warningThreshold <= 0) {
    return (intervalKm && intervalKm < 2000) ? Math.max(10, Math.round(intervalKm * 0.1)) : 200;
  }

  // Case A: Absolute odometer threshold (e.g. 8789 KM when nextOdometer is 9000 KM)
  if (nextOdometer && warningThreshold > (lastServiceOdo || 0) && warningThreshold < nextOdometer) {
    return nextOdometer - warningThreshold;
  }

  // Case B: Milestone within interval (e.g. 3500 KM on 4000 KM interval -> 500 KM remaining)
  if (intervalKm && warningThreshold < intervalKm) {
    return intervalKm - warningThreshold;
  }

  // Fallback: Default 200 KM if threshold is equal to or exceeds target
  return 200;
}


/**
 * Parse YYYY-MM-DD string into a safe local Date object at 00:00:00 local time.
 * @param {string} dateStr
 * @returns {Date}
 */
function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d, 0, 0, 0, 0);
  }
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Format Date object into local YYYY-MM-DD string.
 * @param {Date} date
 * @returns {string}
 */
function formatLocalDate(date) {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Add value and unit duration to a date string.
 * @param {string} dateStr
 * @param {number} value
 * @param {string} unit
 * @returns {Date}
 */
function addTimeToDate(dateStr, value, unit) {
  const d = parseLocalDate(dateStr);
  const val = Number(value) || 0;
  if (unit === 'days') {
    d.setDate(d.getDate() + val);
  } else if (unit === 'weeks') {
    d.setDate(d.getDate() + val * 7);
  } else if (unit === 'months') {
    d.setMonth(d.getMonth() + val);
  } else if (unit === 'years') {
    d.setFullYear(d.getFullYear() + val);
  }
  return d;
}

/**
 * Convert time value and unit into approximate calendar days.
 * @param {number} value
 * @param {string} unit
 * @returns {number}
 */
function convertToDays(value, unit) {
  const val = Number(value) || 0;
  if (unit === 'days') return val;
  if (unit === 'weeks') return val * 7;
  if (unit === 'months') return val * 30;
  if (unit === 'years') return val * 365;
  return val;
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
        const warnLimitKm = computeKmWarningMargin(
          service.warning_threshold,
          service.interval_km,
          nextOdometer,
          service.last_service_odometer
        );
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
      const lastDateStr = service.last_service_date || formatLocalDate(today);
      if (service.one_time_limit_date) {
        nextDueDate = parseLocalDate(service.one_time_limit_date);
      } else {
        nextDueDate = addTimeToDate(lastDateStr, service.interval_time_val, service.interval_time_unit);
      }

      const diffMs = nextDueDate.getTime() - today.getTime();
      deltaRemainingDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (deltaRemainingDays <= 0) {
        dateStatus = 'status--critical';
      } else {
        // Evaluate warning milestone date
        if (typeof service.warning_time_val === 'number' && service.warning_time_val > 0) {
          const warnDate = addTimeToDate(lastDateStr, service.warning_time_val, service.warning_time_unit);
          warnDate.setHours(0, 0, 0, 0);
          if (warnDate < nextDueDate) {
            if (today.getTime() >= warnDate.getTime()) {
              dateStatus = 'status--warning';
            }
          } else {
            const defaultMarginDays = Math.min(30, Math.max(1, Math.round(convertToDays(service.interval_time_val, service.interval_time_unit) * 0.1))) || 7;
            if (deltaRemainingDays <= defaultMarginDays) {
              dateStatus = 'status--warning';
            }
          }
        } else {
          const defaultMarginDays = Math.min(30, Math.max(1, Math.round(convertToDays(service.interval_time_val, service.interval_time_unit) * 0.1))) || 7;
          if (deltaRemainingDays <= defaultMarginDays) {
            dateStatus = 'status--warning';
          }
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
      if (deltaRemainingKm <= 0 && deltaRemainingDays <= 0) {
        displayDeltaText = `${Math.abs(deltaRemainingKm)} KM / ${Math.abs(deltaRemainingDays)} days OVERDUE`;
        sortMetric = Math.min(deltaRemainingKm, deltaRemainingDays * 10);
      } else if (deltaRemainingKm <= 0) {
        displayDeltaText = `${Math.abs(deltaRemainingKm)} KM OVERDUE`;
        sortMetric = deltaRemainingKm;
      } else if (deltaRemainingDays <= 0) {
        displayDeltaText = `${Math.abs(deltaRemainingDays)} days OVERDUE`;
        sortMetric = deltaRemainingDays * 10;
      } else {
        const kmRatio = deltaRemainingKm / (Number(service.interval_km) || 1);
        const totalIntervalDays = convertToDays(service.interval_time_val, service.interval_time_unit) || 30;
        const daysRatio = deltaRemainingDays / totalIntervalDays;

        if (kmRatio <= daysRatio) {
          displayDeltaText = `${deltaRemainingKm} KM Remaining`;
          sortMetric = deltaRemainingKm;
        } else {
          displayDeltaText = `${deltaRemainingDays} days Remaining`;
          sortMetric = deltaRemainingDays * 10;
        }
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
      nextDueDate: nextDueDate ? formatLocalDate(nextDueDate) : null,
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
 * Compute monthly spending aggregation for the last N months.
 * @param {Array<object>} history
 * @param {number} [monthsCount=6]
 * @returns {Array<{monthKey: string, monthLabel: string, year: number, total: number}>}
 */
function computeMonthlySpendTrends(history, monthsCount = 6) {
  const result = [];
  const today = new Date();

  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
    const monthLabel = d.toLocaleString('default', { month: 'short' });

    let total = 0;
    if (Array.isArray(history)) {
      history.forEach(item => {
        if (!item.timestamp) return;
        const itemDate = new Date(item.timestamp);
        if (itemDate.getFullYear() === y && itemDate.getMonth() === m) {
          total += Number(item.cost) || 0;
        }
      });
    }
    result.push({ monthKey, monthLabel, year: y, total });
  }

  return result;
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
 * Filters uncalibrated zero readings and requires sufficient time delta.
 * @param {Array<object>} log
 * @returns {number} Average daily km
 */
function computeDailyAvgMileage(log) {
  if (!Array.isArray(log) || log.length < 2) return 0;

  // Sort log by timestamp ascending
  let sorted = [...log]
    .filter(item => typeof item.odometer === 'number' && item.timestamp)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (sorted.length < 2) return 0;

  // If first entry is an uncalibrated 0 baseline followed by actual readings, skip it
  if (sorted[0].odometer === 0 && sorted[1].odometer > 50) {
    sorted = sorted.slice(1);
    if (sorted.length < 2) return 0;
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const odoDiff = (last.odometer || 0) - (first.odometer || 0);
  const timeDiffMs = last.timestamp - first.timestamp;
  const timeDiffDays = timeDiffMs / (1000 * 60 * 60 * 24);

  // Require at least 6 hours (0.25 days) elapsed for a reliable daily rate
  if (timeDiffDays < 0.25 || odoDiff <= 0) return 0;

  const rate = odoDiff / timeDiffDays;
  return Number(Math.min(2000, rate).toFixed(1));
}

/**
 * Compute the remaining days forecast and human-readable explanation for a service.
 * @param {object} s Enriched service object
 * @param {number} avgMileage Daily average mileage (KM/day)
 * @returns {{days: number|null, message: string, isOverdue: boolean, type: 'km'|'time'|'both'|'none'}}
 */
function computeServiceForecast(s, avgMileage) {
  const isKmOverdue = s.deltaRemainingKm !== null && s.deltaRemainingKm <= 0;
  const isTimeOverdue = s.deltaRemainingDays !== null && s.deltaRemainingDays <= 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function makeResult(days, message, isOverdue, type) {
    let forecastDate = null;
    if (typeof days === 'number' && days > 0) {
      const fDate = new Date(today);
      fDate.setDate(fDate.getDate() + days);
      forecastDate = formatLocalDate(fDate);
    }
    return { days, message, isOverdue, type, forecastDate };
  }

  // 1. Overdue cases
  if (isKmOverdue && isTimeOverdue) {
    return makeResult(
      0,
      `🚨 Overdue by ${Math.abs(s.deltaRemainingKm)} KM & ${Math.abs(s.deltaRemainingDays)} days! Service immediately.`,
      true,
      'both'
    );
  }
  if (isKmOverdue) {
    return makeResult(
      0,
      `🚨 Past due by ${Math.abs(s.deltaRemainingKm)} KM! Service immediately.`,
      true,
      'km'
    );
  }
  if (isTimeOverdue) {
    return makeResult(
      0,
      `🚨 Past due by ${Math.abs(s.deltaRemainingDays)} days! Service immediately.`,
      true,
      'time'
    );
  }

  // 2. Not overdue - calculate estimated days remaining
  const daysFromKm = (avgMileage > 0 && s.deltaRemainingKm !== null && s.deltaRemainingKm > 0)
    ? Math.ceil(s.deltaRemainingKm / avgMileage)
    : null;
  const daysFromTime = (s.deltaRemainingDays !== null && s.deltaRemainingDays > 0)
    ? s.deltaRemainingDays
    : null;

  if (daysFromKm !== null && daysFromTime !== null) {
    if (daysFromKm <= daysFromTime) {
      return makeResult(
        daysFromKm,
        `⏳ Est. ${daysFromKm} days remaining (~${avgMileage} KM/day, based on mileage)`,
        false,
        'km'
      );
    } else {
      return makeResult(
        daysFromTime,
        `⏳ Est. ${daysFromTime} days remaining (Due ${s.nextDueDate}, based on time)`,
        false,
        'time'
      );
    }
  }

  if (daysFromKm !== null) {
    return makeResult(
      daysFromKm,
      `⏳ Est. ${daysFromKm} days remaining (~${avgMileage} KM/day)`,
      false,
      'km'
    );
  }

  if (daysFromTime !== null) {
    return makeResult(
      daysFromTime,
      `⏳ Est. ${daysFromTime} days remaining (Due ${s.nextDueDate})`,
      false,
      'time'
    );
  }

  // KM only and no avgMileage available
  return makeResult(
    null,
    `⏳ Forecast requires more odometer logs (~0 KM/day)`,
    false,
    'none'
  );
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
 * Sort services by the specified criteria with optional reversal.
 * @param {Array<object>} services
 * @param {string} criteria
 * @param {boolean} [reversed=false]
 * @returns {Array<object>}
 */
function sortServices(services, criteria, reversed = false) {
  if (!Array.isArray(services)) return [];
  const list = [...services];

  let result;
  if (criteria === 'priority') {
    result = sortByPriority(list);
  } else {
    result = list.sort((a, b) => {
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

  return reversed ? result.reverse() : result;
}

/**
 * Compute fuel consumption statistics from refuel history using full-to-full intervals.
 * @param {Array<object>} fuelLog
 * @returns {{
 *   avgKmL: number|null,
 *   lastKmL: number|null,
 *   costPerKm: number|null,
 *   totalLiters: number,
 *   totalCost: number,
 *   enrichedLog: Array<object>
 * }}
 */
function computeFuelEfficiency(fuelLog) {
  const result = {
    avgKmL: null,
    lastKmL: null,
    costPerKm: null,
    totalLiters: 0,
    totalCost: 0,
    enrichedLog: []
  };

  if (!Array.isArray(fuelLog) || fuelLog.length === 0) {
    return result;
  }

  // Sort by odometer ascending
  const sorted = [...fuelLog].sort((a, b) => (a.odometer || 0) - (b.odometer || 0));

  let totalCalculatedKm = 0;
  let totalCalculatedLiters = 0;
  let totalCalculatedCost = 0;

  let lastFullOdo = null;
  let intermediateLiters = 0;
  let intermediateCost = 0;

  const enriched = sorted.map((entry) => {
    const item = { ...entry, segmentKm: null, segmentKmL: null, segmentCostPerKm: null };
    result.totalLiters += Number(entry.liters) || 0;
    result.totalCost += Number(entry.total_cost) || 0;

    if (lastFullOdo === null) {
      if (entry.is_full_tank) {
        lastFullOdo = entry.odometer;
      }
    } else {
      intermediateLiters += Number(entry.liters) || 0;
      intermediateCost += Number(entry.total_cost) || 0;

      if (entry.is_full_tank) {
        const deltaKm = entry.odometer - lastFullOdo;
        if (deltaKm > 0 && intermediateLiters > 0) {
          const kmL = deltaKm / intermediateLiters;
          const costKm = intermediateCost / deltaKm;

          item.segmentKm = deltaKm;
          item.segmentKmL = Math.round(kmL * 10) / 10;
          item.segmentCostPerKm = Math.round(costKm);

          totalCalculatedKm += deltaKm;
          totalCalculatedLiters += intermediateLiters;
          totalCalculatedCost += intermediateCost;

          result.lastKmL = item.segmentKmL;
        }
        lastFullOdo = entry.odometer;
        intermediateLiters = 0;
        intermediateCost = 0;
      }
    }
    return item;
  });

  if (totalCalculatedKm > 0 && totalCalculatedLiters > 0) {
    result.avgKmL = Math.round((totalCalculatedKm / totalCalculatedLiters) * 10) / 10;
    result.costPerKm = Math.round(totalCalculatedCost / totalCalculatedKm);
  }

  result.enrichedLog = enriched.reverse();
  return result;
}

// Global exports
window.parseLocalDate = parseLocalDate;
window.formatLocalDate = formatLocalDate;
window.addTimeToDate = addTimeToDate;
window.convertToDays = convertToDays;
window.computeAllServices = computeAllServices;
window.sortByPriority = sortByPriority;
window.sortServices = sortServices;
window.computeDailyAvgMileage = computeDailyAvgMileage;
window.computeServiceForecast = computeServiceForecast;
window.computeMonthlySpendTrends = computeMonthlySpendTrends;
window.computeFuelEfficiency = computeFuelEfficiency;
