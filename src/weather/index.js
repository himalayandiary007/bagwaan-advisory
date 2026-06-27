// Tomorrow.io Weather API integration
// Docs: https://docs.tomorrow.io/reference/realtime-weather

const axios = require('axios');

const TOMORROW_API_KEY = process.env.TOMORROW_API_KEY;
const BASE_URL = 'https://api.tomorrow.io/v4';

// Default to Shimla if GPS not set
const DEFAULT_LAT = 31.1048;
const DEFAULT_LNG = 77.1734;

/**
 * Get current weather + 24h forecast for a location
 * Returns the fields we care about for spray decisions
 */
async function getWeatherForOrchard(lat, lng) {
  const location = `${lat || DEFAULT_LAT},${lng || DEFAULT_LNG}`;

  try {
    const response = await axios.get(`${BASE_URL}/timelines`, {
      params: {
        location,
        fields: [
          'temperature',
          'humidity',
          'precipitationIntensity',
          'precipitationProbability',
          'windSpeed',
          'leafWetnessDuration', // hours of leaf wetness (key for Mills Table)
        ].join(','),
        units: 'metric',
        timesteps: '1h',
        startTime: 'nowMinus12h',
        endTime: 'nowPlus24h',
        apikey: TOMORROW_API_KEY,
      },
    });

    const intervals = response.data?.data?.timelines?.[0]?.intervals || [];
    return parseWeatherData(intervals);

  } catch (err) {
    console.error('Weather API error:', err.response?.data || err.message);
    // Return safe defaults so the app doesn't crash if API fails
    return {
      currentTemp: null,
      maxTempNext24h: null,
      rainLast12h: 0,
      leafWetnessHours: 0,
      scabRisk: false,
      dodineTempLock: false,
      rainRepeatWarning: false,
      summary: 'Weather data unavailable. Check manually before spraying.',
    };
  }
}

function parseWeatherData(intervals) {
  if (!intervals.length) return {};

  // Past 12h intervals (index 0-11 are past, 12+ are future)
  // Tomorrow.io returns hourly data; startTime=nowMinus12h means first 12 are past
  const past12h = intervals.slice(0, 12);
  const next24h = intervals.slice(12, 36);

  // Total rain in last 12h
  const rainLast12h = past12h.reduce((sum, i) => {
    return sum + (i.values?.precipitationIntensity || 0);
  }, 0);

  // Max temp in next 24h (to check Dodine lock)
  const maxTempNext24h = Math.max(...next24h.map(i => i.values?.temperature || 0));

  // Current conditions (latest past interval)
  const current = intervals[11]?.values || {};

  // Leaf wetness hours (cumulative from last 24h)
  // Mills Table: >= 9h of leaf wetness at 13-24°C = high scab risk
  const leafWetnessHours = [...past12h, ...next24h.slice(0, 12)].filter(i => {
    const lw = i.values?.leafWetnessDuration || 0;
    const temp = i.values?.temperature || 0;
    return lw > 0 && temp >= 13 && temp <= 24;
  }).length;  // count hours with wetness in the infection temp range

  // Apply the rules from our spray JSON
  const scabRisk = leafWetnessHours >= 9;            // Mills Table trigger
  const dodineTempLock = maxTempNext24h > 30;        // Dodine banned above 30°C
  const rainRepeatWarning = rainLast12h > 5;         // Re-spray needed after >5mm rain

  let summary = '';
  if (scabRisk) summary += '⚠️ Scab infection risk HIGH. ';
  if (dodineTempLock) summary += '🌡️ Temp >30°C: Dodine not recommended. ';
  if (rainRepeatWarning) summary += '🌧️ Heavy rain - re-spray may be needed. ';
  if (!summary) summary = '✅ Weather looks OK for spraying.';

  return {
    currentTemp: current.temperature,
    humidity: current.humidity,
    maxTempNext24h,
    rainLast12h: Math.round(rainLast12h * 10) / 10,
    leafWetnessHours,
    scabRisk,
    dodineTempLock,
    rainRepeatWarning,
    summary,
  };
}

module.exports = { getWeatherForOrchard };
