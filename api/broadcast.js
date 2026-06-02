/* ============================================================
   api/broadcast.js — Broadcast & Ads Control Endpoint
   ============================================================ */

const { readDB, writeDB } = require('./database');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || (req.body && req.body.action);

  try {
    const db = await readDB();

    /* ---- ADS STATUS ---- */
    if (action === 'adsStatus') {
      return res.status(200).json({ adsEnabled: db.meta.adsEnabled !== false });
    }

    /* ---- BROADCAST SEEN ---- */
    if (action === 'seen') {
      const { uid, bid } = req.query;
      const bc = (db.broadcasts || []).find(b => b.id === bid);
      if (bc) {
        if (!bc.seenBy) bc.seenBy = [];
        if (!bc.seenBy.includes(uid)) {
          bc.seenBy.push(uid);
          await writeDB(db);
        }
      }
      return res.status(200).json({ ok: true });
    }

    /* ---- GET LATEST BROADCAST ---- */
    if (action === 'latest') {
      const uid = req.query.uid;
      const bcs = (db.broadcasts || []);
      const latest = bcs.length ? bcs[bcs.length - 1] : null;
      if (!latest) return res.status(200).json({ broadcast: null });
      const seen = latest.seenBy && latest.seenBy.includes(String(uid));
      return res.status(200).json({ broadcast: seen ? null : latest });
    }

    return res.status(400).json({ ok: false });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
};
