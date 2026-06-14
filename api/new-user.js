// =============================================
// API: /api/new-user
// Sends new user info to Telegram admin bot
// Called once per new user on their first visit
// =============================================

const fetch = require('node-fetch');

const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '6048050987';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const d = req.body;

    const msg =
`╔══════════════════════╗
🆕 <b>NEW USER JOINED!</b>
╚══════════════════════╝

📅 <b>Join Time &amp; Date :</b>
${d.shortDate || '--'} — ${d.timeStr || '--'} BD Time

🆔 <b>User ID :</b>
${d.uid}

📱 <b>Device Info :</b>
${d.device || 'Unknown'}

🔋 <b>Battery :</b>
${d.battery || 'Unknown'}

📶 <b>Network Info :</b>
${d.network || 'Unknown'}

🌍 <b>IP Address :</b>
${d.ip || 'Unknown'}

🏙️ <b>Country :</b>
${d.country || 'Unknown'}

🏠 <b>Division :</b>
${d.division || 'Unknown'}

📍 <b>Zilla :</b>
${d.zilla || 'Unknown'}

🏡 <b>City / Village :</b>
${d.city || 'Unknown'}

📡 <b>ISP Provider :</b>
${d.isp || 'Unknown'}

💾 <b>RAM :</b>
${d.ram || 'Unknown'}

🧠 <b>User Agent :</b>
${(d.userAgent || 'Unknown').substring(0, 150)}`;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: msg, parse_mode: 'HTML' })
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('new-user API error:', err.message);
    return res.status(500).json({ error: 'Failed' });
  }
};
