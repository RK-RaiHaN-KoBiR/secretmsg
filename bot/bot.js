// ===== CHITHI PATHAO — TELEGRAM BOT =====
const { readDB, writeDB, getBDTime, genId, invalidateCache } = require('../api/database');
const { sendTelegramMessage, answerCallbackQuery, ADMIN_ID, TG_API, BOT_TOKEN } = require('./webhook');

// Admin state machine for multi-step commands
const adminState = {};

// ===== MAIN BOT HANDLER =====
async function handleUpdate(update) {
  if (update.callback_query) return handleCallback(update.callback_query);

  const msg = update.message;
  if (!msg) return;

  const chatId = String(msg.chat.id);
  const text = (msg.text || '').trim();
  const isAdmin = chatId === String(ADMIN_ID);

  if (!isAdmin) {
    await sendTelegramMessage('🚫 Access Denied. This bot is for admin only.', chatId);
    return;
  }

  // Check if admin is in a state
  const state = adminState[chatId];
  if (state) {
    await handleAdminState(chatId, text, state);
    return;
  }

  // Commands & keyboard
  if (text === '/start' || text === '🏠 Start') return cmdStart(chatId);
  if (text === '/help' || text === '🆘 Help') return cmdHelp(chatId);
  if (text === '📨 Send Message' || text === '/send') return initSend(chatId);
  if (text === '📥 Received History' || text === '/received') return cmdReceivedHistory(chatId);
  if (text === '📤 Reply History' || text === '/replyhistory') return cmdReplyHistory(chatId);
  if (text === '👥 Show All User' || text === '/users') return cmdShowUsers(chatId);
  if (text === '📢 Broadcast' || text === '/broadcast') return initBroadcast(chatId);
  if (text === '📝 Caption BOX' || text === '/caption') return cmdCaptionBox(chatId);

  // /send userid message
  if (text.startsWith('/send ')) {
    const parts = text.split(' ');
    if (parts.length >= 3) {
      const uid = parts[1];
      const replyMsg = parts.slice(2).join(' ');
      await sendReplyToUser(chatId, uid, replyMsg);
    } else {
      await sendTelegramMessage('Usage: /send <userId> <message>', chatId);
    }
    return;
  }

  if (text.startsWith('/ban ')) {
    const uid = text.split(' ')[1];
    await banUser(chatId, uid, true);
    return;
  }
  if (text.startsWith('/unban ')) {
    const uid = text.split(' ')[1];
    await banUser(chatId, uid, false);
    return;
  }
  if (text.startsWith('/info ')) {
    const uid = text.split(' ')[1];
    await cmdViewUserInfo(chatId, uid);
    return;
  }

  await sendTelegramMessage('❓ Unknown command. Use /help to see all commands.', chatId);
}

// ===== STATE MACHINE =====
async function handleAdminState(chatId, text, state) {
  if (state.step === 'await_send_uid') {
    adminState[chatId] = { step: 'await_send_msg', userId: text.trim() };
    await sendTelegramMessage('💌 Enter Your Message:', chatId);
    return;
  }

  if (state.step === 'await_send_msg') {
    await sendReplyToUser(chatId, state.userId, text);
    delete adminState[chatId];
    return;
  }

  if (state.step === 'await_broadcast') {
    await sendBroadcast(chatId, text);
    delete adminState[chatId];
    return;
  }

  if (state.step === 'await_caption') {
    await addAdminCaption(chatId, text);
    delete adminState[chatId];
    return;
  }

  if (state.step === 'await_caption_edit') {
    await editAdminCaption(chatId, state.captionId, text);
    delete adminState[chatId];
    return;
  }

  if (state.step === 'await_reply_uid') {
    adminState[chatId] = { step: 'await_reply_inline_msg', userId: state.userId, origMsgId: state.origMsgId };
    await sendTelegramMessage(`💌 Enter reply for User ${state.userId}:`, chatId);
    return;
  }

  if (state.step === 'await_reply_inline_msg') {
    await sendReplyToUser(chatId, state.userId, text);
    delete adminState[chatId];
    return;
  }

  delete adminState[chatId];
}

// ===== COMMANDS =====
async function cmdStart(chatId) {
  const msg =
`╔══════════════════════╗
💌 Welcome Back To
চিঠি পাঠাও
╚══════════════════════╝

✨ Anonymous Messaging Platform

📌 Available Features:
🔘 Send Message
🔘 Receive Reply
🔘 Push Notification
🔘 Live Popup Message
🔘 Instant Reply System
🔘 Broadcast Notification
🔘 Caption System

━━━━━━━━━━━━━━━━━━━━━━━

📌 Available Commands:
/send — Send message to user
/received — View received messages
/replyhistory — View sent replies
/users — Show all registered users
/broadcast — Send broadcast
/caption — Manage captions
/help — Help menu`;

  await sendTelegramMessage(msg, chatId);
  await sendKeyboard(chatId);
}

