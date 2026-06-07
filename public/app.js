/**
 * ═══════════════════════════════════════════════════════
 *  CITHI PATHAN — app.js
 *  Frontend logic: Firebase, UI, messaging, notifications
 * ═══════════════════════════════════════════════════════
 */

'use strict';

/* ──────────────────────────────────────────────────────
   ① FIREBASE CONFIGURATION
   Replace values here if you change your Firebase project
────────────────────────────────────────────────────── */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyA96S5IRQWJmhnsD6uTKGKivnyrLRRNDeM",
  authDomain:        "cithi-pathan.firebaseapp.com",
  projectId:         "cithi-pathan",
  storageBucket:     "cithi-pathan.firebasestorage.app",
  messagingSenderId: "239712190057",
  appId:             "1:239712190057:web:d7b285123e1ed17700ecf8",
  measurementId:     "G-98MLFXMQVY",
  databaseURL:       "https://cithi-pathan-default-rtdb.firebaseio.com"
};

/* ──────────────────────────────────────────────────────
   ② PUSH NOTIFICATION (VAPID) CONFIG
   Change publicKey if you regenerate VAPID keys
────────────────────────────────────────────────────── */
const VAPID_PUBLIC_KEY = "BIh4Gq9Jk7zAHcmViGZZLSmMVwl8zcmuOdAplHXSFzljdyffQdSIJ0ACpfNHTyGFhIeG2d9O8Y6MJJhZ-MpdxBY";

/* ──────────────────────────────────────────────────────
   ③ TELEGRAM BOT CONFIG
   Used by API routes (backend) — stored here as reference
   The actual API calls go through /api/*.js (serverless)
────────────────────────────────────────────────────── */
const BOT_CONFIG = {
  token:    "8653934604:AAGE9O4iEkB62yxsXWEGOE2AS_TZNmmMxPA",
  adminId:  "6048050987"
};

/* ──────────────────────────────────────────────────────
   ④ APP CONSTANTS  — modify freely
────────────────────────────────────────────────────── */
const UID_MIN         = 1001;           // First user ID
const UID_MAX         = 9999;           // Last user ID
const LOADING_MS      = 2800;           // Loading screen duration (ms)
const BD_TIMEZONE     = "Asia/Dhaka";   // Bangladesh timezone
const AD_SHOW_CHANCE  = 0.30;           // 30% chance to show ad
const POPUP_AUTO_CLOSE= 5000;           // Broadcast/caption popup auto-close (ms)

/* ──────────────────────────────────────────────────────
   ⑤ FLOATING EMOJI POOL — add/remove as desired
────────────────────────────────────────────────────── */
const FLOAT_EMOJIS = [
  '💖','🌺','📩','💝','💚','💛','🧡','❤️',
  '❤️‍🩹','💜','💙','🤎','🖤','🤍','💓','💞','💌','🌸'
];

/* ════════════════════════════════════════════════════════
   APP STATE
════════════════════════════════════════════════════════ */
const state = {
  uid:           null,    // Current user's 4-digit ID (string)
  isNew:         false,   // Was this user just created?
  isBanned:      false,
  profile:       {},      // { name, wa, fb, registeredDate, totalSend, totalRecv, notifAllowed }
  sendHistory:   [],
  recvHistory:   [],
  captions:      [],
  adsEnabled:    true,
  seenReplies:   new Set(),  // Reply IDs already shown as popup
  seenBroadcast: null,       // Last broadcast ID shown
  editingCaption:null,       // Caption ID being edited
};

/* ════════════════════════════════════════════════════════
   FIREBASE INIT
════════════════════════════════════════════════════════ */
let db;

function initFirebase() {
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  db = firebase.database();
}

/* ════════════════════════════════════════════════════════
   UTILITY HELPERS
════════════════════════════════════════════════════════ */

