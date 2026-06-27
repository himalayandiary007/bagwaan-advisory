// Bagwaan — HP Apple Advisory Bot
// WhatsApp via Meta Cloud API (free tier — no Twilio needed)
//
// Message flow:
//   Farmer texts your WhatsApp number
//   → Meta sends JSON POST to /webhook on this server
//   → handleMessage() processes it
//   → We call Meta Graph API to send the reply
//
// Meta test mode: add up to 5 phone numbers to whitelist on Meta dashboard.
// No Business verification needed for testing — works immediately.

require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { handleMessage } = require('./bot/stateMachine');
const { handleImageMessage } = require('./bot/diseaseDetector');
const db = require('./db');

const app = express();
app.use(bodyParser.json());

const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;  // from Meta dashboard
const ACCESS_TOKEN    = process.env.META_ACCESS_TOKEN;     // temporary or permanent token
const VERIFY_TOKEN    = process.env.META_VERIFY_TOKEN;     // any string you choose

// ── Webhook Verification (one-time setup) ────────────────────────────────────
// When you enter your webhook URL in Meta dashboard, Meta sends a GET request
// to verify you own the server. This responds with the challenge to confirm it.
app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[META] Webhook verified');
    res.status(200).send(challenge);
  } else {
    console.error('[META] Webhook verification failed — check META_VERIFY_TOKEN in .env');
    res.sendStatus(403);
  }
});

// ── Incoming Messages ─────────────────────────────────────────────────────────
// Meta sends ALL events here: messages, delivery receipts, read receipts.
// We only care about text messages — everything else is ignored.
app.post('/webhook', async (req, res) => {
  // Always respond 200 immediately — Meta will retry if you don't
  res.status(200).send('OK');

  try {
    const body = req.body;

    // Validate it's a WhatsApp message event
    if (body.object !== 'whatsapp_business_account') return;

    const entry   = body.entry?.[0];
    const change  = entry?.changes?.[0];
    const value   = change?.value;

    // Ignore delivery/read status updates
    if (!value?.messages) return;

    const message = value.messages[0];

    const from = message.from;   // '919816001234' — no + prefix

    // ── Image message → disease detection ──────────────────────────────────
    if (message.type === 'image') {
      console.log(`[IMG] +${from}: image received`);

      // Look up farmer's language preference
      const { farmer } = await db.getOrCreateFarmer(from);
      const lang = farmer.language || 'hi';

      // Send acknowledgement immediately — Gemini takes 5-10 seconds
      await sendMessage(from, lang === 'hi'
        ? '🔍 तस्वीर मिली। रोग पहचान हो रही है... (10-15 सेकंड रुकें)'
        : '🔍 Image received. Analysing for disease... (please wait 10-15 seconds)'
      );

      const reply = await handleImageMessage(from, message, lang);
      if (reply) await sendMessage(from, reply);
      return;
    }

    // ── Voice notes / documents / other — politely decline ─────────────────
    if (message.type !== 'text') {
      await sendMessage(from, 'केवल text या photo भेजें। / Please send text or a photo only.');
      return;
    }

    // ── Text message → conversation state machine ───────────────────────────
    const msgText = message.text.body;
    console.log(`[IN]  +${from}: ${msgText}`);

    const reply = await handleMessage(from, msgText);
    if (reply) {
      await sendMessage(from, reply);
    }

  } catch (err) {
    // Log but never crash — Meta will retry on 5xx responses
    console.error('[ERROR] Webhook handler:', err.message);
  }
});

// ── Send Message via Meta Graph API ──────────────────────────────────────────
async function sendMessage(to, text) {
  const MAX_LENGTH = 4000; // WhatsApp allows 4096 chars
  const chunks = splitMessage(text, MAX_LENGTH);

  for (const chunk of chunks) {
    try {
      await axios.post(
        `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: chunk },
        },
        {
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log(`[OUT] +${to}: ${chunk.substring(0, 60)}...`);
    } catch (err) {
      const errData = err.response?.data?.error;
      if (errData) {
        console.error(`[META ERROR] ${errData.code}: ${errData.message}`);
      } else {
        console.error('[META ERROR]', err.message);
      }
      // Don't crash on send failure — log and continue
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
