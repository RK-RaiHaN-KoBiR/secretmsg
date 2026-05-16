// ===== USER API =====
const { readDB, writeDB, getBDTime, genId } = require('./database');
const { sendTelegramMessage } = require('../bot/webhook');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await readDB();

    if (req.method === 'GET') {
      const { action, userId } = req.query;

      if (action === 'checkBan') {
        const user = db.users[userId];
        return res.json({ banned: user ? user.banned : false });
      }

      return res.json({ ok: true });
    }

    if (req.method === 'POST') {
      const { action, userId, deviceInfo } = req.body;

      if (action === 'register') {
        db.meta.lastUserId = (db.meta.lastUserId || 1000) + 1;
        const newId = String(db.meta.lastUserId);
        const now = getBDTime();
        db.users[newId] = {
          id: newId, banned: false, bannedAt: null,
          registeredAt: now, lastActive: now,
          totalSent: 0, totalReceived: 0,
          notificationAllowed: false,
          deviceInfo: deviceInfo || {}
        };
        await writeDB(db);
        return res.json({ userId: newId });
      }

      if (action === 'newUserAlert') {
        const di = deviceInfo || {};
        const msg =
`╔══════════════════════╗
🆕 NEW USER JOINED!
╚══════════════════════╝

📅 Join Time & Date : ${di.timestamp || getBDTime()}

🆔 User ID : ${userId}

📱 Device Info : ${di.platform || 'Unknown'}

🔋 Charging Status : ${di.charging || 'Unknown'} ${di.batteryLevel || ''}

📶 Network Info : ${di.networkType || 'Unknown'}

🌍 IP Address : ${di.ip || 'Unknown'}

🏙️ Country : ${di.country || 'Unknown'}

🏠 Division : ${di.region || 'Unknown'}

📍 Zilla : ${di.region || 'Unknown'}

🏡 City / Village : ${di.city || 'Unknown'}

📡 ISP Provider : ${di.isp || 'Unknown'}

📱 Device Model : ${di.userAgent?.includes('Mobile')?'Mobile Device':'Desktop'}

💾 RAM / ROM : ${di.deviceMemory ? di.deviceMemory+'GB RAM':'Unknown'} / Unknown

🧠 User Agent :
${di.userAgent || 'Unknown'}`;

        await sendTelegramMessage(msg);
        return res.json({ ok: true });
      }

      if (action === 'updateActivity') {
        if (db.users[userId]) {
          db.users[userId].lastActive = getBDTime();
          await writeDB(db);
        }
        return res.json({ ok: true });
      }
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('User API Error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};
