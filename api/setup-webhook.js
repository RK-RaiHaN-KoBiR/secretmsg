// ============================================================
// 🔐 API: /api/setup-webhook
// Call this ONCE after deploying to register Telegram webhook
// GET https://your-app.vercel.app/api/setup-webhook
// ============================================================

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL   = process.env.NEXT_PUBLIC_APP_URL;

export default async function handler(req, res) {
  if (!BOT_TOKEN || !APP_URL) {
    return res.status(500).json({ error: 'Missing BOT_TOKEN or APP_URL env vars' });
  }

  const webhookUrl = `${APP_URL}/api/telegram-webhook`;

  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'callback_query'] })
    });
    const data = await r.json();
    return res.status(200).json({ success: data.ok, webhookUrl, telegram: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
