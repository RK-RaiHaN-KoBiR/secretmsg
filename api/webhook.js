// =============================================
// CITHI PATHAN - TELEGRAM BOT WEBHOOK (webhook.js)
// Handles all bot commands & inline callbacks
// Deployed as Vercel Serverless Function
// =============================================

const admin  = require('firebase-admin');
const fetch  = require('node-fetch');

// ---- Firebase Admin Init ----
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID   || 'cithi-pathan',
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY  || '').replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL  || ''
    })
  });
}

const db = admin.firestore();

// ---- Bot Config ----
const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID || '6048050987');
const WEBSITE_URL   = process.env.WEBSITE_URL || 'https://cithipathao.vercel.app';

// =============================================
// TELEGRAM API HELPERS
// =============================================

// Send raw Telegram API request
async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body)
  });
  return res.json();
}

// Send a text message
async function sendMsg(chatId, text, extra = {}) {
  return tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}

// Answer a callback query (clears loading spinner on button)
async function answerCB(id, text = '') {
  return tg('answerCallbackQuery', { callback_query_id: id, text });
}

// Edit an existing message (for confirmation dialogs etc.)
async function editMsg(chatId, msgId, text, extra = {}) {
  return tg('editMessageText', { chat_id: chatId, message_id: msgId, text, parse_mode: 'HTML', ...extra });
}

// ---- Admin Keyboard (persistent reply keyboard) ----
const ADMIN_KEYBOARD = {
  keyboard: [
    ['📨 Send Message',    '📥 Received History'],
    ['📤 Reply History',   '👥 Show All Users'],
    ['📢 Broadcast',       '📝 Caption BOX'],
    ['🆘 Help',            '📊 Bot Status']
  ],
  resize_keyboard: true,
  persistent: true
};

// =============================================
// SESSION MANAGEMENT (Firestore-backed)
// Vercel serverless functions are stateless,
// so we store conversation state in Firestore
// =============================================

const SESSIONS_COL = '_botSessions';

async function getSession(chatId) {
  try {
    const doc = await db.collection(SESSIONS_COL).doc(String(chatId)).get();
    if (doc.exists) return doc.data();
  } catch {}
  return { state: null, data: {} };
}

async function setSession(chatId, sessionData) {
  try {
    await db.collection(SESSIONS_COL).doc(String(chatId)).set(sessionData, { merge: true });
  } catch {}
}

async function clearSession(chatId) {
  try {
    await db.collection(SESSIONS_COL).doc(String(chatId)).set({ state: null, data: {} });
  } catch {}
}

// =============================================
// HELPERS
// =============================================

// Get BD Time (Asia/Dhaka, 12-hour format)
function getBDTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hour12: true
  });
  const dateStr = now.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Dhaka', day: '2-digit', month: '2-digit', year: 'numeric'
  }).split('/').join('-');
  return { timeStr, dateStr };
}

// Check if message is from admin
function isAdmin(chatId) {
  return String(chatId) === ADMIN_CHAT_ID;
}

// =============================================
// COMMAND HANDLERS
// =============================================

// /start → Welcome message + keyboard
async function handleStart(chatId) {
  const { timeStr, dateStr } = getBDTime();
  const msg =
`╔══════════════════════════════╗
💌 <b>Welcome To চিঠি পাঠান</b>
    <i>Secret Anonymous Messaging</i>
╚══════════════════════════════╝

✨ <b>Available Features:</b>

🔘 Send Message To Users
🔘 Receive & Reply Messages
🔘 Push Notification System
🔘 Live Popup Message
🔘 Broadcast To All Users
🔘 Caption Management
🔘 Ban / Unban Users

📅 <b>Time:</b> ${timeStr} — ${dateStr} BD Time

📌 Use Keyboard Buttons or type commands.
Type /help for full command list.`;

  await sendMsg(chatId, msg, { reply_markup: ADMIN_KEYBOARD });
  await clearSession(chatId);
}

// /send (step 1) → ask for User ID
async function handleSendMessage(chatId) {
  await setSession(chatId, { state: 'WAIT_SEND_UID', data: {} });
  await sendMsg(chatId,
    '📨 <b>Send Message To User</b>\n\n🆔 Enter User ID:\n<i>(e.g. 1001)</i>'
  );
}

