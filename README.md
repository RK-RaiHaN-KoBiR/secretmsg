# 💌 গোপন চিঠির বাক্স | Secret Message Box

> সরাসরি বলতে না পারা আপনার মনের কথা গুলো এখানে বলতে পারেন পরিচয় গোপন রেখে 🔐

## 📁 Project Structure

```
secretmsg/
├── public/
│   ├── index.html      ← Main website
│   ├── style.css       ← All styles
│   ├── app.js          ← Frontend logic
│   └── sw.js           ← Service Worker (notifications)
├── api/
│   ├── webhook.js      ← Message handler (website → bot)
│   └── bot.js          ← Telegram bot + reply checker
├── scripts/
│   └── setup.js        ← Webhook setup script
├── vercel.json         ← Vercel config
└── package.json
```

## 🚀 Deploy Steps (Android থেকেও করা যাবে)

### Step 1: GitHub এ Upload করুন
1. GitHub এ যান: https://github.com/RK-RaiHaN-KoBiR/secretmsg/
2. সব ফাইল গুলো upload করুন (folder structure বজায় রাখুন)

### Step 2: Vercel এ Deploy করুন
1. https://vercel.com এ যান
2. GitHub দিয়ে login করুন
3. "New Project" → আপনার repo select করুন
4. Deploy করুন

### Step 3: Environment Variables সেট করুন
Vercel Dashboard → Project Settings → Environment Variables এ এগুলো add করুন:

```
BOT_TOKEN = আপনার আসল bot token
ADMIN_CHAT_ID = আপনার Telegram user ID (6048050987)
JSONBIN_BIN_ID = আপনার JSONBin bin ID
JSONBIN_MASTER_KEY = আপনার JSONBin master key
JSONBIN_ACCESS_KEY = আপনার JSONBin access key
SITE_URL = https://cithipathao.vercel.app
```

### Step 4: Telegram Webhook Register করুন
Browser এ এই URL এ যান (একবারই করতে হবে):
```
https://api.telegram.org/bot{YOUR_BOT_TOKEN}/setWebhook?url=https://cithipathao.vercel.app/api/bot
```

---

## 🤖 Bot Commands

| Command | কাজ |
|---------|-----|
| `/start` | Bot শুরু |
| `/help` | সব command দেখুন |
| `/users` | সব user list |
| `/send {userid} {msg}` | নির্দিষ্ট user কে reply |
| `/sendall {msg}` | সবাইকে broadcast |

### Keyboard Buttons:
- ❓ Help
- 📤 Send History  
- 📥 Received History
- 👥 Show All Users
- 📢 Send To All

---

## 🔗 Links
- 📢 Telegram: https://t.me/rksystemall
- 💬 Admin: https://m.me/ToR.PiccHi.JaMai.TaH.X
- 🌐 Site: https://cithipathao.vercel.app

---

## ⚠️ Important Notes
- Bot শুধু Admin (ADMIN_CHAT_ID) ব্যবহার করতে পারবে
- সব user তথ্য আলাদা আলাদা cookies/localStorage এ save হয়
- কেউ অন্যের তথ্য দেখতে পারবে না
- Admin শুধু bot থেকে সব তথ্য দেখতে পারবে
