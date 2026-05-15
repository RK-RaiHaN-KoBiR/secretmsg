/* ===== bot/bot.js — Full Telegram Bot ===== */
const { readDB, writeDB, getBDTime } = require('../api/database');

const BOT_TOKEN = process.env.BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_ID  = String(process.env.ADMIN_ID || '6048050987');
const TG_API    = `https://api.telegram.org/bot${BOT_TOKEN}`;
const SITE_URL  = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (process.env.SITE_URL || 'https://cithipathao.vercel.app');

// ─── pending state (in-memory, per cold start) ────
const pendingState = {};

// ─── SEND TG ─────────────────────────────────────
async function sendMsg(chatId, text, extra={}) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML', ...extra };
  try {
    const r = await fetch(`${TG_API}/sendMessage`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    return await r.json();
  } catch(e) { return null; }
}

async function answerCallback(callbackQueryId, text='') {
  try {
    await fetch(`${TG_API}/answerCallbackQuery`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ callback_query_id:callbackQueryId, text }) });
  } catch(e) {}
}

// ─── KEYBOARDS ────────────────────────────────────
const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: '📨 Send Message' }, { text: '📥 Received History' }],
    [{ text: '📤 Reply History' }, { text: '👥 Show All User' }],
    [{ text: '📢 Broadcast' }, { text: '📝 Caption BOX' }],
    [{ text: '🆘 Help' }]
  ],
  resize_keyboard: true,
  persistent: true
};

// ─── MAIN BOT HANDLER ─────────────────────────────
module.exports = async function botHandler(req, res) {
  if (req.method !== 'POST') return res.status(200).end();

  const update = req.body;
  if (!update) return res.status(200).end();

  try {
    if (update.callback_query) await handleCallback(update.callback_query);
    else if (update.message)   await handleMessage(update.message);
  } catch(e) { console.error('Bot error:', e); }

  return res.status(200).json({ ok: true });
};

// ─── CALLBACK HANDLER ─────────────────────────────
async function handleCallback(cq) {
  const chatId = String(cq.from.id);
  const data   = cq.data || '';
  await answerCallback(cq.id);

  if (!isAdmin(chatId)) { await sendMsg(chatId, '❌ Access Denied'); return; }

  if (data.startsWith('reply_')) {
    const targetUid = data.replace('reply_', '');
    pendingState[chatId] = { action: 'replyToUser', targetUid };
    await sendMsg(chatId, `✉️ <b>Reply To User:</b> <code>${targetUid}</code>\n\nএখন আপনার Reply Message লিখুন:`, { reply_markup: { force_reply: true } });
  }

  if (data.startsWith('ban_')) {
    const uid = data.replace('ban_', '');
    await banUser(chatId, uid, true);
  }
  if (data.startsWith('unban_')) {
    const uid = data.replace('unban_', '');
    await banUser(chatId, uid, false);
  }
  if (data.startsWith('viewinfo_')) {
    const uid = data.replace('viewinfo_', '');
    await showUserInfo(chatId, uid);
  }
  if (data.startsWith('delrecv_')) {
    const msgId = data.replace('delrecv_', '');
    await deleteMessage(chatId, msgId, 'received');
  }
  if (data.startsWith('delreply_')) {
    const msgId = data.replace('delreply_', '');
    await deleteMessage(chatId, msgId, 'reply');
  }
  if (data.startsWith('editcap_')) {
    const capId = data.replace('editcap_', '');
    pendingState[chatId] = { action: 'editCaption', capId };
    await sendMsg(chatId, '✏️ নতুন Caption Text লিখুন:');
  }
  if (data.startsWith('delcap_')) {
    const capId = data.replace('delcap_', '');
    const db    = await readDB();
    const cap   = (db.captions||[]).find(c => c.id === capId);
    if (cap) { cap.deleted = true; await writeDB(db); await sendMsg(chatId, '🗑️ Caption Deleted!'); }
  }
  if (data === 'addcaption') {
    pendingState[chatId] = { action: 'addCaption' };
    await sendMsg(chatId, '📝 নতুন Caption লিখুন:');
  }
}

