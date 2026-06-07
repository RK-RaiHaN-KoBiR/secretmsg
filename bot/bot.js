/**
 * ═══════════════════════════════════════════════════════
 *  CITHI PATHAN — bot/bot.js
 *  Main Telegram Bot Entry Point
 *  Uses: Telegraf.js (webhook mode for Vercel)
 * ═══════════════════════════════════════════════════════
 */

'use strict';

import { Telegraf, Markup, session } from 'telegraf';
import { handleCommands }            from './commands.js';
import { handleAdmin }               from './admin.js';
import {
  dbGet, dbSet, dbUpdate, dbDelete,
  getAllUsers, getUser,
  banUser, unbanUser, clearUser,
  sendReplyToUser,
  writeBroadcast,
  getAllCaptions, addCaption, updateCaption, deleteCaption,
  setAdsStatus, bumpVersion
} from '../api/database.js';

/* ──────────────────────────────────────────────────────
   ① BOT CONFIG — set via .env / Vercel env vars
────────────────────────────────────────────────────── */
export const BOT_TOKEN  = process.env.BOT_TOKEN  || "8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA";
export const ADMIN_ID   = process.env.ADMIN_ID   || "6048050987";
export const SITE_URL   = process.env.SITE_URL   || "https://cithipathao.vercel.app";

/* ──────────────────────────────────────────────────────
   ② BOT INSTANCE
────────────────────────────────────────────────────── */
export const bot = new Telegraf(BOT_TOKEN);

/* ──────────────────────────────────────────────────────
   ③ SESSION — tracks admin conversation state
   e.g. "waiting for reply UID", "waiting for caption text"
────────────────────────────────────────────────────── */
bot.use(session({
  defaultSession: () => ({
    state:         null,   // 'await_reply_uid' | 'await_reply_msg' | 'await_caption' | 'await_edit_caption' | 'await_broadcast' | 'await_send_uid' | 'await_send_msg'
    replyUID:      null,   // UID being replied to
    editCaptionId: null,   // caption ID being edited
    pendingMsgId:  null,   // original message msgId for inline reply
  })
}));

/* ──────────────────────────────────────────────────────
   ④ ADMIN GUARD — only ADMIN_ID can use this bot
────────────────────────────────────────────────────── */
export function isAdmin(ctx) {
  return String(ctx.from?.id) === String(ADMIN_ID);
}

bot.use(async (ctx, next) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('🚫 Access Denied. This bot is for admin only.');
  }
  return next();
});

/* ──────────────────────────────────────────────────────
   ⑤ BD TIME FORMATTER
────────────────────────────────────────────────────── */
export function bdTime(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Dhaka',
    day:      '2-digit',
    month:    '2-digit',
    year:     'numeric',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   true
  }).replace(',', ' —') + ' BD Time';
}

export function pad2(n) { return String(n).padStart(2, '0'); }

/* ──────────────────────────────────────────────────────
   ⑥ MAIN KEYBOARD — shown after every command
────────────────────────────────────────────────────── */
export const MAIN_KEYBOARD = Markup.keyboard([
  ['📨 Send Message',   '📥 Received History'],
  ['📤 Reply History',  '👥 Show All User'],
  ['📢 Broadcast',      '📝 Caption BOX'],
  ['🆘 Help']
]).resize();

/* ──────────────────────────────────────────────────────
   ⑦ LOAD ALL HANDLERS
────────────────────────────────────────────────────── */
handleCommands(bot);
handleAdmin(bot);

