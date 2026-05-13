// api/bot.js - Telegram Bot + Reply Endpoint

const TELEGRAM_TOKEN = '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_CHAT_ID = '6048050987';
const JSONBIN_BIN_ID = '6a0165595d6c3911694c78bc';
const JSONBIN_KEY = '$2a$10$RcXzuT2PuYjBpDB1oL1SM.Qo3X2nQJrPlybj6gFmJEZot.wy8sUcm';
const JSONBIN_ACCESS = '$2a$10$JsBz0QBN/BL6kYnQxlchcOKyFGrxrW78.xTwcClsgwHu5OVFxrnFm';

const TG_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

async function tg(method, body) {
  const r = await fetch(`${TG_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

async function getDB() {
  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      headers: { 'X-Master-Key': JSONBIN_KEY, 'X-Access-Key': JSONBIN_ACCESS }
    });
    const d = await r.json();
    return d.record || { users: {}, replies: {}, pending_replies: {} };
  } catch(e) { return { users: {}, replies: {}, pending_replies: {} }; }
}

async function setDB(data) {
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

function isAdmin(chatId) {
  return String(chatId) === String(ADMIN_CHAT_ID);
}

async function handleBotUpdate(update, db) {
  const now = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });

  // ===== CALLBACK QUERY (inline button) =====
  if (update.callback_query) {
    const cb = update.callback_query;
    if (!isAdmin(cb.from.id)) {
      await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '❌ Admin only!' });
      return;
    }

    const data = cb.data;

    // Reply button clicked
    if (data.startsWith('reply_')) {
      const userId = data.replace('reply_', '');
      await tg('answerCallbackQuery', { callback_query_id: cb.id });
      await tg('sendMessage', {
        chat_id: cb.from.id,
        text: `✍️ *User ID:* \`${userId}\`\n\nReply করতে নিচের format এ পাঠান:\n\`/send ${userId} আপনার মেসেজ এখানে লিখুন\``,
        parse_mode: 'Markdown'
      });
      return;
    }

    // User ID clicked in list
    if (data.startsWith('info_')) {
      const userId = data.replace('info_', '');
      const user = db.users && db.users[userId];
      if (!user) {
        await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'User not found' });
        return;
      }
      const dev = user.device || {};
      const msg = `👤 *User Info: ${userId}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📅 *Last Active:* ${user.lastActive || 'Unknown'}\n` +
        `🆔 *User ID:* \`${userId}\`\n` +
        `📱 *Device:* ${dev.userAgent ? dev.userAgent.substring(0, 60) : 'Unknown'}\n` +
        `🔋 *Battery:* ${dev.charging || 'Unknown'} ${dev.chargeStatus || ''}\n` +
        `📶 *Network:* ${dev.online ? 'Online' : 'Offline'}\n` +
        `🌍 *IP:* \`${dev.ip || 'Unknown'}\`\n` +
        `🏙️ *Country:* ${dev.country || 'Unknown'}\n` +
        `🏠 *Division:* ${dev.region || 'Unknown'}\n` +
        `📍 *Zilla:* ${dev.city || 'Unknown'}\n` +
        `📡 *ISP:* ${dev.isp || 'Unknown'}\n` +
        `💾 *RAM:* ${dev.ram || 'Unknown'}\n` +
        `🧠 *User Agent:* \`${dev.userAgent ? dev.userAgent.substring(0, 100) : 'Unknown'}\`\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📅 *Join Time:* ${user.joinTime || 'Unknown'}`;

      await tg('answerCallbackQuery', { callback_query_id: cb.id });
      await tg('sendMessage', {
        chat_id: cb.from.id,
        text: msg,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '💬 Send Reply', callback_data: `reply_${userId}` }
          ]]
        }
      });
      return;
    }
  }

  // ===== MESSAGE =====
  if (!update.message) return;
  const msg = update.message;
  const chatId = msg.chat.id;
  const text = msg.text || '';

  // Only admin can use bot
  if (!isAdmin(chatId)) {
    await tg('sendMessage', {
      chat_id: chatId,
      text: '🔒 এই bot শুধু Admin ব্যবহার করতে পারবেন।'
    });
    return;
  }

  // ===== COMMANDS =====

  // /start
  if (text === '/start' || text.startsWith('/start')) {
    await tg('sendMessage', {
      chat_id: chatId,
      text: `🌟 *গোপন চিঠির বাক্স - Admin Panel*\n\n` +
        `স্বাগতম Admin! 👋\n\n` +
        `নিচের commands ব্যবহার করুন:`,
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: '❓ Help' }, { text: '📤 Send History' }],
          [{ text: '📥 Received History' }, { text: '👥 Show All Users' }],
          [{ text: '📢 Send To All' }]
        ],
        resize_keyboard: true
      }
    });
    return;
  }

  // /help or Help button
  if (text === '/help' || text === '❓ Help') {
    await tg('sendMessage', {
      chat_id: chatId,
      text: `📋 *সকল Commands:*\n\n` +
        `🔹 /start - Bot শুরু করুন\n` +
        `🔹 /help - এই help দেখুন\n` +
        `🔹 /users - সব user দেখুন\n` +
        `🔹 /send {userid} {msg} - নির্দিষ্ট user কে reply\n` +
        `🔹 /sendall {msg} - সবাইকে message পাঠান\n` +
        `🔹 /history - Message history\n` +
        `🔹 /recvhistory - Received history\n\n` +
        `💡 *উদাহরণ:*\n` +
        `\`/send AB12 হ্যালো! তোমার মেসেজ পেয়েছি।\``,
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: '❓ Help' }, { text: '📤 Send History' }],
          [{ text: '📥 Received History' }, { text: '👥 Show All Users' }],
          [{ text: '📢 Send To All' }]
        ],
        resize_keyboard: true
      }
    });
    return;
  }

  // /users or Show All Users button
  if (text === '/users' || text === '👥 Show All Users') {
    const users = db.users || {};
    const userIds = Object.keys(users);
    if (!userIds.length) {
      await tg('sendMessage', { chat_id: chatId, text: '📭 এখনো কোনো user নেই।' });
      return;
    }

    const inlineButtons = userIds.map(uid => [{
      text: `🆔 ${uid} — ${users[uid].device?.country || '?'} — ${users[uid].lastActive ? users[uid].lastActive.substring(0, 10) : '?'}`,
      callback_data: `info_${uid}`
    }]);

    await tg('sendMessage', {
      chat_id: chatId,
      text: `👥 *সকল Users (${userIds.length} জন):*\n\nUser ID তে click করলে বিস্তারিত দেখবেন:`,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineButtons }
    });
    return;
  }

  // /send userid message
  if (text.startsWith('/send ')) {
    const parts = text.split(' ');
    if (parts.length < 3) {
      await tg('sendMessage', {
        chat_id: chatId,
        text: '⚠️ Format: `/send {userid} {message}`',
        parse_mode: 'Markdown'
      });
      return;
    }
    const targetId = parts[1].toUpperCase();
    const replyMsg = parts.slice(2).join(' ');

    // Save reply to DB
    db.pending_replies = db.pending_replies || {};
    const replyId = Date.now().toString();
    db.pending_replies[targetId] = {
      msgId: replyId,
      message: replyMsg,
      timestamp: new Date().toISOString(),
      seen: false
    };
    await setDB(db);

    await tg('sendMessage', {
      chat_id: chatId,
      text: `✅ *Reply Sent!*\n\n🆔 *To User:* \`${targetId}\`\n📅 *Time:* ${now}\n\n💬 *Message:* ${replyMsg}\n\n⏳ _Wait For User Seen your Message..._`,
      parse_mode: 'Markdown'
    });
    return;
  }

  // /sendall or Send To All button
  if (text === '📢 Send To All' || text === '/sendall') {
    await tg('sendMessage', {
      chat_id: chatId,
      text: '📢 সবাইকে message পাঠাতে লিখুন:\n`/sendall আপনার message এখানে`',
      parse_mode: 'Markdown'
    });
    return;
  }

  if (text.startsWith('/sendall ')) {
    const broadcastMsg = text.replace('/sendall ', '');
    const users = db.users || {};
    const userIds = Object.keys(users);

    if (!userIds.length) {
      await tg('sendMessage', { chat_id: chatId, text: '📭 কোনো user নেই।' });
      return;
    }

    const replyId = Date.now().toString();
    db.pending_replies = db.pending_replies || {};
    userIds.forEach(uid => {
      db.pending_replies[uid] = {
        msgId: replyId + uid,
        message: broadcastMsg,
        timestamp: new Date().toISOString(),
        seen: false,
        broadcast: true
      };
    });
    await setDB(db);

    await tg('sendMessage', {
      chat_id: chatId,
      text: `✅ *Broadcast Sent!*\n\n👥 *Total Users:* ${userIds.length}\n📅 *Time:* ${now}\n\n💬 *Message:* ${broadcastMsg}`,
      parse_mode: 'Markdown'
    });
    return;
  }

  // /history or Send History button
  if (text === '/history' || text === '📤 Send History') {
    await tg('sendMessage', {
      chat_id: chatId,
      text: `📤 *Send History*\n\nWebsite থেকে পাঠানো messages bot এ দেখানো হচ্ছে।\nUser দের কাছ থেকে আসা সব message এখানে দেখুন।`,
      parse_mode: 'Markdown'
    });
    return;
  }

  // /recvhistory or Received History button
  if (text === '/recvhistory' || text === '📥 Received History') {
    const replies = db.pending_replies || {};
    const allReplies = Object.entries(replies);
    if (!allReplies.length) {
      await tg('sendMessage', { chat_id: chatId, text: '📭 কোনো reply history নেই।' });
      return;
    }
    const lines = allReplies.slice(-10).map(([uid, r]) =>
      `🆔 ${uid}: ${r.message.substring(0, 50)}... (${r.seen ? '✅ Seen' : '⏳ Unseen'})`
    ).join('\n');
    await tg('sendMessage', {
      chat_id: chatId,
      text: `📥 *Reply History (Last 10):*\n\n${lines}`,
      parse_mode: 'Markdown'
    });
    return;
  }

  // Default
  await tg('sendMessage', {
    chat_id: chatId,
    text: '❓ কমান্ড বুঝতে পারিনি। /help দেখুন।',
    reply_markup: {
      keyboard: [
        [{ text: '❓ Help' }, { text: '📤 Send History' }],
        [{ text: '📥 Received History' }, { text: '👥 Show All Users' }],
        [{ text: '📢 Send To All' }]
      ],
      resize_keyboard: true
    }
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = await getDB();

  // ===== GET: Check for pending replies for a user =====
  if (req.method === 'GET') {
    const { action, userId } = req.query;

    if (action === 'get_reply' && userId) {
      const pending = db.pending_replies && db.pending_replies[userId];
      if (pending && !pending.seen) {
        // Mark as seen
        db.pending_replies[userId].seen = true;
        db.pending_replies[userId].seenTime = new Date().toISOString();
        await setDB(db);

        // Notify admin bot
        try {
          await tg('sendMessage', {
            chat_id: ADMIN_CHAT_ID,
            text: `👁️ *Message Seen!*\n\n🆔 *User ID:* \`${userId}\`\n📅 *Seen Time:* ${new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' })}\n✅ Reply delivered successfully!`,
            parse_mode: 'Markdown'
          });
        } catch(e) {}

        return res.status(200).json({
          message: pending.message,
          msgId: pending.msgId,
          timestamp: pending.timestamp
        });
      }
      return res.status(200).json({});
    }

    return res.status(200).json({ ok: true });
  }

  // ===== POST: Telegram webhook =====
  if (req.method === 'POST') {
    try {
      const update = req.body;
      await handleBotUpdate(update, db);
      return res.status(200).json({ ok: true });
    } catch(e) {
      console.error(e);
      return res.status(500).json({ error: 'Internal error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
