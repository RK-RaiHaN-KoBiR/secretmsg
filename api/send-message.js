// ============================================================
// 🔐 API: /api/send-message
// Receives message, stores in JSONBIN, alerts Telegram
// ALL sensitive keys are in env vars — never exposed to client
// ============================================================

const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const MASTER_KEY    = process.env.JSONBIN_MASTER_KEY;
const ACCESS_KEY    = process.env.JSONBIN_ACCESS_KEY;
const BIN_ID        = process.env.JSONBIN_MESSAGES_BIN_ID;

// Simple in-memory rate limiter (resets on cold start — fine for serverless)
const rateLimiter = new Map();
const RATE_LIMIT   = parseInt(process.env.RATE_LIMIT_MAX || '10');
const RATE_WINDOW  = 60 * 1000; // 1 minute

function checkRateLimit(ip) {
  const now = Date.now();
  const key  = ip || 'unknown';
  if (!rateLimiter.has(key)) {
    rateLimiter.set(key, { count: 1, start: now });
    return true;
  }
  const entry = rateLimiter.get(key);
  if (now - entry.start > RATE_WINDOW) {
    rateLimiter.set(key, { count: 1, start: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── JSONBIN helpers ──────────────────────────────────────────
async function getBin() {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
    headers: {
      'X-Master-Key': MASTER_KEY,
      'X-Access-Key': ACCESS_KEY
    }
  });
  if (!res.ok) return { messages: [] };
  const data = await res.json();
  return data.record || { messages: [] };
}

async function updateBin(record) {
  await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': MASTER_KEY,
      'X-Access-Key': ACCESS_KEY
    },
    body: JSON.stringify(record)
  });
}

// ── Telegram sender ───────────────────────────────────────────
async function sendTelegram(text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: ADMIN_CHAT_ID,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '💬 Reply', callback_data: 'reply_mode' },
          { text: '📨 Send Reply', callback_data: 'send_reply' }
        ]]
      }
    })
  });
}

// ── IP Geolocation ────────────────────────────────────────────
async function getGeoInfo(ip) {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!res.ok) return {};
    return await res.json();
  } catch (_) { return {}; }
}

// ── Get device info from User-Agent (basic) ──────────────────
function parseUA(ua) {
  if (!ua) return { device: 'Unknown', os: 'Unknown' };
  let device = 'Desktop';
  let os = 'Unknown';
  if (/android/i.test(ua)) { device = 'Android'; os = 'Android'; }
  else if (/iphone|ipad/i.test(ua)) { device = 'iOS'; os = 'iOS'; }
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  return { device, os };
}

// ── Handler ───────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limiting
  const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { return res.status(400).json({ error: 'Invalid JSON' }); }
  }

  const { userId, name, phone, fb, message, isAnonymous, timestamp } = body || {};

  // Validation
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  if (message.trim().length > 1000) {
    return res.status(400).json({ error: 'Message too long (max 1000 chars).' });
  }
  if (!userId) return res.status(400).json({ error: 'User ID missing.' });

  // Sanitize
  const safeMsg  = message.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeName = (name || 'Unknown').replace(/</g, '&lt;').slice(0, 60);
  const safePhone = (phone || 'Not provided').slice(0, 20);
  const safeFb   = (fb || 'Not provided').slice(0, 150);
  const ua       = req.headers['user-agent'] || 'Unknown';
  const { device, os } = parseUA(ua);
  const now      = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });
  const msgId    = Date.now().toString(36).toUpperCase();

  // Geo info
  const geo = await getGeoInfo(clientIp);

  // Build Telegram message
  const tgText = `
╔════════════════════════╗
📨 <b>NEW SECRET MESSAGE RECEIVED</b>
╚════════════════════════╝

🕒 <b>Time:</b> ${now}
🆔 <b>User ID:</b> <code>${userId}</code>
📌 <b>Msg ID:</b> <code>${msgId}</code>

━━━━━━━━━━━━━━━━━━━

👤 <b>Name:</b> ${safeName}
📞 <b>Phone:</b> ${safePhone}
🔗 <b>FB ID:</b> ${safeFb}
🕶 <b>Anonymous:</b> ${isAnonymous ? 'Yes 🕶' : 'No'}

━━━━━━━━━━━━━━━━━━━

🌐 <b>IP Address:</b> <code>${clientIp || 'Hidden'}</code>
🌍 <b>Country:</b> ${geo.country_name || 'Unknown'}
🏙 <b>City:</b> ${geo.city || 'Unknown'}
📍 <b>Region:</b> ${geo.region || 'Unknown'}
📡 <b>ISP:</b> ${geo.org || 'Unknown'}

━━━━━━━━━━━━━━━━━━━

📱 <b>Device:</b> ${device} | ${os}
🧠 <b>User-Agent:</b> <code>${ua.substring(0, 120)}</code>

━━━━━━━━━━━━━━━━━━━

💌 <b>MESSAGE:</b>
┌──────────────────────┐
${safeMsg}
└──────────────────────┘

📤 Reply: /send ${userId} [your message]
`.trim();

  try {
    // Send to Telegram
    await sendTelegram(tgText);

    // Store in JSONBIN
    if (BIN_ID) {
      const record = await getBin();
      if (!record.messages) record.messages = [];
      record.messages.unshift({
        id: msgId,
        userId,
        name: safeName,
        phone: safePhone,
        fb: safeFb,
        message: safeMsg,
        isAnonymous: !!isAnonymous,
        ip: clientIp,
        country: geo.country_name || '',
        city: geo.city || '',
        device, os,
        time: now,
        timestamp,
        status: 'sent',
        reply: null,
        replySeen: false
      });
      // Keep last 500 messages
      if (record.messages.length > 500) record.messages = record.messages.slice(0, 500);
      await updateBin(record);
    }

    return res.status(200).json({ success: true, msgId });
  } catch (err) {
    console.error('send-message error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