/** Format Date → "DD/MM/YYYY — HH:MM AM/PM BD Time" */
function bdTimeStr(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleString('en-GB', {
    timeZone: BD_TIMEZONE,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).replace(',', ' —') + ' BD Time';
}

/** Show a brief toast message */
function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

/** Convert VAPID key from URL-safe base64 to Uint8Array */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/** Generate next sequential UID by scanning Firebase */
async function generateUID() {
  const snap = await db.ref('users').once('value');
  const existing = snap.exists() ? Object.keys(snap.val()).map(Number) : [];
  for (let id = UID_MIN; id <= UID_MAX; id++) {
    if (!existing.includes(id)) return String(id);
  }
  return null; // Capacity full
}

/** Pad number to 2 digits */
function pad2(n) { return String(n).padStart(2, '0'); }

/* ════════════════════════════════════════════════════════
   CLOCK — Live time & date inside circle
════════════════════════════════════════════════════════ */
function startClock() {
  function tick() {
    const now  = new Date();
    const opts = { timeZone: BD_TIMEZONE, hour: 'numeric', minute: '2-digit',
                   second: '2-digit', hour12: true };
    const timeStr = now.toLocaleTimeString('en-US', opts).toUpperCase();

    const dateOpts = { timeZone: BD_TIMEZONE, day: '2-digit',
                       month: 'long', year: 'numeric' };
    const dateStr  = now.toLocaleDateString('en-US', dateOpts);

    document.getElementById('clockTime').textContent = timeStr;
    document.getElementById('clockDate').textContent = dateStr;
  }
  tick();
  setInterval(tick, 1000);
}

/* ════════════════════════════════════════════════════════
   FLOATING EMOJI BACKGROUND
════════════════════════════════════════════════════════ */
function startFloatingEmojis() {
  const container = document.getElementById('floatingEmojis');
  function spawnEmoji() {
    const el = document.createElement('div');
    el.className  = 'float-emoji';
    el.textContent= FLOAT_EMOJIS[Math.floor(Math.random() * FLOAT_EMOJIS.length)];
    el.style.left = Math.random() * 100 + 'vw';
    const dur     = 8 + Math.random() * 12;
    const delay   = Math.random() * 5;
    el.style.animationDuration = dur + 's';
    el.style.animationDelay    = delay + 's';
    el.style.fontSize = (1 + Math.random() * 1.2) + 'em';
    container.appendChild(el);
    setTimeout(() => el.remove(), (dur + delay) * 1000 + 1000);
  }
  // Spawn initial batch
  for (let i = 0; i < 12; i++) spawnEmoji();
  setInterval(spawnEmoji, 1800);
}

/* ════════════════════════════════════════════════════════
   USER REGISTRATION & PROFILE
════════════════════════════════════════════════════════ */

/** Load or create user session */
async function initUser() {
  // Check localStorage first
  let storedUID = localStorage.getItem('cithi_uid');

  if (storedUID) {
    // Returning user — verify in DB
    const snap = await db.ref(`users/${storedUID}`).once('value');
    if (snap.exists()) {
      state.uid    = storedUID;
      const data   = snap.val();
      state.isBanned = data.banned === true;
      state.profile  = data.profile || {};
      state.isNew    = false;
    } else {
      // DB entry missing — re-register
      localStorage.removeItem('cithi_uid');
      await registerNewUser();
    }
  } else {
    await registerNewUser();
  }
}

async function registerNewUser() {
  const newUID = await generateUID();
  if (!newUID) { showToast('সর্বোচ্চ ইউজার সংখ্যায় পৌঁছে গেছে।'); return; }

  state.uid  = newUID;
  state.isNew= true;

  const profile = {
    name:           '',
    wa:             '',
    fb:             '',
    registeredDate: Date.now(),
    totalSend:      0,
    totalRecv:      0,
    notifAllowed:   false
  };
  state.profile = profile;

  // Save to DB
  await db.ref(`users/${newUID}`).set({
    uid:     newUID,
    banned:  false,
    profile: profile,
    lastActive: Date.now()
  });

  localStorage.setItem('cithi_uid', newUID);

  // Send new user alert to admin via API
  collectAndSendDeviceInfo();
}

/** Collect browser/device info and send via API */
async function collectAndSendDeviceInfo() {
  const ua      = navigator.userAgent;
  const lang    = navigator.language || 'Unknown';
  const conn    = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const network = conn ? (conn.effectiveType || 'Unknown') : 'Unknown';
  let battery   = { level: 'Unknown', charging: 'Unknown' };

  try {
    const b     = await navigator.getBattery?.();
    if (b) battery = { level: Math.round(b.level * 100) + '%', charging: b.charging ? 'Charging' : 'Discharging' };
  } catch (_) {}

  // RAM (Chrome only)
  const ram = navigator.deviceMemory ? navigator.deviceMemory + 'GB' : 'Unknown';

  // Fetch IP/location from a public API via our server-side route
  let ipData = {};
  try {
    const r = await fetch('/api/user?action=getip');
    if (r.ok) ipData = await r.json();
  } catch (_) {}

  const deviceInfo = {
    uid:        state.uid,
    userAgent:  ua,
    language:   lang,
    network,
    battery,
    ram,
    screen:     `${screen.width}x${screen.height}`,
    timestamp:  Date.now(),
    ...ipData
  };

  // Save to Firebase
  await db.ref(`users/${state.uid}/deviceInfo`).set(deviceInfo);

  // Notify admin bot
  try {
    await fetch('/api/user', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'newUser', uid: state.uid, deviceInfo })
    });
  } catch (_) {}
}

