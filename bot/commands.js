/**
 * ═══════════════════════════════════════════════════════
 *  CITHI PATHAN — bot/commands.js
 *  All slash command handlers: /start /send /ban /unban ...
 * ═══════════════════════════════════════════════════════
 */

'use strict';

import {
  MAIN_KEYBOARD, SITE_URL, ADMIN_ID, bdTime, pad2,
  handleSendMessageFlow, handleReceivedHistory, handleReplyHistory,
  handleShowAllUsers, handleBroadcastFlow, handleCaptionBox, handleHelp,
  getUser, banUser, unbanUser, clearUser,
  sendReplyToUser, writeBroadcast,
  getAllCaptions, addCaption,
  setAdsStatus, bumpVersion,
  dbGet, dbUpdate
} from './bot.js';

/* ══════════════════════════════════════════════════════
   REGISTER ALL COMMANDS
══════════════════════════════════════════════════════ */
export function handleCommands(bot) {

  /* ─────────────────────────────────────────
     /start — Welcome screen
  ───────────────────────────────────────── */
  bot.start(async (ctx) => {
    const users = await dbGet('users');
    const count = users ? Object.keys(users).length : 0;

    await ctx.reply(
      `╔══════════════════════════════╗\n💌 <b>Welcome Back To</b>\n<b>চিঠি পাঠাও — Cithi Pathan</b>\n╚══════════════════════════════╝\n\n✨ <b>Anonymous Messaging Platform</b>\n\n👑 Admin Panel Active\n🌐 Site: ${SITE_URL}\n👥 Total Users: <b>${count}</b>\n🕒 Time: ${bdTime()}\n\n📌 <b>Available Features:</b>\n\n🔘 Send Message to User\n🔘 Receive Reply\n🔘 Push Notification\n🔘 Live Popup Message\n🔘 Instant Reply System\n🔘 Broadcast Notification\n🔘 Caption System\n🔘 Ban / Unban Users\n🔘 Ads ON / OFF Control\n\n━━━━━━━━━━━━━━━━━━━━━━━\n📌 <b>Available Commands:</b>\n/send /received /replyhistory\n/users /broadcast /caption\n/ban /unban /info /ads /status /help`,
      { parse_mode: 'HTML', ...MAIN_KEYBOARD }
    );

    // Set bot commands in Telegram (shows when user types /)
    await ctx.telegram.setMyCommands([
      { command: 'start',        description: 'Open Welcome Menu' },
      { command: 'send',         description: 'Send Reply To User (e.g. /send 1001 Hello)' },
      { command: 'received',     description: 'View Received Messages' },
      { command: 'replyhistory', description: 'View Sent Replies History' },
      { command: 'users',        description: 'Show All Registered Users' },
      { command: 'broadcast',    description: 'Send Broadcast To All Users' },
      { command: 'caption',      description: 'Manage Website Captions' },
      { command: 'ban',          description: 'Ban a User (e.g. /ban 1001)' },
      { command: 'unban',        description: 'Unban a User (e.g. /unban 1001)' },
      { command: 'info',         description: 'View User Info (e.g. /info 1001)' },
      { command: 'ads',          description: 'Toggle Ads on/off (e.g. /ads off)' },
      { command: 'status',       description: 'View Bot & Site Status' },
      { command: 'help',         description: 'Open Help Menu' }
    ]);
  });

  /* ─────────────────────────────────────────
     /send [uid] [message]
     e.g. /send 1001 Hello, how are you?
  ───────────────────────────────────────── */
  bot.command('send', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);

    // No args → start interactive flow
    if (!args.length) return handleSendMessageFlow(ctx);

    const uid     = args[0];
    const message = args.slice(1).join(' ').trim();

    if (!uid) return ctx.reply('❌ Usage: /send [uid] [message]\nExample: /send 1001 Hello!');
    if (!message) {
      ctx.session.state    = 'await_send_msg';
      ctx.session.replyUID = uid;
      return ctx.reply(`🆔 User ID: <b>${uid}</b>\n\n💌 Message লিখুন:`, { parse_mode: 'HTML' });
    }

    const user = await getUser(uid);
    if (!user) return ctx.reply(`❌ User ID <b>${uid}</b> পাওয়া যায়নি।`, { parse_mode: 'HTML' });

    const msgData = await sendReplyToUser(uid, message, ADMIN_ID);

    return ctx.reply(
      `╔══════════════════════╗\n📤 <b>REPLY STATUS REPORT</b>\n╚══════════════════════╝\n\n✅ Reply Sent To User ID : <b>${uid}</b>\n\n🕒 <b>Time &amp; Date :</b>\n${bdTime()}\n\n⏳ Status : Wait For User Seen Your Message!`,
      { parse_mode: 'HTML', ...MAIN_KEYBOARD }
    );
  });

  /* ─────────────────────────────────────────
     /received — All received messages
  ───────────────────────────────────────── */
  bot.command('received', async (ctx) => {
    return handleReceivedHistory(ctx);
  });

  /* ─────────────────────────────────────────
     /replyhistory — All sent replies
  ───────────────────────────────────────── */
  bot.command('replyhistory', async (ctx) => {
    return handleReplyHistory(ctx);
  });

  /* ─────────────────────────────────────────
     /users — Show all registered users
  ───────────────────────────────────────── */
  bot.command('users', async (ctx) => {
    return handleShowAllUsers(ctx);
  });

  /* ─────────────────────────────────────────
     /broadcast [message]
  ───────────────────────────────────────── */
  bot.command('broadcast', async (ctx) => {
    const message = ctx.message.text.split(' ').slice(1).join(' ').trim();
    if (!message) return handleBroadcastFlow(ctx);

    const bc = await writeBroadcast(message);
    return ctx.reply(
      `✅ <b>Broadcast Successfully Sent To Website All Users!</b>\n\n💬 Message:\n${message}\n\n🕒 Send Time :\n${bdTime()}`,
      { parse_mode: 'HTML', ...MAIN_KEYBOARD }
    );
  });

  /* ─────────────────────────────────────────
     /caption — Manage captions
  ───────────────────────────────────────── */
  bot.command('caption', async (ctx) => {
    return handleCaptionBox(ctx);
  });

  /* ─────────────────────────────────────────
     /ban [uid]
  ───────────────────────────────────────── */
  bot.command('ban', async (ctx) => {
    const uid = ctx.message.text.split(' ')[1]?.trim();
    if (!uid) return ctx.reply('❌ Usage: /ban [uid]\nExample: /ban 1001');

    const user = await getUser(uid);
    if (!user) return ctx.reply(`❌ User ID <b>${uid}</b> পাওয়া যায়নি।`, { parse_mode: 'HTML' });

    await banUser(uid);
    return ctx.reply(
      `🚫 <b>User Banned Successfully!</b>\n\n🆔 User ID: <b>${uid}</b>\n🕒 Time: ${bdTime()}\n\n✅ This user can no longer access the website.`,
      { parse_mode: 'HTML', ...MAIN_KEYBOARD }
    );
  });

  /* ─────────────────────────────────────────
     /unban [uid]
  ───────────────────────────────────────── */
  bot.command('unban', async (ctx) => {
    const uid = ctx.message.text.split(' ')[1]?.trim();
    if (!uid) return ctx.reply('❌ Usage: /unban [uid]\nExample: /unban 1001');

    const user = await getUser(uid);
    if (!user) return ctx.reply(`❌ User ID <b>${uid}</b> পাওয়া যায়নি।`, { parse_mode: 'HTML' });

    await unbanUser(uid);
    return ctx.reply(
      `✅ <b>User Unbanned Successfully!</b>\n\n🆔 User ID: <b>${uid}</b>\n🕒 Time: ${bdTime()}\n\n🟢 This user can now access the website again.`,
      { parse_mode: 'HTML', ...MAIN_KEYBOARD }
    );
  });

  /* ─────────────────────────────────────────
     /info [uid]
  ───────────────────────────────────────── */
  bot.command('info', async (ctx) => {
    const uid = ctx.message.text.split(' ')[1]?.trim();
    if (!uid) return ctx.reply('❌ Usage: /info [uid]\nExample: /info 1001');

    const user = await getUser(uid);
    if (!user) return ctx.reply(`❌ User ID <b>${uid}</b> পাওয়া যায়নি।`, { parse_mode: 'HTML' });

    return sendUserInfo(ctx, uid, user);
  });

  /* ─────────────────────────────────────────
     /ads [on|off]
  ───────────────────────────────────────── */
  bot.command('ads', async (ctx) => {
    const arg = ctx.message.text.split(' ')[1]?.toLowerCase().trim();

    if (!arg || (arg !== 'on' && arg !== 'off')) {
      return ctx.reply('❌ Usage: /ads on\n       /ads off');
    }

    const enabled = arg === 'on';
    await setAdsStatus(enabled);

    return ctx.reply(
      `${enabled ? '✅' : '🚫'} <b>Ads ${enabled ? 'Enabled' : 'Disabled'} Successfully!</b>\n\n🕒 Time: ${bdTime()}\n🌐 Website এ পরিবর্তন সাথে সাথে হয়ে গেছে।`,
      { parse_mode: 'HTML', ...MAIN_KEYBOARD }
    );
  });

  /* ─────────────────────────────────────────
     /status — Bot & site health check
  ───────────────────────────────────────── */
  bot.command('status', async (ctx) => {
    const users    = await dbGet('users');
    const captions = await dbGet('captions');
    const adsOn    = await dbGet('settings/adsEnabled');
    const userCount= users    ? Object.keys(users).length    : 0;
    const capCount = captions ? Object.keys(captions).length : 0;

    return ctx.reply(
      `╔══════════════════════════════╗\n📊 <b>BOT STATUS REPORT</b>\n╚══════════════════════════════╝\n\n🤖 <b>Bot Status :</b> ✅ Online\n🌐 <b>Website :</b> ${SITE_URL}\n\n👥 <b>Total Users :</b> ${userCount}\n📝 <b>Total Captions :</b> ${capCount}\n📢 <b>Ads Status :</b> ${adsOn !== false ? '✅ Enabled' : '🚫 Disabled'}\n\n🕒 <b>Current BD Time :</b>\n${bdTime()}\n\n✅ All Systems Operational`,
      { parse_mode: 'HTML', ...MAIN_KEYBOARD }
    );
  });

  /* ─────────────────────────────────────────
     /help
  ───────────────────────────────────────── */
  bot.command('help', async (ctx) => {
    return handleHelp(ctx);
  });

  /* ─────────────────────────────────────────
     /delete [uid] [msgId] [type]
     type: sent | received
  ───────────────────────────────────────── */
  bot.command('delete', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const [uid, msgId, type] = args;

    if (!uid || !msgId) {
      return ctx.reply('❌ Usage: /delete [uid] [msgId] [sent|received]\nExample: /delete 1001 01 received');
    }

    const path = (type === 'sent')
      ? `users/${uid}/sendHistory/${msgId}`
      : `users/${uid}/receivedMessages/${msgId}`;

    try {
      const { dbDelete } = await import('../api/database.js');
      await dbDelete(path);
      return ctx.reply(`🗑️ Message deleted successfully.\n🆔 UID: ${uid} | Msg: ${msgId}`, MAIN_KEYBOARD);
    } catch (err) {
      return ctx.reply(`❌ Delete failed: ${err.message}`);
    }
  });

  /* ─────────────────────────────────────────
     /clear [uid] — Clear all user data
  ───────────────────────────────────────── */
  bot.command('clear', async (ctx) => {
    const uid = ctx.message.text.split(' ')[1]?.trim();
    if (!uid) return ctx.reply('❌ Usage: /clear [uid]\nExample: /clear 1001');

    await clearUser(uid);
    return ctx.reply(
      `✅ <b>User Data Cleared!</b>\n\n🆔 User ID: <b>${uid}</b>\n🗑️ সব ডেটা মুছে ফেলা হয়েছে।\n\n🕒 ${bdTime()}`,
      { parse_mode: 'HTML', ...MAIN_KEYBOARD }
    );
  });

}

