// ============================================================
// 🔐 API: /api/track-user
// Fires when a new user visits for the first time
// ============================================================

const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const MASTER_KEY    = process.env.JSONBIN_MASTER_KEY;
const ACCESS_KEY    = process.env.JSONBIN_ACCESS_KEY;
const USERS_BIN_ID  = process.env.JSONBIN_USERS_BIN_ID;

async function getGeoInfo(ip) {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!res.ok) return {};
    return await res.json();
  } catch (_) { return {}; }
}

function parseUA(ua) {
  if (!ua) return { device: 'Unknown', os: 'Unknown', browser: 'Unknown' };
  let device = 'Desktop';
  let os = 'Unknown';
  let browser = 'Unknown';
  if (/android/i.test(ua)) { device = 'Android Phone'; os = 'Android'; }
  else if (/iphone/i.test(ua)) { device = 'iPhone'; os = 'iOS'; }
  else if (/ipad/i.test(ua)) { device = 'iPad'; os = 'iPadOS'; }
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edg/i.test(ua)) browser = 'Edge';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';
  return { device, os, browser };
}

async function storeUser(userRecord) {
  if (!USERS_BIN_ID) return;
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${USERS_BIN_ID}/latest`, {
      headers: { 'X-Master-Key': MASTER_KEY, 'X-Access-Key': ACCESS_KEY }
    });
    const data = res.ok ? (await res.json()).record || { users: [] } : { users: [] };
    if (!data.users) data.users = [];
    // Check not already stored
    if (!data.users.find(u => u.userId === userRecord.userId)) {
      data.users.unshift(userRecord);
      if (data.users.length > 1000) data.users = data.users.slice(0, 1000);
      await fetch(`https://api.jsonbin.io/v3/b/${USERS_BIN_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': MASTER_KEY, 'X-Access-Key': ACCESS_KEY },
        body: JSON.stringify(data)
      });
    }
  } catch (_) {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { return res.status(400).json({ error: 'Bad JSON' }); }
  }

  const { userId, timestamp } = body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const ip  = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ua  = req.headers['user-agent'] || 'Unknown';
  const { device, os, browser } = parseUA(ua);
  const geo = await getGeoInfo(ip);
  const now = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });

  const tgText = `
🚨 <b>NEW USER JOINED!</b>

━━━━━━━━━━━━━━━━━━━

🕒 <b>Time:</b> ${now}
🆔 <b>User ID:</b> <code>${userId}</code>

🌐 <b>IP Address:</b> <code>${ip || 'Hidden'}</code>
🌍 <b>Country:</b> ${geo.country_name || 'Unknown'}
🏙 <b>City:</b> ${geo.city || 'Unknown'}
📍 <b>Region:</b> ${geo.region || 'Unknown'}
📡 <b>ISP:</b> ${geo.org || 'Unknown'}

━━━━━━━━━━━━━━━━━━━

📱 <b>Device:</b> ${device}
💻 <b>OS:</b> ${os}
🌐 <b>Browser:</b> ${browser}
🧠 <b>UA:</b> <code>${ua.substring(0, 100)}</code>

━━━━━━━━━━━━━━━━━━━

💡 Send message: /send ${userId} Hello!
`.trim();

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: tgText, parse_mode: 'HTML' })
    });

    await storeUser({ userId, ip, country: geo.country_name, city: geo.city, device, os, browser, time: now });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' });
  }
}
