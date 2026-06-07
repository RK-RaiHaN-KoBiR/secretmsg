/**
 * ═══════════════════════════════════════════════════════
 *  /api/user.js — Vercel Serverless Function
 *  Handles: IP lookup, new user alert, device info saving
 * ═══════════════════════════════════════════════════════
 */

'use strict';

const BOT_TOKEN       = process.env.BOT_TOKEN       || "8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA";
const ADMIN_ID        = process.env.ADMIN_ID        || "6048050987";
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || "https://cithi-pathan-default-rtdb.firebaseio.com";
const FIREBASE_SECRET = process.env.FIREBASE_SECRET || "";  // Optional: Firebase DB secret for write access

/* ──────────────────────────────────────────────────────
   TELEGRAM HELPER
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
   BD TIME
────────────────────────────────────────────────────── */
function bdTime(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).replace(',', ' —') + ' BD Time';
}

/* ──────────────────────────────────────────────────────
   IP LOOKUP using ipapi.co (free, no key required)
────────────────────────────────────────────────────── */
async function lookupIP(ip) {
  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!r.ok) return {};
    const d = await r.json();
    return {
      ip:      d.ip      || ip,
      country: d.country_name || 'Unknown',
      region:  d.region  || 'Unknown',
      city:    d.city    || 'Unknown',
      isp:     d.org     || 'Unknown',
      postal:  d.postal  || ''
    };
  } catch (_) {
    return { ip };
  }
}

/* ──────────────────────────────────────────────────────
   GET CLIENT IP from request headers
────────────────────────────────────────────────────── */
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'Unknown'
  );
}

/* ──────────────────────────────────────────────────────
   MAIN HANDLER
────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  /* ── GET /api/user?action=getip — Return IP & location info ── */
  if (req.method === 'GET' && action === 'getip') {
    const ip   = getClientIP(req);
    const data = await lookupIP(ip);
    return res.status(200).json(data);
  }

  /* ── POST /api/user — New user registration alert ── */
  if (req.method === 'POST') {
    const body = req.body;
    if (!body) return res.status(400).json({ error: 'No body' });

    if (body.action === 'newUser') {
      return handleNewUserAlert(body, req, res);
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/* ──────────────────────────────────────────────────────
   NEW USER ALERT → Telegram
────────────────────────────────────────────────────── */
async function handleNewUserAlert(body, req, res) {
  const { uid, deviceInfo } = body;
  const ip     = deviceInfo?.ip || getClientIP(req);
  const ipData = await lookupIP(ip);

  const d = { ...deviceInfo, ...ipData };

  const text = `
╔══════════════════════╗
🆕 <b>NEW USER JOINED!</b>
╚══════════════════════╝

📅 <b>Join Time &amp; Date :</b>
${bdTime(Date.now())}

🆔 <b>User ID :</b> ${uid}

📱 <b>Device Info :</b> ${d.userAgent?.substring(0, 80) || 'Unknown'}

🔋 <b>Battery :</b> ${d.battery ? `${d.battery.level} (${d.battery.charging})` : 'Unknown'}

📶 <b>Network :</b> ${d.network || 'Unknown'}

🌍 <b>IP Address :</b> ${d.ip || 'Unknown'}

🏙️ <b>Country :</b> ${d.country || 'Unknown'}

🏠 <b>Division :</b> ${d.region || 'Unknown'}

📍 <b>City :</b> ${d.city || 'Unknown'}

📡 <b>ISP Provider :</b> ${d.isp || 'Unknown'}

📱 <b>Screen :</b> ${d.screen || 'Unknown'}

💾 <b>RAM :</b> ${d.ram || 'Unknown'}

🧠 <b>User Agent :</b>
<code>${(d.userAgent || 'Unknown').substring(0, 200)}</code>
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
