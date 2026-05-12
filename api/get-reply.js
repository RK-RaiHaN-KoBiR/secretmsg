// ============================================================
// 🔐 API: /api/get-reply
// Polls for unseen admin replies for a given userId
// ============================================================

const MASTER_KEY  = process.env.JSONBIN_MASTER_KEY;
const ACCESS_KEY  = process.env.JSONBIN_ACCESS_KEY;
const REPLIES_BIN = process.env.JSONBIN_REPLIES_BIN_ID;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  if (!REPLIES_BIN) return res.status(200).json({ hasNewReply: false });

  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${REPLIES_BIN}/latest`, {
      headers: { 'X-Master-Key': MASTER_KEY, 'X-Access-Key': ACCESS_KEY }
    });
    if (!r.ok) return res.status(200).json({ hasNewReply: false });

    const data = await r.json();
    const replies = data.record?.replies || [];

    // Find latest unseen reply for this userId
    const userReplies = replies.filter(rp => rp.userId === userId && !rp.seen);
    if (!userReplies.length) return res.status(200).json({ hasNewReply: false });

    const latest = userReplies[userReplies.length - 1];
    return res.status(200).json({ hasNewReply: true, reply: latest });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' });
  }
}