// /send [uid] [msg] → shortcut command
async function handleSendCommand(chatId, args) {
  const parts  = args.trim().split(' ');
  const uid    = parts[0];
  const message = parts.slice(1).join(' ');

  if (!uid || !message) {
    return sendMsg(chatId, '⚠️ Usage: /send [uid] [message]\nExample: /send 1001 Hello there!');
  }
  await sendReplyToUser(chatId, uid, message);
}

// Core: send reply to a specific user
async function sendReplyToUser(chatId, uid, message) {
  const { timeStr, dateStr } = getBDTime();

  try {
    // Generate sequential message ID for this reply
    const msgID = await generateNextID(`adminReplies_${uid}`);

    // Save to Firestore
    const replyData = {
      msgID,
      toUID:     parseInt(uid),
      message,
      sendTime:  timeStr,
      sendDate:  dateStr,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      seenByUser: false
    };
    await db.collection('adminReplies').doc(`${uid}_${msgID}`).set(replyData);

    // Update user's totalReceived count
    await db.collection('users').doc(String(uid)).update({
      totalReceived: admin.firestore.FieldValue.increment(1),
      lastActive:    admin.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});

    // Send success report to admin
    await sendMsg(chatId,
`╔══════════════════════╗
📤 <b>REPLY STATUS REPORT</b>
╚══════════════════════╝

✅ Reply Sent To User ID : <b>${uid}</b>

🕒 Time & Date :
${timeStr} 🔹 ${dateStr}

⏳ Status :
Wait For User Seen Your Message!`
    );

    await clearSession(chatId);
  } catch (err) {
    await sendMsg(chatId, `❌ Failed to send reply. Error: ${err.message}`);
  }
}

// Sequential ID generator (Firestore transaction)
async function generateNextID(counterKey) {
  return db.runTransaction(async (t) => {
    const ref = db.collection('_counters').doc(counterKey);
    const doc = await t.get(ref);
    let next = 1;
    if (doc.exists) next = (doc.data().last || 0) + 1;
    t.set(ref, { last: next });
    return String(next).padStart(2, '0');
  });
}

// Received History (messages sent by users)
async function handleReceivedHistory(chatId) {
  try {
    const snap = await db.collection('sentMessages')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    if (snap.empty) {
      return sendMsg(chatId, '📭 কোনো Message নেই এখনো।');
    }

    await sendMsg(chatId, '📥 <b>RECEIVED HISTORY</b> (Last 20)\n━━━━━━━━━━━━━━━━━━━━━━━');

    for (const doc of snap.docs) {
      const d = doc.data();
      const msgText =
`┌────────────────────────┐
Msg ID: <b>${d.msgID}</b>
User ID: <b>${d.userID}</b>
Name: ${d.senderName || 'Unknown'}
Message: ${d.message}
Time: ${d.sendTime}, ${d.sendDate}
└────────────────────────┘`;

      await sendMsg(chatId, msgText, {
        reply_markup: {
          inline_keyboard: [[
            { text: '📩 Send Reply',  callback_data: `reply_${d.userID}` },
            { text: '🗑️ Delete',      callback_data: `del_sent_${doc.id}` }
          ]]
        }
      });
    }
  } catch (err) {
    await sendMsg(chatId, `❌ Error: ${err.message}`);
  }
}

// Reply History (messages admin has sent to users)
async function handleReplyHistory(chatId) {
  try {
    const snap = await db.collection('adminReplies')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    if (snap.empty) {
      return sendMsg(chatId, '📭 কোনো Reply পাঠানো হয়নি এখনো।');
    }

    await sendMsg(chatId, '📤 <b>REPLY HISTORY</b> (Last 20)\n━━━━━━━━━━━━━━━━━━━━━━━');

    for (const doc of snap.docs) {
      const d = doc.data();
      const seen = d.seenByUser
        ? `✅ Seen at ${d.seenTime} ${d.seenDate}`
        : '⏳ Not seen yet';

      const msgText =
`┌────────────────────────┐
Msg ID: <b>${d.msgID}</b>
User ID: <b>${d.toUID}</b>
Message: ${d.message}
Send Time: ${d.sendTime}, ${d.sendDate}
${seen}
└────────────────────────┘`;

      await sendMsg(chatId, msgText, {
        reply_markup: {
          inline_keyboard: [[
            { text: '🗑️ Delete', callback_data: `del_reply_${doc.id}` }
          ]]
        }
      });
    }
  } catch (err) {
    await sendMsg(chatId, `❌ Error: ${err.message}`);
  }
}