/* ──────────────────────────────────────────────────────
   ⑧ TEXT MESSAGE HANDLER (keyboard buttons + state machine)
────────────────────────────────────────────────────── */
bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const sess = ctx.session;

  /* ── State Machine: handle multi-step flows ── */

  // Step: waiting for UID to send message
  if (sess.state === 'await_send_uid') {
    const uid = text.trim();
    const user = await getUser(uid);
    if (!user) {
      sess.state = null;
      return ctx.reply(`❌ User ID ${uid} পাওয়া যায়নি।`, MAIN_KEYBOARD);
    }
    sess.state    = 'await_send_msg';
    sess.replyUID = uid;
    return ctx.reply(`✅ User ID: <b>${uid}</b> পাওয়া গেছে!\n\n💌 এখন Message লিখুন:`, { parse_mode: 'HTML' });
  }

  // Step: waiting for message text to send
  if (sess.state === 'await_send_msg') {
    const uid     = sess.replyUID;
    const msgData = await sendReplyToUser(uid, text, ADMIN_ID);
    sess.state    = null;
    sess.replyUID = null;

    await ctx.reply(
      `╔══════════════════════╗\n📤 <b>REPLY STATUS REPORT</b>\n╚══════════════════════╝\n\n✅ Reply Sent To User ID : <b>${uid}</b>\n\n🕒 <b>Time &amp; Date :</b>\n${bdTime()}\n\n⏳ <b>Status :</b>\nWait For User Seen Your Message!`,
      { parse_mode: 'HTML', ...MAIN_KEYBOARD }
    );
    return;
  }

  // Step: waiting for reply UID (from inline button flow)
  if (sess.state === 'await_reply_uid') {
    const uid  = text.trim();
    const user = await getUser(uid);
    if (!user) {
      sess.state = null;
      return ctx.reply(`❌ User ID ${uid} পাওয়া যায়নি।`, MAIN_KEYBOARD);
    }
    sess.state    = 'await_reply_msg';
    sess.replyUID = uid;
    return ctx.reply(`🆔 User <b>${uid}</b> কে Reply লিখুন:`, { parse_mode: 'HTML' });
  }

  // Step: waiting for reply message text
  if (sess.state === 'await_reply_msg') {
    const uid     = sess.replyUID;
    const msgData = await sendReplyToUser(uid, text, ADMIN_ID);
    sess.state    = null;
    sess.replyUID = null;

    await ctx.reply(
      `╔══════════════════════╗\n📤 <b>REPLY STATUS REPORT</b>\n╚══════════════════════╝\n\n✅ Reply Sent To User ID : <b>${uid}</b>\n\n🕒 <b>Time &amp; Date :</b>\n${bdTime()}\n\n⏳ Status : Wait For User Seen Your Message!`,
      { parse_mode: 'HTML', ...MAIN_KEYBOARD }
    );
    return;
  }

  // Step: waiting for new caption text
  if (sess.state === 'await_caption') {
    const capData = await addCaption(text, 'admin');
    sess.state = null;

    await ctx.reply(
      `✅ <b>Caption Successfully Added!</b>\n\n📌 Caption ID: <b>${capData.capId}</b>\n💬 ${text}\n\n🌐 Now visible on website instantly.`,
      { parse_mode: 'HTML', ...MAIN_KEYBOARD }
    );
    return;
  }

  // Step: waiting for edited caption text
  if (sess.state === 'await_edit_caption') {
    const capId = sess.editCaptionId;
    await updateCaption(capId, text);
    sess.state         = null;
    sess.editCaptionId = null;

    await ctx.reply(
      `✅ <b>Caption Updated Successfully!</b>\n\n📌 Caption ID: ${capId}\n💬 ${text}\n\n🌐 Changes saved on website instantly.`,
      { parse_mode: 'HTML', ...MAIN_KEYBOARD }
    );
    return;
  }

  // Step: waiting for broadcast message
  if (sess.state === 'await_broadcast') {
    const bc = await writeBroadcast(text);
    sess.state = null;

    await ctx.reply(
      `✅ <b>Broadcast Successfully Sent To Website All Users!</b>\n\n💬 Message:\n${text}\n\n🕒 Send Time :\n${bdTime()}`,
      { parse_mode: 'HTML', ...MAIN_KEYBOARD }
    );
    return;
  }

  /* ── Keyboard Button Handlers ── */
  if (text === '📨 Send Message')      return handleSendMessageFlow(ctx);
  if (text === '📥 Received History')  return handleReceivedHistory(ctx);
  if (text === '📤 Reply History')     return handleReplyHistory(ctx);
  if (text === '👥 Show All User')     return handleShowAllUsers(ctx);
  if (text === '📢 Broadcast')         return handleBroadcastFlow(ctx);
  if (text === '📝 Caption BOX')       return handleCaptionBox(ctx);
  if (text === '🆘 Help')              return handleHelp(ctx);

  // Unknown — show keyboard
  return ctx.reply('অপশন সিলেক্ট করুন:', MAIN_KEYBOARD);
});

