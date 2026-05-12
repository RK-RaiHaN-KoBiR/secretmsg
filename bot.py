"""
💌 Secret Message Box — Telegram Bot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pip install pyTelegramBotAPI
python bot.py
"""

import telebot, datetime, os
from telebot.types import (
    InlineKeyboardMarkup, InlineKeyboardButton,
    ReplyKeyboardMarkup, KeyboardButton
)

# ══════════════════════════════════
#  ⚙️  CONFIG
# ══════════════════════════════════
BOT_TOKEN = os.environ.get("BOT_TOKEN", "8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA")
OWNER_ID  = int(os.environ.get("OWNER_ID", "6048050987"))
SITE_URL  = os.environ.get("SITE_URL", "https://cithipathao.vercel.app")

bot = telebot.TeleBot(BOT_TOKEN)

# State storage
pending_reply = {}   # owner_id → target_uid
user_registry = {}   # uid → last_seen info

# ══════════════════════════════════
#  🎹  OWNER KEYBOARD
# ══════════════════════════════════
def owner_kb():
    kb = ReplyKeyboardMarkup(resize_keyboard=True, row_width=2)
    kb.add(
        KeyboardButton("📋 /allcmd"),
        KeyboardButton("❓ /help"),
        KeyboardButton("📤 /sendhistory"),
        KeyboardButton("📥 /receivehistory"),
        KeyboardButton("👥 /showusers"),
        KeyboardButton("📢 /sendall"),
    )
    return kb

def now_str():
    return datetime.datetime.now().strftime("%d %b %Y • %I:%M %p")

def is_owner(msg):
    return msg.from_user.id == OWNER_ID

# ══════════════════════════════════
#  /start
# ══════════════════════════════════
@bot.message_handler(commands=['start'])
def cmd_start(msg):
    t = now_str()
    if is_owner(msg):
        text = (
            "╔══════════════════════════════════╗\n"
            "║   💌  Secret Message Box Bot     ║\n"
            "╚══════════════════════════════════╝\n\n"
            f"👑 *স্বাগতম, Admin!*\n"
            f"⏰ সময়: `{t}`\n\n"
            "📋 দ্রুত Commands:\n"
            "• /allcmd — সব Command\n"
            "• /send `id` `msg` — User কে Reply\n"
            "• /showusers — সব User দেখো\n"
            "• /sendall `msg` — সবাইকে Message\n\n"
            f"🌐 Site: {SITE_URL}\n\n"
            "💡 নিচের Keyboard Button ব্যবহার করো!"
        )
        bot.send_message(msg.chat.id, text, parse_mode='Markdown', reply_markup=owner_kb())
    else:
        text = (
            "💌 *Secret Message Box*\n\n"
            "এই Bot টি Private। তুমি আমাকে গোপন চিঠি পাঠাতে পারো!\n\n"
            f"🌐 [চিঠি পাঠাতে এখানে যাও]({SITE_URL})\n\n"
            "✨ পরিচয় গোপন রেখে বা প্রকাশ করে!"
        )
        bot.send_message(msg.chat.id, text, parse_mode='Markdown',
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("💌 চিঠি পাঠাও", url=SITE_URL)
            ]]))

# ══════════════════════════════════
#  /help
# ══════════════════════════════════
@bot.message_handler(commands=['help'])
def cmd_help(msg):
    if not is_owner(msg): return
    text = (
        "╔══════════════════════════╗\n"
        "║     ❓ Help Guide        ║\n"
        "╚══════════════════════════╝\n\n"
        "📌 *Admin Commands:*\n\n"
        "▸ /start — Bot চালু\n"
        "▸ /help — এই Help\n"
        "▸ /allcmd — সব Command\n"
        "▸ /send `uid` `message` — User Reply\n"
        "▸ /showusers — সব User List\n"
        "▸ /sendall `message` — সবাইকে Message\n"
        "▸ /sendhistory — পাঠানো History\n"
        "▸ /receivehistory — পাওয়া History\n"
        "▸ /cancel — চলমান Reply বাতিল\n\n"
        "💡 *Inline Reply Button:*\n"
        "Message এর নিচে Reply Button চাপলেও Reply করা যায়!\n\n"
        "📡 *Reply Format:*\n"
        "`/send 123 Hello, এটা তোমার Reply!`"
    )
    bot.send_message(msg.chat.id, text, parse_mode='Markdown', reply_markup=owner_kb())

# ══════════════════════════════════
#  /allcmd
# ══════════════════════════════════
@bot.message_handler(commands=['allcmd'])
def cmd_allcmd(msg):
    if not is_owner(msg): return
    text = (
        "╔══════════════════════════════════╗\n"
        "║      📋 সব Available Commands    ║\n"
        "╚══════════════════════════════════╝\n\n"
        "🟢 *Basic:*\n"
        "/start — Bot শুরু করো\n"
        "/help — Help দেখো\n"
        "/allcmd — এই List\n\n"
        "💌 *Messaging:*\n"
        "/send `[uid]` `[message]` — User কে Reply পাঠাও\n"
        "/sendall `[message]` — সব User কে Message\n\n"
        "👥 *Users:*\n"
        "/showusers — সব User ID দেখো\n\n"
        "📚 *History:*\n"
        "/sendhistory — পাঠানো Message History\n"
        "/receivehistory — পাওয়া Message History\n\n"
        "❌ *Control:*\n"
        "/cancel — Pending Reply বাতিল\n\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🌐 Site: {SITE_URL}"
    )
    bot.send_message(msg.chat.id, text, parse_mode='Markdown', reply_markup=owner_kb())