/* ════════════════════════════════════════════════════════
   UI HELPERS — sections, dropdown
════════════════════════════════════════════════════════ */

/** Show a section, hide others */
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  document.getElementById('dropdownMenu').classList.remove('open');
}

function goHome() { showSection('homeSection'); }

function closeSection(id) {
  document.getElementById(id).classList.remove('active');
}

function openReceived() {
  document.getElementById('sentOverlay').style.display = 'none';
  showSection('receivedHistorySection');
  loadReceivedHistory();
}

function goToReply() {
  closeReplyPopup();
  goHome();
  setTimeout(() => document.getElementById('msgInput').focus(), 300);
}

/** Dropdown toggle */
document.getElementById('threeDotBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('dropdownMenu').classList.toggle('open');
});

document.addEventListener('click', () => {
  document.getElementById('dropdownMenu').classList.remove('open');
});

/** Dropdown item navigation */
document.querySelectorAll('.dropdown-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    const section = item.dataset.section;
    if (!section) return;
    if (section === 'home') { goHome(); return; }
    const sectionMap = {
      sendHistory:     'sendHistorySection',
      receivedHistory: 'receivedHistorySection',
      captionBox:      'captionBoxSection',
      myProfile:       'myProfileSection',
      helpSection:     'helpSection'
    };
    if (sectionMap[section]) {
      showSection(sectionMap[section]);
      if (section === 'sendHistory')     loadSendHistory();
      if (section === 'receivedHistory') loadReceivedHistory();
      if (section === 'captionBox')      loadCaptions();
      if (section === 'myProfile')       renderProfile();
    }
  });
});

/* ════════════════════════════════════════════════════════
   SEND MESSAGE
════════════════════════════════════════════════════════ */

// Character counter
document.getElementById('msgInput').addEventListener('input', function() {
  document.getElementById('charCount').textContent = this.value.length;
});

document.getElementById('sendBtn').addEventListener('click', sendMessage);

