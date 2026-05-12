// ============================================================
// 🔐 API: /api/telegram-webhook
// Telegram Bot webhook — handles commands, sends replies
// Set webhook to: https://your-app.vercel.app/api/telegram-webhook
// ============================================================

const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const MASTER_KEY    = process.env.JSONBIN_MASTER_KEY;
const ACCESS_KEY    = process.env.JSONBIN_ACCESS_KEY;
const MESSAGES_BIN  = process.env.JSONBIN_MESSAGES_BIN_ID;
const REPLIES_BIN   = process.env.JSONBIN_REPLIES_BIN_ID;
const USERS_BIN     = process.env.JSONBIN_USERS_BIN_ID;

// ── Telegram API helper ───────────────────────────────────────
async function tgSend(chatId, text, extra = {}) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra })
  });
}

// ── JSONBIN helpers ───────────────────────────────────────────
async function getBinData(binId) {
  if (!binId) return {};
  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
      headers: { 'X-Master-Key': MASTER_KEY, 'X-Access-Key': ACCESS_KEY }
    });
    return r.ok ? ((await r.json()).record || {}) : {};
  } catch (_) { return {}; }
}

async function updateBinData(binId, data) {
  if (!binId) return;
  await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': MASTER_KEY, 'X-Access-Key': ACCESS_KEY },
    body: JSON.stringify(data)
  });
}

// ── Command Handlers ──────────────────────────────────────────
async function handleStart(chatId) {
  await tgSend(chatId, `
💌 <b>Secret Message Box Bot</b>

হ্যালো Admin! আপনার Secret Message Box Bot চালু আছে।

━━━━━━━━━━━━━━━━━━━

📋 <b>সব কমান্ড দেখুন:</b>
/allcmd

💬 <b>Reply পাঠান:</b>
/send [USERID] [MESSAGE]

━━━━━━━━━━━━━━━━━━━

🌸 সব Message এখানে আসবে।
`.trim(), {
    reply_markup: {
      keyboard: [
        [{ text: '❓ Help' }, { text: '📨 Send History' }],
        [{ text: '📥 Receive History' }, { text: '👥 Show All Users' }],
        [{ text: '📢 Send to All Users' }]
      ],
      resize_keyboard: true
    }
  });
}

async function handleHelp(chatId) {
  await tgSend(chatId, `
❓ <b>Help & Commands</b>

━━━━━━━━━━━━━━━━━━━

<b>/send [USERID] [MESSAGE]</b>
→ কোনো User কে Reply পাঠান

<b>/showusers</b>
→ সব User এর তালিকা

<b>/sendall [MESSAGE]</b>
→ সব User কে একসাথে Message

<b>/sendhistory</b>
→ পাঠানো সব Message

<b>/receivehistory</b>
→ পাওয়া সব Message

━━━━━━━━━━━━━━━━━━━
📌 Reply Format: /send 123 Hello there!
`.trim());
}

async function handleAllCmd(chatId) {
  await tgSend(chatId, `
📋 <b>All Commands</b>

━━━━━━━━━━━━━━━━━━━

/start — Bot শুরু করুন
/help — সাহায্য দেখুন
/allcmd — সব কমান্ড
/send — User কে Reply
/showusers — সব User
/sendall — সবাইকে Message
/sendhistory — Sent Messages
/receivehistory — Received Messages

━━━━━━━━━━━━━━━━━━━

⌨️ নিচের Keyboard থেকেও ব্যবহার করুন।
`.trim());
}

async function handleSendReply(chatId, userId, message) {
  if (!userId || !message) {
    return tgSend(chatId, '⚠️ Format: /send [USERID] [MESSAGE]\n\nExample: /send 123 Hello!');
  }

  const replyId = Date.now().toString(36).toUpperCase();
  const now     = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });

  // Store in JSONBIN replies bin
  if (REPLIES_BIN) {
    const record = await getBinData(REPLIES_BIN);
    if (!record.replies) record.replies = [];
    record.replies.push({
      id: replyId,
      userId,
      message,
      time: now,
      seen: false,
      sentAt: new Date().toISOString()
    });
    if (record.replies.length > 1000) record.replies = record.replies.slice(-1000);
    await updateBinData(REPLIES_BIN, record);
  }

  await tgSend(chatId, `
✅ <b>Reply Sent!</b>

━━━━━━━━━━━━━━━━━━━

🆔 <b>User ID:</b> <code>${userId}</code>
💌 <b>Message:</b> ${message}
🕒 <b>Time:</b> ${now}

━━━━━━━━━━━━━━━━━━━
👀 Waiting for user to see...
`.trim());
}

