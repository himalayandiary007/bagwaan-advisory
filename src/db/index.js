// Database connection pool using node-postgres (pg)
// Single pool shared across the entire app - never create new Pool per request

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // Render.com PostgreSQL requires SSL in production
  // rejectUnauthorized: false allows self-signed certs (Render uses these)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected DB error:', err);
});

// Helper: run a query with automatic error logging
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log('DB query:', { text, duration, rows: res.rowCount });
  }
  return res;
}

// Get or create a farmer record by phone number
async function getOrCreateFarmer(phone) {
  const existing = await query('SELECT * FROM farmers WHERE phone = $1', [phone]);
  if (existing.rows.length > 0) {
    return { farmer: existing.rows[0], isNew: false };
  }
  const inserted = await query(
    'INSERT INTO farmers (phone) VALUES ($1) RETURNING *',
    [phone]
  );
  return { farmer: inserted.rows[0], isNew: true };
}

// Update a farmer's conversation state
async function updateFarmerState(phone, state) {
  await query(
    'UPDATE farmers SET conv_state = $1, updated_at = NOW() WHERE phone = $2',
    [state, phone]
  );
}

// Get a farmer's full record including their primary orchard
async function getFarmerWithOrchard(phone) {
  const res = await query(
    `SELECT f.*, o.id as orchard_id, o.area_bigha, o.altitude_zone,
            o.primary_variety, o.irrigation_type, o.lat, o.lng,
            o.current_stage_id, o.stage_set_at
     FROM farmers f
     LEFT JOIN orchards o ON o.farmer_id = f.id
     WHERE f.phone = $1
     ORDER BY o.created_at ASC
     LIMIT 1`,
    [phone]
  );
  return res.rows[0] || null;
}

// Store a temp value during onboarding (e.g., key='name', value='Ramesh Kumar')
async function setTempValue(phone, key, value) {
  await query(
    `INSERT INTO conv_temp (phone, key, value, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (phone, key) DO UPDATE SET value = $3, updated_at = NOW()`,
    [phone, key, value]
  );
}

// Read a temp value
async function getTempValue(phone, key) {
  const res = await query(
    'SELECT value FROM conv_temp WHERE phone = $1 AND key = $2',
    [phone, key]
  );
  return res.rows[0]?.value || null;
}

// Get all temp values for a phone (full onboarding data)
async function getAllTempValues(phone) {
  const res = await query(
    'SELECT key, value FROM conv_temp WHERE phone = $1',
    [phone]
  );
  const map = {};
  res.rows.forEach(row => { map[row.key] = row.value; });
  return map;
}

// Clear temp values after onboarding complete
async function clearTempValues(phone) {
  await query('DELETE FROM conv_temp WHERE phone = $1', [phone]);
}

// Create an orchard record
async function createOrchard(farmerId, data) {
  const res = await query(
    `INSERT INTO orchards
       (farmer_id, area_bigha, altitude_zone, altitude_m, primary_variety, irrigation_type, current_stage_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      farmerId,
      data.area_bigha,
      data.altitude_zone,
      data.altitude_m,
      data.primary_variety,
      data.irrigation_type,
      data.current_stage_id
    ]
  );
  return res.rows[0];
}

// Log a spray
async function logSpray(orchardId, data) {
  const res = await query(
    `INSERT INTO spray_logs
       (orchard_id, spray_date, stage_id, active_ingredient, brand_name, dose_applied, spray_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      orchardId,
      data.spray_date || new Date(),
      data.stage_id,
      data.active_ingredient,
      data.brand_name,
      data.dose_applied,
      data.spray_type
    ]
  );
  return res.rows[0];
}

// Get last spray logs for an orchard (to check rotation)
async function getLastSprays(orchardId, limit = 5) {
  const res = await query(
    'SELECT * FROM spray_logs WHERE orchard_id = $1 ORDER BY spray_date DESC LIMIT $2',
    [orchardId, limit]
  );
  return res.rows;
}

// Update orchard's current growth stage
async function updateOrchardStage(orchardId, stageId) {
  await query(
    'UPDATE orchards SET current_stage_id = $1, stage_set_at = NOW() WHERE id = $2',
    [stageId, orchardId]
  );
}

module.exports = {
  query,
  getOrCreateFarmer,
  updateFarmerState,
  getFarmerWithOrchard,
  setTempValue,
  getTempValue,
  getAllTempValues,
  clearTempValues,
  createOrchard,
  logSpray,
  getLastSprays,
  updateOrchardStage,
};
