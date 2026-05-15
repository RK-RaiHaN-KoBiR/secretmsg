/* ===== api/broadcast.js — Vercel Serverless ===== */
const { readDB, writeDB, getBDTime } = require('./database');

const BOT_TOKEN = process.env.BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_ID  = process.env.ADMIN_ID  || '6048050987';
const TG_API    = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendTg(chatId, text) {
  try {
    await fetch(`${TG_API}/sendMessage`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ chat_id:chatId, text, parse_mode:'HTML' })
    });
  } catch(e) {}
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await readDB();

    if (req.method === 'POST') {
      const { message } = req.body || {};
      if (!message) return res.json({ ok: false, error: 'No message' });
      if (!db.broadcasts) db.broadcasts = [];

      const time = getBDTime();
      const bc   = { id: `bc_${Date.now()}`, message, time };
      db.broadcasts.push(bc);
      // Keep only last 10 broadcasts
      if (db.broadcasts.length > 10) db.broadcasts = db.broadcasts.slice(-10);
      await writeDB(db);

      const userCount = Object.keys(db.users || {}).length;
      await sendTg(ADMIN_ID, `✅ <b>Broadcast Successfully Sent To Website All Users!</b>\n\n🕒 <b>Send Time:</b> ${time}\n👥 <b>Total Users:</b> ${userCount}`);

      return res.json({ ok: true, bc });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch(e) {
    console.error('Broadcast API error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
};
