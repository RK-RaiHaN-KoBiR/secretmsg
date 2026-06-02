/* ============================================================
   bot/bot.js — Cithi-Pathan Telegram Bot (Main Entry)
   ============================================================ */

'use strict';

const { readDB, writeDB, genId } = require('../api/database');
const { handleCommand, handleCallbackQuery, handleAdminState } = require('./commands');
const { setupWebhook } = require('./webhook');

const BOT_TOKEN = process.env.BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_ID  = parseInt(process.env.ADMIN_ID || '6048050987');
const TG_API    = `https://api.telegram.org/bot${BOT_TOKEN}`;

/* ---------- Global admin state (conversation context) ---------- */
const adminState = {};  // { step, data }

/* ---------- BD Time ---------- */
function getBDTime() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
  const pad = n => String(n).padStart(2, '0');
  let h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()}`;
  const timeStr = `${pad(h)}:${pad(m)} ${ampm}`;
  return `${timeStr} 🔸 ${dateStr} BD Time`;
}

/* ---------- Send Telegram Message ---------- */
async function sendMsg(chatId, text, extra = {}) {
  try {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...extra,
      }),
    });
    return res.json();
  } catch (e) {
    console.error('sendMsg error:', e.message);
  }
}

/* ---------- Edit Telegram Message ---------- */
async function editMsg(chatId, messageId, text, extra = {}) {
  try {
    await fetch(`${TG_API}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...extra }),
    });
  } catch {}
}

/* ---------- Answer Callback Query ---------- */
async function answerCB(callbackQueryId, text = '') {
  try {
    await fetch(`${TG_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch {}
}

/* ---------- Main Update Handler ---------- */
async function handleUpdate(update) {
  try {
    /* --- Callback Query (inline button clicks) --- */
    if (update.callback_query) {
      const cb = update.callback_query;
      const fromId = cb.from.id;
      if (fromId !== ADMIN_ID) {
        await answerCB(cb.id, '⛔ Unauthorized');
        return;
      }
      await answerCB(cb.id);
      await handleCallbackQuery(cb, { sendMsg, editMsg, adminState, getBDTime, ADMIN_ID, BOT_TOKEN, TG_API });
      return;
    }

    /* --- Message --- */
    if (!update.message) return;
    const msg  = update.message;
    const from = msg.from;
    const text = (msg.text || '').trim();
    const chatId = msg.chat.id;

    /* Only allow admin */
    if (from.id !== ADMIN_ID) {
      await sendMsg(chatId, '⛔ এই Bot শুধুমাত্র Admin ব্যবহার করতে পারবে।');
      return;
    }

    /* If admin is in a multi-step state, handle it */
    if (adminState[ADMIN_ID] && adminState[ADMIN_ID].step) {
      await handleAdminState(msg, text, { sendMsg, adminState, getBDTime, ADMIN_ID, TG_API, readDB, writeDB, genId });
      return;
    }

    /* Commands & keyboard text */
    await handleCommand(msg, text, { sendMsg, adminState, getBDTime, ADMIN_ID, TG_API, readDB, writeDB, genId });

  } catch (err) {
    console.error('handleUpdate error:', err);
  }
}

/* ---------- Polling (fallback if no webhook) ---------- */
let offset = 0;
async function poll() {
  try {
    const res = await fetch(`${TG_API}/getUpdates?offset=${offset}&timeout=30&limit=10`);
    const data = await res.json();
    if (data.ok && data.result.length) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        await handleUpdate(update);
      }
    }
  } catch (e) {
    console.error('Polling error:', e.message);
  }
  setTimeout(poll, 1000);
}

/* ---------- Webhook handler (exported for Vercel) ---------- */
async function webhookHandler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('OK');
  try {
    await handleUpdate(req.body);
  } catch (e) {
    console.error('Webhook handler error:', e);
  }
  res.status(200).json({ ok: true });
}

/* ---------- Start ---------- */
async function start() {
  console.log('🤖 Cithi-Pathan Bot Starting...');

  // Set bot commands
  try {
    await fetch(`${TG_API}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start',        description: 'Open Welcome Menu' },
          { command: 'send',         description: 'Send Reply To User' },
          { command: 'received',     description: 'View Received Messages' },
          { command: 'replyhistory', description: 'View Sent Replies History' },
          { command: 'users',        description: 'Show All Registered Users' },
          { command: 'broadcast',    description: 'Send Broadcast Notification' },
          { command: 'caption',      description: 'Manage Website Captions' },
          { command: 'help',         description: 'Open Help Menu' },
          { command: 'ban',          description: 'Ban a User: /ban UID' },
          { command: 'unban',        description: 'Unban a User: /unban UID' },
          { command: 'info',         description: 'View User Info: /info UID' },
          { command: 'delete',       description: 'Delete Message: /delete MSGID' },
          { command: 'status',       description: 'View Bot Status Report' },
          { command: 'ads',          description: 'Toggle Ads: /ads on or /ads off' },
          { command: 'clear',        description: 'Clear User Data: /clear UID' },
        ],
      }),
    });
    console.log('✅ Bot commands registered');
  } catch (e) {
    console.error('setMyCommands error:', e.message);
  }

  // Check if WEBHOOK_URL is set, else use polling
  const webhookUrl = process.env.WEBHOOK_URL;
  if (webhookUrl) {
    await setupWebhook(TG_API, webhookUrl);
    console.log(`✅ Webhook set: ${webhookUrl}`);
  } else {
    console.log('🔄 Using long-polling...');
    poll();
  }
}

/* Export for Vercel webhook route */
module.exports = { webhookHandler, handleUpdate, sendMsg, getBDTime, ADMIN_ID, TG_API };

/* Run if called directly */
if (require.main === module) {
  start().catch(console.error);
}
