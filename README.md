# 💌 Chithi Pathao — চিঠি পাঠাও

> Secret Anonymous Messaging Platform with Telegram Bot Admin Panel

## 🚀 Quick Deploy (GitHub → Vercel)

### Step 1: Upload to GitHub
1. Go to https://github.com/RK-RaiHaN-KoBiR/secretmsg/
2. Upload all files keeping the folder structure intact

### Step 2: Deploy on Vercel
1. Go to https://vercel.com
2. Import your GitHub repository
3. Add Environment Variables (from `.env.example`)
4. Click Deploy ✅

### Step 3: Set Telegram Webhook
After deploying, open this URL in your browser:
```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://cithipathao.vercel.app/api/botwebhook
```

### Step 4: Set Bot Commands
Open this URL:
```
https://api.telegram.org/bot<BOT_TOKEN>/setMyCommands?commands=[{"command":"start","description":"Open Welcome Menu"},{"command":"send","description":"Send Reply To User"},{"command":"received","description":"View Received Messages"},{"command":"replyhistory","description":"View Sent Replies"},{"command":"users","description":"Show All Users"},{"command":"broadcast","description":"Send Broadcast"},{"command":"caption","description":"Manage Captions"},{"command":"help","description":"Help Menu"},{"command":"ban","description":"Ban User"},{"command":"unban","description":"Unban User"},{"command":"info","description":"View User Info"}]
```

## 📁 Folder Structure
```
secretmsg/
├── public/          ← Website files
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── sw.js        ← Service Worker
│   └── manifest.json
├── api/             ← Backend API (Vercel serverless)
│   ├── send.js      ← Message API
│   ├── user.js      ← User management
│   ├── caption.js   ← Caption management
│   ├── broadcast.js ← Broadcast system
│   ├── database.js  ← JSONBin helper
│   └── botwebhook.js← Telegram webhook
├── bot/             ← Telegram bot logic
│   ├── bot.js       ← Main bot handler
│   └── webhook.js   ← Telegram API helper
├── vercel.json      ← Vercel config
├── package.json
├── .env.example     ← Copy to .env
└── README.md
```

## 🤖 Bot Commands
| Command | Action |
|---------|--------|
| `/start` | Welcome menu |
| `/send <uid> <msg>` | Send reply to user |
| `/received` | View all received messages |
| `/replyhistory` | View sent replies |
| `/users` | Show all registered users |
| `/broadcast` | Send broadcast to all users |
| `/caption` | Manage captions |
| `/ban <uid>` | Ban a user |
| `/unban <uid>` | Unban a user |
| `/info <uid>` | View user info |
| `/help` | Help menu |

## 🌐 Live Website
https://cithipathao.vercel.app

## 📞 Contact
- Facebook: https://m.me/ToR.PiccHi.JaMai.TaH.X
- Telegram: https://t.me/rksystemall
