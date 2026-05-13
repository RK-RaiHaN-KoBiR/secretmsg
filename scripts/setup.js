// scripts/setup.js
// Run this once after deploying to Vercel to register the Telegram webhook

const BOT_TOKEN = '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const SITE_URL = 'https://cithipathao.vercel.app';

async function setupWebhook() {
  const webhookUrl = `${SITE_URL}/api/bot`;
  const apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;

  console.log(`🔧 Setting up Telegram webhook...`);
  console.log(`📡 Webhook URL: ${webhookUrl}`);

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query']
      })
    });
    const data = await res.json();
    if (data.ok) {
      console.log('✅ Webhook registered successfully!');
    } else {
      console.error('❌ Failed:', data.description);
    }
  } catch(e) {
    console.error('❌ Error:', e.message);
  }
}

setupWebhook();
