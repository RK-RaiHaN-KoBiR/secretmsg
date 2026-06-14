// =============================================
// API: /api/new-caption
// Notifies admin when a user adds a caption
// =============================================

const fetch = require('node-fetch');

const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '6048050987';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { uid, capID, text, time, date } = req.body;

    const msg =
`🚨 <b>Alert : New Caption Added!</b>

📌 <b>Caption ID :</b>
${capID}

🆔 <b>Caption Added By User :</b>
${uid}

💬 <b>Caption :</b>
${text}

🕒 <b>Added Time &amp; Date :</b>
${time} — ${date}`;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: msg, parse_mode: 'HTML' })
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('new-caption API error:', err.message);
    return res.status(500).json({ error: 'Failed' });
  }
};