async function handleShowUsers(chatId) {
  const record = await getBinData(USERS_BIN);
  const users  = record.users || [];
  if (!users.length) {
    return tgSend(chatId, '📭 এখনো কোনো User নেই।');
  }
  const list = users.slice(0, 20).map((u, i) =>
    `${i + 1}. 🆔 <code>${u.userId}</code> | 🌍 ${u.country || '?'} | 📱 ${u.device || '?'} | 🕒 ${u.time || '?'}`
  ).join('\n');

  await tgSend(chatId, `
👥 <b>All Users (Last 20)</b>

━━━━━━━━━━━━━━━━━━━

${list}

━━━━━━━━━━━━━━━━━━━
📊 Total: <b>${users.length}</b> users
`.trim());
}

async function handleSendAll(chatId, message) {
  if (!message) return tgSend(chatId, '⚠️ Format: /sendall [MESSAGE]');

  const record = await getBinData(USERS_BIN);
  const users  = (record.users || []).map(u => u.userId);
  if (!users.length) return tgSend(chatId, '📭 No users found.');

  const now = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });
  const repliesRecord = await getBinData(REPLIES_BIN);
  if (!repliesRecord.replies) repliesRecord.replies = [];

  let count = 0;
  for (const uid of users) {
    const replyId = `${Date.now().toString(36)}_${uid}`.toUpperCase();
    repliesRecord.replies.push({ id: replyId, userId: uid, message, time: now, seen: false, isBroadcast: true });
    count++;
  }
  if (repliesRecord.replies.length > 2000) repliesRecord.replies = repliesRecord.replies.slice(-2000);
  await updateBinData(REPLIES_BIN, repliesRecord);

  await tgSend(chatId, `📢 <b>Broadcast Sent!</b>\n\n✅ ${count} জন User কে Message পাঠানো হয়েছে।\n💌 Message: ${message}`);
}

async function handleSendHistory(chatId) {
  const record   = await getBinData(MESSAGES_BIN);
  const messages = (record.messages || []).slice(0, 10);
  if (!messages.length) return tgSend(chatId, '📭 No send history.');

  const list = messages.map((m, i) =>
    `${i + 1}. 🆔 <code>${m.userId}</code> | 👤 ${m.name} | 🕒 ${m.time}\n    💬 ${m.message.substring(0, 60)}...`
  ).join('\n\n');

  await tgSend(chatId, `📨 <b>Send History (Last 10)</b>\n\n━━━━━━━━━━\n${list}`);
}

async function handleReceiveHistory(chatId) {
  const record  = await getBinData(REPLIES_BIN);
  const replies = (record.replies || []).slice(-10).reverse();
  if (!replies.length) return tgSend(chatId, '📭 No receive history.');

  const list = replies.map((r, i) =>
    `${i + 1}. 🆔 <code>${r.userId}</code> | ${r.seen ? '👀 Seen' : '📬 Unseen'} | 🕒 ${r.time}\n    💌 ${r.message.substring(0, 60)}`
  ).join('\n\n');

  await tgSend(chatId, `📥 <b>Receive History (Last 10)</b>\n\n━━━━━━━━━━\n${list}`);
}

// ── Main Handler ──────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('OK');

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { return res.status(200).send('OK'); }
  }

  const msg      = body?.message;
  const callback = body?.callback_query;

  if (callback) {
    const cbChatId = callback.message?.chat?.id;
    if (String(cbChatId) !== String(ADMIN_CHAT_ID)) return res.status(200).send('OK');
    // Handle inline keyboard callbacks
    if (callback.data === 'reply_mode') {
      await tgSend(cbChatId, '💬 Reply format:\n/send [USERID] [YOUR MESSAGE]\n\nExample: /send 123 Hello there!');
    }
    return res.status(200).send('OK');
  }

  if (!msg) return res.status(200).send('OK');

  const chatId = msg.chat?.id;
  const text   = msg.text?.trim() || '';

  // Security: only respond to admin
  if (String(chatId) !== String(ADMIN_CHAT_ID)) {
    await tgSend(chatId, '🚫 Access Denied. This bot is private.');
    return res.status(200).send('OK');
  }

  // Parse command
  const [cmd, ...args] = text.split(' ');

  switch (cmd.toLowerCase()) {
    case '/start':
      await handleStart(chatId);
      break;

    case '/help':
    case '❓ help':
      await handleHelp(chatId);
      break;

    case '/allcmd':
      await handleAllCmd(chatId);
      break;

    case '/send':
      await handleSendReply(chatId, args[0], args.slice(1).join(' '));
      break;

    case '/showusers':
    case '👥 show all users':
      await handleShowUsers(chatId);
      break;

    case '/sendall':
    case '📢 send to all users':
      await handleSendAll(chatId, args.join(' ') || text.replace(/^📢 send to all users\s*/i, '').trim());
      break;

    case '/sendhistory':
    case '📨 send history':
      await handleSendHistory(chatId);
      break;

    case '/receivehistory':
    case '📥 receive history':
      await handleReceiveHistory(chatId);
      break;

    default:
      await tgSend(chatId, '❓ Unknown command. Type /allcmd to see all commands.');
  }

  return res.status(200).send('OK');
}