# ══════════════════════════════════
#  /send uid message
# ══════════════════════════════════
send_history = []

@bot.message_handler(commands=['send'])
def cmd_send(msg):
    if not is_owner(msg): return
    parts = msg.text.split(None, 2)
    if len(parts) < 3:
        bot.send_message(msg.chat.id,
            "⚠️ *Format:*\n`/send [userid] [message]`\n\n"
            "📌 *Example:*\n`/send 123 হ্যালো, তোমার উত্তর হলো...`",
            parse_mode='Markdown')
        return

    uid     = parts[1].lstrip('#')
    reply   = parts[2].strip()
    t       = now_str()

    # Save to history
    send_history.append({'uid': uid, 'msg': reply, 'time': t})
    if len(send_history) > 100: send_history.pop(0)

    # Send formatted reply to self (site polls this)
    formatted = f"[TO:#{uid}] {reply}"
    bot.send_message(OWNER_ID, formatted)

    # Update user registry seen status
    if uid in user_registry:
        user_registry[uid]['replied'] = t

    bot.send_message(msg.chat.id,
        f"✅ *Reply পাঠানো হয়েছে!*\n\n"
        f"🆔 To: `#{uid}`\n"
        f"⏰ সময়: `{t}`\n"
        f"💬 Message:\n_{reply}_\n\n"
        f"⏳ User seen করলে Status আসবে...",
        parse_mode='Markdown', reply_markup=owner_kb())

# ══════════════════════════════════
#  /showusers
# ══════════════════════════════════
@bot.message_handler(commands=['showusers'])
def cmd_showusers(msg):
    if not is_owner(msg): return
    if not user_registry:
        bot.send_message(msg.chat.id, "👥 এখনো কোনো User নেই।", reply_markup=owner_kb())
        return
    lines = ["╔══════════════════════════════╗\n║  👥 Registered Users         ║\n╚══════════════════════════════╝\n"]
    for uid, info in list(user_registry.items())[-30:]:
        lines.append(
            f"🆔 `#{uid}`\n"
            f"  📍 {info.get('city','—')}, {info.get('country','—')}\n"
            f"  📱 {info.get('model','—')}\n"
            f"  ⏰ {info.get('time','—')}\n"
        )
    bot.send_message(msg.chat.id, '\n'.join(lines), parse_mode='Markdown', reply_markup=owner_kb())

# ══════════════════════════════════
#  /sendall message
# ══════════════════════════════════
@bot.message_handler(commands=['sendall'])
def cmd_sendall(msg):
    if not is_owner(msg): return
    parts = msg.text.split(None, 1)
    if len(parts) < 2:
        bot.send_message(msg.chat.id, "⚠️ Format: `/sendall [message]`", parse_mode='Markdown')
        return
    broadcast = parts[1].strip()
    t = now_str()
    count = 0
    for uid in list(user_registry.keys()):
        formatted = f"[TO:#{uid}] 📢 Admin Message:\n{broadcast}"
        bot.send_message(OWNER_ID, formatted)
        count += 1
    bot.send_message(msg.chat.id,
        f"✅ *Broadcast পাঠানো হয়েছে!*\n"
        f"👥 {count} User কে\n⏰ {t}",
        parse_mode='Markdown', reply_markup=owner_kb())

# ══════════════════════════════════
#  /sendhistory
# ══════════════════════════════════
@bot.message_handler(commands=['sendhistory'])
def cmd_sendhistory(msg):
    if not is_owner(msg): return
    if not send_history:
        bot.send_message(msg.chat.id, "📤 এখনো কোনো Reply পাঠাওনি।", reply_markup=owner_kb())
        return
    lines = ["╔══════════════════════════╗\n║  📤 Send History         ║\n╚══════════════════════════╝\n"]
    for h in send_history[-20:][::-1]:
        lines.append(f"🆔 `#{h['uid']}` — ⏰ {h['time']}\n💬 {h['msg'][:80]}\n")
    bot.send_message(msg.chat.id, '\n'.join(lines), parse_mode='Markdown', reply_markup=owner_kb())

# ══════════════════════════════════
#  /receivehistory
# ══════════════════════════════════
receive_history = []

@bot.message_handler(commands=['receivehistory'])
def cmd_recvhistory(msg):
    if not is_owner(msg): return
    if not receive_history:
        bot.send_message(msg.chat.id, "📥 এখনো কোনো Message পাওনি।", reply_markup=owner_kb())
        return
    lines = ["╔══════════════════════════════╗\n║  📥 Receive History          ║\n╚══════════════════════════════╝\n"]
    for h in receive_history[-20:][::-1]:
        lines.append(f"🆔 `#{h['uid']}` — ⏰ {h['time']}\n💬 {h['msg'][:80]}\n")
    bot.send_message(msg.chat.id, '\n'.join(lines), parse_mode='Markdown', reply_markup=owner_kb())

