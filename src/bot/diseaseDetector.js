// Disease Detection via Image Analysis
// Flow:
//   Farmer sends photo on WhatsApp
//   → server.js routes image messages here
//   → We download the image from Meta's servers
//   → Send to Google Gemini Flash (free tier) for disease identification
//   → Cross-reference detected disease with hp_apple_spray_master.json
//   → Reply to farmer with disease name (Hindi) + spray recommendation

const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

// Load spray data once at startup
let sprayData;
try {
  sprayData = require('../data/hp_apple_spray_master.json');
} catch (e) {
  console.warn('Spray data not found — disease cross-reference will be skipped');
  sprayData = { growth_stages: [] };
}

// ── Main Handler ──────────────────────────────────────────────────────────────

/**
 * Called from server.js when farmer sends an image message.
 * @param {string} from   - farmer's phone number e.g. '919816001234'
 * @param {object} data   - Interakt webhook data object (data.type === 'Image')
 * @param {string} lang   - 'hi' or 'en'
 * @returns {string}      - reply to send back to farmer
 */
async function handleImageMessage(from, data, lang = 'hi') {
  try {
    // Step 1 — Download image from Interakt media URL
    const mediaUrl  = data.media?.url;
    const mimeType  = data.media?.mime_type || 'image/jpeg';
    if (!mediaUrl) throw new Error('No media URL in Interakt image payload');
    const { base64 } = await downloadImage(mediaUrl);

    // Step 2 — Analyse with Gemini Vision
    const diagnosis = await analyseWithGemini(base64, mimeType, lang);

    if (!diagnosis.disease_found) {
      return lang === 'hi'
        ? `📷 तस्वीर साफ नहीं दिखी या कोई रोग नहीं पहचाना।\n\nकृपया:\n• प्रभावित पत्ती/फल की नज़दीक से तस्वीर लें\n• अच्छी रोशनी में photo लें\n• दोबारा भेजें`
        : `📷 Could not identify a disease from this image.\n\nPlease:\n• Take a close-up of the affected leaf or fruit\n• Ensure good lighting\n• Try again`;
    }

    // Step 3 — Find matching sprays from our JSON
    const sprays = findSpraysForDisease(diagnosis.disease_name_en);

    // Step 4 — Format and return reply
    return formatDiseaseResponse(diagnosis, sprays, lang);

  } catch (err) {
    console.error('[DISEASE DETECTOR] Error:', err.message);
    return lang === 'hi'
      ? '❌ तस्वीर analyse करने में दिक्कत आई। थोड़ी देर बाद दोबारा कोशिश करें।'
      : '❌ Could not analyse the image. Please try again in a moment.';
  }
}

// ── Step 1: Download Image from Interakt ─────────────────────────────────────
// Interakt provides a direct URL — no auth header needed (unlike Meta)

async function downloadImage(url) {
  const imgRes = await axios.get(url, { responseType: 'arraybuffer' });
  const base64 = Buffer.from(imgRes.data).toString('base64');
  return { base64 };
}

// ── Step 2: Analyse with Gemini Flash ────────────────────────────────────────