/* ══════════════════════════════════════════════════════
   FLOW HANDLERS
══════════════════════════════════════════════════════ */

/* ── Send Message Flow ── */
export async function handleSendMessageFlow(ctx) {
  ctx.session.state = 'await_send_uid';
  return ctx.reply('🆔 <b>Enter User ID</b>\n\nযে User কে message পাঠাবেন তার ID দিন:', { parse_mode: 'HTML' });
}

/* ── Received History ── */
export async function handleReceivedHistory(ctx) {
  const users = await getAllUsers();
  let allMessages = [];

  for (const user of users) {
    if (!user.sendHistory) continue;
    Object.values(user.sendHistory).forEach(msg => {
      allMessages.push({ ...msg, uid: user.uid });
    });
  }

  if (!allMessages.length) {
    return ctx.reply('📭 কোনো Received Message নেই।', MAIN_KEYBOARD);
  }

  allMessages.sort((a, b) => b.timestamp - a.timestamp);
  const recent = allMessages.slice(0, 15);

  for (const msg of recent) {
    const text = `┌────────────────────────\n📨 <b>Msg ID:</b> ${msg.msgId}\n🆔 <b>User ID:</b> ${msg.uid}\n👤 <b>Name:</b> ${msg.name || 'Unknown'}\n💬 <b>Message:</b> ${msg.message}\n🕒 <b>Time:</b> ${bdTime(msg.timestamp)}\n└────────────────────────`;

    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '🗑️ Delete', callback_data: `del_sent_${msg.uid}_${msg.msgId}` },
          { text: '📩 Reply',  callback_data: `reply_${msg.uid}_${msg.msgId}` }
        ]]
      }
    });
  }

  return ctx.reply(`✅ মোট ${allMessages.length} টি Message দেখানো হচ্ছে।`, MAIN_KEYBOARD);
}

/* ── Reply History ── */
export async function handleReplyHistory(ctx) {
  const users = await getAllUsers();
  let allReplies = [];

  for (const user of users) {
    if (!user.receivedMessages) continue;
    Object.values(user.receivedMessages).forEach(msg => {
      allReplies.push({ ...msg, uid: user.uid });
    });
  }

  if (!allReplies.length) {
    return ctx.reply('📭 কোনো Reply History নেই।', MAIN_KEYBOARD);
  }

  allReplies.sort((a, b) => b.timestamp - a.timestamp);
  const recent = allReplies.slice(0, 15);

  for (const msg of recent) {
    const text = `┌────────────────────────\n📤 <b>Msg ID:</b> ${msg.msgId}\n🆔 <b>User ID:</b> ${msg.uid}\n💬 <b>Message:</b> ${msg.message}\n🕒 <b>Send Time:</b> ${bdTime(msg.timestamp)}\n👁️ <b>Seen:</b> ${msg.seenAt ? bdTime(msg.seenAt) : 'Not yet'}\n└────────────────────────`;

    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '🗑️ Delete', callback_data: `del_recv_${msg.uid}_${msg.msgId}` }
        ]]
      }
    });
  }

  return ctx.reply(`✅ মোট ${allReplies.length} টি Reply দেখানো হচ্ছে।`, MAIN_KEYBOARD);
}

/* ── Show All Users ── */
export async function handleShowAllUsers(ctx) {
  const users = await getAllUsers();

  if (!users.length) {
    return ctx.reply('👥 কোনো Registered User নেই।', MAIN_KEYBOARD);
  }

  await ctx.reply(
    `╔══════════════════════════════╗\n👥 <b>REGISTERED USER ID LIST</b>\n╚══════════════════════════════╝\n\nমোট Users: <b>${users.length}</b>`,
    { parse_mode: 'HTML' }
  );

  for (let i = 0; i < users.length; i++) {
    const u    = users[i];
    const name = u.profile?.name || 'Unknown';
    const banned = u.banned ? '🔴 Banned' : '🟢 Active';

    const text = `━━━━━━━━━━━━━━━━━━\n🔢 <b>Number :</b> ${i + 1}\n🆔 <b>User ID :</b> ${u.uid}\n👤 <b>Name :</b> ${name}\n🔴 <b>Status :</b> ${banned}`;

    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔍 View Info',    callback_data: `info_${u.uid}` },
            { text: '🗑️ Clear Data',  callback_data: `clear_${u.uid}` }
          ],
          [
            { text: '🚫 Ban User',   callback_data: `ban_${u.uid}` },
            { text: '✅ Unban User', callback_data: `unban_${u.uid}` }
          ]
        ]
      }
    });
  }

  return ctx.reply('✅ সব User দেখানো হয়েছে।', MAIN_KEYBOARD);
}

