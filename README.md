# 💌 চিঠি পাঠাও - Secret Message Box

**Site:** https://cithipathao.vercel.app  
**GitHub:** https://github.com/RK-RaiHaN-KoBiR/secretmsg/

---

## 📁 Folder Structure

```
secretmsg/
├── public/
│   ├── index.html      ← Main website
│   ├── style.css       ← Styling
│   ├── app.js          ← Frontend logic
│   ├── sw.js           ← Service Worker (Push Notifications)
│   └── manifest.json   ← PWA Manifest
├── api/
│   ├── send.js         ← Message send endpoint
│   ├── replies.js      ← Get user replies
│   ├── mark-seen.js    ← Mark reply as seen
│   ├── new-user.js     ← New user alert
│   ├── captions.js     ← Get admin captions
│   ├── caption-notify.js ← Caption notification
│   └── subscribe.js    ← Notification subscribe
├── bot/
│   └── bot.js          ← Telegram Bot (Admin only)
├── vercel.json         ← Vercel config
├── package.json
└── README.md
```

---

## 🚀 Deploy to Vercel (GitHub থেকে)

### Step 1: GitHub এ Upload
সব ফাইল GitHub এ push করুন:
```
https://github.com/RK-RaiHaN-KoBiR/secretmsg/
```

### Step 2: Vercel এ Deploy
1. [vercel.com](https://vercel.com) এ যান
2. GitHub দিয়ে login করুন
3. "New Project" → আপনার repo select করুন
4. Deploy করুন

---

## 🤖 Bot চালু করার উপায় (Optional - Local বা Server)

Bot টি locally বা যেকোনো server এ চালাতে পারবেন:

```bash
npm install
node bot/bot.js
```

> **Note:** Bot টি Vercel এ চলবে না (serverless)। Bot চালাতে হলে আলাদা একটা Android device বা server লাগবে।

### Android এ Bot চালানো:
1. **Termux** install করুন (Play Store)
2. Termux খুলুন:
```bash
pkg install nodejs git
git clone https://github.com/RK-RaiHaN-KoBiR/secretmsg
cd secretmsg
npm install
node bot/bot.js
```

---

## ⚙️ Configuration (vercel.json এ আছে)

```
BOT_TOKEN = 8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA
ADMIN_ID = 6048050987
JSONBIN_BIN_ID = 6a048364250b1311c344cc10
JSONBIN_MASTER_KEY = $2a$10$dFJuDsfbDqqnkKBPh2bGMuHea6RJjPSU2bv67bkIM9GaJkypisWdW
```

---

## 🤖 Bot Commands (Admin Only)

| Command | কাজ |
|---------|-----|
| `/start` | Bot শুরু করুন |
| `/send [userid] [msg]` | User কে message পাঠান |
| `/users` | সকল user দেখুন |
| `/broadcast` | সবাইকে message পাঠান |
| `/caption` | Caption manage করুন |
| `/replyhistory` | Reply history |
| `/receivedhistory` | সব received message |
| `/help` | Help দেখুন |

---

## 📌 Features

✅ Secret anonymous messaging  
✅ Telegram bot integration  
✅ User ID system (4-digit permanent)  
✅ Push Notifications  
✅ Send/Receive History  
✅ Caption collection  
✅ Device info tracking  
✅ Admin broadcast  
✅ Profile management  
✅ PWA support  
✅ Cookie-based permanent storage  
