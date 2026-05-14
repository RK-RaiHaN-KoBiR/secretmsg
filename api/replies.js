// api/replies.js - Get replies for a user
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID || '6a048364250b1311c344cc10';
const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY || '$2a$10$dFJuDsfbDqqnkKBPh2bGMuHea6RJjPSU2bv67bkIM9GaJkypisWdW';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
    });
    const data = await r.json();
    const db = data.record || { replies: [] };

    const userReplies = (db.replies || []).filter(rep => rep.userId === userId && !rep.seenByUser);

    return res.status(200).json({ replies: userReplies });
  } catch(e) {
    return res.status(500).json({ error: 'Internal error', replies: [] });
  }
}
