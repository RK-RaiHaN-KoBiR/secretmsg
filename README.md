# 💌 Cithi-Pathan — চিঠি পাঠান

**Anonymous Secret Message Platform with Full Telegram Bot**

🌐 Live: https://cithipathao.vercel.app  
📦 Repo: https://github.com/RK-RaiHaN-KoBiR/secretmsg/

---

## 🚀 Quick Deploy (Vercel — 3 Steps)

1. Upload this folder to your GitHub repo
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo
3. Add all **Environment Variables** (see table below) → **Deploy** ✅

After first deploy, set Telegram webhook:
```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://yoursite.vercel.app/api/webhook
```

---

## 🔐 Environment Variables

Set these in **Vercel → Project → Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `BOT_TOKEN` | `8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA` |
| `ADMIN_ID` | `6048050987` |
| `JSONBIN_BIN_ID` | `6a048364250b1311c344cc10` |
| `JSONBIN_MASTER_KEY` | `$2a$10$dFJuDsfb...` |
| `JSONBIN_ACCESS_KEY` | `$2a$10$YzxVA...` |
| `VAPID_PUBLIC_KEY` | `BIh4Gq9Jk7z...` |
| `VAPID_PRIVATE_KEY` | `-stTkJCFdw...` |
| `SITE_URL` | `https://cithipathao.vercel.app` |
| `WEBHOOK_URL` | `https://cithipathao.vercel.app/api/webhook` |

---

## 📂 Complete Project Structure

```
cithipathan/
│
├── public/               ← Website (Part 1)
│   ├── index.html        ← Full UI
│   ├── style.css         ← Neon dark theme
│   ├── app.js            ← Frontend logic
│   ├── sw.js             ← Service Worker
│   └── manifest.json     ← PWA
│
├── api/                  ← Vercel Serverless Functions
│   ├── database.js       ← JSONBin helper
│   ├── user.js           ← User create/ban/device
│   ├── send.js           ← Message send + seen
│   ├── caption.js        ← Caption CRUD
│   ├── broadcast.js      ← Broadcast + Ads
│   └── webhook.js        ← Telegram webhook receiver
│
├── bot/                  ← Telegram Bot (Part 2)
│   ├── bot.js            ← Main entry + polling
│   ├── commands.js       ← All commands + keyboard
│   ├── webhook.js        ← Webhook setup
│   └── admin.js          ← Admin notify helpers
│
├── database/             ← Schema references
│   ├── users.json
│   ├── captions.json
│   └── messages.json
│
├── package.json
├── vercel.json           ← Deploy config
├── .env.example
└── README.md
```

---

## 🤖 Bot Commands

| Command | Description |
|---|---|
| `/start` | Welcome menu |
| `/send UID message` | Send reply to user |
| `/received` | View all received messages |
| `/replyhistory` | View sent replies |
| `/users` | Show all registered users |
| `/broadcast` | Send broadcast to all |
| `/caption` | Manage captions |
| `/help` | Help menu |
| `/ban UID` | Ban a user |
| `/unban UID` | Unban a user |
| `/info UID` | View user profile |
| `/clear UID` | Clear user data |
| `/delete MSGID` | Delete a message |
| `/status` | Bot status report |
| `/ads on\|off` | Toggle ads |

## ⌨️ Keyboard Buttons

```
[ 📨 Send Message ]  [ 📥 Received History ]
[ 📤 Reply History ] [ 👥 Show All User    ]
[ 📢 Broadcast     ] [ 📝 Caption BOX      ]
[              🆘 Help                    ]
```

---

## ✨ All Features

**Website:**
- 💖 Animated love loading screen
- 🕐 Live BD clock (random colors)
- 🆔 Auto User ID (1001–9999, sequential)
- 📱 Device info capture → Bot notification
- 💌 Anonymous + named message sending
- 📜 Send/Received History (user-specific)
- 📝 Caption Box (add/edit/delete)
- 👤 Profile (optional name/WhatsApp/FB)
- 🔔 Push Notifications (Service Worker)
- 📢 Broadcast popup system
- 🚫 Ban screen for banned users
- 💚 Glassmorphism Neon Dark UI
- 📱 Fully mobile responsive

**Bot:**
- 📩 Inline Reply button on every message
- 👁️ Seen status reports (one-time)
- 📤 Two-way reply: inline button + `/send` command
- 📢 Broadcast to all users
- 👥 Full user list with View/Ban/Unban/Clear
- 📝 Caption management from bot
- 📊 Status report
- 🔔 Ads ON/OFF: `/ads on` / `/ads off`

---

Made with 💖 by RK-RaiHaN-KoBiR
