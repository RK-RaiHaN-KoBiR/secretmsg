/**
 * ═══════════════════════════════════════════════════════
 *  CITHI PATHAN — bot/admin.js
 *  Handles all inline keyboard callback_query actions:
 *  reply, ban, unban, delete, info, clear, caption CRUD
 * ═══════════════════════════════════════════════════════
 */

'use strict';

import { MAIN_KEYBOARD, bdTime } from './bot.js';
import { sendUserInfo }           from './commands.js';
import {
  getUser, banUser, unbanUser, clearUser,
  sendReplyToUser,
  getAllCaptions, updateCaption, deleteCaption,
  dbDelete, dbGet
} from '../api/database.js';

/* ══════════════════════════════════════════════════════
   REGISTER ALL ADMIN CALLBACK HANDLERS
══════════════════════════════════════════════════════ */
export function handleAdmin(bot) {

  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (!data) return;

    await ctx.answerCbQuery(); // Always acknowledge immediately

    /* ══════════════════════════════════
       📩 REPLY TO USER
       callback: reply_<uid>_<msgId>
    ══════════════════════════════════ */
    if (data.startsWith('reply_')) {
      const parts  = data.split('_');
      const uid    = parts[1];
      const msgId  = parts[2];

      // Set session state to await message text
      ctx.session.state         = 'await_reply_msg';
      ctx.session.replyUID      = uid;
      ctx.session.pendingMsgId  = msgId;

      return ctx.reply(
        `📩 <b>Reply to User</b>\n\n🆔 User ID: <b>${uid}</b>\n\nNow type your reply message:`,
        { parse_mode: 'HTML' }
      );
    }

    /* ══════════════════════════════════
       🔍 VIEW USER INFO
       callback: info_<uid>
    ══════════════════════════════════ */
    if (data.startsWith('info_')) {
      const uid  = data.replace('info_', '');
      const user = await getUser(uid);
      if (!user) return ctx.reply(`❌ User ${uid} পাওয়া যায়নি।`);
      return sendUserInfo(ctx, uid, user);
    }

    /* ══════════════════════════════════
       🚫 BAN USER
       callback: ban_<uid>
    ══════════════════════════════════ */
    if (data.startsWith('ban_')) {
      const uid = data.replace('ban_', '');
      await banUser(uid);
      return ctx.reply(
        `🚫 <b>User Banned!</b>\n\n🆔 User ID: <b>${uid}</b>\n🕒 Time: ${bdTime()}\n\n✅ User can no longer access the website.`,
        { parse_mode: 'HTML', ...MAIN_KEYBOARD }
      );
    }

    /* ══════════════════════════════════
       ✅ UNBAN USER
       callback: unban_<uid>
    ══════════════════════════════════ */
    if (data.startsWith('unban_')) {
      const uid = data.replace('unban_', '');
      await unbanUser(uid);
      return ctx.reply(
        `✅ <b>User Unbanned!</b>\n\n🆔 User ID: <b>${uid}</b>\n🕒 Time: ${bdTime()}\n\n🟢 User can now access the website again.`,
        { parse_mode: 'HTML', ...MAIN_KEYBOARD }
      );
    }

    /* ══════════════════════════════════
       🗑️ CLEAR USER DATA
       callback: clear_<uid>
    ══════════════════════════════════ */
    if (data.startsWith('clear_')) {
      const uid = data.replace('clear_', '');

      // Ask for confirmation
      return ctx.reply(
        `⚠️ <b>Confirm: Clear User Data?</b>\n\n🆔 User ID: <b>${uid}</b>\n\nএই user এর সব ডেটা permanently মুছে যাবে!\nUser site এ ঢুকলে নতুন করে register হবে।`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '✔️ Yes, Clear',  callback_data: `clearconfirm_${uid}` },
              { text: '❌ No, Cancel',  callback_data: 'cancel' }
            ]]
          }
        }
      );
    }

    /* ── Confirm Clear ── */
    if (data.startsWith('clearconfirm_')) {
      const uid = data.replace('clearconfirm_', '');
      await clearUser(uid);
      return ctx.reply(
        `✅ <b>User Data Cleared Successfully!</b>\n\n🆔 User ID: <b>${uid}</b>\n🗑️ সব ডেটা মুছে ফেলা হয়েছে।\n🕒 ${bdTime()}`,
        { parse_mode: 'HTML', ...MAIN_KEYBOARD }
      );
    }

    /* ══════════════════════════════════
       🗑️ DELETE SENT MESSAGE (from user)
       callback: del_sent_<uid>_<msgId>
    ══════════════════════════════════ */
    if (data.startsWith('del_sent_')) {
      const parts = data.split('_');
      const uid   = parts[2];
      const msgId = parts[3];

      return ctx.reply(
        `⚠️ <b>Delete This Message?</b>\n\n🆔 UID: ${uid} | Msg: ${msgId}\n\nUser এর Send History থেকেও Remove হবে।`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '✔️ Yes, Delete', callback_data: `delconfirm_sent_${uid}_${msgId}` },
              { text: '❌ Cancel',       callback_data: 'cancel' }
            ]]
          }
        }
      );
    }

    if (data.startsWith('delconfirm_sent_')) {
      const parts = data.split('_');
      const uid   = parts[2];
      const msgId = parts[3];
      await dbDelete(`users/${uid}/sendHistory/${msgId}`);
      return ctx.reply(`🗑️ Message deleted.\n🆔 UID: ${uid} | Msg: ${msgId}`, MAIN_KEYBOARD);
    }

    /* ══════════════════════════════════
       🗑️ DELETE RECEIVED (reply from admin)
       callback: del_recv_<uid>_<msgId>
    ══════════════════════════════════ */
    if (data.startsWith('del_recv_')) {
      const parts = data.split('_');
      const uid   = parts[2];
      const msgId = parts[3];

      return ctx.reply(
        `⚠️ <b>Delete This Reply?</b>\n\n🆔 UID: ${uid} | Msg: ${msgId}\n\nUser এর Received History থেকেও Remove হবে।`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '✔️ Yes, Delete', callback_data: `delconfirm_recv_${uid}_${msgId}` },
              { text: '❌ Cancel',       callback_data: 'cancel' }
            ]]
          }
        }
      );
    }

    if (data.startsWith('delconfirm_recv_')) {
      const parts = data.split('_');
      const uid   = parts[2];
      const msgId = parts[3];
      await dbDelete(`users/${uid}/receivedMessages/${msgId}`);
      return ctx.reply(`🗑️ Reply deleted.\n🆔 UID: ${uid} | Msg: ${msgId}`, MAIN_KEYBOARD);
    }

    /* ══════════════════════════════════
       📝 CAPTION — ADD NEW
       callback: caption_add
    ══════════════════════════════════ */
    if (data === 'caption_add') {
      ctx.session.state = 'await_caption';
      return ctx.reply(
        `➕ <b>Add New Caption Mode Activated</b>\n\n📝 Please type your new caption below:\n✍️ Send your caption as a message...`,
        { parse_mode: 'HTML' }
      );
    }

    /* ══════════════════════════════════
       ✏️ CAPTION — EDIT
       callback: caption_edit_<capId>
    ══════════════════════════════════ */
    if (data.startsWith('caption_edit_')) {
      const capId = data.replace('caption_edit_', '');
      ctx.session.state         = 'await_edit_caption';
      ctx.session.editCaptionId = capId;

      // Show current text
      const cap = await dbGet(`captions/${capId}`);
      return ctx.reply(
        `✏️ <b>Edit Caption Mode Activated</b>\n\n📌 Caption ID: <b>${capId}</b>\n💬 Current text:\n${cap?.text || '—'}\n\n📝 নতুন text পাঠান:`,
        { parse_mode: 'HTML' }
      );
    }

    /* ══════════════════════════════════
       🗑️ CAPTION — DELETE
       callback: caption_del_<capId>
    ══════════════════════════════════ */
    if (data.startsWith('caption_del_')) {
      const capId = data.replace('caption_del_', '');

      return ctx.reply(
        `🗑️ <b>Delete Caption?</b>\n\n📌 Caption ID: <b>${capId}</b>\n\nAre you sure you want to delete this caption?`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '✔️ Yes, Delete', callback_data: `captiondelconfirm_${capId}` },
              { text: '❌ No, Cancel',  callback_data: 'cancel' }
            ]]
          }
        }
      );
    }

    if (data.startsWith('captiondelconfirm_')) {
      const capId = data.replace('captiondelconfirm_', '');
      await deleteCaption(capId);
      return ctx.reply(
        `✅ <b>Caption Deleted Successfully!</b>\n\n📌 Caption ID: ${capId}\n\n🌐 Removed from website instantly.`,
        { parse_mode: 'HTML', ...MAIN_KEYBOARD }
      );
    }

    /* ══════════════════════════════════
       ❌ CANCEL — dismiss any confirmation
    ══════════════════════════════════ */
    if (data === 'cancel') {
      ctx.session.state         = null;
      ctx.session.replyUID      = null;
      ctx.session.editCaptionId = null;
      return ctx.reply('✅ Cancelled.', MAIN_KEYBOARD);
    }

  }); // end callback_query
}