/* ── Broadcast Flow ── */
export async function handleBroadcastFlow(ctx) {
  ctx.session.state = 'await_broadcast';
  return ctx.reply(
    '📢 <b>Broadcast Message লিখুন:</b>\n\nসব User এর কাছে এই message পাঠানো হবে।',
    { parse_mode: 'HTML' }
  );
}

/* ── Caption Box ── */
export async function handleCaptionBox(ctx) {
  const captions = await getAllCaptions();

  if (!captions.length) {
    await ctx.reply('📝 কোনো Caption নেই। নতুন Caption add করুন:', {
      reply_markup: {
        inline_keyboard: [[
          { text: '➕ Add New Caption', callback_data: 'caption_add' }
        ]]
      }
    });
    return;
  }

  await ctx.reply(
    `━━━━━━━━━━━━━━━━━━━━━━━\n🛠️ <b>CAPTION BOX</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\nমোট Captions: <b>${captions.length}</b>`,
    { parse_mode: 'HTML' }
  );

  for (const cap of captions) {
    const addedBy = cap.addedBy === 'admin' ? '👑 Admin' : `👤 User ${cap.addedBy}`;
    const text = `━━━━━━━━━━━━━━━━━━━━━━━\n📌 <b>Caption ID:</b> ${cap.capId || cap._key}\n\n💬 ${cap.text}\n\n🕒 ${bdTime(cap.timestamp)}\n🆔 Added By: ${addedBy}`;

    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '✏️ Edit',   callback_data: `caption_edit_${cap._key}` },
          { text: '🗑️ Delete', callback_data: `caption_del_${cap._key}` }
        ]]
      }
    });
  }

  return ctx.reply('➕ নতুন Caption add করতে:', {
    reply_markup: {
      inline_keyboard: [[
        { text: '➕ Add New Caption', callback_data: 'caption_add' }
      ]]
    }
  });
}

/* ── Help ── */
export async function handleHelp(ctx) {
  return ctx.reply(
    `╔══════════════════════╗\n🤖 <b>BOT HELP &amp; COMMAND MENU</b>\n╚══════════════════════╝\n\n📌 <b>Available Commands:</b>\n\n/start → Open Welcome Menu\n/send → Send Reply To User\n/received → View Received Messages\n/replyhistory → View Sent Replies History\n/users → Show All Registered Users\n/broadcast → Send Broadcast Notification\n/caption → Manage Website Captions\n/help → Open Help Menu\n/ban [uid] → Ban Any User\n/unban [uid] → Unban Any User\n/info [uid] → View User Information\n/ads on|off → Toggle Ads\n/status → View Bot Status\n\n📌 <b>Keyboard Buttons:</b>\n\n📨 Send Message\n📥 Received History\n📤 Reply History\n👥 Show All User\n📢 Broadcast\n📝 Caption BOX\n🆘 Help\n\n✅ Keyboard + Command — দুইভাবেই Bot কাজ করবে।`,
    { parse_mode: 'HTML', ...MAIN_KEYBOARD }
  );
}

/* ══════════════════════════════════════════════════════
   EXPORTS for webhook.js
══════════════════════════════════════════════════════ */
export {
  handleSendMessageFlow, handleReceivedHistory, handleReplyHistory,
  handleShowAllUsers, handleBroadcastFlow, handleCaptionBox, handleHelp,
  getAllUsers, getUser, banUser, unbanUser, clearUser,
  sendReplyToUser, writeBroadcast,
  getAllCaptions, addCaption, updateCaption, deleteCaption,
  setAdsStatus, bumpVersion, dbGet, dbSet, dbUpdate, dbDelete
};