// ─── MESSAGE HANDLER ──────────────────────────────
async function handleMessage(msg) {
  const chatId = String(msg.chat.id);
  const text   = (msg.text || '').trim();
  if (!text) return;

  // Only admin
  if (!isAdmin(chatId)) {
    await sendMsg(chatId, '❌ Access Denied. This bot is for admin only.');
    return;
  }

  // ── Check pending state ──
  const state = pendingState[chatId];
  if (state) {
    delete pendingState[chatId];

    if (state.action === 'replyToUser') {
      await replyToUser(chatId, state.targetUid, text);
      return;
    }
    if (state.action === 'sendMessage_awaitId') {
      pendingState[chatId] = { action: 'sendMessage_awaitMsg', targetUid: text };
      await sendMsg(chatId, '💌 এখন Message লিখুন:');
      return;
    }
    if (state.action === 'sendMessage_awaitMsg') {
      await replyToUser(chatId, state.targetUid, text);
      return;
    }
    if (state.action === 'broadcast') {
      await doBroadcast(chatId, text);
      return;
    }
    if (state.action === 'addCaption') {
      await addAdminCaption(chatId, text);
      return;
    }
    if (state.action === 'editCaption') {
      await editAdminCaption(chatId, state.capId, text);
      return;
    }
    if (state.action === 'ban') {
      await banUser(chatId, text, true);
      return;
    }
    if (state.action === 'unban') {
      await banUser(chatId, text, false);
      return;
    }
    if (state.action === 'viewInfo') {
      await showUserInfo(chatId, text);
      return;
    }
  }

  // ── Commands ──
  if (text === '/start' || text === '/start@')         return handleStart(chatId);
  if (text === '/help' || text === '🆘 Help')          return handleHelp(chatId);
  if (text === '/received' || text === '📥 Received History') return handleReceived(chatId);
  if (text === '/replyhistory' || text === '📤 Reply History') return handleReplyHistory(chatId);
  if (text === '/users' || text === '👥 Show All User') return handleUsers(chatId);
  if (text === '/caption' || text === '📝 Caption BOX') return handleCaptions(chatId);

  if (text === '📨 Send Message' || text === '/send') {
    pendingState[chatId] = { action: 'sendMessage_awaitId' };
    await sendMsg(chatId, '🆔 Enter User ID:');
    return;
  }
  if (text === '📢 Broadcast' || text === '/broadcast') {
    pendingState[chatId] = { action: 'broadcast' };
    await sendMsg(chatId, '📢 Broadcast Message লিখুন (সকল User-এর কাছে যাবে):');
    return;
  }

  // Command: /send 1001 Hello
  if (text.startsWith('/send ')) {
    const parts = text.split(' ');
    if (parts.length >= 3) {
      const uid  = parts[1];
      const rmsg = parts.slice(2).join(' ');
      await replyToUser(chatId, uid, rmsg);
    } else {
      pendingState[chatId] = { action: 'sendMessage_awaitId' };
      await sendMsg(chatId, '🆔 Enter User ID:');
    }
    return;
  }
  if (text.startsWith('/ban '))   { await banUser(chatId, text.split(' ')[1], true); return; }
  if (text.startsWith('/unban ')) { await banUser(chatId, text.split(' ')[1], false); return; }
  if (text.startsWith('/info '))  { await showUserInfo(chatId, text.split(' ')[1]); return; }
  if (text.startsWith('/delete ')) {
    const parts = text.split(' ');
    if (parts[1] && parts[2]) { await deleteMessage(chatId, parts[2], parts[1]); } return;
  }
  if (text === '/status') { await handleStatus(chatId); return; }
  if (text === '/ban') {
    pendingState[chatId] = { action: 'ban' };
    await sendMsg(chatId, '🚫 Ban করার জন্য User ID দিন:');
    return;
  }
  if (text === '/unban') {
    pendingState[chatId] = { action: 'unban' };
    await sendMsg(chatId, '✅ Unban করার জন্য User ID দিন:');
    return;
  }
  if (text === '/info') {
    pendingState[chatId] = { action: 'viewInfo' };
    await sendMsg(chatId, '🆔 User ID দিন:');
    return;
  }

  // Unknown
  await sendMsg(chatId, '❓ Unknown command. /help দিয়ে সব command দেখুন।', { reply_markup: MAIN_KEYBOARD });
}

