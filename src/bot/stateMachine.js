// Conversation State Machine
// This is the brain of the bot.
// Every incoming WhatsApp message flows through handleMessage().
//
// States:
//   NEW → AWAITING_NAME
//   AWAITING_NAME → AWAITING_VILLAGE
//   AWAITING_VILLAGE → AWAITING_DISTRICT
//   AWAITING_DISTRICT → AWAITING_AREA
//   AWAITING_AREA → AWAITING_ALTITUDE
//   AWAITING_ALTITUDE → AWAITING_VARIETY
//   AWAITING_VARIETY → AWAITING_IRRIGATION
//   AWAITING_IRRIGATION → AWAITING_STAGE         ← onboarding only (creates orchard)
//   AWAITING_STAGE → ACTIVE (onboarding complete)
//   ACTIVE → handles SPRAY, STAGE, LOG commands
//   AWAITING_STAGE_UPDATE → ACTIVE               ← updates existing orchard stage (NOT onboarding)

const db = require('../db');
const { getWeatherForOrchard } = require('../weather');
const { getSprayRecommendation, getScabAlert, getRainAlert } = require('./advisor');
const {
  MESSAGES, STAGE_NAMES, STAGE_NUMBER_MAP, ALTITUDE_MAP, IRRIGATION_MAP, format
} = require('./messages');

/**
 * Main entry point. Called once per incoming WhatsApp message.
 *
 * @param {string} from    - WhatsApp number e.g. 'whatsapp:+919816001234'
 * @param {string} msgBody - Message text from farmer
 * @returns {string}       - Reply to send back
 */
async function handleMessage(from, msgBody) {
  const text = (msgBody || '').trim();
  const normalised = text.toUpperCase();

  // 1. Load or create farmer record
  const { farmer, isNew } = await db.getOrCreateFarmer(from);
  const lang = farmer.language || 'hi';
  const msgs = MESSAGES[lang];

  // 2. Handle universal commands that work in any state
  if (normalised === 'HELP') {
    return buildHelpMessage(lang);
  }

  // 3. Route based on current state
  switch (farmer.conv_state) {
    case 'NEW':
      return handleNew(from, farmer, lang);

    case 'AWAITING_NAME':
      return handleNameInput(from, text, lang);

    case 'AWAITING_VILLAGE':
      return handleVillageInput(from, text, lang);

    case 'AWAITING_DISTRICT':
      return handleDistrictInput(from, text, lang);

    case 'AWAITING_AREA':
      return handleAreaInput(from, text, lang);

    case 'AWAITING_ALTITUDE':
      return handleAltitudeInput(from, text, lang);

    case 'AWAITING_VARIETY':
      return handleVarietyInput(from, text, lang);

    case 'AWAITING_IRRIGATION':
      return handleIrrigationInput(from, text, lang);

    case 'AWAITING_STAGE':
      return handleStageInput(from, text, lang);          // onboarding — creates orchard

    case 'AWAITING_STAGE_UPDATE':
      return handleStageUpdateInput(from, text, lang);    // post-onboarding — updates existing orchard

    case 'AWAITING_LOG_STAGE':
      return handleLogStageInput(from, text, farmer, lang);

    case 'AWAITING_LOG_CHEMICAL':
      return handleLogChemicalInput(from, text, farmer, lang);

    case 'ACTIVE':
      return handleActiveState(from, normalised, text, farmer, lang);

    default:
      // Unknown state — reset
      await db.updateFarmerState(from, 'NEW');
      return handleNew(from, farmer, lang);
  }
}

// ─── State Handlers ────────────────────────────────────────────────────────────

async function handleNew(from, farmer, lang) {
  await db.updateFarmerState(from, 'AWAITING_NAME');
  return MESSAGES[lang].welcome;
}

async function handleNameInput(from, text, lang) {
  if (text.length < 2) {
    return lang === 'hi' ? 'कृपया अपना पूरा नाम लिखें।' : 'Please enter your full name.';
  }
  // Save name
  await db.query('UPDATE farmers SET name = $1 WHERE phone = $2', [text, from]);
  await db.updateFarmerState(from, 'AWAITING_VILLAGE');
  return format(MESSAGES[lang].ask_village, { name: text });
}

async function handleVillageInput(from, text, lang) {
  await db.setTempValue(from, 'village', text);
  await db.updateFarmerState(from, 'AWAITING_DISTRICT');
  return MESSAGES[lang].ask_district;
}

