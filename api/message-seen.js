// =============================================
// API: /api/message-seen
// Notifies admin when user sees their reply
// Reports only ONCE per message (not repeated)
// =============================================

const fetch = require('node-fetch');

const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '6048050987';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { uid, replyTime, replyDate, seenTime, seenDate } = req.body;

    const msg =
`╔══════════════════════╗
👁️ <b>MESSAGE SEEN REPORT</b>
╚══════════════════════╝

🆔 <b>UserID :</b>
${uid}

📤 <b>Reply Time :</b>
${replyTime} 🔸${replyDate}...!

👁️ <b>Seen Time :</b>
${seenTime} 🔸${seenDate}...!

🔰 This User Seen Your Message ✅`;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: msg, parse_mode: 'HTML' })
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('message-seen API error:', err.message);
    return res.status(500).json({ error: 'Failed' });
  }
};
