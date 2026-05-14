# 💌 চিঠি পাঠাও - Secret Message Box

**Site:** https://cithipathao.vercel.app  
**GitHub:** https://github.com/RK-RaiHaN-KoBiR/secretmsg/

---

## 📁 Folder Structure


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
