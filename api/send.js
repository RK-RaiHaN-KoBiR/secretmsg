/* ===== api/send.js — Vercel Serverless ===== */
const { readDB, writeDB, getBDTime } = require('./database');

const BOT_TOKEN = process.env.BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_ID  = process.env.ADMIN_ID  || '6048050987';
const TG_API    = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendTg(chatId, text, keyboard) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = keyboard;
  try {
    const r = await fetch(`${TG_API}/sendMessage`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    return await r.json();
  } catch(e) { return null; }
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
      const { uid, type, poll } = req.query;
      if (!uid) return res.json({ messages: [] });

      if (type === 'received') {
        const msgs = (db.receivedMessages || []).filter(m => m.uid === uid && !m.deleted);
        if (poll) {
          // Return only newest unseen message
          const userSeen = db.users[uid] ? (db.users[uid].seenMsgs || []) : [];
          const newMsg   = msgs.find(m => !userSeen.includes(m.msgId));
          // Check for broadcast
          const lastBC   = db.broadcasts && db.broadcasts.length ? db.broadcasts[db.broadcasts.length-1] : null;
          const bcKey    = uid + '_bc_' + (lastBC ? lastBC.id : '');
          const bcSeen   = db.users[uid] ? (db.users[uid].seenBroadcasts || []) : [];
          const newBC    = lastBC && !bcSeen.includes(lastBC.id) ? lastBC : null;
          // Check new caption
          const caps     = db.captions || [];
          const capSeen  = db.users[uid] ? (db.users[uid].seenCaptions || []) : [];
          const newCap   = caps.find(c => c.source === 'admin' && !capSeen.includes(c.id));
          return res.json({ newMessage: newMsg || null, broadcast: newBC || null, newCaption: newCap || null });
        }
        return res.json({ messages: msgs.reverse() });
      }

      // sent
      const msgs = (db.sentMessages || []).filter(m => m.uid === uid && !m.deleted);
      return res.json({ messages: msgs.reverse() });
    }

    // ── POST ─────────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body || {};
      const { action } = body;

      // MARK SEEN
      if (action === 'markSeen') {
        const { uid, msgId } = body;
        if (db.users[uid]) {
          if (!db.users[uid].seenMsgs) db.users[uid].seenMsgs = [];
          if (!db.users[uid].seenMsgs.includes(msgId)) {
            db.users[uid].seenMsgs.push(msgId);
            await writeDB(db);
            // Notify admin of seen
            const msg = (db.receivedMessages||[]).find(m => m.msgId === msgId);
            if (msg) {
              const seenReport = `╔══════════════════════╗\n👁️ <b>MESSAGE SEEN REPORT</b>\n╚══════════════════════╝\n\n🆔 UserID: <b>${uid}</b>\n📤 Reply Time: ${msg.replyTime||msg.time}\n👁️ Seen Time: ${getBDTime()}\n✅ User Seen Your Message`;
              await sendTg(ADMIN_ID, seenReport);
            }
          }
        }
        return res.json({ ok: true });
      }

      // SEND MESSAGE (user → admin)
      const { uid, name, whatsapp, fbLink, message, anonymous } = body;
      if (!message || !message.trim()) return res.json({ ok: false, error: 'Empty message' });

      if (!db.sentMessages) db.sentMessages = [];
      const msgId   = String(db.nextMsgId).padStart(3, '0');
      const time    = getBDTime();
      const user    = db.users[uid] || {};
      const ip      = req.headers['x-forwarded-for'] || '—';
      const ua      = user.ua || req.headers['user-agent'] || '—';

      db.sentMessages.push({ msgId, uid, name: name||'', whatsapp: whatsapp||'', fbLink: fbLink||'', message: message.trim(), time, anonymous: anonymous||false, deleted: false });
      db.nextMsgId = (db.nextMsgId || 1) + 1;
      if (db.users[uid]) { db.users[uid].totalSent = (db.users[uid].totalSent||0) + 1; db.users[uid].lastActive = time; db.users[uid].lastMsg = message.slice(0,50); }
      await writeDB(db);

      // Geo
      let country='—', division='—', zilla='—', city='—', isp='—';
      try {
        const geo = await fetch(`https://ipapi.co/${ip}/json/`);
        const gd  = await geo.json();
        country = gd.country_name||'—'; city = gd.city||'—'; isp = gd.org||'—';
        division = gd.region||'—'; zilla = gd.region_code||'—';
      } catch(e) {}

      const uName  = anonymous ? 'Unknown User' : (name || 'Hidden User');
      const notif  = `╔══════════════════════════════╗\n🔰 <b>New Message Received</b> 🔰\n╚══════════════════════════════╝\n\n🕒 <b>Send Time:</b> ${time}\n🆔 <b>User ID:</b> ${uid}\n👤 <b>User Name:</b> ${uName}\n📱 <b>Device Info:</b> ${user.deviceInfo||'—'}\n🌍 <b>IP Address:</b> ${ip}\n🏙️ <b>Country:</b> ${country}\n🏠 <b>Division:</b> ${division}\n📍 <b>Zilla:</b> ${zilla}\n🏡 <b>City:</b> ${city}\n📡 <b>ISP:</b> ${isp}\n🧠 <b>User Agent:</b>\n<code>${ua.slice(0,100)}</code>\n\n━━━━━━━━━━━━━━━━\n💌 <b>Message:</b>\n\n${message.trim()}\n━━━━━━━━━━━━━━━━\n\n🔘 Reply করার জন্য "Send Reply" বাটন ব্যবহার করুন।`;

      await sendTg(ADMIN_ID, notif, {
        inline_keyboard: [[
          { text: '✉️ Send Reply', callback_data: `reply_${uid}` }
        ]]
      });

      return res.json({ ok: true, msgId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch(e) {
    console.error('Send API error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
};