async function sendMessage() {
  const msgText = document.getElementById('msgInput').value.trim();
  if (!msgText) { showToast('মেসেজ খালি রাখা যাবে না!'); return; }

  const isAnon  = document.getElementById('anonCheck').checked;
  const name    = isAnon ? 'Unknown User' : (document.getElementById('senderName').value.trim() || 'Unknown User');
  const wa      = isAnon ? '' : document.getElementById('senderWA').value.trim();
  const fb      = isAnon ? '' : document.getElementById('senderFB').value.trim();

  // Generate message ID
  const msgIdSnap = await db.ref(`users/${state.uid}/sendHistory`).once('value');
  const existing  = msgIdSnap.exists() ? Object.keys(msgIdSnap.val()).length : 0;
  const msgId     = pad2(existing + 1);

  const msgData = {
    msgId,
    uid:       state.uid,
    name,
    wa,
    fb,
    message:   msgText,
    timestamp: Date.now(),
    anonymous: isAnon
  };

  // Save to Firebase
  await db.ref(`users/${state.uid}/sendHistory/${msgId}`).set(msgData);

  // Increment total send count
  const prevTotal = (state.profile.totalSend || 0) + 1;
  await db.ref(`users/${state.uid}/profile/totalSend`).set(prevTotal);
  state.profile.totalSend = prevTotal;

  // Update lastActive & name/wa/fb in profile if not anon
  if (!isAnon) {
    await db.ref(`users/${state.uid}/profile`).update({ name, wa, fb });
    state.profile.name = name; state.profile.wa = wa; state.profile.fb = fb;
  }

  // Collect device info and send to admin bot via API
  try {
    await fetch('/api/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ msgData, uid: state.uid })
    });
  } catch (_) {}

  // Clear inputs
  document.getElementById('msgInput').value = '';
  document.getElementById('charCount').textContent = '0';

  // Show success popup
  document.getElementById('sentOverlay').style.display = 'flex';

  // After a moment, show notification permission popup
  setTimeout(() => {
    if (!state.profile.notifAllowed && Notification.permission !== 'granted') {
      document.getElementById('notifOverlay').style.display = 'flex';
    }
  }, 2000);
}

/* ════════════════════════════════════════════════════════
   POPUP CONTROLS
════════════════════════════════════════════════════════ */
function closeNotifPopup() { document.getElementById('notifOverlay').style.display = 'none'; }
function closeReplyPopup()  { document.getElementById('replyOverlay').style.display = 'none'; }
function closeBroadcast()   { document.getElementById('broadcastOverlay').style.display = 'none'; }
function closeCaptionPopup(){ document.getElementById('captionPopupOverlay').style.display = 'none'; }
function closeEditCaption() { document.getElementById('editCaptionOverlay').style.display = 'none'; }

function allowNotif() {
  closeNotifPopup();
  requestNotifPermission();
}

/* ════════════════════════════════════════════════════════
   PUSH NOTIFICATIONS
════════════════════════════════════════════════════════ */

async function requestNotifPermission() {
  if (!('Notification' in window)) { showToast('আপনার ব্রাউজার Notification সাপোর্ট করে না।'); return; }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    await subscribeUserToPush();
    state.profile.notifAllowed = true;
    await db.ref(`users/${state.uid}/profile/notifAllowed`).set(true);
    updateNotifStatus('Allowed ✅');
    showToast('✅ Notification চালু হয়েছে!');
  } else {
    showToast('Notification অনুমতি দেওয়া হয়নি।');
  }
}

async function subscribeUserToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg  = await navigator.serviceWorker.ready;
    const sub  = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    // Save subscription to Firebase
    await db.ref(`users/${state.uid}/pushSubscription`).set(JSON.parse(JSON.stringify(sub)));
    // Also store at top-level subscriptions path for easy broadcast
    await db.ref(`pushSubscriptions/${state.uid}`).set(JSON.parse(JSON.stringify(sub)));
  } catch (err) {
    console.error('Push subscription failed:', err);
  }
}

function updateNotifStatus(text) {
  const el = document.getElementById('pNotif');
  if (el) el.textContent = text;
}

/* ════════════════════════════════════════════════════════
   LOAD HISTORIES (Firebase real-time)
════════════════════════════════════════════════════════ */

function loadSendHistory() {
  const list = document.getElementById('sendHistoryList');
  list.innerHTML = '<div class="empty-msg">লোড হচ্ছে...</div>';

  db.ref(`users/${state.uid}/sendHistory`).on('value', snap => {
    if (!snap.exists()) {
      list.innerHTML = '<div class="empty-msg">কোনো পাঠানো মেসেজ নেই।</div>';
      return;
    }
    const items = Object.values(snap.val()).reverse();
    list.innerHTML = '';
    items.forEach(msg => {
      const card = document.createElement('div');
      card.className = 'history-card send-card';
      card.innerHTML = `
        <div class="hcard-row"><span class="hcard-key">Msg ID :</span><span class="hcard-val">${msg.msgId}</span></div>
        <div class="hcard-row"><span class="hcard-key">User ID :</span><span class="hcard-val">${msg.uid}</span></div>
        <div class="hcard-msg">💌 ${escapeHtml(msg.message)}</div>
        <div class="hcard-row"><span class="hcard-key">Send Time :</span><span class="hcard-val">${bdTimeStr(msg.timestamp)}</span></div>
      `;
      list.appendChild(card);
    });
  });
}

