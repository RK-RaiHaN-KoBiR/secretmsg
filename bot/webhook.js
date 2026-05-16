// ===== TELEGRAM WEBHOOK HELPER =====
const BOT_TOKEN = process.env.BOT_TOKEN || '8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA';
const ADMIN_ID = process.env.ADMIN_ID || '6048050987';
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendTelegramMessage(text, chatId = ADMIN_ID) {
  try {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    });
    return res.ok;
  } catch (e) {
    console.error('Telegram send error:', e.message);
    return false;
  }
}

async function sendReplyButton(text, userId, msgId) {
  try {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_ID,
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '💬 Send Reply', callback_data: `reply_${userId}_${msgId}` },
            { text: '🗑️ Delete', callback_data: `delete_msg_${msgId}` }
          ]]
        }
      })
    });
    return res.ok;
  } catch (e) {
    console.error('Telegram reply button error:', e.message);
    return false;
  }
}

async function answerCallbackQuery(callbackQueryId, text = '') {
  try {
    await fetch(`${TG_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text })
    });
  } catch (e) {}
}

module.exports = { sendTelegramMessage, sendReplyButton, answerCallbackQuery, ADMIN_ID, TG_API, BOT_TOKEN };
