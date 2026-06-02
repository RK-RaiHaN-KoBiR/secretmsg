/* ============================================================
   api/user.js — User Management Endpoint (Vercel Serverless)
   ============================================================ */

const { readDB, writeDB, genId } = require('./database');

const BOT_TOKEN  = process.env.BOT_TOKEN  || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_ID   = process.env.ADMIN_ID   || '6048050987';
const TG_API     = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendTelegram(chatId, text, extra = {}) {
  try {
    await fetch(`${TG_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
    });
  } catch {}
}

function getBDTime() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
  const pad = n => String(n).padStart(2, '0');
  let h = now.getHours(), m = now.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} — ${pad(h)}:${pad(m)} ${ampm} BD Time`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.method === 'GET' ? req.query.action : (req.body && req.body.action);

  try {
    const db = await readDB();

    /* ---- CREATE NEW USER ---- */
    if (action === 'create') {
      const uid = db.meta.nextUID;
      db.meta.nextUID = uid + 1;
      db.users[uid] = {
        uid,
        banned: false,
        joinTime: getBDTime(),
        lastActive: getBDTime(),
        totalSent: 0,
        totalReceived: 0,
        notifEnabled: false,
        cleared: false,
      };
      await writeDB(db);
      return res.status(200).json({ ok: true, uid });
    }

    /* ---- CHECK BAN ---- */
    if (action === 'checkBan') {
      const uid = req.query.uid;
      const user = db.users[uid];
      if (!user) return res.status(200).json({ banned: false });
      return res.status(200).json({ banned: !!user.banned });
    }

    /* ---- NEW USER DEVICE INFO (POST) ---- */
    if (action === 'newUser' && req.method === 'POST') {
      const info = req.body.info || {};
      const uid = info.uid;
      if (db.users[uid]) {
        db.users[uid].lastActive = getBDTime();
        db.users[uid].deviceInfo = info;
        await writeDB(db);
      }
      // Notify admin bot
      const msg = `╔══════════════════════╗
🆕 <b>NEW USER JOINED!</b>
╚══════════════════════╝

📅 <b>Join Time & Date:</b>
${info.joinTime || getBDTime()}

🆔 <b>User ID:</b> ${uid}

📱 <b>Device Info:</b> ${info.deviceModel || 'Unknown'}

🔋 <b>Charging Status:</b> ${info.battery || 'Unknown'}

📶 <b>Network Info:</b> ${info.connection || 'Unknown'}

🌍 <b>IP Address:</b> ${info.ip || 'Unknown'}

🏙️ <b>Country:</b> ${info.country || 'Unknown'}

🏠 <b>Division:</b> ${info.region || 'Unknown'}

📍 <b>Zilla:</b> ${info.city || 'Unknown'}

🏡 <b>City/Village:</b> ${info.city || 'Unknown'}

📡 <b>ISP Provider:</b> ${info.isp || 'Unknown'}

📱 <b>Device Model:</b> ${info.deviceModel || 'Unknown'}

💾 <b>RAM:</b> ${info.ram || 'Unknown'}

🧠 <b>User Agent:</b>
<code>${(info.userAgent || '').slice(0, 200)}</code>`;
      await sendTelegram(ADMIN_ID, msg);
      return res.status(200).json({ ok: true });
    }

    /* ---- GET MESSAGES FOR USER ---- */
    if (action === 'getMessages') {
      const uid = String(req.query.uid);
      const since = parseInt(req.query.since || '0');
      // Get replies for this user
      const userReplies = (db.replies || []).filter(r =>
        String(r.toUID) === uid && !r.deleted && r.timestamp > since
      );
      // Get active broadcast
      const broadcasts = (db.broadcasts || []);
      const latestBroadcast = broadcasts.length ? broadcasts[broadcasts.length - 1] : null;
      // Update last active
      if (db.users[uid]) {
        db.users[uid].lastActive = getBDTime();
        db.users[uid].status = 'online';
        await writeDB(db);
      }
      return res.status(200).json({
        messages: userReplies.map(r => ({ id: r.id, text: r.text, time: r.time })),
        broadcast: latestBroadcast,
      });
    }

    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
};