function loadReceivedHistory() {
  const list = document.getElementById('receivedHistoryList');
  list.innerHTML = '<div class="empty-msg">লোড হচ্ছে...</div>';

  db.ref(`users/${state.uid}/receivedMessages`).on('value', snap => {
    if (!snap.exists()) {
      list.innerHTML = '<div class="empty-msg">কোনো প্রাপ্ত মেসেজ নেই।</div>';
      return;
    }
    const items = Object.entries(snap.val())
      .map(([k,v]) => ({...v, _key: k}))
      .reverse();
    list.innerHTML = '';
    items.forEach(msg => {
      // Mark as seen (for popup prevention)
      if (!state.seenReplies.has(msg._key)) {
        state.seenReplies.add(msg._key);
        db.ref(`users/${state.uid}/receivedMessages/${msg._key}/seenAt`).set(Date.now());
        notifyAdminSeen(msg._key, msg);
      }
      const card = document.createElement('div');
      card.className = 'history-card recv-card';
      card.innerHTML = `
        <div class="hcard-row"><span class="hcard-key">Msg ID :</span><span class="hcard-val">${msg.msgId || msg._key}</span></div>
        <div class="hcard-row"><span class="hcard-key">User ID :</span><span class="hcard-val">${state.uid}</span></div>
        <div class="hcard-msg">📩 ${escapeHtml(msg.message)}</div>
        <div class="hcard-row"><span class="hcard-key">Time :</span><span class="hcard-val">${bdTimeStr(msg.timestamp)}</span></div>
      `;
      list.appendChild(card);
    });
  });
}

async function notifyAdminSeen(key, msg) {
  try {
    await fetch('/api/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action: 'seenReport',
        uid:    state.uid,
        msgKey: key,
        msgData: msg
      })
    });
  } catch (_) {}
}

/* ════════════════════════════════════════════════════════
   REAL-TIME REPLY LISTENER (popup on new reply)
════════════════════════════════════════════════════════ */
function listenForReplies() {
  db.ref(`users/${state.uid}/receivedMessages`).on('child_added', snap => {
    const msg = snap.val();
    const key = snap.key;
    if (!state.seenReplies.has(key)) {
      state.seenReplies.add(key);
      showReplyPopup(msg);
    }
  });
}

function showReplyPopup(msg) {
  document.getElementById('replyMsgContent').textContent = msg.message || '';
  document.getElementById('replyMsgTime').textContent    = bdTimeStr(msg.timestamp);
  document.getElementById('replyOverlay').style.display  = 'flex';
}

/* ════════════════════════════════════════════════════════
   CAPTION BOX
════════════════════════════════════════════════════════ */

