// ===== TELEGRAM WEBHOOK ENDPOINT =====
const { handleUpdate } = require('../bot/bot');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'GET') {
    return res.json({ status: 'Chithi Pathao Bot is running! 🤖💌' });
  }
  if (req.method === 'POST') {
    try {
      await handleUpdate(req.body);
    } catch (e) {
      console.error('Bot handler error:', e);
    }
    return res.status(200).json({ ok: true });
  }
  res.status(405).end();
};
