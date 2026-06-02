/* ============================================================
   api/caption.js — Caption Management Endpoint
   ============================================================ */

const { readDB, writeDB, genId } = require('./database');

const BOT_TOKEN = process.env.BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_ID  = process.env.ADMIN_ID  || '6048050987';
const TG_API    = `https://api.telegram.org/bot${BOT_TOKEN}`;

function getBDTime() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
  const pad = n => String(n).padStart(2, '0');
  let h = now.getHours(), m = now.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} — ${pad(h)}:${pad(m)} ${ampm} BD Time`;
}

async function sendTelegram(chatId, text, extra = {}) {
  try {
    await fetch(`${TG_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
    });
  } catch {}
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await readDB();

    /* ---- GET CAPTIONS ---- */
    if (req.method === 'GET') {
      const uid = req.query.uid;
      const captions = (db.captions || []).filter(c => !c.deleted);
      return res.status(200).json({ ok: true, captions });
    }

    if (req.method !== 'POST') return res.status(405).json({ ok: false });

    const { action, uid, text, id } = req.body || {};

    /* ---- ADD CAPTION ---- */
    if (action === 'add') {
      if (!text || !text.trim()) return res.status(400).json({ ok: false, error: 'No text' });
      const captionNum = db.meta.nextCaptionNum || 1;
      db.meta.nextCaptionNum = captionNum + 1;
      const caption = {
        id: genId(),
        captionNum,
        text: text.trim(),
        addedBy: String(uid),
        time: getBDTime(),
        deleted: false,
        timestamp: Date.now(),
      };
      if (!db.captions) db.captions = [];
      db.captions.push(caption);
      await writeDB(db);

      // Notify admin
      const botMsg = `🚨 <b>Alert: New Caption Added!</b>

📌 <b>Caption Number:</b> ${String(captionNum).padStart(2,'0')}

🆔 <b>Caption Added By User:</b> <code>${uid}</code>

💬 <b>Caption:</b>
${text}

🕒 <b>Added Time &amp; Date:</b>
${getBDTime()}`;
      await sendTelegram(ADMIN_ID, botMsg);

      return res.status(200).json({ ok: true, caption });
    }

    /* ---- EDIT CAPTION ---- */
    if (action === 'edit') {
      const cap = (db.captions || []).find(c => c.id === id);
      if (!cap) return res.status(404).json({ ok: false, error: 'Caption not found' });
      // Only owner or admin can edit
      if (String(cap.addedBy) !== String(uid) && cap.addedBy !== 'admin') {
        return res.status(403).json({ ok: false, error: 'Not authorized' });
      }
      cap.text = text.trim();
      cap.editedAt = getBDTime();
      await writeDB(db);
      return res.status(200).json({ ok: true });
    }

    /* ---- DELETE CAPTION ---- */
    if (action === 'delete') {
      const cap = (db.captions || []).find(c => c.id === id);
      if (!cap) return res.status(404).json({ ok: false, error: 'Caption not found' });
      if (String(cap.addedBy) !== String(uid) && cap.addedBy !== 'admin') {
        return res.status(403).json({ ok: false, error: 'Not authorized' });
      }
      cap.deleted = true;
      await writeDB(db);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
};
