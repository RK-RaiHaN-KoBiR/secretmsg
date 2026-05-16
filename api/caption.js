// ===== CAPTION API =====
const { readDB, writeDB, getBDTime, genId, invalidateCache } = require('./database');
const { sendTelegramMessage } = require('../bot/webhook');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await readDB();
    db.captions = db.captions || [];

    if (req.method === 'GET') {
      const { userId } = req.query;
      // Return admin captions + user's own captions
      const visible = db.captions.filter(c =>
        c.addedBy === 'admin' || c.addedBy === userId
      );
      return res.json({ captions: visible });
    }

    if (req.method === 'POST') {
      const { action, userId, text, captionId } = req.body;

      if (action === 'add') {
        if (!text) return res.status(400).json({ error: 'Text required' });
        const now = getBDTime();
        const userCaptions = db.captions.filter(c => c.addedBy === userId);
        const capNumber = String(userCaptions.length + 1).padStart(2, '0');
        const newCap = {
          id: genId(), text, addedBy: userId,
          number: capNumber, time: now
        };
        db.captions.push(newCap);
        db.newCaption = { id: newCap.id, text, time: now };
        await writeDB(db);
        invalidateCache();

        // Notify bot
        const adminTotalCaps = db.captions.filter(c => c.addedBy === userId).length;
        const botMsg =
`🚨 Alert: New Caption Added!

📌 Caption Number: ${capNumber}

🆔 Added By User: ${userId}

💬 Caption:
${text}

🕒 Added Time & Date:
${now}`;
        await sendTelegramMessage(botMsg);
        return res.json({ success: true, caption: newCap });
      }

      if (action === 'edit') {
        const cap = db.captions.find(c => c.id === captionId && c.addedBy === userId);
        if (!cap) return res.status(403).json({ error: 'Not found or not owner' });
        cap.text = text;
        cap.editedAt = getBDTime();
        await writeDB(db);
        invalidateCache();
        return res.json({ success: true });
      }

      if (action === 'delete') {
        const idx = db.captions.findIndex(c => c.id === captionId && c.addedBy === userId);
        if (idx === -1) return res.status(403).json({ error: 'Not found or not owner' });
        db.captions.splice(idx, 1);
        await writeDB(db);
        invalidateCache();
        return res.json({ success: true });
      }

      // Admin: add caption
      if (action === 'admin_add') {
        const now = getBDTime();
        const adminCaps = db.captions.filter(c => c.addedBy === 'admin');
        const newCap = {
          id: genId(), text, addedBy: 'admin',
          number: String(adminCaps.length + 1).padStart(2, '0'), time: now
        };
        db.captions.push(newCap);
        db.newCaption = { id: newCap.id, text, time: now };
        await writeDB(db);
        invalidateCache();
        return res.json({ success: true, caption: newCap });
      }

      if (action === 'admin_edit') {
        const cap = db.captions.find(c => c.id === captionId);
        if (!cap) return res.status(404).json({ error: 'Not found' });
        cap.text = text; cap.editedAt = getBDTime();
        await writeDB(db);
        invalidateCache();
        return res.json({ success: true });
      }

      if (action === 'admin_delete') {
        const idx = db.captions.findIndex(c => c.id === captionId);
        if (idx !== -1) { db.captions.splice(idx, 1); await writeDB(db); invalidateCache(); }
        return res.json({ success: true });
      }
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('Caption API Error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};
