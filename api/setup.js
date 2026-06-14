// =============================================
// API: /api/setup
// Run this ONCE after deploying to Vercel to
// register the Telegram webhook and bot commands.
// Visit: https://your-vercel-url.vercel.app/api/setup
// =============================================

const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
  const WEBSITE_URL = process.env.WEBSITE_URL || 'https://cithipathao.vercel.app';

  try {
    const webhookUrl  = `${WEBSITE_URL}/api/webhook`;
    const webhookRes  = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
    );
    const webhookData = await webhookRes.json();

    const commandsRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start',        description: 'Open Welcome Menu' },
          { command: 'send',         description: 'Send Reply To User (/send uid msg)' },
          { command: 'received',     description: 'View Received Messages' },
          { command: 'replyhistory', description: 'View Sent Replies History' },
          { command: 'users',        description: 'Show All Registered Users' },
          { command: 'broadcast',    description: 'Send Broadcast To All Users' },
          { command: 'caption',      description: 'Manage Website Captions' },
          { command: 'help',         description: 'Open Help Menu' },
          { command: 'ban',          description: 'Ban A User (/ban uid)' },
          { command: 'unban',        description: 'Unban A User (/unban uid)' },
          { command: 'info',         description: 'View User Info (/info uid)' },
          { command: 'status',       description: 'View Bot Status Report' },
          { command: 'ads',          description: 'Toggle Ads (/ads on | /ads off)' }
        ]
      })
    });
    const commandsData = await commandsRes.json();

    return res.status(200).json({ success: true, webhook: webhookData, commands: commandsData, webhookUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
