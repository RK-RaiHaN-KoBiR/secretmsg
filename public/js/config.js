// =============================================
// CITHI PATHAN - CONFIGURATION FILE
// Edit these values to customize your app
// =============================================

// ----- FIREBASE CONFIGURATION -----
// আপনার Firebase project এর config এখানে দিন
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA96S5IRQWJmhnsD6uTKGKivnyrLRRNDeM",
  authDomain: "cithi-pathan.firebaseapp.com",
  projectId: "cithi-pathan",
  storageBucket: "cithi-pathan.firebasestorage.app",
  messagingSenderId: "239712190057",
  appId: "1:239712190057:web:d7b285123e1ed17700ecf8",
  measurementId: "G-98MLFXMQVY"
};

// ----- PUSH NOTIFICATION (VAPID) -----
// Web Push এর জন্য VAPID Public Key
const VAPID_PUBLIC_KEY = "BIh4Gq9Jk7zAHcmViGZZLSmMVwl8zcmuOdAplHXSFzljdyffQdSIJ0ACpfNHTyGFhIeG2d9O8Y6MJJhZ-MpdxBY";

// ----- APP SETTINGS -----
const APP_CONFIG = {
  // User ID Range
  UID_START: 1001,
  UID_END: 9999,

  // Message ID Range
  MSG_ID_START: 1,
  MSG_ID_END: 999999,

  // Caption ID Range
  CAP_ID_START: 1,
  CAP_ID_END: 999999,

  // Loading screen duration (ms)
  LOADING_DURATION: 2800,

  // Auto close popup after (ms)
  POPUP_AUTO_CLOSE: 5000,

  // Ad show chance (0.0 - 1.0) = 30%
  AD_CHANCE_LOAD: 0.30,
  AD_CHANCE_CLICK: 0.30,

  // Timezone for display
  // BD Time = Asia/Dhaka
  TIMEZONE: "Asia/Dhaka",

  // Time format
  TIME_FORMAT_OPTIONS: {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  },

  DATE_FORMAT_OPTIONS: {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "long",
    year: "numeric"
  },

  // Contact links (admin can change these)
  ADMIN_CONTACT_URL: "https://m.me/ToR.PiccHi.JaMai.TaH.X",
  TELEGRAM_CHANNEL_URL: "https://t.me/rksystemall",

  // Floating emojis for background animation
  BG_EMOJIS: ["💖","🌺","📩","💝","💚","💛","🧡","❤️","❤️‍🩹","💜","💙","🤎","🖤","🤍","💓","💞","💖","✨","🌸","💌"]
};

// ---- DO NOT EDIT BELOW THIS LINE ----
// Firebase initialize (done in app.js)
