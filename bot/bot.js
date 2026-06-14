// =============================================
// CITHI PATHAN - TELEGRAM BOT (bot.js)
// Standalone version - runs on Render/Railway/VPS
// Uses long-polling (no webhook needed)
// =============================================

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');

// ---- CONFIGURATION ----
// All settings come from .env file
const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID      || '6048050987';
const WEBSITE_URL   = process.env.WEBSITE_URL        || 'https://cithipathao.vercel.app';

// ---- FIREBASE ADMIN INIT ----
// Server-side Firebase using service account
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID   || 'cithi-pathan',
        privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || ''
      })
    });
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.error('❌ Firebase init error:', err.message);
  }
}

const db  = admin.firestore();
const bot = new Telegraf(BOT_TOKEN);

// =============================================
// SESSION MANAGEMENT
// Stores multi-step conversation state per admin
// =============================================
const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { state: null, data: {} });
  }
  return sessions.get(chatId);
}

function clearSession(chatId) {
  sessions.set(chatId, { state: null, data: {} });
}

// =============================================
// HELPERS
// =============================================

// Get current BD time (Asia/Dhaka, 12-hour format)
function getBDTime() {
  const now  = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit', minute: '2-digit',
    hour12: true
  });
  const dateStr = now.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).split('/').join('-');
  return { timeStr, dateStr };
}

// Check if the sender is admin
function isAdmin(ctx) {
  return String(ctx.from?.id) === String(ADMIN_CHAT_ID);
}

// Reply to a ctx with admin check
async function adminOnly(ctx, fn) {
  if (!isAdmin(ctx)) {
    return ctx.reply('⛔ This bot is for admin use only.');
  }
  return fn();
}

// Send FCM push notification to a specific user
async function sendPushToUser(uid, title, body) {
  try {
    const userDoc = await db.collection('users').doc(String(uid)).get();
    if (!userDoc.exists) return false;
    const token = userDoc.data().fcmToken;
    if (!token) return false;

    await admin.messaging().send({
      token,
      notification: { title, body },
      webpush: {
        fcmOptions: { link: WEBSITE_URL },
        notification: { icon: '/icons/icon-192.png' }
      }
    });
    return true;
  } catch {
    return false;
  }
}

// Generate sequential ID using Firestore transaction
async function getNextID(counterKey) {
  return db.runTransaction(async (t) => {
    const ref = db.collection('_counters').doc(counterKey);
    const doc = await t.get(ref);
    let next  = 1;
    if (doc.exists) next = (doc.data().last || 0) + 1;
    t.set(ref, { last: next });
    return String(next).padStart(2, '0');
  });
}

// =============================================
// ADMIN KEYBOARD MENU
// =============================================
const KEYBOARD = Markup.keyboard([
  ['📨 Send Message',    '📥 Received History'],
  ['📤 Reply History',   '👥 Show All Users'],
  ['📢 Broadcast',       '📝 Caption BOX'],
  ['🆘 Help',            '📊 Bot Status']
]).resize().persistent();

// =============================================
// /start COMMAND
// =============================================
bot.start((ctx) => adminOnly(ctx, async () => {
  clearSession(ctx.chat.id);
  await ctx.reply(
`╔══════════════════════╗
💌 Welcome Back To
   চিঠি পাঠান
╚══════════════════════╝

✨ Anonymous Messaging Platform

📌 Available Features:
📨 Send Message
📥 Received History
📤 Reply History
👥 Show All Users
📢 Broadcast Notification
📝 Caption System
📊 Bot Status

🌐 Website: ${WEBSITE_URL}`,
    KEYBOARD
  );
}));

// =============================================
// SEND MESSAGE FLOW
// Admin can send a message to any user by UID
// =============================================
bot.hears('📨 Send Message', (ctx) => adminOnly(ctx, async () => {
  const session  = getSession(ctx.chat.id);
  session.state  = 'WAIT_SEND_UID';
  session.data   = {};
  await ctx.reply('🆔 Enter User ID:\n\nExample: 1001');
}));