// ─── ACTIONS ──────────────────────────────────────
async function handleStart(chatId) {
  await sendMsg(chatId, `╔══════════════════════╗\n💌 <b>Welcome Back To\nচিঠি পাঠাও</b>\n╚══════════════════════╝\n\n✨ Anonymous Messaging Platform\n\n📌 <b>Available Features:</b>\n🔘 Send Message\n🔘 Receive Reply\n🔘 Push Notification\n🔘 Broadcast Notification\n🔘 Caption System\n🔘 User Management\n\n━━━━━━━━━━━━━━━━\n<b>Available Commands:</b>\n/send /received /replyhistory\n/users /broadcast /caption /help`, { reply_markup: MAIN_KEYBOARD });
}

async function handleHelp(chatId) {
  await sendMsg(chatId, `╔══════════════════════╗\n🤖 <b>BOT HELP & COMMAND MENU</b>\n╚══════════════════════╝\n\n📌 <b>Available Commands:</b>\n/start → Open Welcome Menu\n/send → Send Reply To User\n/received → View Received Messages\n/replyhistory → View Sent Replies\n/users → Show All Registered Users\n/broadcast → Send Broadcast\n/caption → Manage Captions\n/ban → Ban Any User\n/unban → Unban Any User\n/info → View User Information\n/status → View Bot Status\n/help → This Menu\n\n━━━━━━━━━━━━━━━━\n<b>Quick Commands:</b>\n<code>/send 1001 Hello World</code>\n<code>/ban 1001</code>\n<code>/info 1002</code>`, { reply_markup: MAIN_KEYBOARD });
}

async function handleReceived(chatId) {
  const db   = await readDB();
  const msgs = (db.sentMessages||[]).filter(m => !m.deleted).slice(-20).reverse();
  if (!msgs.length) { await sendMsg(chatId, '📭 কোনো Received Message নেই।', { reply_markup: MAIN_KEYBOARD }); return; }

  for (const m of msgs.slice(0,10)) {
    const kb = { inline_keyboard: [[{ text: '✉️ Reply', callback_data: `reply_${m.uid}` }, { text: '🗑️ Delete', callback_data: `delrecv_${m.msgId}` }]] };
    await sendMsg(chatId, `┌────────────────────────\nMsg ID: ${m.msgId}\nUser ID: <b>${m.uid}</b>\nName: ${m.name||'Hidden'}\nMessage: <i>${m.message.slice(0,200)}</i>\nReceived Time: ${m.time}\n└────────────────────────`, { reply_markup: kb });
  }
}

async function handleReplyHistory(chatId) {
  const db   = await readDB();
  const msgs = (db.receivedMessages||[]).filter(m => !m.deleted).slice(-20).reverse();
  if (!msgs.length) { await sendMsg(chatId, '📤 কোনো Reply History নেই।', { reply_markup: MAIN_KEYBOARD }); return; }

  for (const m of msgs.slice(0,10)) {
    const kb = { inline_keyboard: [[{ text: '🗑️ Delete', callback_data: `delreply_${m.msgId}` }]] };
    await sendMsg(chatId, `┌────────────────────────\nMsg ID: ${m.msgId}\nUser ID: <b>${m.uid}</b>\nMessage: <i>${m.message.slice(0,200)}</i>\nSend Time: ${m.time}\n└────────────────────────`, { reply_markup: kb });
  }
}