async function handleDistrictInput(from, text, lang) {
  await db.query(
    'UPDATE farmers SET village = $1, district = $2 WHERE phone = $3',
    [await db.getTempValue(from, 'village'), text, from]
  );
  await db.updateFarmerState(from, 'AWAITING_AREA');
  return MESSAGES[lang].ask_area;
}

async function handleAreaInput(from, text, lang) {
  const area = parseFloat(text);
  if (isNaN(area) || area <= 0) {
    return lang === 'hi'
      ? 'कृपया सही नंबर लिखें (जैसे: 5)'
      : 'Please enter a valid number (e.g. 5)';
  }
  await db.setTempValue(from, 'area', area.toString());
  await db.updateFarmerState(from, 'AWAITING_ALTITUDE');
  return MESSAGES[lang].ask_altitude;
}

async function handleAltitudeInput(from, text, lang) {
  const altData = ALTITUDE_MAP[text.trim()];
  if (!altData) {
    return lang === 'hi'
      ? 'कृपया 1, 2, या 3 लिखें।'
      : 'Please type 1, 2, or 3.';
  }
  await db.setTempValue(from, 'altitude_zone', altData.zone);
  await db.setTempValue(from, 'altitude_m', altData.approx_m.toString());
  await db.updateFarmerState(from, 'AWAITING_VARIETY');
  return MESSAGES[lang].ask_variety;
}

async function handleVarietyInput(from, text, lang) {
  await db.setTempValue(from, 'variety', text);
  await db.updateFarmerState(from, 'AWAITING_IRRIGATION');
  return MESSAGES[lang].ask_irrigation;
}

async function handleIrrigationInput(from, text, lang) {
  const irrigationType = IRRIGATION_MAP[text.trim()];
  if (!irrigationType) {
    return lang === 'hi'
      ? 'कृपया 1, 2, या 3 लिखें।'
      : 'Please type 1, 2, or 3.';
  }
  await db.setTempValue(from, 'irrigation', irrigationType);
  await db.updateFarmerState(from, 'AWAITING_STAGE');
  return MESSAGES[lang].ask_stage;
}

async function handleStageInput(from, text, lang) {
  const stageId = STAGE_NUMBER_MAP[text.trim()];
  if (!stageId) {
    return lang === 'hi'
      ? 'कृपया 1 से 9 के बीच नंबर लिखें।'
      : 'Please type a number between 1 and 9.';
  }

  // All data collected — create farmer profile + orchard
  const allData = await db.getAllTempValues(from);
  const farmerRecord = await db.query('SELECT * FROM farmers WHERE phone = $1', [from]);
  const farmerId = farmerRecord.rows[0].id;

  await db.createOrchard(farmerId, {
    area_bigha: parseFloat(allData.area || 0),
    altitude_zone: allData.altitude_zone || 'mid',
    altitude_m: parseInt(allData.altitude_m || 2000),
    primary_variety: allData.variety || 'Royal Delicious',
    irrigation_type: allData.irrigation || 'none',
    current_stage_id: stageId,
  });

  await db.clearTempValues(from);
  await db.updateFarmerState(from, 'ACTIVE');

  const farmerName = farmerRecord.rows[0].name || '';
  return format(MESSAGES[lang].onboarding_complete, { name: farmerName });
}

// Called when an already-onboarded farmer sends STAGE command and picks a number.
// Only updates current_stage_id — does NOT touch orchard profile data.
async function handleStageUpdateInput(from, text, lang) {
  const stageId = STAGE_NUMBER_MAP[text.trim()];
  if (!stageId) {
    return lang === 'hi'
      ? 'कृपया 1 से 9 के बीच नंबर लिखें।'
      : 'Please type a number between 1 and 9.';
  }

  const farmerData = await db.getFarmerWithOrchard(from);
  if (farmerData?.orchard_id) {
    await db.updateOrchardStage(farmerData.orchard_id, stageId);
  }

  await db.updateFarmerState(from, 'ACTIVE');

  const stageName = STAGE_NAMES[stageId]?.[lang] || stageId;
  return lang === 'hi'
    ? `✅ Stage update हो गई!\n*${stageName}*\n\nSPRAY लिखें spray सलाह के लिए।`
    : `✅ Stage updated to: *${stageName}*\n\nType SPRAY for today's advice.`;
}

// ─── Active State Command Handlers ────────────────────────────────────────────