bot.command('send', (ctx) => adminOnly(ctx, async () => {
  // /send 1001 Hello message
  const args = ctx.message.text.replace('/send', '').trim();
  if (!args) {
    const session = getSession(ctx.chat.id);
    session.state = 'WAIT_SEND_UID';
    session.data  = {};
    return ctx.reply('🆔 Enter User ID:');
  }
  const parts = args.split(' ');
  const uid   = parseInt(parts[0]);
  const msg   = parts.slice(1).join(' ');
  if (!uid || !msg) {
    return ctx.reply('⚠️ Usage: /send 1001 Hello message here');
  }
  await sendReplyToUser(ctx, uid, msg);
}));

// =============================================
// CORE: Send reply to a specific user
// =============================================
async function sendReplyToUser(ctx, uid, message) {
  const { timeStr, dateStr } = getBDTime();
  try {
    // Generate sequential message ID for this user's replies
    const msgID = await getNextID(`adminReplies_${uid}`);

    // Save reply to Firestore
    await db.collection('adminReplies').add({
      msgID,
      toUID:      parseInt(uid),
      message,
      sendTime:   timeStr,
      sendDate:   dateStr,
      timestamp:  admin.firestore.FieldValue.serverTimestamp(),
      seenByUser: false,
      seenTime:   null,
      seenDate:   null
    });

    // Increment user's totalReceived counter
    await db.collection('users').doc(String(uid)).update({
      totalReceived: admin.firestore.FieldValue.increment(1),
      lastActive:    admin.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});

    // Send FCM push notification
    const pushed = await sendPushToUser(
      uid,
      '💌 চিঠি পাঠান',
      'You Have Received New Notification From Admin – Click To Open'
    );

    // Report back to admin
    await ctx.reply(
`╔══════════════════════╗
📤 REPLY STATUS REPORT
╚══════════════════════╝

✅ Reply Sent To User ID : ${uid}

🕒 Time & Date :
${timeStr} 🔹 ${dateStr}...!

🔔 Push Notification: ${pushed ? '✅ Sent' : '❌ No token (user not subscribed)'}

⏳ Status :
Wait For User Seen Your Message!`
    );
  } catch (err) {
    await ctx.reply(`❌ Failed to send to User ${uid}.\nError: ${err.message}`);
  }
}

// =============================================
// RECEIVED HISTORY
// Shows all messages users sent to admin
// =============================================
bot.hears('📥 Received History', (ctx) => adminOnly(ctx, () => handleReceivedHistory(ctx)));
bot.command('received', (ctx) => adminOnly(ctx, () => handleReceivedHistory(ctx)));

async function handleReceivedHistory(ctx) {
  try {
    const snap = await db.collection('sentMessages')
      .orderBy('timestamp', 'desc')
      .limit(15)
      .get();

    if (snap.empty) {
      return ctx.reply('📭 No messages received yet.');
    }

    await ctx.reply(`📥 Received History (last ${snap.size} messages):`);

    for (const doc of snap.docs) {
      const d = doc.data();
      const anon = d.anonymous ? '🎭 Anonymous' : `👤 ${d.senderName || 'Unknown'}`;

      await ctx.reply(
`┌────────────────────────┐
Msg ID : ${d.msgID || '--'}
User ID : ${d.userID}
From : ${anon}
Message : ${d.message}
Time : ${d.sendTime}, ${d.sendDate} BD Time
└────────────────────────┘`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('📩 Reply', `reply_${d.userID}`),
            Markup.button.callback('🗑️ Delete', `del_recv_${doc.id}`)
          ]
        ])
      );
    }
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
}

// =============================================
// REPLY HISTORY
// Shows all replies admin has sent to users
// =============================================
bot.hears('📤 Reply History', (ctx) => adminOnly(ctx, () => handleReplyHistory(ctx)));
bot.command('replyhistory', (ctx) => adminOnly(ctx, () => handleReplyHistory(ctx)));

async function handleReplyHistory(ctx) {
  try {
    const snap = await db.collection('adminReplies')
      .orderBy('timestamp', 'desc')
      .limit(15)
      .get();

    if (snap.empty) {
      return ctx.reply('📭 No replies sent yet.');
    }

    await ctx.reply(`📤 Reply History (last ${snap.size}):`);

    for (const doc of snap.docs) {
      const d    = doc.data();
      const seen = d.seenByUser
        ? `✅ Seen: ${d.seenTime} ${d.seenDate}`
        : '⏳ Not seen yet';

      await ctx.reply(
`┌────────────────────────┐
Msg ID : ${d.msgID || '--'}
User ID : ${d.toUID}
Message : ${d.message}
Sent : ${d.sendTime}, ${d.sendDate} BD Time
${seen}
└────────────────────────┘`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🗑️ Delete', `del_reply_${doc.id}`)]
        ])
      );
    }
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
}

