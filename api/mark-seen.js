// api/mark-seen.js
const BOT_TOKEN = process.env.BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_ID = process.env.ADMIN_ID || '6048050987';
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID || '6a048364250b1311c344cc10';
const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY || '$2a$10$dFJuDsfbDqqnkKBPh2bGMuHea6RJjPSU2bv67bkIM9GaJkypisWdW';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, replyId, time } = req.body;

  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
    });
    const data = await r.json();
    const db = data.record || {};

    // Mark reply as seen
    if (db.replies) {
      const rep = db.replies.find(r => r.id === replyId && r.userId === userId);
      if (rep) {
        rep.seenByUser = true;
        rep.seenTime = time;

        // Save back
        await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': JSONBIN_MASTER_KEY
          },
          body: JSON.stringify(db)
        });

        // Notify admin
        const userInfo = (db.users || {})[userId] || {};
        const seenMsg = `
👁️ <b>User Seen Your Message!</b>

🆔 <b>User ID:</b> <code>${userId}</code>
📅 <b>Reply Time:</b> ${rep.sentTime || 'N/A'}
👁️ <b>Seen Time:</b> ${time}

📱 <b>Device:</b> ${(userInfo.deviceInfo || {}).deviceModel || 'Unknown'}
🌍 <b>IP:</b> ${(userInfo.deviceInfo || {}).ip || 'N/A'}
        `.trim();

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: ADMIN_ID,
            text: seenMsg,
            parse_mode: 'HTML'
          })
        });
      }
    }

    return res.status(200).json({ ok: true });
  } catch(e) {
    return res.status(500).json({ error: 'Internal error' });
  }
}