async function handleUsers(chatId) {
  const db    = await readDB();
  const users = Object.entries(db.users||{});
  if (!users.length) { await sendMsg(chatId, '👥 কোনো Registered User নেই।', { reply_markup: MAIN_KEYBOARD }); return; }

  await sendMsg(chatId, `╔══════════════════════════════╗\n👥 <b>REGISTERED USER ID LIST</b>\n╚══════════════════════════════╝\n\nTotal Users: ${users.length}`);

  let i = 1;
  for (const [uid, u] of users.slice(0,20)) {
    const kb = { inline_keyboard: [
      [{ text: '🔘 View User Info', callback_data: `viewinfo_${uid}` }],
      [{ text: '🚫 Ban User', callback_data: `ban_${uid}` }, { text: '✅ Unban', callback_data: `unban_${uid}` }]
    ]};
    await sendMsg(chatId, `━━━━━━━━━━━━━━━━━━\n🔢 Number: ${i}\n🆔 User ID: <b>${uid}</b>\n📛 Name: ${u.name||'—'}\n🔴 Status: ${u.banned?'Banned':'Active'}`, { reply_markup: kb });
    i++;
  }
}

async function showUserInfo(chatId, uid) {
  const db   = await readDB();
  const user = db.users[uid];
  if (!user) { await sendMsg(chatId, `❌ User ID ${uid} not found.`); return; }

  const sent     = (db.sentMessages||[]).filter(m => m.uid===uid && !m.deleted).length;
  const received = (db.receivedMessages||[]).filter(m => m.uid===uid && !m.deleted).length;

  await sendMsg(chatId, `━━━━━━━━━━━━━━━━━━━━━━━\n🔰 <b>USER PROFILE INFORMATION</b> 🔰\n━━━━━━━━━━━━━━━━━━━━━━━\n\n🆔 User ID: <b>${uid}</b>\n👤 Full Name: ${user.name||'Hidden User'}\n📱 Phone: ${user.whatsapp||'Hidden'}\n🔗 FB Profile: ${user.fbLink||'Not Added'}\n🌍 Location: ${user.city||'—'}, ${user.country||'—'}\n📶 IP: <code>${user.ip||'—'}</code>\n📱 Device: ${user.deviceInfo||'—'}\n🧠 Browser: <code>${(user.ua||'—').slice(0,80)}</code>\n🔔 Notification: ${user.notifAllowed?'Allowed ✅':'Disabled ❌'}\n💌 Total Sent: ${sent}\n📥 Total Received: ${received}\n🔴 Status: ${user.banned?'BANNED 🚫':'Active ✅'}\n📅 Registered: ${user.registeredDate||'—'}\n🕒 Last Active: ${user.lastActive||'—'}\n💬 Last Msg: ${user.lastMsg||'—'}`, {
    reply_markup: { inline_keyboard: [
      [{ text: '✉️ Reply', callback_data: `reply_${uid}` }, { text: user.banned?'✅ Unban':'🚫 Ban', callback_data: `${user.banned?'unban':'ban'}_${uid}` }]
    ]}
  });
}

async function banUser(chatId, uid, ban) {
  const db = await readDB();
  if (!db.users[uid]) { await sendMsg(chatId, `❌ User ID ${uid} not found.`); return; }
  db.users[uid].banned = ban;
  await writeDB(db);
  await sendMsg(chatId, `${ban?'🚫 User Banned':'✅ User Unbanned'}: <b>${uid}</b>`, { reply_markup: MAIN_KEYBOARD });
}

async function replyToUser(chatId, uid, message) {
  const db   = await readDB();
  if (!db.users[uid]) { await sendMsg(chatId, `❌ User ID ${uid} not found.`, { reply_markup: MAIN_KEYBOARD }); return; }
  if (!db.receivedMessages) db.receivedMessages = [];

  const time  = getBDTime();
  const msgId = String(db.nextMsgId||1).padStart(3,'0');
  db.receivedMessages.push({ msgId, uid, message, time, deleted: false, replyTime: time });
  db.nextMsgId = (db.nextMsgId||1) + 1;
  if (db.users[uid]) { db.users[uid].totalReceived = (db.users[uid].totalReceived||0) + 1; }
  await writeDB(db);

  await sendMsg(chatId, `╔══════════════════════╗\n📤 <b>REPLY STATUS REPORT</b>\n╚══════════════════════╝\n\n✅ Reply Sent To UserID: <b>${uid}</b>\n🕒 Time: ${time}\n⏳ Status: Wait For User Seen Your Message!`, { reply_markup: MAIN_KEYBOARD });
}