async function cmdHelp(chatId) {
  const msg =
`╔══════════════════════╗
🤖 BOT HELP & COMMAND MENU
╚══════════════════════╝

📌 Available Commands:

/start → Open Welcome Menu
/send &lt;uid&gt; &lt;msg&gt; → Send Reply To User
/received → View Received Messages
/replyhistory → View Sent Replies History
/users → Show All Registered Users
/broadcast → Send Broadcast Notification
/caption → Manage Website Captions
/help → Open Help Menu
/ban &lt;uid&gt; → Ban Any User
/unban &lt;uid&gt; → Unban Any User
/info &lt;uid&gt; → View User Information

━━━━━━━━━━━━━━━━━━━━━━━

📌 Keyboard Buttons:
📨 Send Message
📥 Received History
📤 Reply History
👥 Show All User
📢 Broadcast
📝 Caption BOX
🆘 Help`;
  await sendTelegramMessage(msg, chatId);
}

function initSend(chatId) {
  adminState[chatId] = { step: 'await_send_uid' };
  return sendTelegramMessage('🆔 Enter User ID:', chatId);
}

async function sendReplyToUser(adminChatId, targetUserId, message) {
  try {
    const db = await readDB();
    if (!db.users[targetUserId]) {
      await sendTelegramMessage(`❌ User ID ${targetUserId} not found!`, adminChatId);
      return;
    }

    const now = getBDTime();
    const reply = {
      id: genId(), targetUserId, message, time: now,
      sentAt: now, seenAt: null, deleted: false
    };
    db.replies = db.replies || [];
    db.replies.push(reply);

    if (db.users[targetUserId]) {
      db.users[targetUserId].totalReceived = (db.users[targetUserId].totalReceived || 0) + 1;
    }

    await writeDB(db);
    invalidateCache();

    const report =
`╔══════════════════════╗
📤 REPLY STATUS REPORT
╚══════════════════════╝

✅ Reply Sent To UserID : ${targetUserId}

🕒 Time & Date :
${now}

⏳ Status :
Wait For User Seen Your Message!`;
    await sendTelegramMessage(report, adminChatId);
  } catch (e) {
    await sendTelegramMessage(`❌ Error: ${e.message}`, adminChatId);
  }
}

async function cmdReceivedHistory(chatId) {
  const db = await readDB();
  const msgs = (db.messages || []).slice(-20).reverse();
  if (msgs.length === 0) {
    await sendTelegramMessage('📭 No messages received yet.', chatId);
    return;
  }
  for (const m of msgs.slice(0, 10)) {
    const card =
`┌────────────────────────┐
Msg ID: ${m.id.slice(0, 6)}
│ User ID: ${m.userId}
│ Message: ${m.message.substring(0, 200)}
│ Received Time: ${m.time}
└────────────────────────┘`;
    await fetch(`${TG_API}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId, text: card,
        reply_markup: {
          inline_keyboard: [[
            { text: '💬 Reply', callback_data: `reply_${m.userId}_${m.id}` },
            { text: '🗑️ Delete', callback_data: `delete_msg_${m.id}` }
          ]]
        }
      })
    });
  }
}

async function cmdReplyHistory(chatId) {
  const db = await readDB();
  const replies = (db.replies || []).slice(-20).reverse();
  if (replies.length === 0) {
    await sendTelegramMessage('📭 No replies sent yet.', chatId);
    return;
  }
  for (const r of replies.slice(0, 10)) {
    const card =
`┌────────────────────────┐
Msg ID: ${r.id.slice(0, 6)}
│ User ID: ${r.targetUserId}
│ Message: ${r.message.substring(0, 200)}
│ Send Time: ${r.time}
└────────────────────────┘`;
    await fetch(`${TG_API}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId, text: card,
        reply_markup: {
          inline_keyboard: [[
            { text: '🗑️ Delete', callback_data: `delete_reply_${r.id}` }
          ]]
        }
      })
    });
  }
}