function loadCaptions() {
  const list = document.getElementById('captionList');
  list.innerHTML = '<div class="empty-msg">লোড হচ্ছে...</div>';

  db.ref('captions').on('value', snap => {
    if (!snap.exists()) {
      list.innerHTML = '<div class="empty-msg">কোনো caption নেই।</div>';
      return;
    }
    const items = Object.entries(snap.val())
      .map(([k,v]) => ({...v, _key: k}))
      .sort((a,b) => a.timestamp - b.timestamp);

    list.innerHTML = '';
    items.forEach((cap, idx) => {
      const isOwner = cap.addedBy === state.uid || cap.addedBy === 'admin';
      const isMyOwn = cap.addedBy === state.uid;

      const card = document.createElement('div');
      card.className = 'caption-card';
      card.innerHTML = `
        <div class="caption-card-num">📌 Caption Number: ${pad2(idx + 1)}</div>
        <div class="caption-card-text">💬 ${escapeHtml(cap.text)}</div>
        <div class="caption-card-meta">
          👤 ${cap.addedBy === 'admin' ? '👑 Admin' : 'User: ' + cap.addedBy} &nbsp;|&nbsp;
          🕒 ${bdTimeStr(cap.timestamp)}
        </div>
        <div class="caption-card-actions">
          <button class="copy-btn ripple" onclick="copyCaption('${escapeAttr(cap.text)}')">📋 Copy</button>
          ${isMyOwn ? `<button class="edit-btn ripple" onclick="openEditCaption('${cap._key}', '${escapeAttr(cap.text)}')">✏️ Edit</button>` : ''}
          ${isMyOwn ? `<button class="del-btn ripple" onclick="deleteCaption('${cap._key}')">🗑️ Delete</button>` : ''}
        </div>
      `;
      list.appendChild(card);
    });
  });
}

async function addCaption() {
  const text = document.getElementById('newCaptionInput').value.trim();
  if (!text) { showToast('Caption খালি রাখা যাবে না!'); return; }

  const snap    = await db.ref('captions').once('value');
  const count   = snap.exists() ? Object.keys(snap.val()).length : 0;
  const capId   = pad2(count + 1);

  const capData = {
    capId,
    text,
    addedBy:   state.uid,
    timestamp: Date.now()
  };

  await db.ref(`captions/${capId}`).set(capData);
  document.getElementById('newCaptionInput').value = '';
  showToast('✅ Caption সংরক্ষিত হয়েছে!');

  // Notify admin
  try {
    await fetch('/api/caption', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'add', uid: state.uid, capData })
    });
  } catch (_) {}
}

function copyCaption(text) {
  navigator.clipboard.writeText(text).then(() => showToast('📋 Copied!'));
}

function openEditCaption(key, text) {
  state.editingCaption = key;
  document.getElementById('editCaptionInput').value = text;
  document.getElementById('editCaptionId').value    = key;
  document.getElementById('editCaptionOverlay').style.display = 'flex';
}

async function saveEditCaption() {
  const key  = document.getElementById('editCaptionId').value;
  const text = document.getElementById('editCaptionInput').value.trim();
  if (!text) { showToast('Caption খালি রাখা যাবে না!'); return; }
  await db.ref(`captions/${key}/text`).set(text);
  closeEditCaption();
  showToast('✅ Caption আপডেট হয়েছে!');
}

async function deleteCaption(key) {
  if (!confirm('এই caption মুছে ফেলবেন?')) return;
  await db.ref(`captions/${key}`).remove();
  showToast('🗑️ Caption মুছে ফেলা হয়েছে।');
}

/* ════════════════════════════════════════════════════════
   PROFILE
════════════════════════════════════════════════════════ */

function renderProfile() {
  const p = state.profile;
  document.getElementById('pUID').textContent  = state.uid || '----';
  document.getElementById('pName').textContent = p.name || '—';
  document.getElementById('pWA').textContent   = p.wa   || '—';
  document.getElementById('pFB').textContent   = p.fb   || '—';
  document.getElementById('pSend').textContent = p.totalSend || 0;
  document.getElementById('pRecv').textContent = p.totalRecv || 0;
  document.getElementById('pReg').textContent  = p.registeredDate ? bdTimeStr(p.registeredDate) : '—';
  updateNotifStatus(p.notifAllowed ? 'Allowed ✅' : 'Disabled — Click Enable');
  document.getElementById('topUID').textContent = state.uid || '----';
}

function openEditProfile() {
  document.getElementById('editName').value = state.profile.name || '';
  document.getElementById('editWA').value   = state.profile.wa   || '';
  document.getElementById('editFB').value   = state.profile.fb   || '';
  document.getElementById('editProfilePopup').style.display = 'flex';
}

function closeEditProfile() {
  document.getElementById('editProfilePopup').style.display = 'none';
}

