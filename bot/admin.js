/* ============================================================
   bot/admin.js — Admin Utility Functions
   ============================================================ */

'use strict';

const BOT_TOKEN = process.env.BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_ID  = parseInt(process.env.ADMIN_ID || '6048050987');
const TG_API    = `https://api.telegram.org/bot${BOT_TOKEN}`;

/* ─── BD Time helper ─── */
function getBDTime() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
  const pad = n => String(n).padStart(2, '0');
  let h = now.getHours(), m = now.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${pad(h)}:${pad(m)} ${ampm} 🔸 ${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} BD Time`;
}

/* ─── Send message to any chat ─── */
async function send(chatId, text, extra = {}) {
  try {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
    });
    return res.json();
  } catch (e) {
    console.error('admin.send error:', e.message);
  }
}

/* ─── Notify admin of new user ─── */
async function notifyNewUser(info) {
  const text = `╔══════════════════════╗
🆕 <b>NEW USER JOINED!</b>
╚══════════════════════╝

📅 <b>Join Time &amp; Date:</b>
${info.joinTime || getBDTime()}

🆔 <b>User ID:</b> <code>${info.uid}</code>

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

  return send(ADMIN_ID, text);
}

/* ─── Notify admin of new message ─── */
async function notifyNewMessage({ uid, msgId, text, name, wa, fb, anon, device, connection, time }) {
  const msg = `╔══════════════════════════════╗
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

  return send(ADMIN_ID, msg, {
    reply_markup: {
      inline_keyboard: [[
        { text: '📩 Send Reply', callback_data: `reply_${uid}_${msgId}` },
      ]],
    },
  });
}

/* ─── Notify admin of seen ─── */
async function notifyMessageSeen({ uid, replyTime, seenTime }) {
  const text = `╔══════════════════════╗
👁️ <b>MESSAGE SEEN REPORT</b>
╚══════════════════════╝

🆔 <b>UserID:</b> <code>${uid}</code>

📤 <b>Reply Time:</b> ${replyTime || '—'}

👁️ <b>Seen Time:</b> ${seenTime}

🔰 This User Seen Your Message ✅`;
  return send(ADMIN_ID, text);
}

/* ─── Notify admin of new caption ─── */
async function notifyNewCaption({ uid, captionNum, text, time }) {
  const msg = `🚨 <b>Alert: New Caption Added!</b>

📌 <b>Caption Number:</b> ${String(captionNum).padStart(2,'0')}

🆔 <b>Caption Added By User:</b> <code>${uid}</code>

💬 <b>Caption:</b>
${text}

🕒 <b>Added Time &amp; Date:</b>
${time}`;
  return send(ADMIN_ID, msg);
}

/* ─── Notify admin of broadcast seen ─── */
async function notifyBroadcastSeen({ uid, seenTime, sendTime, deviceInfo = {} }) {
  const text = `👁️ <b>User:</b> [<code>${uid}</code>]
Seen Your Broadcast Message!

🕒 <b>Seen Time:</b>
${seenTime}

📤 <b>Broadcast Send Time:</b>
${sendTime}

📱 <b>Device Info:</b> ${deviceInfo.deviceModel || 'Unknown'}
🔋 <b>Charging:</b> ${deviceInfo.battery || 'Unknown'}
📶 <b>Network:</b> ${deviceInfo.connection || 'Unknown'}
🌍 <b>IP:</b> ${deviceInfo.ip || 'Unknown'}
🏙️ <b>Country:</b> ${deviceInfo.country || 'Unknown'}`;

  return send(ADMIN_ID, text, {
    reply_markup: {
      inline_keyboard: [[{ text: '📩 Reply User', callback_data: `reply_${uid}_broadcast` }]],
    },
  });
}

/* ─── Check if sender is admin ─── */
function isAdmin(fromId) {
  return parseInt(fromId) === ADMIN_ID;
}

module.exports = {
  send,
  notifyNewUser,
  notifyNewMessage,
  notifyMessageSeen,
  notifyNewCaption,
  notifyBroadcastSeen,
  isAdmin,
  ADMIN_ID,
  TG_API,
  getBDTime,
};
