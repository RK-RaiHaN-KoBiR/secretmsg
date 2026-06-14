// =============================================
// API: /api/send-message
// Notifies admin bot when user sends a message
// Called from frontend after saving to Firestore
// =============================================

const fetch = require('node-fetch');

const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '6048050987';

async function sendTG(text, replyMarkup) {
  const body = {
    chat_id:    ADMIN_CHAT_ID,
    text,
    parse_mode: 'HTML'
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body)
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const d = req.body;

    const msg =
`╔══════════════════════════════╗
🔰 <b>New Message Received</b> 🔰
╚══════════════════════════════╝

🕒 <b>Send Time &amp; Date :</b> ${d.sendTime || '--'} | ${d.sendDate || '--'}

🆔 <b>User ID :</b> ${d.userID}

👤 <b>User Name :</b> ${d.senderName || 'Unknown User'}

📱 <b>WhatsApp :</b> ${d.whatsapp || 'Not Provided'}

🔗 <b>FB Link :</b> ${d.fbLink || 'Not Provided'}

📱 <b>Device :</b> ${d.device || 'Unknown'}

📶 <b>Network :</b> ${d.network || 'Unknown'}

🧠 <b>User Agent :</b>
${(d.userAgent || 'Unknown').substring(0, 120)}

━━━━━━━━━━━━━━━━━━━━━━━
💌 <b>Message :</b>

${d.message}
━━━━━━━━━━━━━━━━━━━━━━━

🔘 Reply করার জন্য নিচের "Send Reply" Button ব্যবহার করুন।`;

    await sendTG(msg, {
      inline_keyboard: [[
        { text: '📩 Send Reply', callback_data: `reply_${d.userID}` }
      ]]
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('send-message API error:', err.message);
    return res.status(500).json({ error: 'Failed' });
  }
};