/* ══════════════════════════════════════════════════════
   HELPER — Send Full User Info Card
══════════════════════════════════════════════════════ */
export async function sendUserInfo(ctx, uid, user) {
  const p  = user?.profile || {};
  const d  = user?.deviceInfo || {};
  const sh = user?.sendHistory      ? Object.keys(user.sendHistory).length      : 0;
  const rh = user?.receivedMessages ? Object.keys(user.receivedMessages).length : 0;

  // Last message
  let lastMsg = '—';
  if (user?.sendHistory) {
    const msgs = Object.values(user.sendHistory).sort((a,b) => b.timestamp - a.timestamp);
    if (msgs[0]) lastMsg = msgs[0].message?.substring(0, 50) || '—';
  }

  const text = `━━━━━━━━━━━━━━━━━━━━━━━\n🔰 <b>USER PROFILE INFORMATION</b> 🔰\n━━━━━━━━━━━━━━━━━━━━━━━\n\n🆔 <b>User ID</b>            : ${uid}\n\n👤 <b>Full Name</b>          : ${p.name || 'Not Set'}\n\n📱 <b>Phone Number</b>       : ${p.wa   || 'Not Set'}\n\n🔗 <b>FB Profile</b>         : ${p.fb   || 'Not Added'}\n\n🌍 <b>Location</b>           : ${d.city || 'Unknown'}, ${d.country || 'Unknown'}\n\n📶 <b>Network</b>            : ${d.network || 'Unknown'}\n\n📱 <b>Device</b>             : ${d.userAgent?.substring(0,40) || 'Unknown'}\n\n🧠 <b>Browser</b>            : ${d.userAgent?.match(/(Chrome|Firefox|Safari|Opera|Edge)/)?.[0] || 'Unknown'}\n\n🔔 <b>Notification</b>       : ${p.notifAllowed ? 'Allowed ✅' : 'Disabled ❌'}\n\n💌 <b>Total Sent</b>         : ${sh}\n\n📥 <b>Total Received</b>     : ${rh}\n\n🔴 <b>User Status</b>        : ${user.banned ? '🔴 Banned' : '🟢 Active'}\n\n📅 <b>Account Created</b>    : ${p.registeredDate ? bdTime(p.registeredDate) : '—'}\n\n🕒 <b>Last Active</b>        : ${user.lastActive ? bdTime(user.lastActive) : '—'}\n\n🌍 <b>IP Address</b>         : ${d.ip || 'Unknown'}\n\n📡 <b>ISP</b>                : ${d.isp || 'Unknown'}\n\n💬 <b>LAST MESSAGE PREVIEW:</b>\n${lastMsg}`;

  return ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📩 Send Message', callback_data: `reply_${uid}_info` },
          { text: '🗑️ Clear Data',  callback_data: `clear_${uid}` }
        ],
        [
          { text: '🚫 Ban User',   callback_data: `ban_${uid}` },
          { text: '✅ Unban User', callback_data: `unban_${uid}` }
        ]
      ]
    }
  });
}
