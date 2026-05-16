// ===== BROADCAST API =====
const { readDB, writeDB, getBDTime, genId, invalidateCache } = require('./database');
const { sendTelegramMessage } = require('../bot/webhook');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await readDB();

    if (req.method === 'POST') {
      const { action, message, userId, broadcastId, deviceInfo } = req.body;

      if (action === 'send') {
        const now = getBDTime();
        const id = genId();
        db.broadcast = { id, message, time: now, seenBy: [] };
        await writeDB(db);
        invalidateCache();

        const userCount = Object.keys(db.users || {}).length;
        const report =
`✅ Broadcast Successfully Sent To Website All Users!

🕒 Send Time : ${now}

👥 Total Users: ${userCount}`;
        await sendTelegramMessage(report);
        return res.json({ success: true });
      }

      if (action === 'seen') {
        if (db.broadcast && db.broadcast.id === broadcastId) {
          if (!db.broadcast.seenBy) db.broadcast.seenBy = [];
          if (!db.broadcast.seenBy.includes(userId)) {
            db.broadcast.seenBy.push(userId);
            await writeDB(db);

            const di = deviceInfo || {};
            const seenReport =
`👁️ User : [${userId}]
Seen Your Broadcast Message!

🕒 Seen Time :
${getBDTime()}

📤 Broadcast Send Time :
${db.broadcast.time}

🆔 User ID : ${userId}
📱 Device Info : ${di.platform || 'Unknown'}
📶 Network Info : ${di.networkType || 'Unknown'}`;
            await sendTelegramMessage(seenReport);
          }
        }
        return res.json({ ok: true });
      }
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('Broadcast API Error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};
