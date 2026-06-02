/* ============================================================
   bot/commands.js — All Bot Commands & Keyboard Handlers
   ============================================================ */

'use strict';

/* ─────────────────────────────────────────
   KEYBOARD LAYOUT
───────────────────────────────────────── */
const MAIN_KEYBOARD = {
  keyboard: [
    ['📨 Send Message',    '📥 Received History'],
    ['📤 Reply History',   '👥 Show All User'],
    ['📢 Broadcast',       '📝 Caption BOX'],
    ['🆘 Help'],
  ],
  resize_keyboard: true,
  persistent: true,
};

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function pad2(n) { return String(n).padStart(2, '0'); }

function fmtMsgCard(m, index) {
  return `┌────────────────────────────────┐
<b>Msg ID:</b> ${pad2(m.msgId || index + 1)}
<b>User ID:</b> <code>${m.fromUID || m.uid || '—'}</code>
<b>Message:</b> ${escHtml((m.text || '').slice(0, 300))}
<b>Time:</b> ${m.time || '—'}
└────────────────────────────────┘`;
}

/* ─────────────────────────────────────────
   WELCOME / START
───────────────────────────────────────── */
async function cmdStart(sendMsg, ADMIN_ID) {
  const text = `╔══════════════════════╗
💌 <b>Welcome Back To</b>
<b>চিঠি পাঠান (Cithi Pathan)</b>
╚══════════════════════╝

✨ <b>Anonymous Messaging Platform</b>

📌 <b>Available Features:</b>
🔘 Send Message
🔘 Receive Reply
🔘 Push Notification
🔘 Live Popup Message
🔘 Instant Reply System
🔘 Broadcast Notification
🔘 Caption System

━━━━━━━━━━━━━━━━━━━━━━━
📌 <b>Available Commands:</b>
/send /received /replyhistory
/users /broadcast /caption
/help /ban /unban /info
/status /ads /clear /delete
━━━━━━━━━━━━━━━━━━━━━━━
🌐 <b>Website:</b> https://cithipathao.vercel.app`;
  await sendMsg(ADMIN_ID, text, { reply_markup: MAIN_KEYBOARD });
}

/* ─────────────────────────────────────────
   RECEIVED HISTORY
───────────────────────────────────────── */
async function cmdReceived(sendMsg, ADMIN_ID, db) {
  const msgs = (db.messages || []).filter(m => !m.deleted);
  if (!msgs.length) {
    return sendMsg(ADMIN_ID, '📭 কোনো Received Message নেই।', { reply_markup: MAIN_KEYBOARD });
  }
  const chunks = [];
  let current = `╔══════════════════════════════╗\n📥 <b>RECEIVED HISTORY</b>\n╚══════════════════════════════╝\n\n`;
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const card = fmtMsgCard(m, i) + '\n\n';
    if ((current + card).length > 3800) {
      chunks.push(current);
      current = card;
    } else {
      current += card;
    }
  }
  if (current.trim()) chunks.push(current);
  for (const chunk of chunks) {
    await sendMsg(ADMIN_ID, chunk, {
      reply_markup: {
        inline_keyboard: msgs.slice(0, 10).map(m => [{
          text: `🗑️ Delete Msg ${pad2(m.msgId)}`,
          callback_data: `del_msg_${m.id}`,
        }]),
      },
    });
  }
}

/* ─────────────────────────────────────────
   REPLY HISTORY
───────────────────────────────────────── */
async function cmdReplyHistory(sendMsg, ADMIN_ID, db) {
  const replies = (db.replies || []).filter(r => !r.deleted);
  if (!replies.length) {
    return sendMsg(ADMIN_ID, '📭 কোনো Reply History নেই।', { reply_markup: MAIN_KEYBOARD });
  }
  let text = `╔══════════════════════════════╗\n📤 <b>REPLY HISTORY</b>\n╚══════════════════════════════╝\n\n`;
  for (let i = 0; i < replies.length; i++) {
    const r = replies[i];
    text += `┌────────────────────────────────┐\n<b>Msg ID:</b> ${pad2(r.msgId || i + 1)}\n<b>User ID:</b> <code>${r.toUID}</code>\n<b>Message:</b> ${escHtml((r.text || '').slice(0, 300))}\n<b>Send Time:</b> ${r.sentTime || '—'}\n└────────────────────────────────┘\n\n`;
    if (text.length > 3600) {
      await sendMsg(ADMIN_ID, text, {
        reply_markup: {
          inline_keyboard: [[{ text: `🗑️ Delete Reply ${pad2(r.msgId || i+1)}`, callback_data: `del_reply_${r.id}` }]],
        },
      });
      text = '';
    }
  }
  if (text.trim()) {
    await sendMsg(ADMIN_ID, text, {
      reply_markup: {
        inline_keyboard: replies.slice(-1).map(r => [{
          text: `🗑️ Delete Reply ${pad2(r.msgId)}`,
          callback_data: `del_reply_${r.id}`,
        }]),
      },
    });
  }
}

