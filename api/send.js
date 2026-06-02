/* ============================================================
   api/send.js — Message Send Endpoint (Vercel Serverless)
   ============================================================ */

const { readDB, writeDB, genId } = require('./database');

const BOT_TOKEN = process.env.BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_ID  = process.env.ADMIN_ID  || '6048050987';
const TG_API    = `https://api.telegram.org/bot${BOT_TOKEN}`;
const SITE_URL  = process.env.SITE_URL  || 'https://cithipathao.vercel.app';

function getBDTime() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
  const pad = n => String(n).padStart(2, '0');
  let h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${pad(h)}:${pad(m)} ${ampm} 🔸 ${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} BD Time`;
}

async function sendTelegram(chatId, text, extra = {}) {
  const res = await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
  });
  return res.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const body = req.body || {};
  const action = body.action;

  try {
    const db = await readDB();

    /* ---- SEND MESSAGE TO ADMIN ---- */
    if (action === 'send') {
      const { uid, msgId, text, name, wa, fb, time, anon, device, connection } = body;
      const user = db.users[String(uid)] || {};

      // Increment send count
      if (db.users[String(uid)]) {
        db.users[String(uid)].totalSent = (db.users[String(uid)].totalSent || 0) + 1;
        db.users[String(uid)].lastMsg = text.slice(0, 100);
        db.users[String(uid)].lastActive = getBDTime();
      }

      // Store message
      const msgRecord = {
        id: genId(),
        msgId,
        fromUID: uid,
        text,
        time,
        seen: false,
        deleted: false,
        timestamp: Date.now(),
        name, wa, fb, anon,
      };
      if (!db.messages) db.messages = [];
      db.messages.push(msgRecord);
      await writeDB(db);

      // Bot notification
      const botMsg = `╔══════════════════════════════╗
🔰 <b>𝗡𝗲𝘄 𝗠𝗲𝘀𝘀𝗮𝗴𝗲 𝗥𝗲𝗰𝗲𝗶𝘃𝗲𝗱 🔰</b>
╚══════════════════════════════╝

🕒 <b>Send Time &amp; Date:</b> ${time}

🆔 <b>User ID:</b> <code>${uid}</code>

👤 <b>User Name:</b> ${anon ? 'Anonymous 🎭' : (name || 'Unknown')}

📱 <b>WhatsApp:</b> ${anon ? 'Hidden' : (wa || 'Not Added')}

🔗 <b>FB Link:</b> ${anon ? 'Hidden' : (fb || 'Not Added')}

📲 <b>Device:</b> ${device || 'Unknown'}

📶 <b>Network:</b> ${connection || 'Unknown'}

━━━━━━━━━━━━━━━━━━━━━━━
💌 <b>Message:</b>

${text}
━━━━━━━━━━━━━━━━━━━━━━━

🔘 Reply করার জন্য নিচের "Send Reply" Button ব্যবহার করুন।`;

      // Inline reply button
      await sendTelegram(ADMIN_ID, botMsg, {
        reply_markup: {
          inline_keyboard: [[
            { text: '📩 Send Reply', callback_data: `reply_${uid}_${msgRecord.id}` }
          ]]
        }
      });

      return res.status(200).json({ ok: true, msgId });
    }

    /* ---- SEEN NOTIFICATION ---- */
    if (action === 'seen') {
      const { uid, msgId, seenTime } = body;
      // Find the reply this user saw
      const reply = (db.replies || []).find(r => String(r.toUID) === String(uid) && !r.seen);
      if (reply && !reply.seenReported) {
        reply.seen = true;
        reply.seenTime = seenTime;
        reply.seenReported = true;
        await writeDB(db);

        const seenMsg = `╔══════════════════════╗
👁️ <b>MESSAGE SEEN REPORT</b>
╚══════════════════════╝

🆔 <b>UserID:</b> <code>${uid}</code>

📤 <b>Reply Time:</b> ${reply.sentTime || '—'}

👁️ <b>Seen Time:</b> ${seenTime}

🔰 This User Seen Your Message ✅`;
        await sendTelegram(ADMIN_ID, seenMsg);
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
};
