// api/new-user.js
const BOT_TOKEN = process.env.BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_ID = process.env.ADMIN_ID || '6048050987';
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID || '6a048364250b1311c344cc10';
const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY || '$2a$10$dFJuDsfbDqqnkKBPh2bGMuHea6RJjPSU2bv67bkIM9GaJkypisWdW';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, time, deviceInfo } = req.body;

  try {
    // Save user to DB
    const r = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
    });
    const data = await r.json();
    const db = data.record || { users: {}, messages: [], replies: [] };

    if (!db.users) db.users = {};

    // Only alert if truly new
    const isNew = !db.users[userId];

    db.users[userId] = {
      joinTime: time,
      lastActive: time,
      deviceInfo
    };

    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_MASTER_KEY
      },
      body: JSON.stringify(db)
    });

    if (isNew) {
      const di = deviceInfo || {};
      const alertMsg = `
🆕 <b>New User Alert!</b>

📅 <b>Join Time:</b> ${time}
🆔 <b>User ID:</b> <code>${userId}</code>
📱 <b>Device:</b> ${di.deviceModel || 'Unknown'}
🔋 <b>Charging:</b> ${di.charging || 'Unknown'}
📶 <b>Network:</b> ${di.network || 'Unknown'}
🌍 <b>IP:</b> ${di.ip || 'N/A'}
🏙️ <b>Country:</b> ${di.country || 'N/A'}
🏠 <b>Region:</b> ${di.region || 'N/A'}
📍 <b>City:</b> ${di.city || 'N/A'}
📡 <b>ISP:</b> ${di.isp || 'N/A'}
💾 <b>RAM:</b> ${di.ram || 'Unknown'}
🧠 <b>Agent:</b> ${(di.userAgent || '').substring(0, 100)}
      `.trim();

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_ID,
          text: alertMsg,
          parse_mode: 'HTML'
        })
      });
    }

    return res.status(200).json({ ok: true, isNew });
  } catch(e) {
    return res.status(500).json({ error: 'Internal error' });
  }
}