async function cmdShowUsers(chatId) {
  const db = await readDB();
  const users = Object.values(db.users || {});
  if (users.length === 0) {
    await sendTelegramMessage('👥 No registered users yet.', chatId);
    return;
  }
  const header =
`╔══════════════════════════════╗
👥 REGISTERED USER ID LIST
╚══════════════════════════════╝`;
  await sendTelegramMessage(header, chatId);

  let i = 1;
  for (const u of users.slice(0, 20)) {
    const card = `━━━━━━━━━━━━━━━━━━\n🔢 Number : ${i}\n🆔 User ID : ${u.id}`;
    await fetch(`${TG_API}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId, text: card,
        reply_markup: {
          inline_keyboard: [[
            { text: '🔘 View User Info', callback_data: `view_user_${u.id}` },
            { text: '🚫 Ban', callback_data: `ban_${u.id}` },
            { text: '✅ Unban', callback_data: `unban_${u.id}` }
          ]]
        }
      })
    });
    i++;
  }
}

async function cmdViewUserInfo(chatId, uid) {
  const db = await readDB();
  const u = db.users[uid];
  if (!u) { await sendTelegramMessage(`❌ User ${uid} not found.`, chatId); return; }
  const di = u.deviceInfo || {};
  const info =
`━━━━━━━━━━━━━━━━━━━━━━━
🔰 USER PROFILE INFORMATION 🔰
━━━━━━━━━━━━━━━━━━━━━━━

🆔 User ID            : ${u.id}

👤 Full Name          : ${u.profile?.name || 'Not Set'}

📱 Phone Number       : ${u.profile?.wa || 'Not Set'}

🔗 FB Profile         : ${u.profile?.fb || 'Not Added'}

🌍 Location           : ${di.city || 'Unknown'}, ${di.country || 'Unknown'}

📶 Network            : ${di.networkType || 'Unknown'}

📱 Device             : ${di.platform || 'Unknown'}

🧠 Browser            : ${(di.userAgent || '').split(' ').slice(-1)[0] || 'Unknown'}

🔔 Notification       : ${u.notificationAllowed ? 'Allowed !' : 'Not Allowed'}

💌 Total Sent         : ${u.totalSent || 0}

📥 Total Received     : ${u.totalReceived || 0}

🟢 Active Status      : ${u.lastActive ? 'Recently Active' : 'Unknown'}

🔴 User Status        : ${u.banned ? '🚫 BANNED' : '✅ Unbanned'}

📅 Account Created    : ${u.registeredAt || '—'}

🕒 Last Active        : ${u.lastActive || '—'}

💬 LAST MESSAGE:
${u.lastMessage || 'No message yet.'}

━━━━━━━━━━━━━━━━━━━━━━━`;
  await sendTelegramMessage(info, chatId);
}

function initBroadcast(chatId) {
  adminState[chatId] = { step: 'await_broadcast' };
  return sendTelegramMessage('📢 Enter Broadcast Message:', chatId);
}

async function sendBroadcast(chatId, message) {
  try {
    const res = await fetch(
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000') + '/api/broadcast',
      {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', message })
      }
    );
    await res.json();
    await sendTelegramMessage(`✅ Broadcast sent to all users!\n🕒 ${getBDTime()}`, chatId);
  } catch (e) {
    await sendTelegramMessage(`❌ Broadcast failed: ${e.message}`, chatId);
  }
}

async function cmdCaptionBox(chatId) {
  const db = await readDB();
  const caps = (db.captions || []).filter(c => c.addedBy === 'admin');

  const header =
`╔══════════════════════╗
📝 Bot CAPTION LIST
╚══════════════════════╝`;
  await sendTelegramMessage(header, chatId);

  if (caps.length === 0) {
    await sendTelegramMessage('📭 No admin captions yet.', chatId);
  } else {
    for (const c of caps) {
      const card = `━━━━━━━━━━━━━━━━━━\n📌 Caption Text :\n"${c.text}"\n\n🕒 Added Time :\n${c.time}`;
      await fetch(`${TG_API}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId, text: card,
          reply_markup: {
            inline_keyboard: [[
              { text: '✏️ Edit', callback_data: `caption_edit_${c.id}` },
              { text: '🗑️ Delete', callback_data: `caption_delete_${c.id}` }
            ]]
          }
        })
      });
    }
  }

  await fetch(`${TG_API}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId, text: '➕ Add New Caption:',
      reply_markup: {
        inline_keyboard: [[{ text: '➕ Add New Caption', callback_data: 'caption_add' }]]
      }
    })
  });
}

async function addAdminCaption(chatId, text) {
  try {
    const db = await readDB();
    const now = getBDTime();
    const adminCaps = (db.captions || []).filter(c => c.addedBy === 'admin');
    const newCap = {
      id: genId(), text, addedBy: 'admin',
      number: String(adminCaps.length + 1).padStart(2, '0'), time: now
    };
    db.captions = db.captions || [];
    db.captions.push(newCap);
    db.newCaption = { id: newCap.id, text, time: now };
    await writeDB(db);
    invalidateCache();
    await sendTelegramMessage(`✅ Caption added!\n\n📌 "${text}"\n🕒 ${now}`, chatId);
  } catch (e) {
    await sendTelegramMessage(`❌ Error: ${e.message}`, chatId);
  }
}

async function editAdminCaption(chatId, captionId, newText) {
  try {
    const db = await readDB();
    const cap = db.captions.find(c => c.id === captionId);
    if (!cap) { await sendTelegramMessage('❌ Caption not found.', chatId); return; }
    cap.text = newText; cap.editedAt = getBDTime();
    await writeDB(db);
    invalidateCache();
    await sendTelegramMessage(`✅ Caption updated!\n\n📌 "${newText}"`, chatId);
  } catch (e) {
    await sendTelegramMessage(`❌ Error: ${e.message}`, chatId);
  }
}

async function banUser(chatId, uid, ban) {
  const db = await readDB();
  if (!db.users[uid]) {
    await sendTelegramMessage(`❌ User ${uid} not found.`, chatId); return;
  }
  db.users[uid].banned = ban;
  db.users[uid].bannedAt = ban ? getBDTime() : null;
  await writeDB(db);
  invalidateCache();
  await sendTelegramMessage(`${ban ? '🚫 User BANNED' : '✅ User UNBANNED'}: ${uid}`, chatId);
}

// ===== CALLBACK HANDLER =====
async function handleCallback(cb) {
  const chatId = String(cb.from.id);
  const data = cb.data;
  const cbId = cb.id;

  if (chatId !== String(ADMIN_ID)) {
    await answerCallbackQuery(cbId, '🚫 Access Denied');
    return;
  }

  if (data.startsWith('reply_')) {
    const parts = data.split('_');
    const uid = parts[1];
    adminState[chatId] = { step: 'await_reply_inline_msg', userId: uid };
    await answerCallbackQuery(cbId, `Replying to user ${uid}`);
    await sendTelegramMessage(`💌 Enter reply for User ${uid}:`, chatId);
    return;
  }

  if (data.startsWith('delete_msg_')) {
    const msgId = data.replace('delete_msg_', '');
    const db = await readDB();
    db.messages = (db.messages || []).filter(m => m.id !== msgId);
    await writeDB(db);
    invalidateCache();
    await answerCallbackQuery(cbId, '🗑️ Message deleted');
    await sendTelegramMessage(`✅ Message deleted permanently.`, chatId);
    return;
  }

  if (data.startsWith('delete_reply_')) {
    const rId = data.replace('delete_reply_', '');
    const db = await readDB();
    const r = db.replies.find(r => r.id === rId);
    if (r) { r.deleted = true; await writeDB(db); invalidateCache(); }
    await answerCallbackQuery(cbId, '🗑️ Reply deleted');
    await sendTelegramMessage('✅ Reply deleted from user view too.', chatId);
    return;
  }

  if (data.startsWith('view_user_')) {
    const uid = data.replace('view_user_', '');
    await answerCallbackQuery(cbId);
    await cmdViewUserInfo(chatId, uid);
    return;
  }

  if (data.startsWith('ban_')) {
    const uid = data.replace('ban_', '');
    await answerCallbackQuery(cbId, `Banning ${uid}`);
    await banUser(chatId, uid, true);
    return;
  }

  if (data.startsWith('unban_')) {
    const uid = data.replace('unban_', '');
    await answerCallbackQuery(cbId, `Unbanning ${uid}`);
    await banUser(chatId, uid, false);
    return;
  }

  if (data === 'caption_add') {
    adminState[chatId] = { step: 'await_caption' };
    await answerCallbackQuery(cbId);
    await sendTelegramMessage('📝 Enter new caption text:', chatId);
    return;
  }

  if (data.startsWith('caption_edit_')) {
    const capId = data.replace('caption_edit_', '');
    adminState[chatId] = { step: 'await_caption_edit', captionId: capId };
    await answerCallbackQuery(cbId);
    await sendTelegramMessage('✏️ Enter new caption text:', chatId);
    return;
  }

  if (data.startsWith('caption_delete_')) {
    const capId = data.replace('caption_delete_', '');
    const db = await readDB();
    db.captions = (db.captions || []).filter(c => c.id !== capId);
    await writeDB(db);
    invalidateCache();
    await answerCallbackQuery(cbId, '🗑️ Caption deleted');
    await sendTelegramMessage('✅ Caption deleted.', chatId);
    return;
  }

  await answerCallbackQuery(cbId);
}

// ===== KEYBOARD =====
async function sendKeyboard(chatId) {
  await fetch(`${TG_API}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: '⌨️ KEYBOARD MENU 💜',
      reply_markup: {
        keyboard: [
          ['📨 Send Message', '📥 Received History'],
          ['📤 Reply History', '👥 Show All User'],
          ['📢 Broadcast', '📝 Caption BOX'],
          ['🆘 Help']
        ],
        resize_keyboard: true
      }
    })
  });
}

module.exports = { handleUpdate };
