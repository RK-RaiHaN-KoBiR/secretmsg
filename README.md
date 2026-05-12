# 💌 Secret Message Box — Setup Guide

## 📁 Project Structure

```
secretmsg/
├── api/
│   ├── send.js          # Message send endpoint (secure)
│   ├── alert.js         # New user alert endpoint
│   └── poll.js          # Poll for bot replies
├── public/
│   ├── index.html       # Main website
│   ├── sw.js            # Service Worker
│   └── manifest.json    # PWA manifest
├── bot.py               # Telegram Bot script
├── vercel.json          # Vercel config + security headers
├── .env.example         # Environment variables template
└── README.md
```

---

## 🚀 Vercel Deployment

### Step 1: GitHub এ Upload করো
```
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/secretmsg.git
git push -u origin main
```

### Step 2: Vercel Connect করো
1. [vercel.com](https://vercel.com) এ যাও
2. "New Project" → GitHub repo select করো
3. **Environment Variables** যোগ করো (নিচে দেখো)
4. Deploy!

---

## ⚙️ Environment Variables (Vercel Dashboard)

```
BOT_TOKEN       = তোমার_bot_token
OWNER_ID        = তোমার_telegram_user_id
SITE_URL        = https://তোমার-domain.vercel.app
```

> ⚠️ কোনো Secret কখনো code এ রাখবে না!

---

## 🤖 Bot চালানো

```bash
pip install pyTelegramBotAPI
python bot.py
```

অথবা Environment Variable দিয়ে:
```bash
BOT_TOKEN="xxx" OWNER_ID="123" python bot.py
```

---

## 🤖 Bot Commands

| Command | কাজ |
|---------|-----|
| `/start` | Bot চালু |
| `/help` | Help দেখো |
| `/allcmd` | সব Command |
| `/send 123 message` | User কে Reply |
| `/sendall message` | সবাইকে Message |
| `/showusers` | সব User দেখো |
| `/sendhistory` | পাঠানো History |
| `/receivehistory` | পাওয়া History |
| `/cancel` | Reply বাতিল |

---

## 🔐 Security Features

- ✅ Bot Token শুধু Server-side (Vercel env)
- ✅ Rate Limiting (5 msg/min per IP)
- ✅ Input Sanitization (XSS protection)
- ✅ CSP Security Headers
- ✅ CORS Protection
- ✅ No sensitive data in frontend code

---

## 📞 Contact

- Facebook: https://m.me/ToR.PiccHi.JaMai.TaH.X
- Telegram: https://t.me/rksystemall
