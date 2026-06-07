/**
 * ═══════════════════════════════════════════════════════
 *  /api/broadcast.js — Vercel Serverless Function
 *  Handles: Broadcast seen report → Telegram admin
 * ═══════════════════════════════════════════════════════
 */

'use strict';

const BOT_TOKEN       = process.env.BOT_TOKEN       || "8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA";
const ADMIN_ID        = process.env.ADMIN_ID        || "6048050987";
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || "https://cithi-pathan-default-rtdb.firebaseio.com";

function bdTime(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).replace(',', ' —') + ' BD Time';
}

async function sendTelegram(method, params) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  const r   = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(params)
  });
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { action, uid, bcId } = req.body || {};

  /* ── Seen Report ── */
  if (action === 'seen' && uid) {
    // Fetch device info for richer report
    let d = {};
    try {
      const r = await fetch(`${FIREBASE_DB_URL}/users/${uid}/deviceInfo.json`);
      if (r.ok) d = await r.json() || {};
    } catch (_) {}

    const text = `
👁️ <b>User : [${uid}]</b>
Seen Your Broadcast Message!

🕒 <b>Seen Time :</b>
${bdTime(Date.now())}

━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>User ID :</b> ${uid}
📱 <b>Device Info :</b> ${d.userAgent?.substring(0,60) || 'Unknown'}
🔋 <b>Charging :</b> ${d.battery ? `${d.battery.level} (${d.battery.charging})` : 'Unknown'}
📶 <b>Network :</b> ${d.network || 'Unknown'}
🌍 <b>IP :</b> ${d.ip || 'Unknown'}
🏙️ <b>Country :</b> ${d.country || 'Unknown'}
🏠 <b>Division :</b> ${d.region || 'Unknown'}
📍 <b>City :</b> ${d.city || 'Unknown'}
📡 <b>ISP :</b> ${d.isp || 'Unknown'}
📱 <b>Device Model :</b> ${d.screen || 'Unknown'}
💾 <b>RAM :</b> ${d.ram || 'Unknown'}
`.trim();

    try {
      await sendTelegram('sendMessage', {
        chat_id:      ADMIN_ID,
        text,
        parse_mode:   'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '📩 Reply User', callback_data: `reply_${uid}_bc` }
          ]]
        }
      });
    } catch (_) {}

    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
