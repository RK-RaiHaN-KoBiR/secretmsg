# 💌 চিঠি পাঠাও — Secret Message Box

> Anonymous Secret Messaging Platform with Telegram Bot Admin Panel

**Live Site:** [cithipathao.vercel.app](https://cithipathao.vercel.app)  
**GitHub:** [RK-RaiHaN-KoBiR/secretmsg](https://github.com/RK-RaiHaN-KoBiR/secretmsg)

---

## 📂 Folder Structure

```
secretmsg/
├── public/
│   ├── index.html       ← Main Website
│   ├── style.css        ← Full CSS (Glassmorphism + Neon)
│   ├── app.js           ← Frontend JavaScript
│   ├── sw.js            ← Service Worker (Push Notifications)
│   └── manifest.json    ← PWA Manifest
│
├── api/
│   ├── database.js      ← JSONBin DB Helper
│   ├── user.js          ← User Register / Profile API
│   ├── send.js          ← Send & Receive Message API
│   ├── caption.js       ← Caption Management API
│   ├── broadcast.js     ← Broadcast API
│   └── webhook.js       ← Telegram Webhook Endpoint
│
├── bot/
│   ├── bot.js           ← Full Telegram Bot Logic
│   └── setWebhook.js    ← Webhook Setup Script
│
├── database/
│   └── db.json          ← Default DB Structure (JSONBin এ যাবে)
│
├── package.json
├── vercel.json
├── .env.example
└── README.md
```

---

## 🚀 Deploy করার নিয়ম (Android Mobile দিয়ে)

### Step 1 — GitHub এ Upload করুন

1. GitHub এ login করুন → New Repository → নাম: `secretmsg`
2. সব ফাইল upload করুন (folder structure ঠিক রাখুন)

### Step 2 — JSONBin Setup

1. [jsonbin.io](https://jsonbin.io) তে একাউন্ট খুলুন
2. New Bin তৈরি করুন → `database/db.json` এর content paste করুন
3. Bin ID, Master Key, Access Key নোট করুন

### Step 3 — Vercel Deploy

1. [vercel.com](https://vercel.com) এ GitHub দিয়ে login করুন
2. "New Project" → আপনার `secretmsg` repository select করুন
3. **Environment Variables** যোগ করুন:

| Key | Value |
|-----|-------|
| `BOT_TOKEN` | আপনার Telegram Bot Token |
| `ADMIN_ID` | আপনার Telegram User ID |
| `JSONBIN_BIN_ID` | আপনার JSONBin Bin ID |
| `JSONBIN_MASTER_KEY` | আপনার JSONBin Master Key |
| `JSONBIN_ACCESS_KEY` | আপনার JSONBin Access Key |
| `SITE_URL` | `https://আপনার-প্রজেক্ট.vercel.app` |

4. Deploy করুন ✅

### Step 4 — Webhook Set করুন

Deploy হওয়ার পর Browser এ এই URL এ যান:
```
https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=https://আপনার-সাইট.vercel.app/api/webhook
```

---

## 🤖 Bot Features

| Command | কাজ |
|---------|-----|
| `/start` | Welcome Menu |
| `/send 1001 Hello` | User কে Message পাঠান |
| `/received` | সব Received Messages |
| `/replyhistory` | সব Sent Replies |
| `/users` | সব Registered Users |
| `/broadcast` | সকলকে Message পাঠান |
| `/caption` | Caption Manage করুন |
| `/ban 1001` | User Ban করুন |
| `/unban 1001` | User Unban করুন |
| `/info 1001` | User Info দেখুন |
| `/status` | Bot Status |
| `/help` | Help Menu |

---

## 🌐 Website Features

- ✅ Anonymous / Named Message Send
- ✅ Auto User ID Generation (1001–9999)
- ✅ Send History & Received History
- ✅ Caption Box (Admin + User)
- ✅ My Profile
- ✅ Push Notifications
- ✅ Glassmorphism + Neon UI
- ✅ Mobile Responsive
- ✅ PWA Support
- ✅ Ban System

---

## 🔒 Security

- User data isolated (প্রতিটি user শুধু নিজেরটা দেখে)
- Admin only bot access
- No sensitive data in frontend
- All logic server-side (Vercel Serverless)

---

**Made with 💜 by RK System**
