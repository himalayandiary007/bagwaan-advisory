// Spray Recommendation Engine
// Reads hp_apple_spray_master.json and generates recommendations
// based on: current growth stage + weather conditions + previous sprays (rotation)

const path = require('path');
const { MESSAGES, STAGE_NAMES, format } = require('./messages');

// Load the spray master data (built from HP Horti schedules 2023-2026)
let sprayData;
try {
  sprayData = require('../data/hp_apple_spray_master.json');
} catch (e) {
  console.warn('Spray data not found at src/data/hp_apple_spray_master.json');
  sprayData = { growth_stages: [], weather_rules: { global_rules: [] } };
}

/**
 * Get spray recommendations for a farmer
 *
 * @param {string} stageId - e.g. 'pink_bud', 'full_bloom'
 * @param {object} weather - result from getWeatherForOrchard()
 * @param {array}  recentSprays - last 3-5 sprays from DB (for rotation check)
 * @param {string} lang - 'hi' or 'en'
 * @returns {string} - formatted WhatsApp message
 */
function getSprayRecommendation(stageId, weather = {}, recentSprays = [], lang = 'hi') {
  const msgs = MESSAGES[lang];

  // Find the stage in our data
  const stage = sprayData.growth_stages?.find(s => s.stage_id === stageId);
  if (!stage) {
    return lang === 'hi'
      ? `❌ Growth stage "${stageId}" नहीं मिली। STAGE लिखकर stage update करें।`
      : `❌ Stage "${stageId}" not found. Type STAGE to update.`;
  }

  const stageName = STAGE_NAMES[stageId]?.[lang] || stageId;
  const today = new Date().toLocaleDateString('en-IN');

  // Get active ingredients used in last 5 sprays (for rotation warning)
  const recentIngredients = recentSprays.map(s => s.active_ingredient?.toLowerCase() || '');

  // Filter disease sprays
  let diseaseRecos = filterSprays(stage.disease_sprays || [], weather, recentIngredients);
  let pestRecos = filterSprays(stage.pest_sprays || [], weather, recentIngredients);

  // Build the message
  let message = format(msgs.spray_header, {
    stage_name: stageName,
    date: today,
    weather_note: weather.summary || 'Check weather before spraying',
  });

  // Disease sprays (top 2)
  if (diseaseRecos.length === 0) {
    message += lang === 'hi'
      ? '\nकोई Disease Spray नहीं (इस stage पर)।'
      : '\nNo disease spray for this stage.';
  } else {
    diseaseRecos.slice(0, 2).forEach((spray, i) => {
      const brands = (spray.brand_names || []).slice(0, 2).join(' / ');
      const targets = (spray.targets || []).join(', ');
      const rotationWarning = recentIngredients.includes(spray.active_ingredient?.toLowerCase())
        ? (lang === 'hi' ? ' ⚠️ Rotation चेक करें' : ' ⚠️ Check rotation')
        : '';

      message += '\n\n' + format(msgs.spray_item, {
        active_ingredient: spray.active_ingredient,
        brand_names: brands || 'See local market',
        dose: spray.dose_per_200L || 'As per label',
        targets: targets,
      }) + rotationWarning;
    });
  }

  // Pest sprays (if any)
  if (pestRecos.length > 0) {
    message += lang === 'hi' ? '\n\n*Pest Sprays:*' : '\n\n*Pest Sprays:*';
    pestRecos.slice(0, 1).forEach(spray => {
      const brands = (spray.brand_names || []).slice(0, 2).join(' / ');
      message += '\n' + format(msgs.spray_item, {
        active_ingredient: spray.active_ingredient,
        brand_names: brands || 'See local market',
        dose: spray.dose_per_200L || 'As per label',
        targets: (spray.targets || []).join(', '),
      });
    });
  }

  // Build ban warning if any recommended spray is on ban list
  const banList = sprayData.proposed_ban_list?.proposed || [];
  const bannedInReco = [...diseaseRecos, ...pestRecos].some(spray =>
    banList.some(banned => spray.active_ingredient?.toLowerCase().includes(banned.toLowerCase()))
  );
  const banWarning = bannedInReco
    ? (lang === 'hi' ? 'ऊपर कुछ chemicals proposed ban list में हैं। विकल्प भी देखें।' : 'Some chemicals above are on the proposed ban list. Consider alternatives.')
    : (lang === 'hi' ? 'कोई banned chemical नहीं।' : 'No banned chemicals in this recommendation.');

  message += '\n' + format(msgs.spray_footer, { ban_warning: banWarning });

  return message;
}

/**
 * Filter spray list based on weather conditions
 * Removes Dodine if temp > 30°C, adds scab alert items if scab risk high
 */
function filterSprays(sprays, weather, recentIngredients) {
  return sprays.filter(spray => {
    // Remove Dodine if max temp > 30°C (weather rule from our JSON)
    if (weather.dodineTempLock && spray.active_ingredient?.toLowerCase().includes('dodine')) {
      return false;
    }
    return true;
  });
}

/**
 * Get the scab alert message if Mills Table threshold is crossed
 */
function getScabAlert(weather, lang = 'hi') {
  if (!weather.scabRisk) return null;

  const msgs = MESSAGES[lang];
  return format(msgs.weather_alert_scab, {
    hours: weather.leafWetnessHours,
  });
}

/**
 * Get rain re-spray alert
 */
function getRainAlert(weather, lang = 'hi') {
  if (!weather.rainRepeatWarning) return null;

  const msgs = MESSAGES[lang];
  return format(msgs.weather_alert_rain, {
    rainfall: weather.rainLast12h,
    orchard_id: '',
  });
}

module.exports = { getSprayRecommendation, getScabAlert, getRainAlert };