async function handleActiveState(from, command, rawText, farmer, lang) {
  const msgs = MESSAGES[lang];

  if (command === 'SPRAY') {
    return await handleSprayCommand(from, farmer, lang);
  }

  if (command === 'STAGE') {
    // IMPORTANT: use AWAITING_STAGE_UPDATE here, NOT AWAITING_STAGE
    // AWAITING_STAGE is onboarding-only (creates a new orchard from temp data)
    // AWAITING_STAGE_UPDATE just updates current_stage_id on the existing orchard
    await db.updateFarmerState(from, 'AWAITING_STAGE_UPDATE');
    return msgs.ask_stage;
  }

  if (command === 'LOG') {
    await db.updateFarmerState(from, 'AWAITING_LOG_STAGE');
    return msgs.ask_stage; // ask which stage they sprayed at
  }

  return msgs.not_understood;
}

async function handleSprayCommand(from, farmer, lang) {
  // Get farmer's orchard + current stage
  const farmerData = await db.getFarmerWithOrchard(from);
  if (!farmerData || !farmerData.orchard_id) {
    return lang === 'hi'
      ? 'Profile नहीं मिला। HELP लिखें।'
      : 'Profile not found. Type HELP.';
  }

  const stageId = farmerData.current_stage_id;
  if (!stageId) {
    // No stage set yet — ask the farmer, but use AWAITING_STAGE_UPDATE
    // so it updates the existing orchard rather than trying to create a new one
    await db.updateFarmerState(from, 'AWAITING_STAGE_UPDATE');
    return MESSAGES[lang].ask_stage;
  }

  // Get weather for their orchard location
  const weather = await getWeatherForOrchard(farmerData.lat, farmerData.lng);

  // Get last sprays for rotation check
  const recentSprays = await db.getLastSprays(farmerData.orchard_id, 5);

  // Generate recommendation
  const recommendation = getSprayRecommendation(stageId, weather, recentSprays, lang);

  // If scab alert is triggered, prepend it
  const scabAlert = getScabAlert(weather, lang);
  const rainAlert = getRainAlert(weather, lang);

  const alerts = [scabAlert, rainAlert].filter(Boolean).join('\n\n');
  return alerts ? `${alerts}\n\n${recommendation}` : recommendation;
}

async function handleLogStageInput(from, text, farmer, lang) {
  const stageId = STAGE_NUMBER_MAP[text.trim()];
  if (!stageId) {
    return lang === 'hi'
      ? 'कृपया 1 से 9 के बीच नंबर लिखें।'
      : 'Please type a number between 1 and 9.';
  }
  await db.setTempValue(from, 'log_stage', stageId);
  await db.updateFarmerState(from, 'AWAITING_LOG_CHEMICAL');
  return MESSAGES[lang].log_ask_chemical;
}

async function handleLogChemicalInput(from, text, farmer, lang) {
  const stageId = await db.getTempValue(from, 'log_stage');
  const farmerData = await db.getFarmerWithOrchard(from);

  if (!farmerData?.orchard_id) {
    // No orchard found — can't save the log. Reset to ACTIVE and inform farmer.
    await db.clearTempValues(from);
    await db.updateFarmerState(from, 'ACTIVE');
    return lang === 'hi'
      ? '❌ Orchard profile नहीं मिला। Spray log save नहीं हुआ। HELP लिखें।'
      : '❌ Orchard profile not found. Log not saved. Type HELP.';
  }

  await db.logSpray(farmerData.orchard_id, {
    spray_date: new Date(),
    stage_id: stageId,
    active_ingredient: text,
    brand_name: '',
    dose_applied: '',
    spray_type: 'disease',
  });

  await db.clearTempValues(from);
  await db.updateFarmerState(from, 'ACTIVE');

  const stageName = STAGE_NAMES[stageId]?.[lang] || stageId;
  return format(MESSAGES[lang].log_saved, {
    date: new Date().toLocaleDateString('en-IN'),
    stage: stageName,
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildHelpMessage(lang) {
  if (lang === 'hi') {
    return `*HP Apple Advisory - Help*

*SPRAY* - आज की spray सलाह पाएं
*STAGE* - Growth stage update करें
*LOG* - Spray log करें
*HELP* - यह message दोबारा देखें

किसी भी समस्या के लिए यह commands use करें।`;
  }
  return `*HP Apple Advisory - Help*

*SPRAY* - Get today's spray advice
*STAGE* - Update your growth stage
*LOG* - Log a spray you've done
*HELP* - Show this message again`;
}

module.exports = { handleMessage };
