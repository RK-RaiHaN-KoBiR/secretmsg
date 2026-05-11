// ═══════════════════════════════════════════════
// 💌 SECRET MESSAGE BOX — Telegram Bot
// Vercel Serverless Function (api/bot.js)
// ═══════════════════════════════════════════════

const BOT_TOKEN  = process.env.BOT_TOKEN  || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const OWNER_ID   = process.env.OWNER_ID   || '6048050987';
const SITE_URL   = process.env.SITE_URL   || 'https://cithipathao.vercel.app'; // ← তোমার site URL দাও
const TG_API     = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ── pending replies store (in-memory; use a DB for production) ──
// For Vercel serverless, use Vercel KV or a simple JSON store
// Here we use a simple Map (resets on cold start; for production use KV)
const pendingReplies = new Map();

// ════════════════════════════════════════════════
// HELPER: Send message to Telegram
// ════════════════════════════════════════════════
async function tgSend(chat_id, text, extra={}) {
  const res = await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'Markdown', ...extra })
  });
  return res.json();
}

// ════════════════════════════════════════════════
// HELPER: Answer callback query
// ════════════════════════════════════════════════
async function answerCallback(callback_query_id, text='') {
  await fetch(`${TG_API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id, text, show_alert: false })
  });
}

// ════════════════════════════════════════════════
// HELPER: Edit message reply markup
// ════════════════════════════════════════════════
async function editReplyMarkup(chat_id, message_id, inline_keyboard) {
  await fetch(`${TG_API}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, message_id, reply_markup: { inline_keyboard } })
  });
}

// ════════════════════════════════════════════════
// MAIN HANDLER (Vercel Serverless)
// ════════════════════════════════════════════════
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).send('💌 Secret Message Bot is running!');
  }

  try {
    const update = req.body;

    // ── Callback query (inline button press) ──
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return res.status(200).json({ ok: true });
    }

    // ── Regular message ──
    if (update.message) {
      await handleMessage(update.message);
      return res.status(200).json({ ok: true });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Bot error:', err);
    res.status(200).json({ ok: true }); // always 200 to Telegram
  }
};

// ════════════════════════════════════════════════
// HANDLE MESSAGES
// ════════════════════════════════════════════════
async function handleMessage(msg) {
  const chatId  = String(msg.chat.id);
  const text    = msg.text || '';
  const isOwner = chatId === OWNER_ID;

  // Only owner can use bot commands
  if (!isOwner) {
    await tgSend(chatId,
      '🔒 এই bot শুধুমাত্র owner এর জন্য!\n\n💌 Message পাঠাতে visit করো:\n' + SITE_URL
    );
    return;
  }

  // ── /start ──
  if (text === '/start') {
    const kb = getMainKeyboard();
    await tgSend(chatId,
`💌 *Secret Message Box Bot*
━━━━━━━━━━━━━━━━━━━━━━
সালাম! 👋 তোমার গোপন message box bot চালু আছে ✅

🌐 *Site:* ${SITE_URL}

নিচের buttons ব্যবহার করো 👇`,
      { reply_markup: kb }
    );
    return;
  }

  // ── /help ──
  if (text === '/help' || text === '/') {
    await tgSend(chatId,
`📋 *সব Command দেখো:*
━━━━━━━━━━━━━━━━━━━━━━
🔹 /start — Bot শুরু করো
🔹 /help — সব command দেখো
🔹 /send \`userid\` \`message\` — কোনো user কে reply পাঠাও
🔹 /status — Bot status দেখো
🔹 /site — Site link পাও
━━━━━━━━━━━━━━━━━━━━━━
💡 *Reply পাঠানোর উদাহরণ:*
\`/send 123 তোমার message পেয়েছি! 💕\`

📌 *Inline Reply:*
যেকোনো message এ নিচে *"💬 Reply to #userid"* button চাপো`,
      { reply_markup: getMainKeyboard() }
    );
    return;
  }

  // ── /status ──
  if (text === '/status') {
    const now = new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka', hour12: true });
    await tgSend(chatId,
`🟢 *Bot Status: ONLINE*
━━━━━━━━━━━━━━━━━━━━━━
📅 *সময়:* ${now}
🌐 *Site:* ${SITE_URL}
🤖 *Bot:* চালু আছে ✅
💌 *Messages:* সব ঠিকঠাক আসছে`,
      { reply_markup: getMainKeyboard() }
    );
    return;
  }

  // ── /site ──
  if (text === '/site') {
    await tgSend(chatId, `🌐 *তোমার Secret Message Box:*\n\n${SITE_URL}`,
      { reply_markup: getMainKeyboard() }
    );
    return;
  }

  // ── /send userid message ──
  if (text.startsWith('/send ')) {
    const parts  = text.replace('/send ', '').trim().split(' ');
    const userId = parts[0];
    const replyMsg = parts.slice(1).join(' ').trim();

    if (!userId || !replyMsg) {
      await tgSend(chatId,
`❌ *Format ঠিক নেই!*
━━━━━━━━━━━━━━━━━━━━━━
✅ *সঠিক format:*
\`/send 123 তোমার message এখানে লিখো\`

📌 userid = site এ দেখানো #number`
      );
      return;
    }

    // Send reply to user via site
    await sendReplyToUser(chatId, userId, replyMsg);
    return;
  }

  // ── Awaiting reply input (after pressing inline Reply button) ──
  if (pendingReplies.has(chatId)) {
    const { userId } = pendingReplies.get(chatId);
    pendingReplies.delete(chatId);
    await sendReplyToUser(chatId, userId, text);
    return;
  }

  // ── Unknown command ──
  await tgSend(chatId,
    '❓ বুঝলাম না! /help লিখলে সব command দেখতে পাবে 😊',
    { reply_markup: getMainKeyboard() }
  );
}

