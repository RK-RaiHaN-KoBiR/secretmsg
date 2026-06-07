# 🤖 চিঠি পাঠান — Part 2 (Bot Files)

## 📂 Part 2 এ কী আছে

```
bot/
├── bot.js        ← Main bot + session + keyboard
├── commands.js   ← All /commands handlers
├── admin.js      ← Inline callback_query handlers
└── webhook.js    ← Webhook handler + Push notification sender

api/
└── webhook.js    ← Vercel route → delegates to bot/webhook.js

database/
├── users.json    ← Example schema (real data: Firebase)
├── captions.json ← Example schema
└── messages.json ← Example schema

package.json      ← Updated with telegraf dependency
vercel.json       ← Complete routing config
```

---

## 🚀 Part 1 + Part 2 একসাথে মার্জ করুন

Part 1 এর ফোল্ডারে Part 2 এর ফাইলগুলো যোগ করুন:

```
cithipathan/          ← Part 1 (existing)
├── public/           ← Part 1 থেকে
├── api/
│   ├── send.js       ← Part 1 থেকে
│   ├── user.js       ← Part 1 থেকে
│   ├── caption.js    ← Part 1 থেকে
│   ├── broadcast.js  ← Part 1 থেকে
│   ├── database.js   ← Part 1 থেকে
│   └── webhook.js    ← ✅ Part 2 এর নতুন ফাইল
├── bot/              ← ✅ Part 2 এর নতুন ফোল্ডার
│   ├── bot.js
│   ├── commands.js
│   ├── admin.js
│   └── webhook.js
├── database/         ← ✅ Part 2 এর নতুন ফোল্ডার
│   ├── users.json
│   ├── captions.json
│   └── messages.json
├── package.json      ← ✅ Part 2 টা দিয়ে Replace করুন
├── vercel.json       ← ✅ Part 2 টা দিয়ে Replace করুন
├── .env.example      ← Part 1 থেকে (same)
└── README.md         ← Part 1 থেকে (same)
```

---

## ⚙️ Step-by-Step Setup

### Step 1 — npm install

```bash
npm install
```
এটা `telegraf` এবং `node-fetch` install করবে।

### Step 2 — Vercel এ Environment Variables Set করুন

Vercel Dashboard → Project → Settings → Environment Variables:

| Variable         | Value                                        |
|------------------|----------------------------------------------|
| BOT_TOKEN        | `8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA` |
| ADMIN_ID         | `6048050987`                                 |
| FIREBASE_DB_URL  | `https://cithi-pathan-default-rtdb.firebaseio.com` |
| VAPID_PUBLIC_KEY | আপনার VAPID public key                       |
| VAPID_PRIVATE_KEY| আপনার VAPID private key                      |
| VAPID_SUBJECT    | `mailto:Taniishaakhtar@gmail.com`            |
| SITE_URL         | `https://cithipathao.vercel.app`             |
| WEBHOOK_URL      | `https://cithipathao.vercel.app/api/webhook` |

### Step 3 — Deploy করুন

```
GitHub এ সব file upload → Vercel auto-deploy হবে
```

### Step 4 — Telegram Webhook Set করুন

Browser এ এই URL open করুন (একবারই করতে হবে):

```
https://cithipathao.vercel.app/api/webhook?action=set
```

Success response দেখবেন:
```json
{ "status": "Webhook set!", "url": "https://..." }
```

---

## 🤖 Bot Features

### Keyboard Buttons
| Button | কাজ |
|--------|-----|
| 📨 Send Message | User কে message পাঠান |
| 📥 Received History | সব received message দেখুন |
| 📤 Reply History | পাঠানো সব reply দেখুন |
| 👥 Show All User | সব registered user list |
| 📢 Broadcast | সবার কাছে message পাঠান |
| 📝 Caption BOX | Caption manage করুন |
| 🆘 Help | সব command দেখুন |

### Slash Commands
| Command | কাজ |
|---------|-----|
| `/start` | Welcome menu |
| `/send 1001 Hello` | Direct reply |
| `/received` | Received messages |
| `/replyhistory` | Sent replies |
| `/users` | All users list |
| `/broadcast মেসেজ` | Broadcast all |
| `/caption` | Caption management |
| `/ban 1001` | Ban user |
| `/unban 1001` | Unban user |
| `/info 1001` | User details |
| `/ads on` | Ads চালু |
| `/ads off` | Ads বন্ধ |
| `/status` | Bot status |
| `/delete 1001 01 received` | Message delete |
| `/clear 1001` | User data clear |
| `/help` | Help menu |

### Inline Buttons (Message এ আসে)
- 📩 **Send Reply** → User কে reply দিন
- 🔍 **View Info** → User details
- 🗑️ **Clear Data** → User data wipe
- 🚫 **Ban User** → User ban
- ✅ **Unban User** → User unban
- ✏️ **Edit Caption** → Caption edit
- 🗑️ **Delete Caption** → Caption delete

---

## 🔔 Push Notification System

Bot থেকে User কে reply দিলে automatically push notification যাবে।
Manual push পাঠাতে:

```
https://cithipathao.vercel.app/api/webhook?action=push&uid=1001&msg=Hello
```

---

## 👤 Developer

**RK RaiHaN KoBiR**
📩 Telegram: [t.me/rksystemall](https://t.me/rksystemall)
🔗 GitHub: [github.com/RK-RaiHaN-KoBiR](https://github.com/RK-RaiHaN-KoBiR)