async function doBroadcast(chatId, message) {
  const db   = await readDB();
  if (!db.broadcasts) db.broadcasts = [];
  const time = getBDTime();
  const bc   = { id: `bc_${Date.now()}`, message, time };
  db.broadcasts.push(bc);
  if (db.broadcasts.length > 10) db.broadcasts = db.broadcasts.slice(-10);
  await writeDB(db);

  const userCount = Object.keys(db.users||{}).length;
  await sendMsg(chatId, `✅ <b>Broadcast Successfully Sent To Website All Users!</b>\n\n🕒 Send Time: ${time}\n👥 Total Users: ${userCount}`, { reply_markup: MAIN_KEYBOARD });
}

async function handleCaptions(chatId) {
  const db   = await readDB();
  const caps = (db.captions||[]).filter(c => !c.deleted && c.source==='admin');

  await sendMsg(chatId, `╔══════════════════════╗\n📝 <b>WEBSITE CAPTION LIST</b>\n╚══════════════════════╝\n\nAdmin Captions: ${caps.length}`, {
    reply_markup: { inline_keyboard: [[{ text:'➕ Add New Caption', callback_data:'addcaption' }]] }
  });

  for (const c of caps.slice(0,10)) {
    const kb = { inline_keyboard: [[{ text:'✏️ Edit', callback_data:`editcap_${c.id}` }, { text:'🗑️ Delete', callback_data:`delcap_${c.id}` }]] };
    await sendMsg(chatId, `📌 <b>Caption Text:</b>\n${c.text}\n\n🕒 <i>${c.time}</i>`, { reply_markup: kb });
  }
}

async function addAdminCaption(chatId, text) {
  const db   = await readDB();
  if (!db.captions) db.captions = [];
  const time  = getBDTime();
  const capId = `cap_admin_${Date.now()}`;
  const num   = db.nextCaptionNum||1;
  db.captions.push({ id:capId, num, text, uid:'admin', source:'admin', time, deleted:false });
  db.nextCaptionNum = num+1;
  await writeDB(db);
  await sendMsg(chatId, `✅ <b>Caption Added!</b>\n\n📌 Caption: ${text}\n🕒 Time: ${time}`, { reply_markup: MAIN_KEYBOARD });
}

async function editAdminCaption(chatId, capId, newText) {
  const db  = await readDB();
  const cap = (db.captions||[]).find(c => c.id===capId);
  if (!cap) { await sendMsg(chatId, '❌ Caption not found.'); return; }
  cap.text = newText; cap.editedAt = getBDTime();
  await writeDB(db);
  await sendMsg(chatId, '✅ Caption Updated!', { reply_markup: MAIN_KEYBOARD });
}

async function deleteMessage(chatId, msgId, type) {
  const db = await readDB();
  const arr = type==='reply' ? db.receivedMessages : db.sentMessages;
  const msg = (arr||[]).find(m => m.msgId===msgId);
  if (msg) { msg.deleted = true; await writeDB(db); await sendMsg(chatId, '🗑️ Message Deleted (Permanently from both sides)!'); }
  else await sendMsg(chatId, '❌ Message not found.');
}

async function handleStatus(chatId) {
  const db = await readDB();
  const users = Object.keys(db.users||{}).length;
  const sent  = (db.sentMessages||[]).filter(m=>!m.deleted).length;
  const recv  = (db.receivedMessages||[]).filter(m=>!m.deleted).length;
  const caps  = (db.captions||[]).filter(c=>!c.deleted).length;
  await sendMsg(chatId, `🤖 <b>BOT STATUS REPORT</b>\n\n👥 Total Users: ${users}\n💌 Sent Messages: ${sent}\n📩 Received Messages: ${recv}\n📝 Captions: ${caps}\n🕒 Time: ${getBDTime()}\n✅ Status: Online`, { reply_markup: MAIN_KEYBOARD });
}

function isAdmin(chatId) {
  return chatId === ADMIN_ID;
}
