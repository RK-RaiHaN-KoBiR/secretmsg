// api/alert.js — New User Alert (secure backend)
const ALERTED = new Set();

function sanitize(str) {
  if (!str) return '—';
  return String(str).replace(/[<>]/g, '').trim().slice(0, 500);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { uid, device } = req.body || {};
  if (!uid) return res.status(400).json({ ok: false });
  if (ALERTED.has(uid)) return res.status(200).json({ ok: true, skip: true });
  ALERTED.add(uid);

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const OWNER_ID  = process.env.OWNER_ID;
  if (!BOT_TOKEN || !OWNER_ID) return res.status(500).end();

  const dev = device || {};
  const now = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'medium', timeZone: 'Asia/Dhaka' });

  const text =
`🚨 নতুন User সাইটে এসেছে! 🚨

🆔 User ID  : #${sanitize(uid)}
⏰ সময়      : ${now}

📱 Model    : ${sanitize(dev.model)}
💻 OS       : ${sanitize(dev.os)}
🧠 RAM      : ${sanitize(dev.ram)}
🔋 Battery  : ${sanitize(dev.battery)} ${sanitize(dev.charging)}
🌐 IP       : ${sanitize(dev.ip)}
🌍 Country  : ${sanitize(dev.country)}
📍 Division : ${sanitize(dev.division)}
🏙 City     : ${sanitize(dev.city)}
📶 ISP      : ${sanitize(dev.isp)}
🕵️ UA       : ${sanitize((dev.ua || '').slice(0, 120))}

━━━━━━━━━━━━━━━━━━━━━━━
💬 Reply: /send ${sanitize(uid)} [message]`;

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: OWNER_ID, text })
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
};
