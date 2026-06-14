// =============================================
// API: /api/broadcast-seen
// Notifies admin when user sees a broadcast
// Reports once per user per broadcast
// =============================================

const fetch = require('node-fetch');

const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '6048050987';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { uid, broadcastTime, broadcastDate, seenTime, seenDate, deviceInfo } = req.body;
    const di = deviceInfo || {};

    const msg =
`👁️ <b>User : [${uid}]</b>
Seen Your Broadcast Message!

🕒 <b>Seen Time :</b>
${seenTime} — ${seenDate} BD Time

📤 <b>Broadcast Send Time :</b>
${broadcastTime} — ${broadcastDate}

🆔 User ID : ${uid}
📱 Device : ${di.device || 'Unknown'}
📶 Network : ${di.network || 'Unknown'}
🌍 IP : ${di.ip || 'Unknown'}
🏙️ Country : ${di.country || 'Unknown'}`;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text:    msg,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '📩 Reply User', callback_data: `reply_${uid}` }]]
        }
      })
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('broadcast-seen error:', err.message);
    return res.status(500).json({ error: 'Failed' });
  }
};