// =============================================
// SHOW ALL USERS
// Lists all registered users with management buttons
// =============================================
bot.hears('👥 Show All Users', (ctx) => adminOnly(ctx, () => handleShowAllUsers(ctx)));
bot.command('users', (ctx) => adminOnly(ctx, () => handleShowAllUsers(ctx)));

async function handleShowAllUsers(ctx) {
  try {
    const snap = await db.collection('users')
      .orderBy('createdAt', 'asc')
      .limit(30)
      .get();

    if (snap.empty) {
      return ctx.reply('📭 No users registered yet.');
    }

    await ctx.reply(
`╔══════════════════════════════╗
👥 REGISTERED USER ID LIST
╚══════════════════════════════╝
Total Users: ${snap.size}`
    );

    let num = 1;
    for (const doc of snap.docs) {
      const d      = doc.data();
      const uid    = d.uid || doc.id;
      const status = d.banned ? '🚫 BANNED' : '✅ Active';

      await ctx.reply(
`━━━━━━━━━━━━━━━━━━
🔢 Number : ${num}
🆔 User ID : ${uid}
📅 Joined  : ${d.joinDate || '--'} ${d.joinTime || ''}
🔴 Status  : ${status}`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('📋 View Info',   `info_${uid}`),
            Markup.button.callback('🗑️ Clear Data',  `clear_${uid}`)
          ],
          [
            Markup.button.callback('🚫 Ban',   `ban_${uid}`),
            Markup.button.callback('✅ Unban', `unban_${uid}`)
          ]
        ])
      );
      num++;
    }
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
}

// =============================================
// VIEW USER INFO
// =============================================
bot.command('info', (ctx) => adminOnly(ctx, async () => {
  const uid = ctx.message.text.replace('/info', '').trim();
  if (!uid) return ctx.reply('⚠️ Usage: /info 1001');
  await showUserInfo(ctx, uid);
}));

