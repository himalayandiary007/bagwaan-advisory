// Bagwaan — HP Apple Advisory Bot
// WhatsApp via Interakt API (14-day free trial for POC)
// Long-term: switch to Meta Cloud API once Meta account restriction is resolved
//
// Message flow:
//   Farmer texts your Interakt WhatsApp number
//   → Interakt sends JSON POST to /webhook on this server
//   → handleMessage() processes it
//   → We call Interakt API to send the reply

require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { handleMessage } = require('./bot/stateMachine');
const { handleImageMessage } = require('./bot/diseaseDetector');
const db = require('./db');

const app = express();
app.use(bodyParser.json());

const INTERAKT_API_KEY = process.env.INTERAKT_API_KEY;  // from Interakt dashboard → Settings → Developer

// ── Incoming Messages from Interakt ──────────────────────────────────────────
// Interakt sends POST to /webhook when farmer texts your WhatsApp number.
// No GET verification needed (unlike Meta Cloud API).
app.post('/webhook', async (req, res) => {
  // Always respond 200 immediately — Interakt retries on failure
  res.status(200).send('OK');

  try {
    const body = req.body;

    // Interakt wraps everything in { type: 'message', data: { ... } }
    if (body.type !== 'message') return;

    const data = body.data;
    if (!data || !data.sender) return;

    const from = data.sender.phone;  // '919816001234' — no + prefix
    if (!from) return;

    const msgType = data.type;  // 'Text', 'Image', 'Audio', 'Document', etc.

    // ── Image message → disease detection ──────────────────────────────────
    if (msgType === 'Image') {
      console.log(`[IMG] +${from}: image received`);

      const { farmer } = await db.getOrCreateFarmer(from);
      const lang = farmer.language || 'hi';

      await sendMessage(from, lang === 'hi'
        ? '🔍 तस्वीर मिली। रोग पहचान हो रही है... (10-15 सेकंड रुकें)'
        : '🔍 Image received. Analysing for disease... (please wait 10-15 seconds)'
      );

      // Pass the full data object — diseaseDetector extracts the media URL from it
      const reply = await handleImageMessage(from, data, lang);
      if (reply) await sendMessage(from, reply);
      return;
    }

    // ── Voice notes / docs / other — politely decline ──────────────────────
    if (msgType !== 'Text') {
      await sendMessage(from, 'केवल text या photo भेजें। / Please send text or a photo only.');
      return;
    }

    // ── Text message → conversation state machine ───────────────────────────
    const msgText = data.message;
    if (!msgText) return;

    console.log(`[IN]  +${from}: ${msgText}`);

    const reply = await handleMessage(from, msgText);
    if (reply) await sendMessage(from, reply);

  } catch (err) {
    console.error('[ERROR] Webhook handler:', err.message);
  }
});

// ── Send Message via Interakt API ─────────────────────────────────────────────
async function sendMessage(to, text) {
  const MAX_LENGTH = 4000;
  const chunks = splitMessage(text, MAX_LENGTH);

  for (const chunk of chunks) {
    try {
      await axios.post(
        'https://api.interakt.ai/v1/public/message/',
        {
          userId: to,
          fullPhoneNumber: to,
          callbackData: 'bagwaan_reply',
          type: 'Text',
          data: { message: chunk },
        },
        {
          headers: {
            // Interakt uses Basic auth: base64(api_key + ':')
            Authorization: `Basic ${Buffer.from(INTERAKT_API_KEY + ':').toString('base64')}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log(`[OUT] +${to}: ${chunk.substring(0, 60)}...`);
    } catch (err) {
      const errData = err.response?.data;
      console.error('[INTERAKT ERROR]', errData ? JSON.stringify(errData) : err.message);
    }

    if (chunks.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

function splitMessage(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let current = '';
  for (const line of text.split('\n')) {
    if ((current + '\n' + line).length > maxLen) {
      if (current) chunks.push(current.trim());
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'Bagwaan Advisory Bot', time: new Date().toISOString() });
});

// ── Keep-Alive ping endpoint ──────────────────────────────────────────────────
// Render.com free tier spins down after 15 min of inactivity.
// UptimeRobot (free) pings /ping every 5 minutes to keep the server awake.
app.get('/ping', (req, res) => res.send('pong'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bagwaan Advisory Bot running on port ${PORT}`);
  console.log(`Webhook: POST /webhook`);
  console.log(`Health:  GET  /health`);
});
