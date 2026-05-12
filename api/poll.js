// api/poll.js — Poll Telegram for replies to a specific user
function sanitize(str) {
  return String(str || '').replace(/[<>]/g, '').trim().slice(0, 100);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { uid, offset } = req.query;
  if (!uid) return res.status(400).json({ ok: false, error: 'uid required' });

  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) return res.status(500).json({ ok: false });

  const safeOffset = parseInt(offset || '0', 10) || 0;
  const safeUid = sanitize(uid);

  try {
    const r = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${safeOffset + 1}&limit=50&timeout=5`,
      { method: 'GET' }
    );
    const data = await r.json();
    if (!data.ok) return res.status(200).json({ ok: true, replies: [], lastUpdate: safeOffset });

    const replies = [];
    let lastUpdate = safeOffset;

    for (const upd of data.result) {
      lastUpdate = upd.update_id;
      const msg = upd.message || upd.edited_message;
      if (!msg || !msg.text) continue;
      const text = msg.text;
      // Match [TO:#uid] pattern sent by bot handler
      const m = text.match(/\[TO:#?(\d+)\]\s*([\s\S]+)/i);
      if (m && m[1] === safeUid) {
        replies.push({
          text: m[2].trim().slice(0, 2000),
          ts: msg.date,
          time: new Date(msg.date * 1000).toLocaleString('en-US', {
            dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka'
          })
        });
      }
    }

    return res.status(200).json({ ok: true, replies, lastUpdate });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