async function analyseWithGemini(base64, mimeType, lang) {
  if (!GEMINI_API_KEY) {
    throw new Error('GOOGLE_GEMINI_API_KEY not set in .env');
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are an expert plant pathologist specializing in apple orchards in Himachal Pradesh, India.

A farmer has shared this image of their apple tree/fruit/leaf. Carefully analyse it.

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "disease_found": true,
  "disease_name_en": "Apple Scab",
  "disease_name_hi": "सेब का पपड़ी रोग",
  "severity": "moderate",
  "symptoms_hi": "पत्तियों पर काले-भूरे धब्बे, जो बाद में पपड़ी बन जाते हैं।",
  "cause_hi": "Venturia inaequalis नामक कवक (fungus) से होता है।",
  "immediate_action_hi": "प्रभावित पत्तियाँ और फल तुरंत हटाएं। गिरी हुई पत्तियाँ जलाएं।",
  "confidence": "high"
}

Rules:
- severity must be one of: mild, moderate, severe
- confidence must be one of: high, medium, low
- If image is blurry, not a plant, or disease cannot be identified, set disease_found to false and other fields to null
- disease_name_hi must be in Devanagari script
- symptoms_hi and immediate_action_hi must be in Hindi (Devanagari)

Common HP apple diseases to look for:
Apple Scab (सेब का पपड़ी रोग), Powdery Mildew (चूर्णिल आसिता),
Alternaria Blotch (अल्टरनेरिया धब्बा), Brown Rot (भूरा सड़न),
Fire Blight (अग्नि झुलसा), Collar Rot (गर्दन सड़न),
Woolly Aphid (रोएँदार माहू), San Jose Scale (सैन जोस स्केल),
Codling Moth (कोडलिंग मॉथ), Bitter Rot (कड़वा सड़न)`;

  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64 } },
    { text: prompt },
  ]);

  const raw = result.response.text().trim();

  // Strip markdown code fences if Gemini adds them
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('[GEMINI] Could not parse JSON response:', raw);
    return { disease_found: false };
  }
}

// ── Step 3: Find Sprays for Disease in JSON ───────────────────────────────────

function findSpraysForDisease(diseaseNameEn) {
  if (!diseaseNameEn || !sprayData.growth_stages) return [];

  // Build search keywords from the disease name
  // e.g. "Apple Scab" → ['apple', 'scab'] → we mainly look for 'scab'
  const keywords = diseaseNameEn.toLowerCase()
    .replace(/apple\s*/i, '')   // remove 'apple' prefix — it's always apple
    .split(/\s+/)
    .filter(k => k.length > 2); // ignore very short words

  const seen = new Set();
  const matches = [];

  for (const stage of sprayData.growth_stages) {
    for (const spray of (stage.disease_sprays || [])) {
      const targets = (spray.targets || []).map(t => t.toLowerCase());
      const hits = keywords.filter(kw => targets.some(t => t.includes(kw)));

      if (hits.length > 0 && !seen.has(spray.active_ingredient)) {
        seen.add(spray.active_ingredient);
        matches.push(spray);
      }
    }
  }

  // Return top 3, prioritising non-banned chemicals
  return matches
    .sort((a, b) => (a.proposed_ban ? 1 : 0) - (b.proposed_ban ? 1 : 0))
    .slice(0, 3);
}

// ── Step 4: Format Response ───────────────────────────────────────────────────

function formatDiseaseResponse(diagnosis, sprays, lang) {
  const severityLabel = {
    hi: { mild: 'हल्का', moderate: 'मध्यम', severe: 'गंभीर', unknown: 'अज्ञात' },
    en: { mild: 'Mild', moderate: 'Moderate', severe: 'Severe', unknown: 'Unknown' },
  };

  const confidenceLabel = {
    hi: { high: 'उच्च', medium: 'मध्यम', low: 'कम' },
    en: { high: 'High', medium: 'Medium', low: 'Low' },
  };

  const severity = severityLabel[lang][diagnosis.severity] || diagnosis.severity;
  const confidence = confidenceLabel[lang][diagnosis.confidence] || diagnosis.confidence;

  let msg = '';

  if (lang === 'hi') {
    msg += `🔍 *रोग पहचान*\n\n`;
    msg += `🌿 *रोग:* ${diagnosis.disease_name_hi}\n`;
    msg += `   _(${diagnosis.disease_name_en})_\n\n`;
    msg += `📊 *गंभीरता:* ${severity}\n`;
    msg += `🎯 *पहचान विश्वास:* ${confidence}\n\n`;
    msg += `📋 *लक्षण:*\n${diagnosis.symptoms_hi}\n\n`;
    msg += `⚠️ *तुरंत करें:*\n${diagnosis.immediate_action_hi}\n`;
  } else {
    msg += `🔍 *Disease Detected*\n\n`;
    msg += `🌿 *Disease:* ${diagnosis.disease_name_en}\n\n`;
    msg += `📊 *Severity:* ${severity}\n`;
    msg += `🎯 *Confidence:* ${confidence}\n\n`;
    msg += `⚠️ *Immediate Action:*\n${diagnosis.immediate_action_hi}\n`;
  }

  // Add spray recommendations if found
  if (sprays.length > 0) {
    msg += lang === 'hi'
      ? `\n💊 *अनुशंसित Spray:*\n`
      : `\n💊 *Recommended Sprays:*\n`;

    sprays.forEach(spray => {
      const brands = (spray.brand_names || []).slice(0, 2).join(', ');
      const banWarn = spray.proposed_ban
        ? (lang === 'hi' ? ' ⚠️ Proposed ban list पर' : ' ⚠️ On proposed ban list')
        : '';

      msg += `\n• *${spray.active_ingredient}*${banWarn}`;
      if (spray.dose_per_200L) msg += `\n  Dose: ${spray.dose_per_200L} per 200L`;
      if (brands) msg += `\n  Brand: ${brands}`;
    });
  } else {
    msg += lang === 'hi'
      ? `\n\n_इस रोग के लिए हमारे database में spray नहीं मिली।_\n_SPRAY लिखें general schedule के लिए।_`
      : `\n\n_No specific spray found in our database for this disease._\n_Type SPRAY for general schedule._`;
  }

  // Low confidence disclaimer
  if (diagnosis.confidence === 'low') {
    msg += lang === 'hi'
      ? `\n\n📌 _तस्वीर से पूरी तरह स्पष्ट नहीं है। नज़दीक से साफ तस्वीर भेजें या हorticulture officer से मिलें।_`
      : `\n\n📌 _Image was not very clear. Try a close-up photo or consult your horticulture officer._`;
  }

  msg += lang === 'hi'
    ? `\n\n_SPRAY लिखें full spray schedule के लिए।_`
    : `\n\n_Type SPRAY for your full spray schedule._`;

  return msg;
}

module.exports = { handleImageMessage };