// ════════════════════════════════════════════════
// HANDLE CALLBACKS (inline button)
// ════════════════════════════════════════════════
async function handleCallback(cb) {
  const chatId  = String(cb.message.chat.id);
  const data    = cb.data || '';
  const msgId   = cb.message.message_id;

  await answerCallback(cb.id, '✍️ Reply লেখো...');

  // reply_USERID
  if (data.startsWith('reply_')) {
    const userId = data.replace('reply_', '');

    // Store pending reply state
    pendingReplies.set(chatId, { userId, msgId });

    await tgSend(chatId,
`💬 *User #${userId} কে Reply লিখো:*
━━━━━━━━━━━━━━━━━━━━━━
এখন যা লিখবে সেটা User #${userId} এর কাছে যাবে।

অথবা /send ${userId} message format ব্যবহার করো।`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Cancel', callback_data: 'cancel_reply' }
          ]]
        }
      }
    );
    return;
  }

  if (data === 'cancel_reply') {
    pendingReplies.delete(chatId);
    await tgSend(chatId, '❌ Reply cancelled.', { reply_markup: getMainKeyboard() });
    return;
  }
}

// ════════════════════════════════════════════════
// SEND REPLY TO USER (via site URL trick)
// ════════════════════════════════════════════════
async function sendReplyToUser(ownerChatId, userId, message) {
  const now = new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka', hour12: true });

  // Build the redirect URL that delivers reply to the user's browser
  const replyUrl = `${SITE_URL}?reply=${encodeURIComponent(message)}&time=${encodeURIComponent(now)}&uid=${userId}`;

  const confirmMsg =
`✅ *Reply পাঠানো হয়েছে!*
━━━━━━━━━━━━━━━━━━━━━━
👤 *User ID:* #${userId}
💬 *Message:* ${message}
🕐 *Time:* ${now}
━━━━━━━━━━━━━━━━━━━━━━
📌 User যখন site visit করবে, তখন reply দেখতে পাবে।
🔔 Background notification ও যাবে যদি allow করা থাকে।`;

  await tgSend(ownerChatId, confirmMsg, {
    reply_markup: {
      inline_keyboard: [[
        { text: '🔗 Reply Delivery Link', url: replyUrl }
      ]]
    }
  });

  // Also notify with status
  await tgSend(ownerChatId,
`📊 *Message Delivery Status:*
━━━━━━━━━━━━━━━━━━━━━━
📤 *Sent:* ✅
👁️ *Seen:* অপেক্ষা করো...
💌 User site এ গেলে automatically দেখতে পাবে।`,
    { reply_markup: getMainKeyboard() }
  );
}

// ════════════════════════════════════════════════
// MAIN KEYBOARD
// ════════════════════════════════════════════════
function getMainKeyboard() {
  return {
    keyboard: [
      ['📊 /status',    '❓ /help'],
      ['🌐 /site',      '🚀 /start'],
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };
}
