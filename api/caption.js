/* ===== api/caption.js — Vercel Serverless ===== */
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
    if (!db.captions) db.captions = [];

    // ── GET ──
    if (req.method === 'GET') {
      const { uid } = req.query;
      // Return admin captions + this user's captions
      const visible = db.captions.filter(c => !c.deleted && (c.source === 'admin' || c.uid === uid));
      return res.json({ captions: visible });
    }

    // ── POST ──
    if (req.method === 'POST') {
      const { action, uid, text, id } = req.body || {};

      if (action === 'add') {
        const time   = getBDTime();
        const capId  = `cap_${Date.now()}`;
        const num    = db.nextCaptionNum || 1;
        const cap    = { id: capId, num, text, uid, source: 'user', time, deleted: false };
        db.captions.push(cap);
        db.nextCaptionNum = num + 1;
        await writeDB(db);
        // Notify admin
        await sendTg(ADMIN_ID, `🚨 <b>Alert: New Caption Added!</b>\n\n📌 <b>Caption Number:</b> ${String(num).padStart(2,'0')}\n🆔 <b>Added By User:</b> ${uid}\n💬 <b>Caption:</b>\n${text}\n\n🕒 <b>Added Time:</b> ${time}`);
        return res.json({ ok: true, cap });
      }

      if (action === 'edit') {
        const cap = db.captions.find(c => c.id === id && c.uid === uid);
        if (!cap) return res.json({ ok: false, error: 'Not found or unauthorized' });
        cap.text = text;
        cap.editedAt = getBDTime();
        await writeDB(db);
        return res.json({ ok: true });
      }

      if (action === 'delete') {
        const cap = db.captions.find(c => c.id === id && (c.uid === uid || uid === ADMIN_ID));
        if (!cap) return res.json({ ok: false, error: 'Not found' });
        cap.deleted = true;
        await writeDB(db);
        return res.json({ ok: true });
      }

      // Admin add (from bot)
      if (action === 'adminAdd') {
        const time  = getBDTime();
        const capId = `cap_admin_${Date.now()}`;
        const num   = db.nextCaptionNum || 1;
        const cap   = { id: capId, num, text, uid: 'admin', source: 'admin', time, deleted: false };
        db.captions.push(cap);
        db.nextCaptionNum = num + 1;
        await writeDB(db);
        return res.json({ ok: true, cap });
      }

      return res.json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch(e) {
    console.error('Caption API error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
};