async function saveProfile() {
  const name = document.getElementById('editName').value.trim();
  const wa   = document.getElementById('editWA').value.trim();
  const fb   = document.getElementById('editFB').value.trim();

  state.profile.name = name;
  state.profile.wa   = wa;
  state.profile.fb   = fb;

  await db.ref(`users/${state.uid}/profile`).update({ name, wa, fb });
  closeEditProfile();
  renderProfile();
  showToast('✅ Profile আপডেট হয়েছে!');
}

/* ════════════════════════════════════════════════════════
   BROADCAST LISTENER
════════════════════════════════════════════════════════ */
function listenForBroadcast() {
  db.ref('broadcast/latest').on('value', snap => {
    if (!snap.exists()) return;
    const bc  = snap.val();
    const key = bc.id || bc.timestamp;
    if (state.seenBroadcast === key) return; // already shown
    state.seenBroadcast = key;

    document.getElementById('broadcastContent').textContent = bc.message || '';
    document.getElementById('broadcastTime').textContent    = bdTimeStr(bc.timestamp);
    document.getElementById('broadcastOverlay').style.display = 'flex';

    // Auto close after POPUP_AUTO_CLOSE ms
    setTimeout(closeBroadcast, POPUP_AUTO_CLOSE);

    // Report seen to admin
    try {
      fetch('/api/broadcast', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'seen', uid: state.uid, bcId: key })
      });
    } catch (_) {}
  });
}

/* ════════════════════════════════════════════════════════
   NEW CAPTION POPUP LISTENER
════════════════════════════════════════════════════════ */
function listenForNewCaption() {
  db.ref('captions').orderByChild('timestamp').limitToLast(1).on('child_added', snap => {
    const cap = snap.val();
    if (cap.addedBy === 'admin') {
      const shownKey = 'cithi_cap_seen_' + snap.key;
      if (localStorage.getItem(shownKey)) return;
      localStorage.setItem(shownKey, '1');

      document.getElementById('captionPopupContent').textContent = cap.text || '';
      document.getElementById('captionPopupTime').textContent    = bdTimeStr(cap.timestamp);
      document.getElementById('captionPopupOverlay').style.display = 'flex';
      setTimeout(closeCaptionPopup, POPUP_AUTO_CLOSE);
    }
  });
}

/* ════════════════════════════════════════════════════════
   ADS SYSTEM
════════════════════════════════════════════════════════ */
function initAds() {
  // Check DB for admin toggle
  db.ref('settings/adsEnabled').on('value', snap => {
    const enabled = snap.exists() ? snap.val() : true;
    state.adsEnabled = enabled;
    const adSection = document.getElementById('adSection');
    if (!adSection) return;

    if (!enabled) {
      adSection.style.display = 'none';
      return;
    }

    // Show ad with 30% chance on page load
    if (Math.random() > AD_SHOW_CHANCE) {
      adSection.style.display = 'none';
      return;
    }

    adSection.style.display = 'block';
    injectAdScript();
  });

  // Also show ad on button clicks (30% chance)
  document.addEventListener('click', (e) => {
    if (!state.adsEnabled) return;
    if (e.target.tagName === 'BUTTON' && Math.random() < AD_SHOW_CHANCE) {
      const adSection = document.getElementById('adSection');
      if (adSection) {
        adSection.style.display = 'block';
        injectAdScript();
      }
    }
  });
}

function injectAdScript() {
  // Only inject once per session
  if (window._adInjected) return;
  window._adInjected = true;
  const container = document.getElementById('adContainer');
  if (!container) return;

  // Ad options
  window.atOptions = {
    key:    'fe838c7a3a587438465d623ec79cf888',
    format: 'iframe',
    height: 50,
    width:  320,
    params: {}
  };

  const script = document.createElement('script');
  script.src   = 'https://www.highperformanceformat.com/fe838c7a3a587438465d623ec79cf888/invoke.js';
  script.async = true;
  container.appendChild(script);
}

