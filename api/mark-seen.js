// ============================================================
// 🔐 API: /api/mark-seen
// Marks a reply as seen by the user, notifies admin via Telegram
// ============================================================

const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const MASTER_KEY    = process.env.JSONBIN_MASTER_KEY;
const ACCESS_KEY    = process.env.JSONBIN_ACCESS_KEY;
const REPLIES_BIN   = process.env.JSONBIN_REPLIES_BIN_ID;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { return res.status(400).json({ error: 'Bad JSON' }); }
  }

  const { userId, replyId } = body || {};
  if (!userId || !replyId) return res.status(400).json({ error: 'Missing fields' });

  const now = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });

  try {
    // Update JSONBIN — mark reply seen
    if (REPLIES_BIN) {
      const r = await fetch(`https://api.jsonbin.io/v3/b/${REPLIES_BIN}/latest`, {
        headers: { 'X-Master-Key': MASTER_KEY, 'X-Access-Key': ACCESS_KEY }
      });
      if (r.ok) {
        const data = await r.json();
        const record = data.record || { replies: [] };
        if (record.replies) {
          const idx = record.replies.findIndex(rp => rp.id === replyId && rp.userId === userId);
          if (idx !== -1) {
            record.replies[idx].seen = true;
            record.replies[idx].seenAt = now;
          }
          await fetch(`https://api.jsonbin.io/v3/b/${REPLIES_BIN}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Master-Key': MASTER_KEY, 'X-Access-Key': ACCESS_KEY },
            body: JSON.stringify(record)
          });
        }
      }
    }

    // Notify admin on Telegram
    const tgText = `
👀 <b>MESSAGE SEEN!</b>

━━━━━━━━━━━━━━━━━━━

🆔 <b>User ID:</b> <code>${userId}</code>
📌 <b>Reply ID:</b> <code>${replyId}</code>
🕒 <b>Seen At:</b> ${now}

━━━━━━━━━━━━━━━━━━━
✅ User has read your reply.
Wait for their response...
`.trim();

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: tgText, parse_mode: 'HTML' })
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' });
  }
}
