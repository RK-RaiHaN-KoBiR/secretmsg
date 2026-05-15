/* ===== bot/setWebhook.js ─ Webhook Setup Script ===== */
// Deploy করার পর এই script একবার run করুন:
// node bot/setWebhook.js

const BOT_TOKEN = process.env.BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const SITE_URL  = process.env.SITE_URL  || 'https://cithipathao.vercel.app';
const TG_API    = `https://api.telegram.org/bot${BOT_TOKEN}`;
const WEBHOOK   = `${SITE_URL}/api/webhook`;

async function setWebhook() {
  console.log('🔗 Setting webhook to:', WEBHOOK);
  try {
    // Set Webhook
    const r1 = await fetch(`${TG_API}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: WEBHOOK, allowed_updates: ['message','callback_query'] })
    });
    const d1 = await r1.json();
    console.log('Webhook result:', d1.ok ? '✅ Success' : '❌ Failed', d1.description || '');

    // Set Bot Commands
    const r2 = await fetch(`${TG_API}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start',        description: 'Open Welcome Menu' },
          { command: 'send',         description: 'Send Reply To User' },
          { command: 'received',     description: 'View Received Messages' },
          { command: 'replyhistory', description: 'View Sent Replies History' },
          { command: 'users',        description: 'Show All Registered Users' },
          { command: 'broadcast',    description: 'Send Broadcast Notification' },
          { command: 'caption',      description: 'Manage Website Captions' },
          { command: 'ban',          description: 'Ban Any User' },
          { command: 'unban',        description: 'Unban Any User' },
          { command: 'info',         description: 'View User Information' },
          { command: 'status',       description: 'View Bot Status Report' },
          { command: 'help',         description: 'Open Help Menu' }
        ]
      })
    });
    const d2 = await r2.json();
    console.log('Commands result:', d2.ok ? '✅ Success' : '❌ Failed');

    console.log('\n✅ Setup Complete! Bot is ready to use.');
  } catch(e) {
    console.error('❌ Error:', e.message);
  }
}

setWebhook();
