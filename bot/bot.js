// bot/bot.js - Telegram Bot for Secret Message Box Admin
// Run: node bot/bot.js
// Install: npm install node-fetch

const BOT_TOKEN = process.env.BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_ID = process.env.ADMIN_ID || '6048050987';
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID || '6a048364250b1311c344cc10';
const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY || '$2a$10$dFJuDsfbDqqnkKBPh2bGMuHea6RJjPSU2bv67bkIM9GaJkypisWdW';
const SITE_URL = process.env.SITE_URL || 'https://cithipathao.vercel.app';

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// State for pending operations
const pendingReplies = {}; // { chatId: { userId, step } }
const pendingBroadcast = {}; // { chatId: true }
const pendingCaption = {}; // { chatId: { action, captionId } }
const pendingSend = {}; // { chatId: { step, userId, message } }

let offset = 0;

// ===== HELPERS =====
async function tgRequest(method, data = {}) {
  try {
    const r = await fetch(`${TG_API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return r.json();
  } catch(e) {
    console.error(`TG Error [${method}]:`, e.message);
    return null;
  }
}

async function sendMsg(chatId, text, extra = {}) {
  return tgRequest('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...extra
  });
}

function isAdmin(chatId) {
  return String(chatId) === String(ADMIN_ID);
}

// ===== DATABASE HELPERS =====
async function getDB() {
  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
    });
    const data = await r.json();
    return data.record || { users: {}, messages: [], replies: [], adminCaptions: [] };
  } catch(e) {
    return { users: {}, messages: [], replies: [], adminCaptions: [] };
  }
}

async function saveDB(db) {
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_MASTER_KEY
      },
      body: JSON.stringify(db)
    });
    return true;
  } catch(e) {
    return false;
  }
}

// ===== KEYBOARD =====
const adminKeyboard = {
  keyboard: [
    ['💌 Send', '📋 Show All Users'],
    ['📤 Reply History', '📥 Received History'],
    ['📢 Broadcast', '✍️ Caption Box'],
    ['❓ Help']
  ],
  resize_keyboard: true,
  persistent: true
};

// ===== SET COMMANDS =====
async function setCommands() {
  await tgRequest('setMyCommands', {
    commands: [
      { command: 'start', description: '🚀 Bot শুরু করুন' },
      { command: 'send', description: '💌 User কে message পাঠান' },
      { command: 'users', description: '👥 সকল User দেখুন' },
      { command: 'broadcast', description: '📢 সবাইকে message পাঠান' },
      { command: 'caption', description: '✍️ Caption manage করুন' },
      { command: 'replyhistory', description: '📤 Reply History' },
      { command: 'receivedhistory', description: '📥 Received Messages' },
      { command: 'help', description: '❓ Help দেখুন' }
    ]
  });
}

// ===== HANDLE COMMANDS =====
async function handleCommand(chatId, cmd, args) {
  if (!isAdmin(chatId)) {
    return sendMsg(chatId, '❌ আপনি admin নন! এই bot শুধু admin ব্যবহার করতে পারবেন।');
  }

  const db = await getDB();

  switch(cmd) {
    case '/start':
      return sendMsg(chatId, `
🌟 <b>Welcome Back To চিঠি পাঠাও!</b> 🌟

🌐 <b>Site:</b> ${SITE_URL}
👤 <b>Admin ID:</b> <code>${ADMIN_ID}</code>

📋 <b>All Commands:</b>
/send [userid] [message] - User কে message পাঠান
/users - সকল user দেখুন
/broadcast - সবাইকে broadcast করুন
/caption - Caption manage করুন
/replyhistory - Reply history দেখুন
/receivedhistory - সব received message দেখুন
/help - Help দেখুন

⌨️ নিচের keyboard থেকেও সব কাজ করতে পারবেন।
      `.trim(), { reply_markup: adminKeyboard });

    case '/send':
      if (args.length >= 2) {
        const userId = args[0];
        const message = args.slice(1).join(' ');
        await sendReplyToUser(chatId, userId, message, db);
      } else {
        pendingSend[chatId] = { step: 'userId' };
        return sendMsg(chatId, '🆔 User ID লিখুন:', {
          reply_markup: { force_reply: true }
        });
      }
      break;

    case '/users':
      return showAllUsers(chatId, db);

    case '/broadcast':
      pendingBroadcast[chatId] = true;
      return sendMsg(chatId, '📢 Broadcast message লিখুন (সবার কাছে যাবে):', {
        reply_markup: { force_reply: true }
      });

    case '/caption':
      return showCaptionMenu(chatId, db);

    case '/replyhistory':
      return showReplyHistory(chatId, db);

    case '/receivedhistory':
      return showReceivedHistory(chatId, db);

    case '/help':
      return showHelp(chatId);

    default:
      return sendMsg(chatId, '❓ Unknown command। /help দেখুন।', { reply_markup: adminKeyboard });
  }
}

// ===== SHOW ALL USERS =====
async function showAllUsers(chatId, db) {
  const users = db.users || {};
  const userIds = Object.keys(users);

  if (!userIds.length) return sendMsg(chatId, '👥 কোনো user নেই।');

  let text = `👥 <b>All Users (${userIds.length})</b>\n\n`;
  const buttons = [];

  userIds.slice(0, 30).forEach(uid => {
    const u = users[uid];
    const lastActive = u.lastActive || 'N/A';
    text += `🆔 <code>${uid}</code> | 📅 ${lastActive}\n`;
    buttons.push([{ text: `🆔 ${uid}`, callback_data: `user_info_${uid}` }]);
  });

  return sendMsg(chatId, text, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ===== USER INFO =====
async function showUserInfo(chatId, userId, db) {
  const u = (db.users || {})[userId];
  if (!u) return sendMsg(chatId, `❌ User ${userId} পাওয়া যায়নি।`);

  const di = u.deviceInfo || {};
  const userMsgs = (db.messages || []).filter(m => m.userId === userId);
  const userReplies = (db.replies || []).filter(r => r.userId === userId);

  const text = `
👤 <b>User Information</b>

🆔 <b>User ID:</b> <code>${userId}</code>
📅 <b>Join Time:</b> ${u.joinTime || 'N/A'}
📅 <b>Last Active:</b> ${u.lastActive || 'N/A'}
👤 <b>Name:</b> ${u.name || 'N/A'}
📱 <b>Phone:</b> ${u.phone || 'N/A'}
🔗 <b>FB:</b> ${u.fb || 'N/A'}

📱 <b>Device Model:</b> ${di.deviceModel || 'Unknown'}
🔋 <b>Charging:</b> ${di.charging || 'Unknown'}
📶 <b>Network:</b> ${di.network || 'Unknown'}
🌍 <b>IP:</b> ${di.ip || 'N/A'}
🏙️ <b>Country:</b> ${di.country || 'N/A'}
🏠 <b>Division:</b> ${di.region || 'N/A'}
📍 <b>Zilla:</b> N/A
🏡 <b>City/Village:</b> ${di.city || 'N/A'}
📡 <b>ISP:</b> ${di.isp || 'N/A'}
📱 <b>Platform:</b> ${di.platform || 'Unknown'}
💾 <b>RAM:</b> ${di.ram || 'Unknown'}
🧠 <b>User Agent:</b> ${(di.userAgent || '').substring(0, 150)}

📤 <b>Total Messages Sent:</b> ${userMsgs.length}
📥 <b>Total Replies Received:</b> ${userReplies.length}
🔔 <b>Notifications:</b> ${u.notifAllowed ? '✅ Allowed' : '❌ Not allowed'}
  `.trim();

  return sendMsg(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💌 Send Reply', callback_data: `reply_${userId}` }],
        [{ text: '📋 All Messages', callback_data: `user_msgs_${userId}` }],
        [{ text: '🔙 Back to Users', callback_data: 'show_users' }]
      ]
    }
  });
}

// ===== REPLY TO USER =====
async function sendReplyToUser(chatId, userId, message, db) {
  const replyId = Date.now().toString();
  const time = new Date().toLocaleString('bn-BD');

  if (!db.replies) db.replies = [];
  db.replies.push({
    id: replyId,
    userId,
    message,
    sentTime: time,
    seenByUser: false
  });

  await saveDB(db);

  await sendMsg(chatId, `
✅ <b>Reply Sent!</b>

🆔 <b>To User ID:</b> <code>${userId}</code>
📅 <b>Time:</b> ${time}
💬 <b>Message:</b> ${message}

⏳ Waiting for user to see your message...
  `.trim());
}

// ===== BROADCAST =====
async function sendBroadcast(chatId, message, db) {
  const users = db.users || {};
  const userIds = Object.keys(users);

  if (!userIds.length) return sendMsg(chatId, '❌ কোনো user নেই।');

  const replyId = Date.now().toString();
  const time = new Date().toLocaleString('bn-BD');

  if (!db.replies) db.replies = [];
  if (!db.broadcasts) db.broadcasts = [];

  db.broadcasts.push({ id: replyId, message, time, totalUsers: userIds.length });

  userIds.forEach(uid => {
    db.replies.push({
      id: `${replyId}_${uid}`,
      userId: uid,
      message: `📢 Admin Broadcast:\n\n${message}`,
      sentTime: time,
      seenByUser: false,
      isBroadcast: true
    });
  });

  await saveDB(db);

  await sendMsg(chatId, `
📢 <b>Broadcast Successfully Sent!</b>

📅 <b>Time:</b> ${time}
👥 <b>Total Users:</b> ${userIds.length}
💬 <b>Message:</b> ${message}
  `.trim(), { reply_markup: adminKeyboard });
}

// ===== CAPTION MENU =====
async function showCaptionMenu(chatId, db) {
  const caps = db.adminCaptions || [];

  let text = `✍️ <b>Caption Management</b>\n\nTotal: ${caps.length} captions\n\n`;

  const buttons = caps.slice(0, 20).map((cap, i) => {
    const preview = cap.text.substring(0, 30).replace(/\n/g, ' ');
    return [
      { text: `📝 ${preview}...`, callback_data: `cap_view_${i}` },
      { text: '✏️', callback_data: `cap_edit_${i}` },
      { text: '🗑️', callback_data: `cap_del_${i}` }
    ];
  });

  buttons.push([{ text: '➕ New Caption Add করুন', callback_data: 'cap_add' }]);

  return sendMsg(chatId, text || '✍️ <b>Caption Management</b>\n\nকোনো caption নেই।', {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ===== REPLY HISTORY =====
async function showReplyHistory(chatId, db) {
  const replies = (db.replies || []).slice(-20).reverse();
  if (!replies.length) return sendMsg(chatId, '📤 কোনো reply নেই।');

  let text = '📤 <b>Reply History (Last 20)</b>\n\n';
  replies.forEach((r, i) => {
    text += `${i + 1}. 🆔 ${r.userId} | 📅 ${r.sentTime}\n💬 ${r.message.substring(0, 50)}...\n\n`;
  });

  return sendMsg(chatId, text);
}

// ===== RECEIVED HISTORY =====
async function showReceivedHistory(chatId, db) {
  const msgs = (db.messages || []).slice(-20).reverse();
  if (!msgs.length) return sendMsg(chatId, '📥 কোনো message নেই।');

  let text = '📥 <b>Received Messages (Last 20)</b>\n\n';
  msgs.forEach((m, i) => {
    text += `${i + 1}. 🆔 ${m.userId} | 📅 ${m.time}\n💬 ${(m.message || '').substring(0, 50)}...\n\n`;
  });

  return sendMsg(chatId, text);
}

// ===== HELP =====
async function showHelp(chatId) {
  return sendMsg(chatId, `
❓ <b>Admin Help — চিঠি পাঠাও Bot</b>

📋 <b>Commands:</b>
/start - Bot শুরু করুন ও সব command দেখুন
/send [userid] [msg] - User কে direct message পাঠান
/users - সকল registered user দেখুন
/broadcast - সকল user কে একসাথে message পাঠান
/caption - Caption add, edit, delete করুন
/replyhistory - আপনার পাঠানো reply দেখুন
/receivedhistory - সকল received message দেখুন
/help - এই help message

⌨️ <b>Keyboard Buttons:</b>
উপরের keyboard থেকেও সব কাজ করতে পারবেন।

💌 <b>Reply করার উপায়:</b>
1. /send userid message
2. Message এর নিচে "💌 Send Reply" button এ click করুন

🌐 <b>Site:</b> ${SITE_URL}
  `.trim(), { reply_markup: adminKeyboard });
}

// ===== CALLBACK HANDLER =====
async function handleCallback(query) {
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const data = query.data;

  if (!isAdmin(chatId)) {
    return tgRequest('answerCallbackQuery', { callback_query_id: query.id, text: '❌ Admin only!' });
  }

  await tgRequest('answerCallbackQuery', { callback_query_id: query.id });

  const db = await getDB();

  if (data.startsWith('reply_')) {
    const userId = data.replace('reply_', '');
    pendingReplies[chatId] = { userId };
    return sendMsg(chatId, `💌 User <code>${userId}</code> কে reply লিখুন:`, {
      reply_markup: { force_reply: true }
    });
  }

  if (data.startsWith('user_info_')) {
    const userId = data.replace('user_info_', '');
    return showUserInfo(chatId, userId, db);
  }

  if (data.startsWith('user_msgs_')) {
    const userId = data.replace('user_msgs_', '');
    const msgs = (db.messages || []).filter(m => m.userId === userId).slice(-10).reverse();
    let text = `📋 <b>User ${userId} - All Messages (Last 10)</b>\n\n`;
    if (!msgs.length) text += 'কোনো message নেই।';
    msgs.forEach((m, i) => {
      text += `${i + 1}. 📅 ${m.time}\n💬 ${m.message}\n\n`;
    });
    return sendMsg(chatId, text, {
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Back', callback_data: `user_info_${userId}` }]]
      }
    });
  }

  if (data === 'show_users') return showAllUsers(chatId, db);

  if (data === 'cap_add') {
    pendingCaption[chatId] = { action: 'add' };
    return sendMsg(chatId, '✍️ নতুন Caption লিখুন:', { reply_markup: { force_reply: true } });
  }

  if (data.startsWith('cap_edit_')) {
    const i = parseInt(data.replace('cap_edit_', ''));
    pendingCaption[chatId] = { action: 'edit', captionId: i };
    return sendMsg(chatId, `✏️ Caption edit করুন:\n\n${(db.adminCaptions[i] || {}).text || ''}`, {
      reply_markup: { force_reply: true }
    });
  }

  if (data.startsWith('cap_del_')) {
    const i = parseInt(data.replace('cap_del_', ''));
    if (db.adminCaptions && db.adminCaptions[i]) {
      db.adminCaptions.splice(i, 1);
      await saveDB(db);
      return sendMsg(chatId, '✅ Caption deleted!');
    }
  }

  if (data.startsWith('cap_view_')) {
    const i = parseInt(data.replace('cap_view_', ''));
    const cap = (db.adminCaptions || [])[i];
    if (cap) {
      return sendMsg(chatId, `📝 Caption:\n\n${cap.text}\n\n📅 Added: ${cap.time}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✏️ Edit', callback_data: `cap_edit_${i}` }, { text: '🗑️ Delete', callback_data: `cap_del_${i}` }]
          ]
        }
      });
    }
  }
}

