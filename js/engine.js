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
 * @returns {{label: string, emoji: string, cssClass: string}}
 */
function classifyStatus(deltaRemaining) {
  if (deltaRemaining <= 0) {
    return {
      label: '🚨 OVERDUE!',
      emoji: '🚨',
      cssClass: 'status--critical'
    };
  } else if (deltaRemaining <= 200) {
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
    const status = classifyStatus(deltaRemaining);
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
