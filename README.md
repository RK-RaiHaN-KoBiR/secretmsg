# 💌 চিঠি পাঠান — Cithi Pathan

> Anonymous Secret Message Platform · Telegram Bot Admin · Firebase · PWA · Vercel

---

## 🚀 Quick Deploy (Android-Friendly)

### Step 1 — GitHub এ Upload করুন

1. [github.com](https://github.com) এ Login করুন  
2. New Repository তৈরি করুন → নাম: `secretmsg`  
3. সব File Upload করুন (এই ZIP এর ভেতরের সব ফাইল)

### Step 2 — Vercel এ Deploy করুন

1. [vercel.com](https://vercel.com) এ Login করুন  
2. **New Project** → GitHub repo সিলেক্ট করুন  
3. **Environment Variables** যোগ করুন (নিচে দেখুন)  
4. **Deploy** চাপুন — সাইট Live হয়ে যাবে ✅

---

## ⚙️ Environment Variables (Vercel Dashboard এ Set করুন)

| Variable | Value |
|---|---|
| `BOT_TOKEN` | আপনার Telegram Bot Token |
| `ADMIN_ID` | আপনার Telegram User ID |
| `FIREBASE_DB_URL` | Firebase Realtime DB URL |
| `VAPID_PUBLIC_KEY` | VAPID Public Key |
| `VAPID_PRIVATE_KEY` | VAPID Private Key |
| `VAPID_SUBJECT` | `mailto:your@email.com` |
| `WEBHOOK_URL` | `https://your-site.vercel.app/api/webhook` |

---

## 🤖 Telegram Bot Webhook Set করুন

Deploy করার পর Browser এ এই URL Open করুন:

```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://cithipathao.vercel.app/api/webhook
```

`<BOT_TOKEN>` এর জায়গায় আপনার Bot Token বসান।

---

## 📂 Project Structure

```
cithipathan/
├── public/              ← Frontend (Part 1)
│   ├── index.html       ← মূল পেজ
│   ├── style.css        ← সব ডিজাইন
│   ├── app.js           ← Frontend Logic
│   ├── sw.js            ← Service Worker (PWA + Push)
│   └── manifest.json    ← PWA Manifest
│
├── api/                 ← Backend Serverless (Part 1)
│   ├── send.js          ← Message send → Telegram alert
│   ├── user.js          ← User registration + IP lookup
│   ├── caption.js       ← Caption notification
│   ├── broadcast.js     ← Broadcast seen report
│   └── database.js      ← Firebase REST helpers
│
├── bot/                 ← Telegram Bot (Part 2)
│   ├── bot.js           ← Main bot logic
│   ├── commands.js      ← All commands
│   ├── webhook.js       ← Webhook handler
│   └── admin.js         ← Admin actions
│
├── vercel.json          ← Vercel deployment config
├── package.json         ← Dependencies
├── .env.example         ← Environment template
└── README.md            ← এই ফাইল
```

---

## 🔥 Firebase Setup

1. [console.firebase.google.com](https://console.firebase.google.com) এ যান  
2. Project: **cithi-pathan** open করুন  
3. **Realtime Database** → Rules → নিচের rules set করুন:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth == null || auth.uid == $uid",
        ".write": "auth == null"
      }
    },
    "captions": {
      ".read": true,
      ".write": true
    },
    "broadcast": {
      ".read": true,
      ".write": true
    },
    "pushSubscriptions": {
      ".read": true,
      ".write": true
    },
    "settings": {
      ".read": true,
      ".write": true
    }
  }
}
```

---

## 🤖 Bot Commands

| Command | কাজ |
|---|---|
| `/start` | Welcome menu |
| `/send 1001 Hello` | User কে message পাঠান |
| `/received` | Received history |
| `/replyhistory` | Sent reply history |
| `/users` | সব registered user |
| `/broadcast মেসেজ` | সবাইকে broadcast |
| `/caption` | Caption manage |
| `/ban 1001` | User ban |
| `/unban 1001` | User unban |
| `/info 1001` | User info দেখুন |
| `/ads on` | Ads চালু |
| `/ads off` | Ads বন্ধ |
| `/help` | Help menu |

---

## ✨ Features

- 💌 Anonymous message sending
- 🆔 Auto sequential User ID (1001–9999)
- 🤖 Telegram bot admin backend
- 🔔 Push notifications (VAPID)
- 📲 PWA — Install as app
- 🔒 Ban/Unban system
- 📡 Real-time Firebase sync
- 📢 Broadcast to all users
- 📝 Caption box (Admin + User)
- 👁️ Message seen tracking
- 📱 Fully responsive (Mobile first)
- 🌙 Dark neon theme

---

## 👤 Developer

**RK RaiHaN KoBiR**  
🔗 GitHub: [github.com/RK-RaiHaN-KoBiR](https://github.com/RK-RaiHaN-KoBiR)  
📩 Telegram: [t.me/rksystemall](https://t.me/rksystemall)

---

> ⚠️ **Part 2** (bot folder) আলাদাভাবে দেওয়া হবে।
