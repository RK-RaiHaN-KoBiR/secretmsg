/* ===== api/user.js — Vercel Serverless ===== */
const { readDB, writeDB, getBDTime } = require('./database');

const BOT_TOKEN = process.env.BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_ID  = process.env.ADMIN_ID  || '6048050987';
const TG_API    = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendTg(chatId, text, keyboard) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = keyboard;
  try {
    await fetch(`${TG_API}/sendMessage`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
  } catch(e) {}
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await readDB();

    // ── GET ──────────────────────────────────────────
    if (req.method === 'GET') {
      const { action, uid } = req.query;

      if (action === 'checkban') {
        const user = db.users[uid];
        return res.json({ banned: user ? user.banned === true : false });
      }

      if (action === 'profile') {
        const user = db.users[uid] || {};
        return res.json({
          name: user.name || '',
          whatsapp: user.whatsapp || '',
          fbLink: user.fbLink || '',
          totalSent: user.totalSent || 0,
          totalReceived: user.totalReceived || 0,
          notifAllowed: user.notifAllowed || false
        });
      }

      if (action === 'allusers') {
        const list = Object.entries(db.users).map(([id, u]) => ({
          userId: id,
          name: u.name || 'Hidden User',
          banned: u.banned || false,
          totalSent: u.totalSent || 0,
          totalReceived: u.totalReceived || 0,
          registeredDate: u.registeredDate || '',
          lastActive: u.lastActive || '',
          device: u.device || '',
          country: u.country || '',
          notifAllowed: u.notifAllowed || false
        }));
        return res.json({ users: list });
      }

      return res.json({ error: 'Unknown action' });
    }

    // ── POST ─────────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body || {};
      const { action } = body;

      // REGISTER NEW USER
      if (action === 'register') {
        // Collect device/ip info from headers
        const ip      = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '—';
        const ua      = req.headers['user-agent'] || '—';
        const uid     = String(db.nextUserId);
        const regTime = getBDTime();

        // Detect device type from UA
        let deviceInfo = 'Unknown Device';
        if (/android/i.test(ua)) deviceInfo = 'Android Device';
        else if (/iphone|ipad/i.test(ua)) deviceInfo = 'iOS Device';
        else if (/windows/i.test(ua)) deviceInfo = 'Windows PC';
        else if (/mac/i.test(ua)) deviceInfo = 'Mac Device';
        else if (/linux/i.test(ua)) deviceInfo = 'Linux Device';

        db.users[uid] = {
          userId: uid,
          ip, ua, deviceInfo,
          registeredDate: regTime,
          lastActive: regTime,
          totalSent: 0,
          totalReceived: 0,
          banned: false,
          name: '', whatsapp: '', fbLink: '',
          notifAllowed: false
        };
        db.nextUserId = Math.min(db.nextUserId + 1, 9999);

        // Try geo lookup
        let country = '—', division = '—', zilla = '—', city = '—', isp = '—';
        try {
          const geo = await fetch(`https://ipapi.co/${ip}/json/`);
          const gd  = await geo.json();
          country   = gd.country_name || '—';
          city      = gd.city || '—';
          isp       = gd.org || '—';
        } catch(e) {}

        await writeDB(db);

        // Send new user notification to admin
        const notif = `╔══════════════════════╗\n🆕 <b>NEW USER JOINED!</b>\n╚══════════════════════╝\n\n📅 <b>Join Time:</b> ${regTime}\n🆔 <b>User ID:</b> ${uid}\n📱 <b>Device:</b> ${deviceInfo}\n🌍 <b>IP:</b> ${ip}\n🏙️ <b>Country:</b> ${country}\n🏡 <b>City:</b> ${city}\n📡 <b>ISP:</b> ${isp}\n🧠 <b>User Agent:</b> <code>${ua.slice(0,120)}</code>`;
        await sendTg(ADMIN_ID, notif);

        return res.json({ ok: true, userId: uid, registeredDate: regTime });
      }

      // UPDATE PROFILE
      if (action === 'updateProfile') {
        const { uid, name, whatsapp, fbLink } = body;
        if (!db.users[uid]) return res.json({ ok: false, error: 'User not found' });
        db.users[uid].name     = name     || '';
        db.users[uid].whatsapp = whatsapp || '';
        db.users[uid].fbLink   = fbLink   || '';
        db.users[uid].lastActive = getBDTime();
        await writeDB(db);
        return res.json({ ok: true });
      }

      // UPDATE NOTIFICATION STATUS
      if (action === 'updateNotif') {
        const { uid, notifAllowed } = body;
        if (db.users[uid]) { db.users[uid].notifAllowed = notifAllowed; await writeDB(db); }
        return res.json({ ok: true });
      }

      return res.json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch(e) {
    console.error('User API error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
};
