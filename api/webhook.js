/* ===== api/webhook.js — Telegram Webhook Endpoint ===== */
const botHandler = require('../bot/bot');

module.exports = async function handler(req, res) {
  return botHandler(req, res);
};
