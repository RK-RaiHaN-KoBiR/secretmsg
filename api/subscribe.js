// api/subscribe.js
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID || '6a048364250b1311c344cc10';
const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY || '$2a$10$dFJuDsfbDqqnkKBPh2bGMuHea6RJjPSU2bv67bkIM9GaJkypisWdW';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = req.body;

  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
    });
    const data = await r.json();
    const db = data.record || { users: {} };

    if (!db.users) db.users = {};
    if (!db.users[userId]) db.users[userId] = {};
    db.users[userId].notifAllowed = true;

    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_MASTER_KEY
      },
      body: JSON.stringify(db)
    });

    return res.status(200).json({ ok: true });
  } catch(e) {
    return res.status(500).json({ error: 'Internal error' });
  }
}
