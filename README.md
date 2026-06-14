# 💌 চিঠি পাঠান — Cithi Pathan

> Secret Anonymous Message Box — Premium Messenger-Style Website + Telegram Bot

---

## 🚀 Quick Deploy Guide (Vercel + Render)

### ✅ Step 1: GitHub এ Upload করুন
1. GitHub এ একটি new repository তৈরি করুন (e.g. `cithi-pathan`)
2. এই সব files সেই repository তে upload করুন

### ✅ Step 2: Firebase Setup
1. [Firebase Console](https://console.firebase.google.com) এ যান
2. আপনার project open করুন (`cithi-pathan`)
3. **Project Settings → Service Accounts → Generate new private key** → JSON download করুন
4. সেই JSON থেকে `private_key` এবং `client_email` copy করুন

### ✅ Step 3: Vercel Deploy (Website + API)
1. [vercel.com](https://vercel.com) এ GitHub দিয়ে login করুন
2. **New Project** → আপনার repository import করুন
3. **Environment Variables** এ এগুলো add করুন:

```
TELEGRAM_BOT_TOKEN    = আপনার bot token
ADMIN_CHAT_ID         = আপনার Telegram user ID
FIREBASE_PROJECT_ID   = cithi-pathan
FIREBASE_PRIVATE_KEY  = -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
FIREBASE_CLIENT_EMAIL = firebase-adminsdk-xxxxx@cithi-pathan.iam.gserviceaccount.com
VAPID_PUBLIC_KEY      = BIh4Gq9Jk7zAHcmViGZZLSmMVwl8zcmuOdAplHXSFzljdyffQdSIJ0ACpfNHTyGFhIeG2d9O8Y6MJJhZ-MpdxBY
VAPID_PRIVATE_KEY     = -stTkJCFdwSCV2MsKMS1fioNYi75GT1l_vIeicJ42bc
VAPID_EMAIL           = mailto:Taniishaakhtar@gmail.com
WEBSITE_URL           = https://your-site.vercel.app
API_SECRET            = cithi-secret-2026
```

4. **Deploy** করুন

### ✅ Step 4: Webhook Setup
Deploy হওয়ার পর browser এ এই URL open করুন:
```
https://your-site.vercel.app/api/setup
```
এটি automatically Telegram webhook এবং bot commands register করবে।

### ✅ Step 5: Bot (Render এ) — Optional
Vercel এ bot চলে না (webhook দিয়ে চলে)।
Bot standalone চালাতে চাইলে [render.com](https://render.com) এ deploy করুন।

---

## 📁 File Structure

```
cithipathan/
├── public/              ← Website files (frontend)
│   ├── index.html       ← Main page
│   ├── css/style.css    ← All styles
│   ├── js/
│   │   ├── config.js    ← Firebase config + app settings
│   │   └── app.js       ← Main app logic
│   ├── sw.js            ← Service Worker (push notifications)
│   └── manifest.json    ← PWA manifest
├── api/                 ← Serverless API routes (Vercel)
│   ├── webhook.js       ← Telegram bot webhook handler
│   ├── send-message.js  ← Notify admin when user sends message
│   ├── new-user.js      ← Notify admin of new user
│   ├── new-caption.js   ← Notify admin of new caption
│   ├── message-seen.js  ← Notify admin when message is seen
│   ├── broadcast-seen.js← Notify admin when broadcast is seen
│   ├── ads-status.js    ← Toggle ads on/off
│   └── setup.js         ← Register webhook (run once)
├── bot/
│   └── bot.js           ← Standalone bot (for Render/VPS)
├── database/
│   ├── db.js            ← Firebase helper (for bot)
│   └── seed.js          ← Initial data seeder
├── .env.example         ← Environment variables template
├── vercel.json          ← Vercel deployment config
├── package.json         ← Dependencies
└── firestore.rules      ← Firestore security rules
```

---

## 🤖 Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Open welcome menu |
| `/send 1001 Hello` | Send message to user 1001 |
| `/received` | View all received messages |
| `/replyhistory` | View sent replies |
| `/users` | Show all registered users |
| `/broadcast` | Send broadcast to all users |
| `/caption` | Manage captions |
| `/ban 1001` | Ban user 1001 |
| `/unban 1001` | Unban user 1001 |
| `/info 1001` | View user 1001's full info |
| `/status` | Bot status report |
| `/ads on` | Enable ads |
| `/ads off` | Disable ads |
| `/help` | Show all commands |

---

## ⚙️ Customization

All settings are in `public/js/config.js`:
- Firebase config
- VAPID key
- UID range (1001–9999)
- Loading duration
- Ad probability
- Background emojis
- Contact links

---

## 🔒 Security Notes
- Bot is admin-only (only your ADMIN_CHAT_ID can use it)
- Users cannot see each other's messages
- All sensitive keys are in Environment Variables (not in code)
- Firestore rules protect user data
