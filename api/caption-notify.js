// api/caption-notify.js
const BOT_TOKEN = process.env.BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_ID = process.env.ADMIN_ID || '6048050987';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, text, action, time } = req.body;

  try {
    const msg = `
✍️ <b>New Caption ${action === 'new' ? 'Added' : 'Edited'} by User!</b>

🆔 <b>User ID:</b> <code>${userId}</code>
📅 <b>Time:</b> ${time}
📝 <b>Caption:</b>

${text}
    `.trim();

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_ID,
        text: msg,
        parse_mode: 'HTML'
      })
    });

    return res.status(200).json({ ok: true });
  } catch(e) {
    return res.status(500).json({ error: 'Internal error' });
  }
}