// Show All Users list
async function handleShowAllUsers(chatId) {
  try {
    const snap = await db.collection('users')
      .orderBy('createdAt', 'asc')
      .get();

    if (snap.empty) {
      return sendMsg(chatId, '📭 কোনো User নেই এখনো।');
    }

    await sendMsg(chatId,
`╔══════════════════════════════╗
👥 <b>REGISTERED USER ID LIST</b>
╚══════════════════════════════╝
Total: ${snap.size} users`
    );

    let num = 1;
    for (const doc of snap.docs) {
      const d = doc.data();
      const uid = d.uid || doc.id;
      const bannedStatus = d.banned ? '🚫 BANNED' : '✅ Active';

      await sendMsg(chatId,
`━━━━━━━━━━━━━━━━━━
🔢 Number : ${num}
🆔 User ID : <b>${uid}</b>
🔴 Status : ${bannedStatus}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔍 View Info',    callback_data: `view_${uid}` },
                { text: '🗑️ Clear Data',   callback_data: `clear_${uid}` }
              ],
              [
                { text: '🚫 Ban',          callback_data: `ban_${uid}` },
                { text: '✅ Unban',         callback_data: `unban_${uid}` }
              ]
            ]
          }
        }
      );
      num++;
    }
  } catch (err) {
    await sendMsg(chatId, `❌ Error: ${err.message}`);
  }
}

// View detailed user info
async function handleViewUserInfo(chatId, uid) {
  try {
    const doc = await db.collection('users').doc(String(uid)).get();
    if (!doc.exists) {
      return sendMsg(chatId, `❌ User ${uid} not found.`);
    }
    const d = doc.data();

    await sendMsg(chatId,
`━━━━━━━━━━━━━━━━━━━━━━━
🔰 <b>USER PROFILE INFORMATION</b> 🔰
━━━━━━━━━━━━━━━━━━━━━━━

🆔 User ID            : <b>${uid}</b>
👤 Full Name          : ${d.name || 'Not Set'}
📱 WhatsApp           : ${d.whatsapp || 'Not Set'}
🔗 FB Profile         : ${d.fbLink || 'Not Added'}
🌍 Location           : ${d.city || 'Unknown'}, ${d.country || 'Unknown'}
📶 Network            : ${d.network || 'Unknown'}
📱 Device             : ${d.device || 'Unknown'}
🧠 Browser            : ${d.browser || 'Unknown'}
🔋 Battery            : ${d.battery || 'Unknown'}
💾 RAM                : ${d.ram || 'Unknown'}
🌍 IP Address         : ${d.ip || 'Unknown'}
🏠 Division           : ${d.division || 'Unknown'}
📍 Zilla              : ${d.zilla || 'Unknown'}
📡 ISP                : ${d.isp || 'Unknown'}
🔔 Notifications      : ${d.notificationEnabled ? '✅ Allowed' : '❌ Disabled'}
💌 Total Sent         : ${d.totalSent || 0}
📥 Total Received     : ${d.totalReceived || 0}
🟢 Account Status     : ${d.banned ? '🚫 BANNED' : '✅ Active'}
📅 Registered         : ${d.joinDate || '--'} ${d.joinTime || ''}
🕒 Last Active        : ${d.lastActive?.toDate ? d.lastActive.toDate().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }) : '--'}

🧠 User Agent:
${(d.userAgent || 'Unknown').substring(0, 150)}`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '📩 Send Message', callback_data: `reply_${uid}` },
            { text: '🚫 Ban',          callback_data: `ban_${uid}` }
          ]]
        }
      }
    );
  } catch (err) {
    await sendMsg(chatId, `❌ Error: ${err.message}`);
  }
}

// Broadcast to all users (step 1)
async function handleBroadcast(chatId) {
  await setSession(chatId, { state: 'WAIT_BROADCAST_MSG', data: {} });
  await sendMsg(chatId,
    '📢 <b>Broadcast To All Users</b>\n\n💌 Enter broadcast message:\n<i>(This will be sent to ALL registered users)</i>'
  );
}

// Core: actually send broadcast to all users
async function sendBroadcastToAll(chatId, message) {
  const { timeStr, dateStr } = getBDTime();

  try {
    const usersSnap = await db.collection('users').get();

    if (usersSnap.empty) {
      return sendMsg(chatId, '📭 কোনো User নেই।');
    }

    // Save broadcast to Firestore so all clients see it via real-time listener
    const bcastRef = db.collection('broadcasts').doc();
    await bcastRef.set({
      message,
      sendTime:  timeStr,
      sendDate:  dateStr,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      seenBy:    []
    });

    // Send success report to admin
    await sendMsg(chatId,
`✅ <b>Broadcast Successfully Sent!</b>

💌 Message:
${message}

🕒 Send Time:
${dateStr} — ${timeStr} BD Time

👥 Sent To: ${usersSnap.size} users`
    );

    await clearSession(chatId);
  } catch (err) {
    await sendMsg(chatId, `❌ Broadcast failed: ${err.message}`);
  }
}

// Caption Box - list all captions
async function handleCaptionBox(chatId) {
  try {
    const snap = await db.collection('captions').orderBy('timestamp', 'asc').get();

    await sendMsg(chatId, '🛠️ <b>CAPTION LIST</b>\n━━━━━━━━━━━━━━━━━━━━━━━');

    if (snap.empty) {
      await sendMsg(chatId, '📝 কোনো Caption নেই এখনো।', {
        reply_markup: {
          inline_keyboard: [[{ text: '➕ Add New Caption', callback_data: 'cap_add' }]]
        }
      });
      return;
    }

    for (const doc of snap.docs) {
      const d = doc.data();
      const isAdmin_cap = d.addedBy === 'Admin';

      await sendMsg(chatId,
`━━━━━━━━━━━━━━━━━━━━━━━
Caption ID: <b>${d.capID || '--'}</b>
📌 Caption:
${d.text}

🕒 ${d.addedTime || ''} — ${d.addedDate || ''}
🆔 Added By: ${d.addedBy || 'Unknown'}`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '✏️ Edit',   callback_data: `cap_edit_${doc.id}` },
              { text: '🗑️ Delete', callback_data: `cap_del_${doc.id}` }
            ]]
          }
        }
      );
    }

    await sendMsg(chatId, '─────────────────────', {
      reply_markup: {
        inline_keyboard: [[{ text: '➕ Add New Caption', callback_data: 'cap_add' }]]
      }
    });
  } catch (err) {
    await sendMsg(chatId, `❌ Error: ${err.message}`);
  }
}

// Help menu
async function handleHelp(chatId) {
  await sendMsg(chatId,
`╔══════════════════════╗
🤖 <b>BOT HELP &amp; COMMAND MENU</b>
╚══════════════════════╝

📌 <b>Available Commands:</b>

/start → Open Welcome Menu
/send [uid] [msg] → Send Reply To User
/received → View Received Messages
/replyhistory → View Sent Replies History
/users → Show All Registered Users
/broadcast → Send Broadcast To All
/caption → Manage Website Captions
/help → Open Help Menu
/ban [uid] → Ban A User
/unban [uid] → Unban A User
/info [uid] → View User Information
/status → View Bot Status Report
/ads on → Enable Ads
/ads off → Disable Ads
/delete [uid] → Delete Message (usage in context)

📌 <b>Keyboard Buttons:</b>
📨 Send Message
📥 Received History
📤 Reply History
👥 Show All Users
📢 Broadcast
📝 Caption BOX
🆘 Help
📊 Bot Status

✅ Both keyboard buttons and commands work the same way!`
  );
}

// Bot status report
async function handleStatus(chatId) {
  try {
    const usersCount  = (await db.collection('users').get()).size;
    const sentCount   = (await db.collection('sentMessages').get()).size;
    const repliesCount = (await db.collection('adminReplies').get()).size;
    const captionsCount = (await db.collection('captions').get()).size;
    const adsDoc       = await db.collection('_system').doc('adsConfig').get();
    const adsEnabled   = adsDoc.exists ? adsDoc.data().enabled !== false : true;
    const { timeStr, dateStr } = getBDTime();

    await sendMsg(chatId,
`📊 <b>BOT STATUS REPORT</b>

👥 Total Users      : ${usersCount}
💌 Total Messages   : ${sentCount}
📤 Total Replies    : ${repliesCount}
📝 Total Captions   : ${captionsCount}
📢 Ads Status       : ${adsEnabled ? '✅ ON' : '🔴 OFF'}

🕒 Report Time: ${timeStr} — ${dateStr} BD Time`
    );
  } catch (err) {
    await sendMsg(chatId, `❌ Error: ${err.message}`);
  }
}

// =============================================
// CALLBACK QUERY HANDLER (Inline Button Clicks)
// =============================================
async function handleCallback(chatId, callbackId, data, msgId) {
  await answerCB(callbackId);

  // ---- reply_[uid] → Start reply flow ----
  if (data.startsWith('reply_')) {
    const uid = data.replace('reply_', '');
    await setSession(chatId, { state: 'WAIT_REPLY_MSG', data: { uid } });
    return sendMsg(chatId,
      `💌 <b>Reply To User ${uid}</b>\n\n✍️ Enter your reply message:`
    );
  }

  // ---- ban_[uid] ----
  if (data.startsWith('ban_')) {
    const uid = data.replace('ban_', '');
    await db.collection('users').doc(String(uid)).update({ banned: true });
    return sendMsg(chatId, `🚫 User <b>${uid}</b> has been BANNED successfully.`);
  }

  // ---- unban_[uid] ----
  if (data.startsWith('unban_')) {
    const uid = data.replace('unban_', '');
    await db.collection('users').doc(String(uid)).update({ banned: false });
    return sendMsg(chatId, `✅ User <b>${uid}</b> has been UNBANNED successfully.`);
  }

  // ---- view_[uid] → View user info ----
  if (data.startsWith('view_')) {
    const uid = data.replace('view_', '');
    return handleViewUserInfo(chatId, uid);
  }

  // ---- clear_[uid] → Clear all user data ----
  if (data.startsWith('clear_')) {
    const uid = data.replace('clear_', '');
    return sendMsg(chatId,
      `⚠️ <b>Clear User Data for ${uid}?</b>\n\nThis will delete ALL data for this user. They will be treated as a new user on next visit.`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '✔️ Yes, Clear All', callback_data: `clear_confirm_${uid}` },
            { text: '❌ Cancel',          callback_data: 'cancel_action' }
          ]]
        }
      }
    );
  }

  // ---- clear_confirm_[uid] ----
  if (data.startsWith('clear_confirm_')) {
    const uid = data.replace('clear_confirm_', '');
    try {
      const batch = db.batch();
      // Delete sent messages
      const sentSnap = await db.collection('sentMessages').where('userID', '==', parseInt(uid)).get();
      sentSnap.forEach(d => batch.delete(d.ref));
      // Delete received messages
      const recvSnap = await db.collection('adminReplies').where('toUID', '==', parseInt(uid)).get();
      recvSnap.forEach(d => batch.delete(d.ref));
      // Delete user doc
      batch.delete(db.collection('users').doc(uid));
      // Delete counters
      batch.delete(db.collection('_counters').doc(`sentMessages_${uid}`));
      batch.delete(db.collection('_counters').doc(`adminReplies_${uid}`));
      await batch.commit();
      return sendMsg(chatId,
        `✅ User <b>${uid}</b> data cleared completely!\n\nThis user will start fresh on next visit.`
      );
    } catch (err) {
      return sendMsg(chatId, `❌ Clear failed: ${err.message}`);
    }
  }

  // ---- del_sent_[docId] → Delete a received message ----
  if (data.startsWith('del_sent_')) {
    const docId = data.replace('del_sent_', '');
    await db.collection('sentMessages').doc(docId).delete();
    return sendMsg(chatId, '🗑️ Message deleted from all places.');
  }

  // ---- del_reply_[docId] → Delete an admin reply ----
  if (data.startsWith('del_reply_')) {
    const docId = data.replace('del_reply_', '');
    await db.collection('adminReplies').doc(docId).delete();
    return sendMsg(chatId, '🗑️ Reply deleted successfully from all places.');
  }

  // ---- cap_add → Add new caption ----
  if (data === 'cap_add') {
    await setSession(chatId, { state: 'WAIT_CAP_ADD', data: {} });
    return sendMsg(chatId,
      '➕ <b>Add New Caption</b>\n\n📝 Please type your new caption below:'
    );
  }

  // ---- cap_edit_[docId] ----
  if (data.startsWith('cap_edit_')) {
    const docId = data.replace('cap_edit_', '');
    await setSession(chatId, { state: 'WAIT_CAP_EDIT', data: { docId } });
    return sendMsg(chatId,
      '✏️ <b>Edit Caption</b>\n\n📝 Please send the updated caption text:'
    );
  }

  // ---- cap_del_[docId] → Confirm delete ----
  if (data.startsWith('cap_del_') && !data.startsWith('cap_del_confirm_') && data !== 'cap_del_cancel') {
    const docId = data.replace('cap_del_', '');
    return sendMsg(chatId,
      '🗑️ <b>Delete Confirmation Required</b>\n\n⚠️ Are you sure you want to delete this caption?',
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '✔️ Yes, Delete', callback_data: `cap_del_confirm_${docId}` },
            { text: '❌ No, Cancel',  callback_data: 'cap_del_cancel' }
          ]]
        }
      }
    );
  }

  // ---- cap_del_confirm_[docId] ----
  if (data.startsWith('cap_del_confirm_')) {
    const docId = data.replace('cap_del_confirm_', '');
    await db.collection('captions').doc(docId).delete();
    return sendMsg(chatId, '✅ Caption Deleted Successfully!\n\n📌 The caption has been removed from the website.');
  }

  // ---- cap_del_cancel ----
  if (data === 'cap_del_cancel') {
    return sendMsg(chatId, '❌ Caption delete cancelled.');
  }

  // ---- cancel_action ----
  if (data === 'cancel_action') {
    return sendMsg(chatId, '❌ Action cancelled.');
  }
}

// =============================================
// MULTI-STEP STATE MESSAGE HANDLER
// =============================================
async function handleStateMessage(chatId, text, session) {
  const { state, data } = session;

  // Step 1: Waiting for User ID to send a message
  if (state === 'WAIT_SEND_UID') {
    const uid = text.trim();
    if (!/^\d{4}$/.test(uid) || parseInt(uid) < 1001 || parseInt(uid) > 9999) {
      return sendMsg(chatId, '⚠️ Invalid User ID. Enter a 4-digit ID between 1001–9999.');
    }
    await setSession(chatId, { state: 'WAIT_SEND_MSG', data: { uid } });
    return sendMsg(chatId, `✅ User ID: <b>${uid}</b>\n\n💌 Now enter your message:`);
  }

  // Step 2: Waiting for message text to send to user
  if (state === 'WAIT_SEND_MSG') {
    await sendReplyToUser(chatId, data.uid, text.trim());
    return; // clearSession called inside sendReplyToUser
  }

  // Waiting for reply message (from inline button)
  if (state === 'WAIT_REPLY_MSG') {
    await sendReplyToUser(chatId, data.uid, text.trim());
    return;
  }

  // Waiting for broadcast message
  if (state === 'WAIT_BROADCAST_MSG') {
    await sendBroadcastToAll(chatId, text.trim());
    return;
  }

  // Waiting for new caption text
  if (state === 'WAIT_CAP_ADD') {
    const { timeStr, dateStr } = getBDTime();
    const capID = await generateNextID('globalCapID');

    await db.collection('captions').add({
      capID,
      text:      text.trim(),
      addedBy:   'Admin',
      addedByUID: 'admin',
      addedTime: timeStr,
      addedDate: dateStr,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    await sendMsg(chatId,
`✅ <b>Caption Successfully Added!</b>

📌 Caption ID: <b>${capID}</b>
💬 Caption: ${text.trim()}

🌐 It is now visible on the website instantly.`
    );
    await clearSession(chatId);
    return;
  }

  // Waiting for edited caption text
  if (state === 'WAIT_CAP_EDIT') {
    const { docId } = data;
    await db.collection('captions').doc(docId).update({ text: text.trim() });
    await sendMsg(chatId,
      '✅ <b>Caption Updated Successfully!</b>\n\n📌 Changes saved and updated on website instantly.'
    );
    await clearSession(chatId);
    return;
  }
}

// =============================================
// ADS TOGGLE HANDLERS
// =============================================
async function handleAdsToggle(chatId, action) {
  const enabled = action === 'on';
  await db.collection('_system').doc('adsConfig').set({ enabled });
  await sendMsg(chatId,
    `📢 Ads have been turned <b>${action.toUpperCase()}</b>.\n\n${enabled ? '✅ Ads are now visible on website.' : '🔴 Ads are now hidden from website.'}`
  );
}

// =============================================
// MAIN WEBHOOK HANDLER (Vercel entry point)
// =============================================
module.exports = async (req, res) => {
  // Always respond 200 to Telegram immediately (required)
  res.status(200).json({ ok: true });

  if (req.method !== 'POST') return;

  const body = req.body;
  if (!body) return;

  try {
    // ---- Handle callback queries (inline button clicks) ----
    if (body.callback_query) {
      const cq     = body.callback_query;
      const chatId = String(cq.message?.chat?.id || cq.from?.id);
      if (!isAdmin(chatId)) return;

      await handleCallback(chatId, cq.id, cq.data || '', cq.message?.message_id);
      return;
    }

    // ---- Handle regular messages ----
    if (!body.message) return;

    const msg    = body.message;
    const chatId = String(msg.chat?.id);
    const text   = (msg.text || '').trim();

    // Security: only admin can use the bot
    if (!isAdmin(chatId)) return;

    // Get current session (Firestore-backed)
    const session = await getSession(chatId);

    // If admin is in a multi-step flow, handle state first
    if (session.state && text && !text.startsWith('/')) {
      await handleStateMessage(chatId, text, session);
      return;
    }

    // Reset session on new command
    if (text.startsWith('/')) await clearSession(chatId);

    // ---- Route commands ----
    if (text === '/start')                          { await handleStart(chatId); }
    else if (text.startsWith('/send '))             { await handleSendCommand(chatId, text.slice(6)); }
    else if (text === '/send')                      { await handleSendMessage(chatId); }
    else if (text === '/received')                  { await handleReceivedHistory(chatId); }
    else if (text === '/replyhistory')              { await handleReplyHistory(chatId); }
    else if (text === '/users')                     { await handleShowAllUsers(chatId); }
    else if (text === '/broadcast')                 { await handleBroadcast(chatId); }
    else if (text === '/caption')                   { await handleCaptionBox(chatId); }
    else if (text === '/help')                      { await handleHelp(chatId); }
    else if (text === '/status')                    { await handleStatus(chatId); }
    else if (text.startsWith('/ban '))              {
      const uid = text.slice(5).trim();
      await db.collection('users').doc(uid).update({ banned: true });
      await sendMsg(chatId, `🚫 User ${uid} BANNED.`);
    }
    else if (text.startsWith('/unban '))            {
      const uid = text.slice(7).trim();
      await db.collection('users').doc(uid).update({ banned: false });
      await sendMsg(chatId, `✅ User ${uid} UNBANNED.`);
    }
    else if (text.startsWith('/info '))             { await handleViewUserInfo(chatId, text.slice(6).trim()); }
    else if (text === '/ads on')                    { await handleAdsToggle(chatId, 'on'); }
    else if (text === '/ads off')                   { await handleAdsToggle(chatId, 'off'); }

    // ---- Keyboard buttons (same as commands) ----
    else if (text === '📨 Send Message')            { await handleSendMessage(chatId); }
    else if (text === '📥 Received History')        { await handleReceivedHistory(chatId); }
    else if (text === '📤 Reply History')           { await handleReplyHistory(chatId); }
    else if (text === '👥 Show All Users')          { await handleShowAllUsers(chatId); }
    else if (text === '📢 Broadcast')               { await handleBroadcast(chatId); }
    else if (text === '📝 Caption BOX')             { await handleCaptionBox(chatId); }
    else if (text === '🆘 Help')                    { await handleHelp(chatId); }
    else if (text === '📊 Bot Status')              { await handleStatus(chatId); }

    // Unknown command
    else {
      await sendMsg(chatId, '⚠️ Unknown command. Type /help to see all commands.', {
        reply_markup: ADMIN_KEYBOARD
      });
    }

  } catch (err) {
    console.error('Webhook error:', err.message);
  }
};
