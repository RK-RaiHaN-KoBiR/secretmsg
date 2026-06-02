/* ============================================================
   bot/webhook.js — Webhook Setup & Vercel Handler
   ============================================================ */

'use strict';

/**
 * Sets the Telegram webhook URL.
 * Call this once after deployment.
 */
async function setupWebhook(TG_API, webhookUrl) {
  try {
    // Delete any existing webhook first
    await fetch(`${TG_API}/deleteWebhook`, { method: 'POST' });

    const res = await fetch(`${TG_API}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      console.log('✅ Webhook set successfully:', webhookUrl);
    } else {
      console.error('❌ Webhook setup failed:', data.description);
    }
    return data;
  } catch (e) {
    console.error('setupWebhook error:', e.message);
  }
}

/**
 * Vercel serverless function handler for /api/webhook
 * This receives all Telegram updates when deployed.
 */
async function vercelWebhookHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Cithi-Pathan Bot Webhook Active ✅' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }
  try {
    // Lazy import to avoid circular dependency
    const { handleUpdate } = require('./bot');
    await handleUpdate(req.body);
  } catch (e) {
    console.error('vercelWebhookHandler error:', e);
  }
  return res.status(200).json({ ok: true });
}

module.exports = { setupWebhook, vercelWebhookHandler };