// ===== MESSAGE HANDLER =====
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  if (!isAdmin(chatId)) {
    return sendMsg(chatId, '❌ এই bot শুধু admin ব্যবহার করতে পারবেন।');
  }

  // Command check
  if (text.startsWith('/')) {
    const parts = text.split(' ');
    const cmd = parts[0].toLowerCase().split('@')[0];
    const args = parts.slice(1);
    return handleCommand(chatId, cmd, args);
  }

  const db = await getDB();

  // Keyboard text handlers
  if (text === '📋 Show All Users') return showAllUsers(chatId, db);
  if (text === '📤 Reply History') return showReplyHistory(chatId, db);
  if (text === '📥 Received History') return showReceivedHistory(chatId, db);
  if (text === '❓ Help') return showHelp(chatId);
  if (text === '✍️ Caption Box') return showCaptionMenu(chatId, db);

  if (text === '💌 Send') {
    pendingSend[chatId] = { step: 'userId' };
    return sendMsg(chatId, '🆔 User ID লিখুন:', { reply_markup: { force_reply: true } });
  }

  if (text === '📢 Broadcast') {
    pendingBroadcast[chatId] = true;
    return sendMsg(chatId, '📢 Broadcast message লিখুন:', { reply_markup: { force_reply: true } });
  }

  // Pending reply
  if (pendingReplies[chatId]) {
    const { userId } = pendingReplies[chatId];
    delete pendingReplies[chatId];
    return sendReplyToUser(chatId, userId, text, db);
  }

  // Pending broadcast
  if (pendingBroadcast[chatId]) {
    delete pendingBroadcast[chatId];
    return sendBroadcast(chatId, text, db);
  }

  // Pending send steps
  if (pendingSend[chatId]) {
    const state = pendingSend[chatId];
    if (state.step === 'userId') {
      pendingSend[chatId] = { step: 'message', userId: text };
      return sendMsg(chatId, `✅ User ID: ${text}\n\n💬 এখন message লিখুন:`, {
        reply_markup: { force_reply: true }
      });
    } else if (state.step === 'message') {
      const userId = state.userId;
      delete pendingSend[chatId];
      return sendReplyToUser(chatId, userId, text, db);
    }
  }

  // Pending caption
  if (pendingCaption[chatId]) {
    const state = pendingCaption[chatId];
    delete pendingCaption[chatId];
    const time = new Date().toLocaleString('bn-BD');

    if (!db.adminCaptions) db.adminCaptions = [];

    if (state.action === 'add') {
      db.adminCaptions.push({ text, time, addedBy: 'admin' });
      await saveDB(db);

      // Notify all users (via replies)
      const userIds = Object.keys(db.users || {});
      if (!db.replies) db.replies = [];
      const notifId = Date.now().toString();
      userIds.forEach(uid => {
        db.replies.push({
          id: `cap_notif_${notifId}_${uid}`,
          userId: uid,
          message: `✨ New Caption Added!\n\n${text}\n\n📅 Added: ${time}`,
          sentTime: time,
          seenByUser: false,
          isCaption: true
        });
      });
      await saveDB(db);

      return sendMsg(chatId, `✅ Caption Added!\n\nCaption: ${text}\nTime: ${time}\n\nSent notification to ${userIds.length} users.`, {
        reply_markup: adminKeyboard
      });
    } else if (state.action === 'edit' && state.captionId !== undefined) {
      if (db.adminCaptions[state.captionId]) {
        db.adminCaptions[state.captionId].text = text;
        db.adminCaptions[state.captionId].editedTime = time;
        await saveDB(db);
        return sendMsg(chatId, '✅ Caption Updated!', { reply_markup: adminKeyboard });
      }
    }
  }

  return sendMsg(chatId, '❓ কী করতে চান? /help দেখুন।', { reply_markup: adminKeyboard });
}

// ===== POLLING =====
async function poll() {
  try {
    const r = await fetch(`${TG_API}/getUpdates?offset=${offset}&timeout=25&allowed_updates=["message","callback_query"]`);
    const data = await r.json();

    if (data.ok && data.result && data.result.length) {
      for (const update of data.result) {
        offset = update.update_id + 1;

        if (update.message) {
          await handleMessage(update.message).catch(e => console.error('Message Error:', e));
        } else if (update.callback_query) {
          await handleCallback(update.callback_query).catch(e => console.error('Callback Error:', e));
        }
      }
    }
  } catch(e) {
    console.error('Poll Error:', e.message);
  }

  setTimeout(poll, 1000);
}

// ===== START =====
async function start() {
  console.log('🤖 Bot starting...');
  await setCommands();
  await sendMsg(ADMIN_ID, `
🚀 <b>Bot Started!</b>

🌐 Site: ${SITE_URL}
⏰ Time: ${new Date().toLocaleString()}

Type /help to see all commands.
  `.trim(), { reply_markup: adminKeyboard });

  console.log('✅ Bot started! Polling...');
  poll();
}

start();