/* ════════════════════════════════════════════════════════
   BAN CHECK
════════════════════════════════════════════════════════ */
function checkBan() {
  if (state.isBanned) {
    document.getElementById('mainApp').style.display  = 'none';
    document.getElementById('banScreen').style.display= 'flex';
    return true;
  }
  // Real-time ban listener
  db.ref(`users/${state.uid}/banned`).on('value', snap => {
    if (snap.val() === true) {
      document.getElementById('mainApp').style.display  = 'none';
      document.getElementById('banScreen').style.display= 'flex';
    }
  });
  return false;
}

/* ════════════════════════════════════════════════════════
   SERVICE WORKER REGISTRATION
════════════════════════════════════════════════════════ */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('SW registration failed:', err);
  }
}

/* ════════════════════════════════════════════════════════
   WEBSITE AUTO-UPDATE (version check)
════════════════════════════════════════════════════════ */
function listenForSiteUpdate() {
  db.ref('settings/version').on('value', snap => {
    if (!snap.exists()) return;
    const serverVer = snap.val();
    const localVer  = localStorage.getItem('cithi_version');
    if (localVer && localVer !== String(serverVer)) {
      localStorage.setItem('cithi_version', String(serverVer));
      // Reload to get latest version (preserving user data)
      location.reload(true);
    } else if (!localVer) {
      localStorage.setItem('cithi_version', String(serverVer));
    }
  });
}

/* ════════════════════════════════════════════════════════
   XSS PROTECTION HELPERS
════════════════════════════════════════════════════════ */
function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str || ''));
  return d.innerHTML;
}
function escapeAttr(str) {
  return (str || '').replace(/'/g, "&#39;").replace(/"/g, '&quot;');
}

/* ════════════════════════════════════════════════════════
   MAIN BOOT SEQUENCE
════════════════════════════════════════════════════════ */
async function boot() {
  // 1. Register Service Worker
  await registerServiceWorker();

  // 2. Init Firebase
  initFirebase();

  // 3. Show loading screen for LOADING_MS
  await new Promise(resolve => setTimeout(resolve, LOADING_MS));

  // 4. Init user (load or create)
  await initUser();

  // 5. Hide loading screen → show app
  const loadingEl = document.getElementById('loadingScreen');
  loadingEl.classList.add('hide');
  setTimeout(() => {
    loadingEl.style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
  }, 650);

  // 6. Ban check
  if (checkBan()) return;

  // 7. Start clock
  startClock();

  // 8. Floating emojis
  startFloatingEmojis();

  // 9. Render UID
  document.getElementById('topUID').textContent = state.uid;
  document.getElementById('pUID').textContent   = state.uid;
  renderProfile();

  // 10. Real-time listeners
  listenForReplies();
  listenForBroadcast();
  listenForNewCaption();
  listenForSiteUpdate();

  // 11. Ads
  initAds();

  // 12. Check if notification already granted
  if (Notification.permission === 'granted') {
    state.profile.notifAllowed = true;
    updateNotifStatus('Allowed ✅');
    subscribeUserToPush();
  }

  // 13. Update lastActive
  db.ref(`users/${state.uid}/lastActive`).set(Date.now());
}

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', boot);

/* ════════════════════════════════════════════════════════
   EXPOSE FUNCTIONS CALLED FROM HTML
════════════════════════════════════════════════════════ */
window.goHome               = goHome;
window.closeSection         = closeSection;
window.openReceived         = openReceived;
window.goToReply            = goToReply;
window.closeNotifPopup      = closeNotifPopup;
window.closeReplyPopup      = closeReplyPopup;
window.closeBroadcast       = closeBroadcast;
window.closeCaptionPopup    = closeCaptionPopup;
window.closeEditCaption     = closeEditCaption;
window.allowNotif           = allowNotif;
window.requestNotifPermission = requestNotifPermission;
window.openEditProfile      = openEditProfile;
window.closeEditProfile     = closeEditProfile;
window.saveProfile          = saveProfile;
window.addCaption           = addCaption;
window.copyCaption          = copyCaption;
window.openEditCaption      = openEditCaption;
window.saveEditCaption      = saveEditCaption;
window.deleteCaption        = deleteCaption;
window.sendMessage          = sendMessage;
