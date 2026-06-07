/**
 * ═══════════════════════════════════════════════════════
 *  /api/caption.js — Vercel Serverless Function
 *  Handles: New caption alert to admin bot
 *           Push notification to all users for new caption
 * ═══════════════════════════════════════════════════════
 */

'use strict';

const BOT_TOKEN       = process.env.BOT_TOKEN       || "8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA";
const ADMIN_ID        = process.env.ADMIN_ID        || "6048050987";
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || "https://cithi-pathan-default-rtdb.firebaseio.com";

/* ──────────────────────────────────────────────────────
   VAPID CONFIG — for sending push notifications
────────────────────────────────────────────────────── */
const VAPID_SUBJECT     = "mailto:Taniishaakhtar@gmail.com";
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || "BIh4Gq9Jk7zAHcmViGZZLSmMVwl8zcmuOdAplHXSFzljdyffQdSIJ0ACpfNHTyGFhIeG2d9O8Y6MJJhZ-MpdxBY";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "-stTkJCFdwSCV2MsKMS1fioNYi75GT1l_vIeicJ42bc";

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
  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(params)
  });
  return res.json();
}

/* ──────────────────────────────────────────────────────
   MAIN HANDLER
────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body;
  if (!body) return res.status(400).json({ error: 'No body' });

  /* ── New Caption Added ── */
  if (body.action === 'add') {
    const { uid, capData } = body;

    const text = `
🚨 <b>Alert : New Caption Added!</b>

📌 <b>Caption Number :</b>
${capData.capId}

🆔 <b>Caption Added By User :</b>
${uid}

💬 <b>Caption :</b>
${capData.text}

🕒 <b>Added Time &amp; Date :</b>
${bdTime(capData.timestamp)}
`.trim();

    try {
      await sendTelegram('sendMessage', {
        chat_id:    ADMIN_ID,
        text,
        parse_mode: 'HTML'
      });
    } catch (_) {}

    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