/* ─────────────────────────────────────────
   SHOW ALL USERS
───────────────────────────────────────── */
async function cmdShowUsers(sendMsg, ADMIN_ID, db) {
  const users = Object.values(db.users || {});
  if (!users.length) {
    return sendMsg(ADMIN_ID, '👥 কোনো Registered User নেই।', { reply_markup: MAIN_KEYBOARD });
  }
  let text = `╔══════════════════════════════╗\n👥 <b>REGISTERED USER ID LIST</b>\n╚══════════════════════════════╝\n\n`;
  const inlineRows = [];
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    text += `━━━━━━━━━━━━━━━━━━\n🔢 <b>Number:</b> ${i + 1}\n🆔 <b>User ID:</b> <code>${u.uid}</code>${u.banned ? ' 🚫 <i>Banned</i>' : ''}\n\n`;
    inlineRows.push([
      { text: `👁️ View ${u.uid}`,  callback_data: `view_user_${u.uid}` },
      { text: `🗑️ Clear ${u.uid}`, callback_data: `clear_user_${u.uid}` },
    ]);
    inlineRows.push([
      { text: `🚫 Ban ${u.uid}`,   callback_data: `ban_user_${u.uid}` },
      { text: `✅ Unban ${u.uid}`, callback_data: `unban_user_${u.uid}` },
    ]);
    if (text.length > 3200) {
      await sendMsg(ADMIN_ID, text, { reply_markup: { inline_keyboard: inlineRows.splice(0, inlineRows.length) } });
      text = '';
    }
  }
  if (text.trim() || inlineRows.length) {
    await sendMsg(ADMIN_ID, text || '─', { reply_markup: { inline_keyboard: inlineRows } });
  }
}

/* ─────────────────────────────────────────
   VIEW USER INFO
───────────────────────────────────────── */
async function cmdViewUser(sendMsg, ADMIN_ID, db, uid) {
  const u = db.users[String(uid)];
  if (!u) return sendMsg(ADMIN_ID, `❌ User ID <code>${uid}</code> পাওয়া যায়নি।`);
  const info = u.deviceInfo || {};
  const totalSent = (db.messages || []).filter(m => String(m.fromUID) === String(uid)).length;
  const totalRecv = (db.replies || []).filter(r => String(r.toUID) === String(uid)).length;
  const lastMsg = (db.messages || []).filter(m => String(m.fromUID) === String(uid)).slice(-1)[0];

  const text = `━━━━━━━━━━━━━━━━━━━━━━━
🔰 <b>USER PROFILE INFORMATION 🔰</b>
━━━━━━━━━━━━━━━━━━━━━━━

🆔 <b>User ID            :</b> <code>${uid}</code>

👤 <b>Full Name          :</b> ${escHtml(info.name || 'Hidden User')}

📱 <b>Phone Number       :</b> ${escHtml(info.whatsapp || 'Hidden')}

🔗 <b>FB Profile         :</b> ${escHtml(info.fb || 'Not Added')}

🌍 <b>Location           :</b> ${escHtml(info.city || '—')}, ${escHtml(info.country || '—')}

📶 <b>Network            :</b> ${escHtml(info.connection || '—')}

📱 <b>Device             :</b> ${escHtml(info.deviceModel || '—')}

🧠 <b>Browser            :</b> ${escHtml((info.userAgent || '').split(' ')[0] || '—')}

🔔 <b>Notification       :</b> ${u.notifEnabled ? 'Allowed ✅' : 'Disabled ❌'}

💌 <b>Total Sent         :</b> ${totalSent}

📥 <b>Total Received     :</b> ${totalRecv}

🟢 <b>Active Status      :</b> ${u.status || 'Offline'}

🔴 <b>User Status        :</b> ${u.banned ? 'Banned 🚫' : 'Unbanned ✅'}

📅 <b>Account Created    :</b> ${u.joinTime || '—'}

🕒 <b>Last Active        :</b> ${u.lastActive || '—'}

💬 <b>LAST MESSAGE:</b>
${lastMsg ? escHtml(lastMsg.text.slice(0, 200)) : '—'}

━━━━━━━━━━━━━━━━━━━━━━━`;

  await sendMsg(ADMIN_ID, text, {
    reply_markup: {
      inline_keyboard: [[
        { text: '📩 Send Reply', callback_data: `reply_${uid}_direct` },
        { text: u.banned ? '✅ Unban' : '🚫 Ban', callback_data: u.banned ? `unban_user_${uid}` : `ban_user_${uid}` },
      ], [
        { text: '🗑️ Clear Data', callback_data: `clear_user_${uid}` },
      ]],
    },
  });
}

