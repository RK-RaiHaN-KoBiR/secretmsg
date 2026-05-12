# 💌 Secret Message Box — "Write Your Mind"
> 🔒 Anonymous Love Letter Platform | Vercel + Telegram Bot + Push Notifications

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/RK-RaiHaN-KoBiR/secretmsg)

---

## ✨ Features

- 💌 **Anonymous Messaging** — পরিচয় গোপন রেখে Message পাঠান
- 🤖 **Telegram Bot** — সব Message সরাসরি Telegram এ যাবে
- 🔔 **Push Notifications** — Admin Reply করলে Instant Notification
- 📱 **Fully Responsive** — Mobile + Desktop সব Device এ কাজ করে
- 🌈 **RGB Animated UI** — Premium Love Letter Theme
- 🔒 **Enterprise Secure** — কোনো Secret Key Frontend এ নেই
- 📚 **Full History** — Send ও Receive সব History সংরক্ষিত
- 🆔 **Auto User ID** — প্রতিটি User এর Unique 3-Digit ID

---

## 🛠️ Setup Guide

### 1️⃣ Clone & Upload to GitHub

```bash
git clone https://github.com/RK-RaiHaN-KoBiR/secretmsg
# অথবা ZIP Extract করে GitHub এ Upload করুন
```

### 2️⃣ JSONBIN Setup

1. https://jsonbin.io তে Account করুন
2. **3টি নতুন Bin** তৈরি করুন:
   - `messages` — User Messages Store
   - `replies` — Admin Replies Store  
   - `users` — User List Store
3. প্রতিটি Bin এর ID কপি করুন

প্রতিটি Bin এ initial data দিন:
- **messages bin:** `{"messages": []}`
- **replies bin:** `{"replies": []}`
- **users bin:** `{"users": []}`

### 3️⃣ Telegram Bot Setup

1. [@BotFather](https://t.me/BotFather) তে যান
2. `/newbot` কমান্ড দিন
3. Bot নাম ও username দিন
4. **Bot Token** কপি করুন
5. Bot এ `/start` পাঠান এবং আপনার **Chat ID** নিন  
   (Chat ID পেতে: [@userinfobot](https://t.me/userinfobot))

### 4️⃣ Vercel Deploy

1. [Vercel](https://vercel.com) এ যান → **New Project** → GitHub Repo Import
2. **Environment Variables** যোগ করুন:

| Variable | Value |
|----------|-------|
| `TELEGRAM_BOT_TOKEN` | আপনার Bot Token |
| `TELEGRAM_ADMIN_CHAT_ID` | আপনার Chat ID |
| `JSONBIN_MASTER_KEY` | JSONBIN Master Key |
| `JSONBIN_ACCESS_KEY` | JSONBIN Access Key |
| `JSONBIN_MESSAGES_BIN_ID` | Messages Bin ID |
| `JSONBIN_REPLIES_BIN_ID` | Replies Bin ID |
| `JSONBIN_USERS_BIN_ID` | Users Bin ID |
| `NEXT_PUBLIC_APP_URL` | https://your-app.vercel.app |
| `RATE_LIMIT_MAX` | `10` |

3. **Deploy** করুন

### 5️⃣ Webhook Setup (Deploy এর পর)

Browser এ এই URL খুলুন:
```
https://your-app.vercel.app/api/setup-webhook
```
Success দেখালে Bot ready! ✅

---

## 🤖 Bot Commands

| Command | কাজ |
|---------|-----|
| `/start` | Bot শুরু করুন |
| `/help` | সাহায্য দেখুন |
| `/allcmd` | সব Commands |
| `/send 123 Hello!` | User 123 কে Reply |
| `/showusers` | সব User List |
| `/sendall Message` | সবাইকে Broadcast |
| `/sendhistory` | Sent Messages |
| `/receivehistory` | Received Messages |

---

## 📂 Project Structure

```
secretmsg/
├── api/
│   ├── send-message.js      # Message receive & Telegram alert
│   ├── track-user.js        # New user tracking
│   ├── get-reply.js         # Poll for admin replies
│   ├── mark-seen.js         # Mark reply as seen
│   ├── telegram-webhook.js  # Telegram bot webhook
│   └── setup-webhook.js     # One-time webhook setup
├── css/
│   └── style.css            # Premium RGB animated styles
├── js/
│   └── app.js               # Main frontend logic
├── icons/                   # PWA icons
├── index.html               # Main UI
├── sw.js                    # Service Worker (push notifications)
├── manifest.json            # PWA manifest
├── vercel.json              # Vercel config + security headers
├── package.json
├── .env.example             # Env template (never commit .env!)
└── README.md
```

---

## 🔒 Security Features

- ✅ All API keys in Environment Variables (never in frontend)
- ✅ Rate limiting (10 requests/minute per IP)
- ✅ Input validation & sanitization (XSS prevention)
- ✅ CSP Security Headers
- ✅ X-Frame-Options: DENY
- ✅ Admin-only Telegram bot access
- ✅ No secrets in GitHub code

---

## 🌐 Live Demo

- Website: https://cithipathao.vercel.app
- GitHub: https://github.com/RK-RaiHaN-KoBiR/secretmsg

---

## 📞 Contact

- 🔵 [Facebook](https://m.me/ToR.PiccHi.JaMai.TaH.X)
- 📨 [Telegram](https://t.me/rksystemall)

---

💌 Made with ❤️ | Secret Message Box