# ══════════════════════════════════
#  /cancel
# ══════════════════════════════════
@bot.message_handler(commands=['cancel'])
def cmd_cancel(msg):
    if not is_owner(msg): return
    pending_reply.pop(OWNER_ID, None)
    bot.send_message(msg.chat.id, "❌ Pending Reply বাতিল।", reply_markup=owner_kb())

# ══════════════════════════════════
#  🔘  INLINE BUTTON HANDLER
# ══════════════════════════════════
@bot.callback_query_handler(func=lambda c: True)
def on_callback(call):
    if call.from_user.id != OWNER_ID:
        bot.answer_callback_query(call.id, "❌ Permission নেই!")
        return

    data = call.data

    if data.startswith("reply_"):
        uid = data[6:]
        pending_reply[OWNER_ID] = uid
        bot.answer_callback_query(call.id, f"✍️ #{uid} কে Reply লেখো!")
        bot.send_message(OWNER_ID,
            f"✍️ *User #`{uid}` কে Reply করো:*\n\n"
            "এখন তোমার message লেখো ও পাঠাও।\n"
            "❌ বাতিল করতে /cancel",
            parse_mode='Markdown')

    elif data.startswith("info_"):
        uid = data[5:]
        info = user_registry.get(uid, {})
        bot.answer_callback_query(call.id, f"User #{uid}")
        bot.send_message(OWNER_ID,
            f"📊 *User Info: #`{uid}`*\n\n"
            f"📱 Model  : {info.get('model','—')}\n"
            f"💻 OS     : {info.get('os','—')}\n"
            f"🌍 Country: {info.get('country','—')}\n"
            f"🏙 City   : {info.get('city','—')}\n"
            f"🌐 IP     : {info.get('ip','—')}\n"
            f"⏰ First Seen: {info.get('time','—')}\n\n"
            f"💬 Reply: `/send {uid} [message]`",
            parse_mode='Markdown')

    elif data.startswith("seen_"):
        uid = data[5:]
        bot.answer_callback_query(call.id, "✅ Seen confirmed")
        bot.send_message(OWNER_ID,
            f"👁️ *User #`{uid}` তোমার Reply দেখেছে!*\n⏰ {now_str()}",
            parse_mode='Markdown')

# ══════════════════════════════════
#  ✍️  PENDING REPLY TEXT HANDLER
# ══════════════════════════════════
@bot.message_handler(
    func=lambda m: m.from_user.id == OWNER_ID
                   and OWNER_ID in pending_reply
                   and not m.text.startswith('/')
)
def handle_pending(msg):
    uid = pending_reply.pop(OWNER_ID)
    reply = msg.text.strip()
    t = now_str()

    send_history.append({'uid': uid, 'msg': reply, 'time': t})
    formatted = f"[TO:#{uid}] {reply}"
    bot.send_message(OWNER_ID, formatted)

    bot.send_message(OWNER_ID,
        f"✅ *Reply পাঠানো!*\n🆔 To: `#{uid}`\n⏰ `{t}`\n💬 _{reply}_",
        parse_mode='Markdown', reply_markup=owner_kb())

# ══════════════════════════════════
#  📩  INCOMING MESSAGE HANDLER
#  (records user info from alert)
# ══════════════════════════════════
@bot.message_handler(func=lambda m: m.from_user.id == OWNER_ID and '[TO:#' in (m.text or ''))
def swallow_to_msg(msg):
    pass  # These are our own formatted relay messages; ignore

# Auto-register user from alert text pattern
# (the /api/alert endpoint sends a message; parse it to populate registry)
@bot.message_handler(func=lambda m: m.from_user.id == OWNER_ID and 'User ID' in (m.text or '') and 'নতুন User' in (m.text or ''))
def parse_alert(msg):
    import re
    text = msg.text
    def extract(pattern):
        m = re.search(pattern, text)
        return m.group(1).strip() if m else '—'
    uid     = extract(r'User ID\s*:\s*#?(\S+)')
    model   = extract(r'Model\s*:\s*(.+)')
    os_     = extract(r'OS\s*:\s*(.+)')
    ip      = extract(r'IP\s*:\s*(\S+)')
    country = extract(r'Country\s*:\s*(.+)')
    city    = extract(r'City\s*:\s*(.+)')
    if uid != '—':
        user_registry[uid] = {'model': model, 'os': os_, 'ip': ip, 'country': country, 'city': city, 'time': now_str()}

# ══════════════════════════════════
#  🚀  RUN
# ══════════════════════════════════
if __name__ == '__main__':
    print("╔══════════════════════════════════╗")
    print("║  💌  Secret Message Box Bot      ║")
    print("╚══════════════════════════════════╝")
    print(f"👑 Owner ID : {OWNER_ID}")
    print(f"🌐 Site     : {SITE_URL}")
    print("✅ Bot চালু — Ctrl+C দিয়ে বন্ধ করো\n")
    bot.infinity_polling(timeout=60, long_polling_timeout=30)