/* ─────────────────────────────────────────
   CAPTION BOX
───────────────────────────────────────── */
async function cmdCaption(sendMsg, ADMIN_ID, db, adminState) {
  const captions = (db.captions || []).filter(c => !c.deleted);
  let text = `━━━━━━━━━━━━━━━━━━━━━━━\n🛠️ <b>ADMIN ADDED CAPTIONS</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  const adminCaps = captions.filter(c => c.addedBy === 'admin');
  const userCaps  = captions.filter(c => c.addedBy !== 'admin');
  const inlineRows = [];

  if (!adminCaps.length && !userCaps.length) {
    text += 'কোনো Caption নেই।\n\n';
  }

  for (const c of adminCaps) {
    text += `<b>Caption ID:</b> ${pad2(c.captionNum)}\n📌 <b>Caption:</b>\n"${escHtml(c.text)}"\n\n🕒 <b>Time:</b> ${c.time}\n🆔 <b>Added By:</b> Admin\n\n`;
    inlineRows.push([
      { text: `✏️ Edit ${pad2(c.captionNum)}`,   callback_data: `cap_edit_${c.id}` },
      { text: `🗑️ Delete ${pad2(c.captionNum)}`, callback_data: `cap_del_${c.id}` },
    ]);
  }

  if (userCaps.length) {
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>USER ADDED CAPTIONS</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    for (const c of userCaps) {
      text += `👤 <b>User ID:</b> <code>${c.addedBy}</code>\n<b>Caption ID:</b> ${pad2(c.captionNum)}\n📌 <b>Caption:</b>\n"${escHtml(c.text)}"\n\n🕒 <b>Time:</b> ${c.time}\n\n`;
      inlineRows.push([
        { text: `✏️ Edit ${pad2(c.captionNum)}`,   callback_data: `cap_edit_${c.id}` },
        { text: `🗑️ Delete ${pad2(c.captionNum)}`, callback_data: `cap_del_${c.id}` },
      ]);
    }
  }

  inlineRows.push([{ text: '➕ Add New Caption', callback_data: 'cap_add' }]);

  if (text.length > 3800) text = text.slice(0, 3800) + '\n...(truncated)';
  await sendMsg(ADMIN_ID, text, { reply_markup: { inline_keyboard: inlineRows } });
}

/* ─────────────────────────────────────────
   BROADCAST
───────────────────────────────────────── */
async function cmdBroadcast(sendMsg, ADMIN_ID, adminState) {
  adminState[ADMIN_ID] = { step: 'broadcast_text' };
  await sendMsg(ADMIN_ID, `📢 <b>Broadcast To All Users</b>\n\n💌 Broadcast Message লিখুন:\n\n(Cancel করতে /cancel লিখুন)`);
}

/* ─────────────────────────────────────────
   SEND MESSAGE (to specific user)
───────────────────────────────────────── */
async function cmdSendMessage(sendMsg, ADMIN_ID, adminState, args) {
  // /send UID message  OR  keyboard button
  if (args && args.length >= 2) {
    const uid  = args[0];
    const text = args.slice(1).join(' ');
    adminState[ADMIN_ID] = { step: 'send_confirm', data: { uid, text } };
    await sendMsg(ADMIN_ID,
      `📩 <b>Send Message Confirmation</b>\n\n🆔 <b>User ID:</b> <code>${uid}</code>\n💌 <b>Message:</b> ${escHtml(text)}\n\nConfirm?`,
      { reply_markup: { inline_keyboard: [[
        { text: '✅ Yes, Send', callback_data: `send_confirm_${uid}` },
        { text: '❌ Cancel',   callback_data: 'cancel' },
      ]] } }
    );
    return;
  }
  adminState[ADMIN_ID] = { step: 'send_uid' };
  await sendMsg(ADMIN_ID, `📨 <b>Send Message To User</b>\n\n🆔 Enter User ID:\n\n(Cancel করতে /cancel লিখুন)`);
}

/* ─────────────────────────────────────────
   HELP
───────────────────────────────────────── */
async function cmdHelp(sendMsg, ADMIN_ID) {
  const text = `╔══════════════════════╗
🤖 <b>BOT HELP &amp; COMMAND MENU</b>
╚══════════════════════╝

📌 <b>Available Commands:</b>

/start → Open Welcome Menu
/send → Send Reply To User
/received → View Received Messages
/replyhistory → View Sent Replies History
/users → Show All Registered Users
/broadcast → Send Broadcast Notification
/caption → Manage Website Captions
/help → Open Help Menu
/ban UID → Ban Any User
/unban UID → Unban Any User
/delete MSGID → Delete Message
/info UID → View User Information
/status → View Bot Status Report
/ads on|off → Toggle Ads
/clear UID → Clear User Data
/cancel → Cancel current action

━━━━━━━━━━━━━━━━━━━━━━━

📌 <b>Keyboard Buttons:</b>
📨 Send Message
📥 Received History
📤 Reply History
👥 Show All User
📢 Broadcast
📝 Caption BOX
🆘 Help

━━━━━━━━━━━━━━━━━━━━━━━

✅ Keyboard + Command — দুইভাবেই কাজ করে`;
  await sendMsg(ADMIN_ID, text, { reply_markup: MAIN_KEYBOARD });
}

/* ─────────────────────────────────────────
   STATUS
───────────────────────────────────────── */
async function cmdStatus(sendMsg, ADMIN_ID, db) {
  const users    = Object.values(db.users || {});
  const msgs     = (db.messages || []).filter(m => !m.deleted);
  const replies  = (db.replies  || []).filter(r => !r.deleted);
  const captions = (db.captions || []).filter(c => !c.deleted);
  const banned   = users.filter(u => u.banned).length;

  const text = `╔══════════════════════╗
📊 <b>BOT STATUS REPORT</b>
╚══════════════════════╝

👥 <b>Total Users     :</b> ${users.length}
🚫 <b>Banned Users    :</b> ${banned}
💌 <b>Total Messages  :</b> ${msgs.length}
📤 <b>Total Replies   :</b> ${replies.length}
📝 <b>Total Captions  :</b> ${captions.length}
📢 <b>Total Broadcasts:</b> ${(db.broadcasts || []).length}
🔔 <b>Ads Enabled     :</b> ${db.meta.adsEnabled !== false ? 'Yes ✅' : 'No ❌'}
🕒 <b>Report Time     :</b> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })} BD Time`;
  await sendMsg(ADMIN_ID, text, { reply_markup: MAIN_KEYBOARD });
}

/* ─────────────────────────────────────────
   ADS TOGGLE
───────────────────────────────────────── */
async function cmdAds(sendMsg, ADMIN_ID, db, writeDB, arg) {
  if (arg === 'on') {
    db.meta.adsEnabled = true;
    await writeDB(db);
    await sendMsg(ADMIN_ID, '✅ <b>Ads Enabled!</b>\n\nWebsite-এ এখন Ads দেখাবে।', { reply_markup: MAIN_KEYBOARD });
  } else if (arg === 'off') {
    db.meta.adsEnabled = false;
    await writeDB(db);
    await sendMsg(ADMIN_ID, '❌ <b>Ads Disabled!</b>\n\nWebsite-এ Ads দেখাবে না।', { reply_markup: MAIN_KEYBOARD });
  } else {
    const current = db.meta.adsEnabled !== false ? 'Enabled ✅' : 'Disabled ❌';
    await sendMsg(ADMIN_ID, `📢 <b>Ads Control</b>\n\nCurrent Status: <b>${current}</b>\n\nToggle:\n/ads on — Enable Ads\n/ads off — Disable Ads`, {
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Ads ON',  callback_data: 'ads_on' },
          { text: '❌ Ads OFF', callback_data: 'ads_off' },
        ]],
      },
    });
  }
}

/* ─────────────────────────────────────────
   MAIN COMMAND ROUTER
───────────────────────────────────────── */
async function handleCommand(msg, text, ctx) {
  const { sendMsg, adminState, getBDTime, ADMIN_ID, TG_API, readDB, writeDB, genId } = ctx;
  const db = await readDB();

  /* /cancel */
  if (text === '/cancel' || text === '❌ Cancel') {
    delete adminState[ADMIN_ID];
    return sendMsg(ADMIN_ID, '❌ Cancelled.', { reply_markup: MAIN_KEYBOARD });
  }

  /* /start */
  if (text === '/start') return cmdStart(sendMsg, ADMIN_ID);

  /* /help or 🆘 Help */
  if (text === '/help' || text === '🆘 Help') return cmdHelp(sendMsg, ADMIN_ID);

  /* /status */
  if (text === '/status') return cmdStatus(sendMsg, ADMIN_ID, db);

  /* /received or 📥 Received History */
  if (text === '/received' || text === '📥 Received History') return cmdReceived(sendMsg, ADMIN_ID, db);

  /* /replyhistory or 📤 Reply History */
  if (text === '/replyhistory' || text === '📤 Reply History') return cmdReplyHistory(sendMsg, ADMIN_ID, db);

  /* /users or 👥 Show All User */
  if (text === '/users' || text === '👥 Show All User') return cmdShowUsers(sendMsg, ADMIN_ID, db);

  /* /caption or 📝 Caption BOX */
  if (text === '/caption' || text === '📝 Caption BOX') return cmdCaption(sendMsg, ADMIN_ID, db, adminState);

  /* /broadcast or 📢 Broadcast */
  if (text === '/broadcast' || text === '📢 Broadcast') return cmdBroadcast(sendMsg, ADMIN_ID, adminState);

  /* /send or 📨 Send Message */
  if (text === '/send' || text === '📨 Send Message') {
    return cmdSendMessage(sendMsg, ADMIN_ID, adminState, []);
  }
  if (text.startsWith('/send ')) {
    const parts = text.slice(6).split(' ');
    return cmdSendMessage(sendMsg, ADMIN_ID, adminState, parts);
  }

  /* /ban UID */
  if (text.startsWith('/ban ')) {
    const uid = text.split(' ')[1];
    if (!uid) return sendMsg(ADMIN_ID, 'Usage: /ban UID');
    if (!db.users[uid]) return sendMsg(ADMIN_ID, `❌ User <code>${uid}</code> পাওয়া যায়নি।`);
    db.users[uid].banned = true;
    await writeDB(db);
    return sendMsg(ADMIN_ID, `🚫 User <code>${uid}</code> Banned Successfully!`, { reply_markup: MAIN_KEYBOARD });
  }

  /* /unban UID */
  if (text.startsWith('/unban ')) {
    const uid = text.split(' ')[1];
    if (!uid) return sendMsg(ADMIN_ID, 'Usage: /unban UID');
    if (!db.users[uid]) return sendMsg(ADMIN_ID, `❌ User <code>${uid}</code> পাওয়া যায়নি।`);
    db.users[uid].banned = false;
    await writeDB(db);
    return sendMsg(ADMIN_ID, `✅ User <code>${uid}</code> Unbanned Successfully!`, { reply_markup: MAIN_KEYBOARD });
  }

  /* /info UID */
  if (text.startsWith('/info ')) {
    const uid = text.split(' ')[1];
    return cmdViewUser(sendMsg, ADMIN_ID, db, uid);
  }

  /* /ads on|off */
  if (text.startsWith('/ads')) {
    const arg = text.split(' ')[1] || '';
    return cmdAds(sendMsg, ADMIN_ID, db, writeDB, arg.toLowerCase());
  }

  /* /clear UID */
  if (text.startsWith('/clear ')) {
    const uid = text.split(' ')[1];
    return clearUserData(sendMsg, ADMIN_ID, db, writeDB, uid);
  }

  /* /delete MSGID */
  if (text.startsWith('/delete ')) {
    const msgId = parseInt(text.split(' ')[1]);
    return deleteMessageById(sendMsg, ADMIN_ID, db, writeDB, msgId);
  }

  /* Unknown */
  await sendMsg(ADMIN_ID, `❓ Unknown command. Use /help to see all commands.`, { reply_markup: MAIN_KEYBOARD });
}

/* ─────────────────────────────────────────
   MULTI-STEP ADMIN STATE HANDLER
───────────────────────────────────────── */
async function handleAdminState(msg, text, ctx) {
  const { sendMsg, adminState, getBDTime, ADMIN_ID, TG_API, readDB, writeDB, genId } = ctx;
  const state = adminState[ADMIN_ID];
  if (!state) return;

  /* /cancel at any point */
  if (text === '/cancel') {
    delete adminState[ADMIN_ID];
    return sendMsg(ADMIN_ID, '❌ Cancelled.', { reply_markup: MAIN_KEYBOARD });
  }

  const db = await readDB();

  /* ── SEND: step 1 — waiting for UID ── */
  if (state.step === 'send_uid') {
    const uid = text.trim();
    if (!db.users[uid]) {
      return sendMsg(ADMIN_ID, `❌ User ID <code>${uid}</code> পাওয়া যায়নি। আবার চেষ্টা করুন বা /cancel দিন।`);
    }
    adminState[ADMIN_ID] = { step: 'send_text', data: { uid } };
    return sendMsg(ADMIN_ID, `✅ User ID: <code>${uid}</code>\n\n💌 এখন Message লিখুন:\n\n(Cancel করতে /cancel)`);
  }

  /* ── SEND: step 2 — waiting for message text ── */
  if (state.step === 'send_text') {
    const { uid } = state.data;
    const replyText = text.trim();
    if (!replyText) return sendMsg(ADMIN_ID, '⚠️ Message খালি রাখা যাবে না।');
    delete adminState[ADMIN_ID];
    await sendReplyToUser(sendMsg, ADMIN_ID, db, writeDB, genId, getBDTime, uid, replyText);
    return;
  }

  /* ── BROADCAST: waiting for text ── */
  if (state.step === 'broadcast_text') {
    const bcText = text.trim();
    if (!bcText) return sendMsg(ADMIN_ID, '⚠️ Broadcast message খালি রাখা যাবে না।');
    delete adminState[ADMIN_ID];
    await sendBroadcast(sendMsg, ADMIN_ID, db, writeDB, genId, getBDTime, bcText);
    return;
  }

  /* ── CAPTION ADD ── */
  if (state.step === 'caption_add') {
    const capText = text.trim();
    if (!capText) return sendMsg(ADMIN_ID, '⚠️ Caption খালি রাখা যাবে না।');
    delete adminState[ADMIN_ID];
    const captionNum = db.meta.nextCaptionNum || 1;
    db.meta.nextCaptionNum = captionNum + 1;
    const cap = {
      id: genId(),
      captionNum,
      text: capText,
      addedBy: 'admin',
      time: getBDTime(),
      deleted: false,
      timestamp: Date.now(),
    };
    if (!db.captions) db.captions = [];
    db.captions.push(cap);
    await writeDB(db);
    return sendMsg(ADMIN_ID,
      `✅ <b>Caption Successfully Added!</b>\n\n📌 Caption has been added to Caption Box.\n🌐 It is now visible on the website instantly.\n\n📌 <b>Caption ID:</b> ${pad2(captionNum)}\n💬 ${escHtml(capText)}`,
      { reply_markup: MAIN_KEYBOARD }
    );
  }

  /* ── CAPTION EDIT ── */
  if (state.step === 'caption_edit') {
    const { capId } = state.data;
    const capText = text.trim();
    if (!capText) return sendMsg(ADMIN_ID, '⚠️ Caption খালি রাখা যাবে না।');
    delete adminState[ADMIN_ID];
    const cap = (db.captions || []).find(c => c.id === capId);
    if (!cap) return sendMsg(ADMIN_ID, '❌ Caption পাওয়া যায়নি।');
    cap.text = capText;
    cap.editedAt = getBDTime();
    await writeDB(db);
    return sendMsg(ADMIN_ID, `✅ <b>Caption Updated Successfully!</b>\n\n📌 Changes have been saved and updated on website instantly.`, { reply_markup: MAIN_KEYBOARD });
  }
}

/* ─────────────────────────────────────────
   CALLBACK QUERY HANDLER
───────────────────────────────────────── */
async function handleCallbackQuery(cb, ctx) {
  const { sendMsg, editMsg, adminState, getBDTime, ADMIN_ID, TG_API, readDB, writeDB, genId } = ctx;
  const data = cb.data;
  const msgId = cb.message ? cb.message.message_id : null;
  const db = await readDB();

  /* ── REPLY to user ── */
  if (data.startsWith('reply_')) {
    const parts = data.split('_');  // reply_UID_msgID
    const uid = parts[1];
    adminState[ADMIN_ID] = { step: 'send_text', data: { uid } };
    return sendMsg(ADMIN_ID, `📩 <b>Reply to User <code>${uid}</code></b>\n\n💌 Message লিখুন:\n\n(Cancel করতে /cancel)`);
  }

  /* ── DELETE received message ── */
  if (data.startsWith('del_msg_')) {
    const id = data.replace('del_msg_', '');
    const m = (db.messages || []).find(msg => msg.id === id);
    if (m) { m.deleted = true; await writeDB(db); }
    return sendMsg(ADMIN_ID, `🗑️ Message deleted permanently.`);
  }

  /* ── DELETE reply ── */
  if (data.startsWith('del_reply_')) {
    const id = data.replace('del_reply_', '');
    const r = (db.replies || []).find(rp => rp.id === id);
    if (r) { r.deleted = true; await writeDB(db); }
    return sendMsg(ADMIN_ID, `🗑️ Reply deleted permanently.`);
  }

  /* ── VIEW user ── */
  if (data.startsWith('view_user_')) {
    const uid = data.replace('view_user_', '');
    return cmdViewUser(sendMsg, ADMIN_ID, db, uid);
  }

  /* ── BAN user ── */
  if (data.startsWith('ban_user_')) {
    const uid = data.replace('ban_user_', '');
    if (db.users[uid]) { db.users[uid].banned = true; await writeDB(db); }
    return sendMsg(ADMIN_ID, `🚫 User <code>${uid}</code> Banned!`);
  }

  /* ── UNBAN user ── */
  if (data.startsWith('unban_user_')) {
    const uid = data.replace('unban_user_', '');
    if (db.users[uid]) { db.users[uid].banned = false; await writeDB(db); }
    return sendMsg(ADMIN_ID, `✅ User <code>${uid}</code> Unbanned!`);
  }

  /* ── CLEAR user data ── */
  if (data.startsWith('clear_user_')) {
    const uid = data.replace('clear_user_', '');
    return clearUserData(sendMsg, ADMIN_ID, db, writeDB, uid);
  }

  /* ── SEND CONFIRM ── */
  if (data.startsWith('send_confirm_')) {
    const uid = data.replace('send_confirm_', '');
    const st = adminState[ADMIN_ID];
    if (st && st.data && st.data.text) {
      delete adminState[ADMIN_ID];
      return sendReplyToUser(sendMsg, ADMIN_ID, db, writeDB, genId, getBDTime, uid, st.data.text);
    }
  }

  /* ── CAPTION ADD ── */
  if (data === 'cap_add') {
    adminState[ADMIN_ID] = { step: 'caption_add' };
    return sendMsg(ADMIN_ID, `➕ <b>Add New Caption Mode Activated</b>\n\n📝 Please type your new caption below:\n✍️ Send your caption as message...\n\n(Cancel করতে /cancel)`);
  }

  /* ── CAPTION EDIT ── */
  if (data.startsWith('cap_edit_')) {
    const capId = data.replace('cap_edit_', '');
    adminState[ADMIN_ID] = { step: 'caption_edit', data: { capId } };
    return sendMsg(ADMIN_ID, `✏️ <b>Edit Caption Mode Activated</b>\n\n📝 Please send the updated caption text...\n\n(Cancel করতে /cancel)`);
  }

  /* ── CAPTION DELETE ── */
  if (data.startsWith('cap_del_')) {
    const capId = data.replace('cap_del_', '');
    return sendMsg(ADMIN_ID, `🗑️ <b>Delete Confirmation Required</b>\n\n⚠️ Are you sure you want to delete this caption?`, {
      reply_markup: {
        inline_keyboard: [[
          { text: '✔️ Yes, Delete', callback_data: `cap_del_confirm_${capId}` },
          { text: '❌ No, Cancel',  callback_data: 'cancel' },
        ]],
      },
    });
  }
  if (data.startsWith('cap_del_confirm_')) {
    const capId = data.replace('cap_del_confirm_', '');
    const cap = (db.captions || []).find(c => c.id === capId);
    if (cap) { cap.deleted = true; await writeDB(db); }
    return sendMsg(ADMIN_ID, `✅ <b>Caption Deleted Successfully!</b>\n\n📌 The caption has been removed from system.`, { reply_markup: MAIN_KEYBOARD });
  }

  /* ── ADS ── */
  if (data === 'ads_on')  return cmdAds(sendMsg, ADMIN_ID, db, writeDB, 'on');
  if (data === 'ads_off') return cmdAds(sendMsg, ADMIN_ID, db, writeDB, 'off');

  /* ── CANCEL ── */
  if (data === 'cancel') {
    delete adminState[ADMIN_ID];
    return sendMsg(ADMIN_ID, '❌ Cancelled.', { reply_markup: MAIN_KEYBOARD });
  }
}

/* ─────────────────────────────────────────
   SEND REPLY TO USER
───────────────────────────────────────── */
async function sendReplyToUser(sendMsg, ADMIN_ID, db, writeDB, genId, getBDTime, uid, replyText) {
  const sentTime = getBDTime();
  const msgIdNum = ((db.replies || []).filter(r => !r.deleted).length) + 1;
  const reply = {
    id: genId(),
    msgId: msgIdNum,
    toUID: String(uid),
    text: replyText,
    sentTime,
    seen: false,
    seenReported: false,
    deleted: false,
    timestamp: Date.now(),
  };
  if (!db.replies) db.replies = [];
  db.replies.push(reply);
  if (db.users[uid]) {
    db.users[uid].totalReceived = (db.users[uid].totalReceived || 0) + 1;
    db.users[uid].lastActive = sentTime;
  }
  await writeDB(db);

  await sendMsg(ADMIN_ID,
    `╔══════════════════════╗\n📤 <b>REPLY STATUS REPORT</b>\n╚══════════════════════╝\n\n✅ <b>Reply Sent To User ID:</b> <code>${uid}</code>\n\n🕒 <b>Time &amp; Date:</b>\n${sentTime}\n\n⏳ <b>Status:</b>\nWait For User Seen Your Message!`,
    { reply_markup: MAIN_KEYBOARD }
  );
}

/* ─────────────────────────────────────────
   BROADCAST TO ALL
───────────────────────────────────────── */
async function sendBroadcast(sendMsg, ADMIN_ID, db, writeDB, genId, getBDTime, bcText) {
  const time = getBDTime();
  const bc = {
    id: genId(),
    text: bcText,
    time,
    seenBy: [],
    timestamp: Date.now(),
  };
  if (!db.broadcasts) db.broadcasts = [];
  db.broadcasts.push(bc);
  await writeDB(db);

  const userCount = Object.keys(db.users || {}).length;
  await sendMsg(ADMIN_ID,
    `✅ <b>Broadcast Successfully Sent To Website All Users!</b>\n\n🕒 <b>Send Time:</b>\n${time}\n\n👥 <b>Total Recipients:</b> ${userCount}`,
    { reply_markup: MAIN_KEYBOARD }
  );
}

/* ─────────────────────────────────────────
   CLEAR USER DATA
───────────────────────────────────────── */
async function clearUserData(sendMsg, ADMIN_ID, db, writeDB, uid) {
  if (!db.users[uid]) return sendMsg(ADMIN_ID, `❌ User <code>${uid}</code> পাওয়া যায়নি।`);
  // Remove user's messages, replies, captions
  db.messages = (db.messages || []).filter(m => String(m.fromUID) !== String(uid));
  db.replies  = (db.replies  || []).filter(r => String(r.toUID)   !== String(uid));
  db.captions = (db.captions || []).filter(c => String(c.addedBy) !== String(uid));
  delete db.users[uid];
  await writeDB(db);
  return sendMsg(ADMIN_ID, `🗑️ <b>User <code>${uid}</code> Data Cleared!</b>\n\nSite থেকে সেই User-এর সব data permanently deleted হয়েছে। পরবর্তীতে Site Visit করলে নতুনভাবে Register হবে।`, { reply_markup: MAIN_KEYBOARD });
}

/* ─────────────────────────────────────────
   DELETE MESSAGE BY ID
───────────────────────────────────────── */
async function deleteMessageById(sendMsg, ADMIN_ID, db, writeDB, msgId) {
  const m = (db.messages || []).find(msg => msg.msgId === msgId);
  const r = (db.replies  || []).find(rep => rep.msgId === msgId);
  if (m) { m.deleted = true; await writeDB(db); return sendMsg(ADMIN_ID, `✅ Message ID ${pad2(msgId)} deleted permanently.`); }
  if (r) { r.deleted = true; await writeDB(db); return sendMsg(ADMIN_ID, `✅ Reply ID ${pad2(msgId)} deleted permanently.`); }
  return sendMsg(ADMIN_ID, `❌ Message ID ${pad2(msgId)} পাওয়া যায়নি।`);
}

module.exports = {
  handleCommand,
  handleCallbackQuery,
  handleAdminState,
  MAIN_KEYBOARD,
};