async function showUserInfo(ctx, uid) {
  try {
    const doc = await db.collection('users').doc(String(uid)).get();
    if (!doc.exists) {
      return ctx.reply(`❌ User ${uid} not found.`);
    }
    const d = doc.data();

    // Get last message preview
    const lastMsgSnap = await db.collection('sentMessages')
      .where('userID', '==', parseInt(uid))
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    const lastMsg = lastMsgSnap.empty ? 'None' : lastMsgSnap.docs[0].data().message.substring(0, 50);

    await ctx.reply(
`━━━━━━━━━━━━━━━━━━━━━━━
🔰 USER PROFILE INFORMATION 🔰
━━━━━━━━━━━━━━━━━━━━━━━

🆔 User ID            : ${uid}
👤 Full Name          : ${d.name    || 'Not Set'}
📱 Phone Number       : ${d.whatsapp|| 'Not Set'}
🔗 FB Profile         : ${d.fbLink  || 'Not Added'}
🌍 Location           : ${d.city    || '?'}, ${d.country || '?'}
📶 Network            : ${d.network || 'Unknown'}
📱 Device             : ${d.device  || 'Unknown'}
🧠 Browser            : ${d.browser || 'Unknown'}
🔔 Notification       : ${d.notificationEnabled ? '✅ Allowed' : '❌ Disabled'}
💌 Total Sent         : ${d.totalSent     || 0}
📥 Total Received     : ${d.totalReceived || 0}
🟢 Active Status      : ${d.lastActive ? 'Recent' : 'Unknown'}
🔴 User Status        : ${d.banned ? '🚫 BANNED' : '✅ Unbanned'}
📅 Account Created    : ${d.joinDate || '--'} - ${d.joinTime || '--'}
🕒 Last Active        : ${d.lastActive ? 'Recent' : '--'}
🌍 IP Address         : ${d.ip   || 'Unknown'}
📡 ISP Provider       : ${d.isp  || 'Unknown'}
🔋 Battery            : ${d.battery || 'Unknown'}
━━━━━━━━━━━━━━━━━━━━━━━
💬 LAST MESSAGE PREVIEW:
${lastMsg}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('📩 Send Message', `reply_${uid}`),
          Markup.button.callback('🗑️ Clear Data',   `clear_${uid}`)
        ],
        [
          Markup.button.callback('🚫 Ban',   `ban_${uid}`),
          Markup.button.callback('✅ Unban', `unban_${uid}`)
        ]
      ])
    );
  } catch (err) {
    await ctx.reply(`❌ Error loading user info: ${err.message}`);
  }
}

// =============================================
// BAN / UNBAN USER
// =============================================
bot.command('ban', (ctx) => adminOnly(ctx, async () => {
  const uid = ctx.message.text.replace('/ban', '').trim();
  if (!uid) return ctx.reply('⚠️ Usage: /ban 1001');
  await db.collection('users').doc(uid).update({ banned: true });
  await ctx.reply(`✅ User ${uid} has been BANNED.\n\nThey will see ACCESS DENIED when visiting the website.`);
}));

bot.command('unban', (ctx) => adminOnly(ctx, async () => {
  const uid = ctx.message.text.replace('/unban', '').trim();
  if (!uid) return ctx.reply('⚠️ Usage: /unban 1001');
  await db.collection('users').doc(uid).update({ banned: false });
  await ctx.reply(`✅ User ${uid} has been UNBANNED.\n\nThey can now access the website normally.`);
}));

// =============================================
// BROADCAST TO ALL USERS
// =============================================
bot.hears('📢 Broadcast', (ctx) => adminOnly(ctx, async () => {
  const session = getSession(ctx.chat.id);
  session.state = 'WAIT_BROADCAST_MSG';
  await ctx.reply('📢 Broadcast Mode Activated\n\n✍️ Type your broadcast message below:\n\n(All users will receive this as popup + push notification)');
}));

bot.command('broadcast', (ctx) => adminOnly(ctx, async () => {
  const session = getSession(ctx.chat.id);
  session.state = 'WAIT_BROADCAST_MSG';
  await ctx.reply('📢 Broadcast Mode Activated\n\n✍️ Type your broadcast message:');
}));

async function sendBroadcastToAll(ctx, message) {
  const { timeStr, dateStr } = getBDTime();
  await ctx.reply('⏳ Sending broadcast...');

  try {
    // Save to Firestore - all users' clients will pick this up via realtime listener
    await db.collection('broadcasts').add({
      message,
      sendTime:  timeStr,
      sendDate:  dateStr,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // Get all non-banned users
    const usersSnap = await db.collection('users')
      .where('banned', '!=', true)
      .get();

    let pushCount = 0;
    // Send FCM push to all users who have notification token
    for (const userDoc of usersSnap.docs) {
      const token = userDoc.data().fcmToken;
      if (token) {
        try {
          await admin.messaging().send({
            token,
            notification: {
              title: '📢 Admin Broadcast',
              body:  message.substring(0, 100)
            },
            webpush: { fcmOptions: { link: WEBSITE_URL } }
          });
          pushCount++;
        } catch {}
      }
    }

    await ctx.reply(
`✅ Broadcast Successfully Sent To All Website Users!

🕒 Send Time :
${dateStr} — ${timeStr} BD Time

📊 Stats:
👥 Total Users  : ${usersSnap.size}
🔔 Push Sent    : ${pushCount}
🌐 Site Popups  : All users will see on next visit`
    );
  } catch (err) {
    await ctx.reply(`❌ Broadcast failed: ${err.message}`);
  }
}

// =============================================
// CAPTION BOX MANAGEMENT
// =============================================
bot.hears('📝 Caption BOX', (ctx) => adminOnly(ctx, () => handleCaptionList(ctx)));
bot.command('caption', (ctx) => adminOnly(ctx, () => handleCaptionList(ctx)));

async function handleCaptionList(ctx) {
  try {
    const snap = await db.collection('captions')
      .orderBy('timestamp', 'asc')
      .limit(20)
      .get();

    await ctx.reply('📝 CAPTION BOX');

    if (snap.empty) {
      await ctx.reply('📭 No captions yet.', Markup.inlineKeyboard([
        [Markup.button.callback('➕ Add New Caption', 'cap_add')]
      ]));
      return;
    }

    // Admin captions first
    const adminCaps = snap.docs.filter(d => d.data().addedBy === 'Admin');
    const userCaps  = snap.docs.filter(d => d.data().addedBy !== 'Admin');

    if (adminCaps.length) await ctx.reply('🛠️ ADMIN ADDED CAPTIONS:');
    for (const doc of adminCaps) {
      const d = doc.data();
      await ctx.reply(
`━━━━━━━━━━━━━━━━━━━━━━━
Caption ID: ${d.capID}
📌 Caption :
"${d.text}"

🕒 ${d.addedTime} — ${d.addedDate}
🆔 Added By : Admin`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('✏️ Edit',   `cap_edit_${doc.id}`),
            Markup.button.callback('🗑️ Delete', `cap_del_${doc.id}`)
          ]
        ])
      );
    }

    if (userCaps.length) await ctx.reply('👤 USER ADDED CAPTIONS:');
    for (const doc of userCaps) {
      const d = doc.data();
      await ctx.reply(
`━━━━━━━━━━━━━━━━━━━━━━━
Caption ID: ${d.capID}
📌 Caption :
"${d.text}"

🕒 ${d.addedTime} — ${d.addedDate}
🆔 Added By : User (${d.addedByUID})`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('✏️ Edit',   `cap_edit_${doc.id}`),
            Markup.button.callback('🗑️ Delete', `cap_del_${doc.id}`)
          ]
        ])
      );
    }

    // Add new button at bottom
    await ctx.reply('─────────────────',
      Markup.inlineKeyboard([
        [Markup.button.callback('➕ Add New Caption', 'cap_add')]
      ])
    );
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
}

// =============================================
// HELP MENU
// =============================================
bot.hears('🆘 Help', (ctx) => adminOnly(ctx, () => handleHelp(ctx)));
bot.command('help', (ctx) => adminOnly(ctx, () => handleHelp(ctx)));

async function handleHelp(ctx) {
  await ctx.reply(
`╔══════════════════════╗
🤖 BOT HELP & COMMAND MENU
╚══════════════════════╝

📌 Available Commands:

/start        → Open Welcome Menu
/send         → Send Reply To User
/received     → View Received Messages
/replyhistory → View Sent Replies History
/users        → Show All Registered Users
/broadcast    → Send Broadcast Notification
/caption      → Manage Website Captions
/help         → Open Help Menu
/ban [uid]    → Ban A User
/unban [uid]  → Unban A User
/info [uid]   → View User Information
/status       → View Bot Status Report
/ads on       → Enable Website Ads
/ads off      → Disable Website Ads

📌 Quick Send:
/send 1001 Hello message

📌 Keyboard Buttons:
📨 Send Message
📥 Received History
📤 Reply History
👥 Show All Users
📢 Broadcast
📝 Caption BOX
🆘 Help
📊 Bot Status`,
    KEYBOARD
  );
}

// =============================================
// BOT STATUS
// =============================================
bot.hears('📊 Bot Status', (ctx) => adminOnly(ctx, () => handleStatus(ctx)));
bot.command('status', (ctx) => adminOnly(ctx, () => handleStatus(ctx)));

async function handleStatus(ctx) {
  const { timeStr, dateStr } = getBDTime();
  try {
    const [usersSnap, msgSnap, replySnap, captionSnap, adsDoc] = await Promise.all([
      db.collection('users').get(),
      db.collection('sentMessages').get(),
      db.collection('adminReplies').get(),
      db.collection('captions').get(),
      db.collection('_system').doc('adsConfig').get()
    ]);

    const banned   = usersSnap.docs.filter(d => d.data().banned).length;
    const notified = usersSnap.docs.filter(d => d.data().notificationEnabled).length;
    const adsOn    = !adsDoc.exists || adsDoc.data().enabled !== false;

    await ctx.reply(
`📊 BOT STATUS REPORT

🕒 Current Time : ${timeStr} — ${dateStr}

👥 Total Users      : ${usersSnap.size}
🚫 Banned Users     : ${banned}
🔔 Notif Enabled   : ${notified}
💌 Total Messages  : ${msgSnap.size}
📤 Total Replies   : ${replySnap.size}
📝 Total Captions  : ${captionSnap.size}
📢 Ads Status      : ${adsOn ? '✅ ON' : '❌ OFF'}

🌐 Website: ${WEBSITE_URL}

✅ Bot is running normally!`
    );
  } catch (err) {
    await ctx.reply(`❌ Status error: ${err.message}`);
  }
}

// =============================================
// ADS CONTROL
// =============================================
bot.command('ads', (ctx) => adminOnly(ctx, async () => {
  const arg = ctx.message.text.replace('/ads', '').trim().toLowerCase();
  if (arg === 'on') {
    await db.collection('_system').doc('adsConfig').set({ enabled: true });
    await ctx.reply('✅ Ads are now ON.\nWebsite will show ads to users.');
  } else if (arg === 'off') {
    await db.collection('_system').doc('adsConfig').set({ enabled: false });
    await ctx.reply('❌ Ads are now OFF.\nWebsite will hide ad section.');
  } else {
    await ctx.reply('⚠️ Usage:\n/ads on  → Enable ads\n/ads off → Disable ads');
  }
}));

// =============================================
// INLINE BUTTON CALLBACKS
// =============================================

// Reply to user via inline button
bot.action(/^reply_(.+)$/, (ctx) => adminOnly(ctx, async () => {
  await ctx.answerCbQuery();
  const uid     = ctx.match[1];
  const session = getSession(ctx.chat.id);
  session.state = 'WAIT_REPLY_MSG';
  session.data  = { targetUID: parseInt(uid) };
  await ctx.reply(`💌 Reply Mode\n\nSending to User ID: ${uid}\n\nType your message:`);
}));

// Ban user
bot.action(/^ban_(.+)$/, (ctx) => adminOnly(ctx, async () => {
  await ctx.answerCbQuery('Banning user...');
  const uid = ctx.match[1];
  await db.collection('users').doc(uid).update({ banned: true });
  await ctx.reply(`✅ User ${uid} has been BANNED.\n\nThey will see ACCESS DENIED on website.`);
}));

// Unban user
bot.action(/^unban_(.+)$/, (ctx) => adminOnly(ctx, async () => {
  await ctx.answerCbQuery('Unbanning user...');
  const uid = ctx.match[1];
  await db.collection('users').doc(uid).update({ banned: false });
  await ctx.reply(`✅ User ${uid} has been UNBANNED.`);
}));

// View user info via inline button
bot.action(/^info_(.+)$/, (ctx) => adminOnly(ctx, async () => {
  await ctx.answerCbQuery();
  await showUserInfo(ctx, ctx.match[1]);
}));

// Clear ALL user data
bot.action(/^clear_(.+)$/, (ctx) => adminOnly(ctx, async () => {
  await ctx.answerCbQuery();
  const uid = ctx.match[1];

  // Ask for confirmation first
  await ctx.reply(
    `⚠️ CONFIRM: Clear ALL data for User ${uid}?\n\nThis will delete:\n• All their sent messages\n• All replies they received\n• Their profile\n• Their counters\n\nThey will be treated as a new user next visit.`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Yes, Clear All', `clear_confirm_${uid}`),
        Markup.button.callback('❌ Cancel',          'clear_cancel')
      ]
    ])
  );
}));

bot.action(/^clear_confirm_(.+)$/, (ctx) => adminOnly(ctx, async () => {
  await ctx.answerCbQuery('Clearing...');
  const uid = ctx.match[1];

  try {
    const batch = db.batch();

    // Delete all sent messages by this user
    const sentSnap = await db.collection('sentMessages')
      .where('userID', '==', parseInt(uid))
      .get();
    sentSnap.forEach(d => batch.delete(d.ref));

    // Delete all replies to this user
    const recvSnap = await db.collection('adminReplies')
      .where('toUID', '==', parseInt(uid))
      .get();
    recvSnap.forEach(d => batch.delete(d.ref));

    // Delete user captions
    const capSnap = await db.collection('captions')
      .where('addedByUID', '==', parseInt(uid))
      .get();
    capSnap.forEach(d => batch.delete(d.ref));

    // Delete user document
    batch.delete(db.collection('users').doc(uid));

    // Delete ID counters for this user
    batch.delete(db.collection('_counters').doc(`sentMessages_${uid}`));
    batch.delete(db.collection('_counters').doc(`adminReplies_${uid}`));

    await batch.commit();

    await ctx.reply(
`✅ User ${uid} data cleared completely!

🗑️ Deleted:
• Sent messages
• Received replies
• Captions
• Profile
• ID counters

This user will start fresh on next website visit.`
    );
  } catch (err) {
    await ctx.reply(`❌ Clear failed: ${err.message}`);
  }
}));

bot.action('clear_cancel', async (ctx) => {
  await ctx.answerCbQuery('Cancelled');
  await ctx.reply('❌ Clear cancelled.');
});

// Delete received message
bot.action(/^del_recv_(.+)$/, (ctx) => adminOnly(ctx, async () => {
  await ctx.answerCbQuery('Deleting...');
  const docId = ctx.match[1];
  try {
    await db.collection('sentMessages').doc(docId).delete();
    await ctx.reply('🗑️ Message deleted from all places successfully.');
  } catch (err) {
    await ctx.reply(`❌ Delete failed: ${err.message}`);
  }
}));

// Delete admin reply
bot.action(/^del_reply_(.+)$/, (ctx) => adminOnly(ctx, async () => {
  await ctx.answerCbQuery('Deleting...');
  const docId = ctx.match[1];
  try {
    await db.collection('adminReplies').doc(docId).delete();
    await ctx.reply('🗑️ Reply deleted from all places successfully.');
  } catch (err) {
    await ctx.reply(`❌ Delete failed: ${err.message}`);
  }
}));

// Add new caption
bot.action('cap_add', (ctx) => adminOnly(ctx, async () => {
  await ctx.answerCbQuery();
  const session = getSession(ctx.chat.id);
  session.state = 'WAIT_CAP_ADD';
  await ctx.reply('➕ Add New Caption Mode\n\n📝 Type your caption below:');
}));

// Edit caption
bot.action(/^cap_edit_(.+)$/, (ctx) => adminOnly(ctx, async () => {
  await ctx.answerCbQuery();
  const session  = getSession(ctx.chat.id);
  session.state  = 'WAIT_CAP_EDIT';
  session.data   = { docId: ctx.match[1] };
  await ctx.reply('✏️ Edit Caption Mode\n\n📝 Send the updated caption text:');
}));

// Delete caption - ask confirmation
bot.action(/^cap_del_(.+)$/, (ctx) => adminOnly(ctx, async () => {
  await ctx.answerCbQuery();
  const docId = ctx.match[1];
  await ctx.reply('🗑️ Delete Confirmation Required\n\n⚠️ Are you sure you want to delete this caption?',
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✔️ Yes, Delete', `cap_del_ok_${docId}`),
        Markup.button.callback('❌ No, Cancel',  'cap_del_cancel')
      ]
    ])
  );
}));

bot.action(/^cap_del_ok_(.+)$/, (ctx) => adminOnly(ctx, async () => {
  await ctx.answerCbQuery('Deleting...');
  const docId = ctx.match[1];
  try {
    await db.collection('captions').doc(docId).delete();
    await ctx.reply('✅ Caption Deleted Successfully!\n\n📌 The caption has been removed from the website.');
  } catch (err) {
    await ctx.reply(`❌ Delete failed: ${err.message}`);
  }
}));

bot.action('cap_del_cancel', async (ctx) => {
  await ctx.answerCbQuery('Cancelled');
  await ctx.reply('❌ Delete cancelled.');
});

// =============================================
// MESSAGE TEXT HANDLER
// Handles multi-step conversation states
// =============================================
bot.on('text', (ctx) => adminOnly(ctx, async () => {
  const text    = ctx.message.text;
  const chatId  = ctx.chat.id;
  const session = getSession(chatId);

  // Skip if it's a command
  if (text.startsWith('/')) return;

  // ---- STATE: Waiting for User ID to send to ----
  if (session.state === 'WAIT_SEND_UID') {
    const uid = parseInt(text.trim());
    if (isNaN(uid) || uid < 1001 || uid > 9999) {
      return ctx.reply('⚠️ Invalid User ID!\nEnter a number between 1001 and 9999:');
    }
    session.data.targetUID = uid;
    session.state = 'WAIT_SEND_MSG';
    return ctx.reply(`💌 User ID: ${uid}\n\nNow type your message:`);
  }

  // ---- STATE: Waiting for message to send ----
  if (session.state === 'WAIT_SEND_MSG') {
    clearSession(chatId);
    return sendReplyToUser(ctx, session.data.targetUID, text);
  }

  // ---- STATE: Waiting for reply (from inline button) ----
  if (session.state === 'WAIT_REPLY_MSG') {
    clearSession(chatId);
    return sendReplyToUser(ctx, session.data.targetUID, text);
  }

  // ---- STATE: Waiting for broadcast message ----
  if (session.state === 'WAIT_BROADCAST_MSG') {
    clearSession(chatId);
    return sendBroadcastToAll(ctx, text);
  }

  // ---- STATE: Waiting for new caption ----
  if (session.state === 'WAIT_CAP_ADD') {
    clearSession(chatId);
    const { timeStr, dateStr } = getBDTime();
    await ctx.reply('⏳ Saving caption...');
    try {
      const capID = await getNextID('globalCapID');
      await db.collection('captions').add({
        capID,
        text,
        addedBy:    'Admin',
        addedByUID: 'admin',
        addedTime:  timeStr,
        addedDate:  dateStr,
        timestamp:  admin.firestore.FieldValue.serverTimestamp()
      });
      await ctx.reply('✅ Caption Successfully Added!\n\n📌 It is now visible on the website instantly.');
    } catch (err) {
      await ctx.reply(`❌ Failed: ${err.message}`);
    }
    return;
  }

  // ---- STATE: Waiting for edited caption ----
  if (session.state === 'WAIT_CAP_EDIT') {
    const docId = session.data.docId;
    clearSession(chatId);
    try {
      await db.collection('captions').doc(docId).update({ text });
      await ctx.reply('✅ Caption Updated Successfully!\n\n📌 Changes are live on website instantly.');
    } catch (err) {
      await ctx.reply(`❌ Update failed: ${err.message}`);
    }
    return;
  }

  // No state - show help hint
  await ctx.reply('⚠️ Unknown input.\n\nUse the keyboard buttons or type /help', KEYBOARD);
}));

// =============================================
// ERROR HANDLER
// =============================================
bot.catch((err, ctx) => {
  console.error(`❌ Bot error for ${ctx.updateType}:`, err);
  ctx.reply('❌ An error occurred. Please try again.').catch(() => {});
});

// =============================================
// START BOT
// =============================================
async function startBot() {
  try {
    // Set bot commands for Telegram "/" menu
    await bot.telegram.setMyCommands([
      { command: 'start',        description: 'Open Welcome Menu' },
      { command: 'send',         description: 'Send Reply To User' },
      { command: 'received',     description: 'View Received Messages' },
      { command: 'replyhistory', description: 'View Sent Replies History' },
      { command: 'users',        description: 'Show All Registered Users' },
      { command: 'broadcast',    description: 'Send Broadcast Notification' },
      { command: 'caption',      description: 'Manage Website Captions' },
      { command: 'help',         description: 'Open Help Menu' },
      { command: 'ban',          description: 'Ban A User (/ban 1001)' },
      { command: 'unban',        description: 'Unban A User (/unban 1001)' },
      { command: 'info',         description: 'View User Info (/info 1001)' },
      { command: 'status',       description: 'View Bot Status Report' },
      { command: 'ads',          description: 'Toggle Ads (/ads on or /ads off)' }
    ]);

    console.log('✅ Bot commands registered');

    // Start polling
    await bot.launch();
    console.log('✅ Cithi Pathan Bot is running! (Long Polling)');
    console.log(`🔐 Admin ID: ${ADMIN_CHAT_ID}`);
    console.log(`🌐 Website : ${WEBSITE_URL}`);
  } catch (err) {
    console.error('❌ Bot launch failed:', err.message);
    process.exit(1);
  }
}

startBot();

// Graceful shutdown
process.once('SIGINT',  () => { bot.stop('SIGINT');  console.log('Bot stopped.'); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); console.log('Bot stopped.'); });
