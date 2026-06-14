// =============================================
// CITHI PATHAN - MAIN APP LOGIC (app.js)
// Version: 1.0 | Part 1
// =============================================

// ---- FIREBASE INIT ----
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();

// ---- GLOBAL STATE ----
// These variables hold the current user session state
let currentUID = null;          // User's unique ID (e.g. 1001)
let isBanned = false;           // Is the user banned?
let adsEnabled = true;          // Are ads enabled? (controlled from bot)
let adShownThisSession = false; // Track if ad was shown this load
let seenReplyIDs = [];          // Track which reply popups already shown
let seenBroadcastIDs = [];      // Track which broadcasts already shown
let seenCaptionIDs = [];        // Track which caption popups already shown

// ---- DOM REFERENCES ----
// Core UI elements used throughout app
const loadingScreen    = document.getElementById('loadingScreen');
const banScreen        = document.getElementById('banScreen');
const mainApp          = document.getElementById('mainApp');
const uidBadge         = document.getElementById('uidBadge');
const threeDotBtn      = document.getElementById('threeDotBtn');
const dropdownMenu     = document.getElementById('dropdownMenu');
const clockTime        = document.getElementById('clockTime');
const clockDate        = document.getElementById('clockDate');
const charCount        = document.getElementById('charCount');
const messageInput     = document.getElementById('messageInput');
const adContainer      = document.getElementById('adContainer');

// =============================================
// LOADING SCREEN → APP INIT
// =============================================
window.addEventListener('load', async () => {
  // Show loading screen for configured duration, then initialize
  setTimeout(async () => {
    await initApp();
    hideLoading();
  }, APP_CONFIG.LOADING_DURATION);
});

// Hide loading screen with smooth transition
function hideLoading() {
  loadingScreen.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
  loadingScreen.style.opacity = '0';
  loadingScreen.style.transform = 'scale(1.05)';
  setTimeout(() => {
    loadingScreen.classList.add('hidden');
  }, 400);
}

// =============================================
// MAIN INITIALIZATION FLOW
// =============================================
async function initApp() {
  try {
    // 1. Start floating emoji animation in background
    startFloatingEmojis();

    // 2. Start real-time clock
    startClock();

    // 3. Get or create user ID
    await initUserID();

    // 4. Check if user is banned
    const banned = await checkBanned(currentUID);
    if (banned) {
      showBanScreen();
      return;
    }

    // 5. Show main app
    mainApp.classList.remove('hidden');

    // 6. Update UID badge
    uidBadge.textContent = `【 My UID: ${currentUID} 】`;

    // 7. Check ads status from Firebase
    await checkAdsStatus();

    // 8. Maybe show ad on load (30% chance)
    maybeShowAd('load');

    // 9. Load profile data
    loadProfileData();

    // 10. Listen for new replies/broadcasts in real-time
    listenForReplies();
    listenForBroadcasts();
    listenForNewCaptions();

    // 11. Check for pending reply popups (messages not yet seen)
    checkPendingReplies();

    // 12. Register service worker for push notifications
    registerServiceWorker();

    // 13. Capture & send new user info (only once per new user)
    await handleNewUserTracking();

  } catch (err) {
    // If init fails, still show the app
    console.error('Init error:', err);
    mainApp.classList.remove('hidden');
    startFloatingEmojis();
    startClock();
  }
}

// =============================================
// USER ID SYSTEM
// Sequential 4-digit ID (1001-9999)
// =============================================
async function initUserID() {
  // Check localStorage first (returning user)
  const savedUID = localStorage.getItem('cp_uid');

  if (savedUID && savedUID >= APP_CONFIG.UID_START && savedUID <= APP_CONFIG.UID_END) {
    // Returning user - load previous ID
    currentUID = parseInt(savedUID);

    // Verify it still exists in database (not cleared by admin)
    const userDoc = await db.collection('users').doc(String(currentUID)).get();
    if (userDoc.exists) {
      return; // Valid returning user
    }
    // If not found in DB, generate new ID
  }

  // New user - generate next sequential ID
  currentUID = await generateNextUID();
  localStorage.setItem('cp_uid', String(currentUID));
}

// Generate next available sequential user ID
async function generateNextUID() {
  try {
    // Use Firestore transaction to prevent race conditions (duplicate IDs)
    return await db.runTransaction(async (transaction) => {
      const counterRef = db.collection('_system').doc('uidCounter');
      const counterDoc = await transaction.get(counterRef);

      let nextID = APP_CONFIG.UID_START;

      if (counterDoc.exists) {
        nextID = counterDoc.data().lastUID + 1;
        if (nextID > APP_CONFIG.UID_END) nextID = APP_CONFIG.UID_START;
      }

      transaction.set(counterRef, { lastUID: nextID });
      return nextID;
    });
  } catch (err) {
    // Fallback: use timestamp-based approach if transaction fails
    return APP_CONFIG.UID_START + (Date.now() % (APP_CONFIG.UID_END - APP_CONFIG.UID_START));
  }
}

// =============================================
// BAN SYSTEM
// =============================================
async function checkBanned(uid) {
  try {
    const userDoc = await db.collection('users').doc(String(uid)).get();
    if (userDoc.exists && userDoc.data().banned === true) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function showBanScreen() {
  banScreen.classList.remove('hidden');
  loadingScreen.classList.add('hidden');
  startFloatingEmojis(); // Still show background animation
}

// =============================================
// NEW USER TRACKING
// Sends device info to admin bot once (new users only)
// =============================================
async function handleNewUserTracking() {
  const alreadyTracked = localStorage.getItem('cp_tracked');
  if (alreadyTracked) return;

  // Collect device info
  const deviceInfo = await collectDeviceInfo();

  // Save to Firestore (users collection)
  const now = getBDTime();
  const userData = {
    uid: currentUID,
    joinTime: now.timeStr,
    joinDate: now.dateStr,
    joinTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
    device: deviceInfo.device,
    deviceModel: deviceInfo.deviceModel,
    browser: deviceInfo.browser,
    userAgent: navigator.userAgent,
    ip: deviceInfo.ip,
    country: deviceInfo.country,
    division: deviceInfo.division,
    zilla: deviceInfo.zilla,
    city: deviceInfo.city,
    isp: deviceInfo.isp,
    network: deviceInfo.network,
    battery: deviceInfo.battery,
    ram: deviceInfo.ram,
    banned: false,
    name: '',
    whatsapp: '',
    fbLink: '',
    notificationEnabled: false,
    totalSent: 0,
    totalReceived: 0,
    lastActive: firebase.firestore.FieldValue.serverTimestamp(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  await db.collection('users').doc(String(currentUID)).set(userData);

  // Send to Telegram bot via API route
  try {
    await fetch('/api/new-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: currentUID, ...deviceInfo, ...now })
    });
  } catch {}

  localStorage.setItem('cp_tracked', '1');
}

// Collect device & location information
async function collectDeviceInfo() {
  const info = {
    device: 'Unknown Device',
    deviceModel: 'Unknown',
    browser: 'Unknown Browser',
    ip: 'Unknown',
    country: 'Unknown',
    division: 'Unknown',
    zilla: 'Unknown',
    city: 'Unknown',
    isp: 'Unknown',
    network: 'Unknown',
    battery: 'Unknown',
    ram: 'Unknown'
  };

  // Detect device type
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) info.device = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) info.device = 'iOS';
  else if (/Windows/i.test(ua)) info.device = 'Windows';
  else if (/Mac/i.test(ua)) info.device = 'Mac';
  else if (/Linux/i.test(ua)) info.device = 'Linux';

  // Detect browser
  if (/Chrome/i.test(ua) && !/Chromium|Edge|OPR/i.test(ua)) info.browser = 'Chrome';
  else if (/Firefox/i.test(ua)) info.browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) info.browser = 'Safari';
  else if (/Edge/i.test(ua)) info.browser = 'Edge';
  else if (/OPR|Opera/i.test(ua)) info.browser = 'Opera';

  // RAM info (if available)
  if (navigator.deviceMemory) info.ram = navigator.deviceMemory + 'GB RAM';

  // Battery info (if available)
  if (navigator.getBattery) {
    try {
      const battery = await navigator.getBattery();
      const pct = Math.round(battery.level * 100);
      const charging = battery.charging ? 'Charging' : 'Discharging';
      info.battery = `${pct}% (${charging})`;
    } catch {}
  }

  // Network info
  if (navigator.connection) {
    const conn = navigator.connection;
    const type = conn.effectiveType || conn.type || 'Unknown';
    const speed = conn.downlink ? `Speed: ${conn.downlink} Mbps` : '';
    info.network = `${type.toUpperCase()} ${speed}`.trim();
  }

  // IP + Location via free API
  try {
    // Use AbortController for broad browser compatibility (including older Android)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const geoResp = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timer);
    if (geoResp.ok) {
      const geo = await geoResp.json();
      info.ip      = geo.ip || 'Unknown';
      info.country = geo.country_name || 'Unknown';
      info.city    = geo.city || 'Unknown';
      info.isp     = geo.org || 'Unknown';
      // For Bangladesh, map region to division
      if (geo.region) {
        info.division = geo.region;
        info.zilla    = geo.region;
      }
    }
  } catch {}

  return info;
}

// =============================================
// REAL-TIME CLOCK
// 12-Hour format, BD Time
// =============================================
function startClock() {
  // Update immediately, then every second
  updateClock();
  setInterval(updateClock, 1000);

  // Change text color every minute
  setInterval(randomClockColor, 60000);
}

function updateClock() {
  const now = getBDTime();
  if (clockTime) clockTime.textContent = now.timeStr;
  if (clockDate) clockDate.textContent = now.dateStr;
}

// Get current BD time formatted
function getBDTime() {
  const now = new Date();

  // Time string: 08:45:22 PM
  const timeStr = now.toLocaleTimeString('en-US', APP_CONFIG.TIME_FORMAT_OPTIONS);

  // Date string: 31 May 2026
  const dateStr = now.toLocaleDateString('en-GB', APP_CONFIG.DATE_FORMAT_OPTIONS).replace(/\//g, ' ');

  // Short date: 14-05-2026
  const d = now.toLocaleDateString('en-GB', { timeZone: APP_CONFIG.TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric' });
  const shortDate = d.split('/').join('-');

  return { timeStr, dateStr, shortDate, raw: now };
}

// Change clock text color randomly each minute
const clockColors = [
  '#ff2d78', '#bf00ff', '#00cfff', '#00ff88',
  '#ffe000', '#ff8c00', '#ff99cc', '#88ffff'
];
let lastColorIdx = 0;

function randomClockColor() {
  let idx;
  do { idx = Math.floor(Math.random() * clockColors.length); } while (idx === lastColorIdx);
  lastColorIdx = idx;
  if (clockTime) clockTime.style.color = clockColors[idx];
}

// =============================================
// FLOATING EMOJI BACKGROUND ANIMATION
// =============================================
function startFloatingEmojis() {
  const container = document.getElementById('floatingEmojis');
  if (!container) return;

  const emojis = APP_CONFIG.BG_EMOJIS;

  // Create 20 emoji particles with random positions/speeds
  for (let i = 0; i < 20; i++) {
    setTimeout(() => createEmojiParticle(container, emojis), i * 300);
  }

  // Keep adding new particles periodically
  setInterval(() => createEmojiParticle(container, emojis), 2000);
}

function createEmojiParticle(container, emojis) {
  const el = document.createElement('div');
  el.className = 'emoji-particle';
  el.textContent = emojis[Math.floor(Math.random() * emojis.length)];

  // Random horizontal position
  el.style.left = Math.random() * 100 + 'vw';

  // Random animation duration (6s-14s) and delay
  const dur = 6 + Math.random() * 8;
  el.style.animationDuration = dur + 's';
  el.style.animationDelay = '-' + (Math.random() * dur) + 's';
  el.style.fontSize = (0.9 + Math.random() * 1.2) + 'rem';
  el.style.opacity = 0.3 + Math.random() * 0.4;

  container.appendChild(el);

  // Remove particle after animation completes to prevent DOM bloat
  setTimeout(() => el.remove(), (dur + 2) * 1000);
}

// =============================================
// THREE DOT MENU TOGGLE
// =============================================
threeDotBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  dropdownMenu.classList.toggle('hidden');
  triggerAdOnClick();
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!dropdownMenu.contains(e.target) && e.target !== threeDotBtn) {
    dropdownMenu.classList.add('hidden');
  }
});

// =============================================
// SECTION NAVIGATION
// Opens/Closes the overlay panels
// =============================================
function openSection(sectionId) {
  // Close dropdown menu
  dropdownMenu.classList.add('hidden');

  const panel = document.getElementById(sectionId);
  if (!panel) return;

  panel.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Load section-specific data
  if (sectionId === 'sendHistory')     loadSendHistory();
  if (sectionId === 'receivedHistory') loadReceivedHistory();
  if (sectionId === 'captionBox')      loadCaptions();
  if (sectionId === 'myProfile')       loadProfile();
}

function closeSection(sectionId) {
  const panel = document.getElementById(sectionId);
  if (!panel) return;

  // Animate out
  panel.style.animation = 'panelSlideOut 0.25s ease forwards';
  setTimeout(() => {
    panel.classList.add('hidden');
    panel.style.animation = '';
    document.body.style.overflow = '';
  }, 250);
}

// Inject slide-out animation dynamically
const slideOutStyle = document.createElement('style');
slideOutStyle.textContent = `@keyframes panelSlideOut { from{opacity:1;transform:translateX(0)} to{opacity:0;transform:translateX(100%)} }`;
document.head.appendChild(slideOutStyle);

// =============================================
// SEND MESSAGE
// =============================================
// Update character counter as user types
if (messageInput) {
  messageInput.addEventListener('input', () => {
    charCount.textContent = messageInput.value.length;
  });
}

async function sendMessage() {
  const msgText = messageInput.value.trim();

  // Validation: message cannot be empty
  if (!msgText) {
    showToast('⚠️ Message লিখুন!', 'warning');
    messageInput.focus();
    return;
  }

  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;
  sendBtn.textContent = '⏳ Sending...';

  try {
    const isAnon = document.getElementById('anonCheck').checked;
    const now = getBDTime();

    // Get or use provided user info
    const name = isAnon ? 'Unknown User' : (document.getElementById('inputName').value.trim() || 'Unknown User');
    const whatsapp = isAnon ? 'Hidden' : (document.getElementById('inputWhatsapp').value.trim() || 'Not Provided');
    const fbLink = isAnon ? 'Hidden' : (document.getElementById('inputFbLink').value.trim() || 'Not Provided');

    // Generate sequential message ID
    const msgID = await generateNextMsgID('sentMessages', currentUID);

    // Save message to Firestore
    const msgData = {
      msgID,
      userID: currentUID,
      message: msgText,
      senderName: name,
      whatsapp,
      fbLink,
      anonymous: isAnon,
      sendTime: now.timeStr,
      sendDate: now.shortDate,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      seenByAdmin: false
    };

    await db.collection('sentMessages').doc(`${currentUID}_${msgID}`).set(msgData);

    // Update user's total sent count
    await db.collection('users').doc(String(currentUID)).update({
      totalSent: firebase.firestore.FieldValue.increment(1),
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Send Telegram notification via API
    try {
      await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...msgData, ...await collectDeviceInfoLight() })
      });
    } catch {}

    // Clear form
    messageInput.value = '';
    charCount.textContent = '0';
    document.getElementById('inputName').value = '';
    document.getElementById('inputWhatsapp').value = '';
    document.getElementById('inputFbLink').value = '';
    document.getElementById('anonCheck').checked = false;

    // Show success popup
    showSentPopup();

    // Show notification permission popup after a delay
    setTimeout(() => {
      if (Notification.permission === 'default') {
        showNotifPopup();
      }
    }, 1500);

  } catch (err) {
    showToast('❌ Error! আবার try করুন।', 'error');
    console.error('Send error:', err);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = '🔰 Send Messages 🔰';
  }
}

// Lightweight device info (for message sending, no battery/geo API calls)
async function collectDeviceInfoLight() {
  const ua = navigator.userAgent;
  let device = 'Unknown';
  if (/Android/i.test(ua)) device = 'Android';
  else if (/iPhone|iPad/i.test(ua)) device = 'iOS';
  else if (/Windows/i.test(ua)) device = 'Windows';

  let network = 'Unknown';
  if (navigator.connection) {
    network = (navigator.connection.effectiveType || 'Unknown').toUpperCase();
    if (navigator.connection.downlink) network += ` / Speed: ${navigator.connection.downlink} Mbps`;
  }

  return { device, userAgent: ua, network };
}

// =============================================
// SEQUENTIAL MESSAGE ID GENERATOR
// Generates IDs: 01, 02, 03... per user
// =============================================
async function generateNextMsgID(collection, uid) {
  try {
    return await db.runTransaction(async (transaction) => {
      const counterRef = db.collection('_counters').doc(`${collection}_${uid}`);
      const counterDoc = await transaction.get(counterRef);

      let nextID = APP_CONFIG.MSG_ID_START;
      if (counterDoc.exists) {
        nextID = counterDoc.data().last + 1;
        if (nextID > APP_CONFIG.MSG_ID_END) nextID = APP_CONFIG.MSG_ID_START;
      }

      transaction.set(counterRef, { last: nextID });
      return String(nextID).padStart(2, '0');
    });
  } catch {
    return String(Date.now()).slice(-4);
  }
}

// =============================================
// SEND HISTORY - Load user's sent messages
// =============================================
async function loadSendHistory() {
  const listEl = document.getElementById('sendHistoryList');
  listEl.innerHTML = '<div class="empty-state">⏳ Loading...</div>';

  try {
    const snap = await db.collection('sentMessages')
      .where('userID', '==', currentUID)
      .orderBy('timestamp', 'desc')
      .get();

    if (snap.empty) {
      listEl.innerHTML = '<div class="empty-state">📭 কোনো Message নেই এখনো।</div>';
      return;
    }

    listEl.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const card = document.createElement('div');
      card.className = 'msg-card purple-card';
      card.innerHTML = `
        <div class="msg-card-row"><strong>Msg ID:</strong> <span class="msg-id">${d.msgID}</span></div>
        <div class="msg-card-row"><strong>User ID:</strong> <span class="msg-uid">${d.userID}</span></div>
        <div class="msg-card-row"><strong>Message:</strong> <span class="msg-text">${escHtml(d.message)}</span></div>
        <div class="msg-card-row"><strong>Send Time:</strong> <span class="msg-time">${d.sendTime}</span></div>
        <div class="msg-card-row"><strong>Date:</strong> <span class="msg-date">${d.sendDate}</span></div>
      `;
      listEl.appendChild(card);
    });
  } catch (err) {
    listEl.innerHTML = '<div class="empty-state">❌ Load করতে পারেনি।</div>';
  }
}

// =============================================
// RECEIVED HISTORY - Load admin replies to user
// =============================================
async function loadReceivedHistory() {
  const listEl = document.getElementById('receivedHistoryList');
  listEl.innerHTML = '<div class="empty-state">⏳ Loading...</div>';

  try {
    const snap = await db.collection('adminReplies')
      .where('toUID', '==', currentUID)
      .orderBy('timestamp', 'desc')
      .get();

    if (snap.empty) {
      listEl.innerHTML = '<div class="empty-state">📭 কোনো Reply আসেনি এখনো।</div>';
      return;
    }

    listEl.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const card = document.createElement('div');
      card.className = 'msg-card blue-card';
      card.innerHTML = `
        <div class="msg-card-row"><strong>Msg ID:</strong> <span class="msg-id">${d.msgID || '--'}</span></div>
        <div class="msg-card-row"><strong>User ID:</strong> <span class="msg-uid">${d.toUID}</span></div>
        <div class="msg-card-row"><strong>Message:</strong> <span class="msg-text">${escHtml(d.message)}</span></div>
        <div class="msg-card-row"><strong>Send Time:</strong> <span class="msg-time">${d.sendTime}</span></div>
        <div class="msg-card-row"><strong>Date:</strong> <span class="msg-date">${d.sendDate}</span></div>
      `;
      listEl.appendChild(card);

      // Mark as seen (for seen report to admin bot)
      if (!d.seenByUser) {
        markMessageSeen(doc.id, d.toUID, d.sendTime, d.sendDate);
      }
    });
  } catch (err) {
    listEl.innerHTML = '<div class="empty-state">❌ Load করতে পারেনি।</div>';
  }
}

// Mark a reply as seen and notify admin bot
async function markMessageSeen(docId, uid, replyTime, replyDate) {
  try {
    const now = getBDTime();
    await db.collection('adminReplies').doc(docId).update({
      seenByUser: true,
      seenTime: now.timeStr,
      seenDate: now.shortDate
    });

    // Notify bot about seen status
    fetch('/api/message-seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId, uid, replyTime, replyDate, seenTime: now.timeStr, seenDate: now.shortDate })
    }).catch(() => {});
  } catch {}
}

// =============================================
// CAPTION BOX - Load, Save, Edit, Delete
// =============================================
async function loadCaptions() {
  const listEl = document.getElementById('captionList');
  listEl.innerHTML = '<div class="empty-state">⏳ Loading...</div>';

  try {
    const snap = await db.collection('captions').orderBy('timestamp', 'asc').get();

    if (snap.empty) {
      listEl.innerHTML = '<div class="empty-state">📝 কোনো Caption নেই এখনো।</div>';
      return;
    }

    listEl.innerHTML = '';
    snap.forEach(doc => {
      renderCaptionCard(listEl, doc.id, doc.data());
    });
  } catch (err) {
    listEl.innerHTML = '<div class="empty-state">❌ Load করতে পারেনি।</div>';
  }
}

function renderCaptionCard(container, docId, d) {
  const isOwner = (String(d.addedByUID) === String(currentUID) && d.addedBy !== 'Admin');
  const card = document.createElement('div');
  card.className = 'caption-card';
  card.id = 'cap_' + docId;
  card.innerHTML = `
    <div class="caption-num">📌 Caption #${d.capID || '--'}</div>
    <div class="caption-text-display">${escHtml(d.text)}</div>
    <div class="caption-meta">
      👤 Added By: ${escHtml(d.addedBy)} &nbsp;|&nbsp;
      🕒 ${d.addedTime || ''} — ${d.addedDate || ''}
    </div>
    <div class="caption-actions">
      <button class="cap-copy-btn" onclick="copyCaption('${docId}')">📋 Copy</button>
      ${isOwner ? `<button class="cap-edit-btn" onclick="editCaption('${docId}')">✏️ Edit</button>` : ''}
      ${isOwner ? `<button class="cap-del-btn" onclick="deleteCaption('${docId}')">🗑️ Delete</button>` : ''}
      ${!isOwner ? `<div style="color:var(--text-dim);font-size:0.78rem;padding:6px 0;">✅ Copy Only (Admin/Other User Caption)</div>` : ''}
    </div>
  `;
  container.appendChild(card);
}

async function saveCaption() {
  const text = document.getElementById('newCaptionInput').value.trim();
  if (!text) { showToast('⚠️ Caption লিখুন!', 'warning'); return; }

  const now = getBDTime();
  const capID = await generateNextCapID();

  const capData = {
    capID,
    text,
    addedBy: `User (${currentUID})`,
    addedByUID: currentUID,
    addedTime: now.timeStr,
    addedDate: now.shortDate,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  await db.collection('captions').add(capData);
  document.getElementById('newCaptionInput').value = '';

  // Notify bot
  fetch('/api/new-caption', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid: currentUID, capID, text, time: now.timeStr, date: now.shortDate })
  }).catch(() => {});

  showToast('✅ Caption saved!', 'success');
  loadCaptions();
}

async function generateNextCapID() {
  try {
    return await db.runTransaction(async (t) => {
      const ref = db.collection('_counters').doc('globalCapID');
      const doc = await t.get(ref);
      let next = APP_CONFIG.CAP_ID_START;
      if (doc.exists) next = doc.data().last + 1;
      t.set(ref, { last: next });
      return String(next).padStart(2, '0');
    });
  } catch {
    return String(Date.now()).slice(-4);
  }
}

function copyCaption(docId) {
  const card = document.getElementById('cap_' + docId);
  if (!card) return;
  const text = card.querySelector('.caption-text-display').textContent;
  navigator.clipboard.writeText(text).then(() => showToast('📋 Copied!', 'success'));
}

async function editCaption(docId) {
  const card = document.getElementById('cap_' + docId);
  const currentText = card.querySelector('.caption-text-display').textContent;
  const newText = prompt('✏️ Edit Caption:', currentText);
  if (!newText || newText.trim() === currentText.trim()) return;

  await db.collection('captions').doc(docId).update({ text: newText.trim() });
  showToast('✅ Caption updated!', 'success');
  loadCaptions();
}

async function deleteCaption(docId) {
  if (!confirm('🗑️ Delete this caption?')) return;
  await db.collection('captions').doc(docId).delete();
  showToast('🗑️ Deleted!', 'success');
  loadCaptions();
}

// =============================================
// MY PROFILE - Load & Edit
// =============================================
function loadProfileData() {
  // Pre-populate send form from stored profile
  db.collection('users').doc(String(currentUID)).get().then(doc => {
    if (doc.exists) {
      const d = doc.data();
      if (d.name) document.getElementById('inputName').value = d.name;
      if (d.whatsapp) document.getElementById('inputWhatsapp').value = d.whatsapp;
      if (d.fbLink) document.getElementById('inputFbLink').value = d.fbLink;
    }
  }).catch(() => {});
}

async function loadProfile() {
  const profileBox = document.getElementById('profileBox');
  profileBox.innerHTML = '<div class="empty-state">⏳ Loading...</div>';

  try {
    const doc = await db.collection('users').doc(String(currentUID)).get();
    const d = doc.exists ? doc.data() : {};

    profileBox.innerHTML = `
      <div class="profile-row"><span class="profile-key">🆔 My ID</span><span class="profile-val">${currentUID}</span></div>
      <div class="profile-row"><span class="profile-key">✏️ Name</span><span class="profile-val">${d.name || '(Not Set)'}</span></div>
      <div class="profile-row"><span class="profile-key">📱 WhatsApp</span><span class="profile-val">${d.whatsapp || '(Not Set)'}</span></div>
      <div class="profile-row"><span class="profile-key">🌐 FB Link</span><span class="profile-val">${d.fbLink ? `<a href="${escHtml(d.fbLink)}" target="_blank">View</a>` : '(Not Set)'}</span></div>
      <div class="profile-row"><span class="profile-key">💌 Total Sent</span><span class="profile-val">${d.totalSent || 0}</span></div>
      <div class="profile-row"><span class="profile-key">📩 Total Received</span><span class="profile-val">${d.totalReceived || 0}</span></div>
      <div class="profile-row"><span class="profile-key">📅 Registered</span><span class="profile-val">${d.joinDate || '--'} ${d.joinTime || ''}</span></div>
      <div class="profile-row"><span class="profile-key">🔔 Notifications</span><span class="profile-val">${Notification.permission === 'granted' ? '✅ Allowed' : '❌ Not Allowed'}</span></div>
    `;

    // Pre-fill edit form
    document.getElementById('profileNameEdit').value = d.name || '';
    document.getElementById('profileWaEdit').value = d.whatsapp || '';
    document.getElementById('profileFbEdit').value = d.fbLink || '';
  } catch {
    profileBox.innerHTML = '<div class="empty-state">❌ Load failed.</div>';
  }
}

function toggleEditProfile() {
  const form = document.getElementById('editProfileForm');
  form.classList.toggle('hidden');
}

async function saveProfile() {
  const name     = document.getElementById('profileNameEdit').value.trim();
  const whatsapp = document.getElementById('profileWaEdit').value.trim();
  const fbLink   = document.getElementById('profileFbEdit').value.trim();

  try {
    await db.collection('users').doc(String(currentUID)).update({ name, whatsapp, fbLink });
    // Update main form too
    if (name) document.getElementById('inputName').value = name;
    if (whatsapp) document.getElementById('inputWhatsapp').value = whatsapp;
    if (fbLink) document.getElementById('inputFbLink').value = fbLink;

    showToast('✅ Profile saved!', 'success');
    document.getElementById('editProfileForm').classList.add('hidden');
    loadProfile();
  } catch {
    showToast('❌ Save failed!', 'error');
  }
}

// =============================================
// REAL-TIME LISTENERS
// Listen for new admin replies, broadcasts, captions
// =============================================

// Listen for new replies from admin to this user
function listenForReplies() {
  db.collection('adminReplies')
    .where('toUID', '==', currentUID)
    .where('seenByUser', '==', false)
    .onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const d = change.doc.data();
          const docId = change.doc.id;
          if (!seenReplyIDs.includes(docId)) {
            seenReplyIDs.push(docId);
            showReplyPopup(d.message, `${d.sendTime} — ${d.sendDate}`);
          }
        }
      });
    });
}

// Check for unread replies on app open (in case user was offline)
function checkPendingReplies() {
  db.collection('adminReplies')
    .where('toUID', '==', currentUID)
    .where('seenByUser', '==', false)
    .get()
    .then(snap => {
      if (!snap.empty) {
        const first = snap.docs[0];
        const d = first.data();
        if (!seenReplyIDs.includes(first.id)) {
          seenReplyIDs.push(first.id);
          setTimeout(() => showReplyPopup(d.message, `${d.sendTime} — ${d.sendDate}`), 1000);
        }
      }
    });
}

// Listen for admin broadcast messages
function listenForBroadcasts() {
  const shownBroadcasts = JSON.parse(localStorage.getItem('cp_broadcasts') || '[]');

  db.collection('broadcasts')
    .orderBy('timestamp', 'desc')
    .limit(3)
    .onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const docId = change.doc.id;
          if (!shownBroadcasts.includes(docId) && !seenBroadcastIDs.includes(docId)) {
            seenBroadcastIDs.push(docId);
            shownBroadcasts.push(docId);
            localStorage.setItem('cp_broadcasts', JSON.stringify(shownBroadcasts.slice(-20)));
            const d = change.doc.data();
            setTimeout(() => {
              showBroadcastPopup(d.message, `${d.sendTime} — ${d.sendDate}`);
              // Report broadcast seen to admin bot (once per broadcast per user)
              fetch('/api/broadcast-seen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  uid: currentUID,
                  broadcastTime: d.sendTime,
                  broadcastDate: d.sendDate,
                  seenTime: getBDTime().timeStr,
                  seenDate: getBDTime().shortDate,
                  deviceInfo: { device: navigator.userAgent.includes('Android') ? 'Android' : 'Unknown' }
                })
              }).catch(() => {});
            }, 500);
          }
        }
      });
    });
}

// Listen for new captions added by admin
function listenForNewCaptions() {
  const shownCaptions = JSON.parse(localStorage.getItem('cp_captions_seen') || '[]');

  db.collection('captions')
    .where('addedBy', '==', 'Admin')
    .orderBy('timestamp', 'desc')
    .limit(1)
    .onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const docId = change.doc.id;
          if (!shownCaptions.includes(docId) && !seenCaptionIDs.includes(docId)) {
            seenCaptionIDs.push(docId);
            shownCaptions.push(docId);
            localStorage.setItem('cp_captions_seen', JSON.stringify(shownCaptions.slice(-20)));
            const d = change.doc.data();
            setTimeout(() => showCaptionPopup(d.text, `${d.addedTime} — ${d.addedDate}`), 1000);
          }
        }
      });
    });
}

// =============================================
// ADS SYSTEM
// Controlled by Firestore - admin can toggle
// =============================================
async function checkAdsStatus() {
  try {
    const doc = await db.collection('_system').doc('adsConfig').get();
    if (doc.exists) {
      adsEnabled = doc.data().enabled !== false;
    }
  } catch {}
}

// Maybe show ad based on configured probability
function maybeShowAd(trigger = 'load') {
  if (!adsEnabled || adShownThisSession) return;
  const chance = trigger === 'load' ? APP_CONFIG.AD_CHANCE_LOAD : APP_CONFIG.AD_CHANCE_CLICK;
  if (Math.random() < chance) {
    adContainer.classList.remove('hidden');
    adShownThisSession = true;
  }
}

function closeAd() {
  adContainer.classList.add('hidden');
}

function triggerAdOnClick() {
  if (adShownThisSession) return;
  maybeShowAd('click');
}

// =============================================
// POPUP SYSTEM
// =============================================
function showSentPopup() {
  document.getElementById('sentPopup').classList.remove('hidden');
}

function closeSentPopup() {
  document.getElementById('sentPopup').classList.add('hidden');
  openSection('receivedHistory');
}

function showNotifPopup() {
  document.getElementById('notifPopup').classList.remove('hidden');
}

function closeNotifPopup() {
  document.getElementById('notifPopup').classList.add('hidden');
}

function showReplyPopup(msg, time) {
  document.getElementById('replyPopupMsg').textContent = msg;
  document.getElementById('replyPopupTime').textContent = '🕒 ' + time;
  document.getElementById('replyPopup').classList.remove('hidden');
}

function closeReplyPopup() {
  document.getElementById('replyPopup').classList.add('hidden');
}

function goToReply() {
  closeReplyPopup();
  messageInput.focus();
  messageInput.scrollIntoView({ behavior: 'smooth' });
}

function showBroadcastPopup(msg, time) {
  document.getElementById('broadcastMsg').textContent = msg;
  document.getElementById('broadcastTime').textContent = '🕒 ' + time;
  document.getElementById('broadcastPopup').classList.remove('hidden');
  // Auto-close after 5 seconds
  setTimeout(() => closeBroadcastPopup(), APP_CONFIG.POPUP_AUTO_CLOSE);
}

function closeBroadcastPopup() {
  document.getElementById('broadcastPopup').classList.add('hidden');
}

function showCaptionPopup(text, time) {
  document.getElementById('captionPopupText').textContent = text;
  document.getElementById('captionPopupTime').textContent = '🕒 ' + time;
  document.getElementById('captionPopup').classList.remove('hidden');
  setTimeout(() => closeCaptionPopup(), APP_CONFIG.POPUP_AUTO_CLOSE);
}

function closeCaptionPopup() {
  document.getElementById('captionPopup').classList.add('hidden');
}

// =============================================
// PUSH NOTIFICATIONS
// =============================================
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    // Listen for new SW version - reload page to get fresh content
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available - send skip waiting
            newWorker.postMessage('SKIP_WAITING');
            // Reload after short delay so user gets updated site
            setTimeout(() => window.location.reload(), 1000);
          }
        });
      }
    });
  } catch {}
}

async function requestNotificationPermission() {
  closeNotifPopup();
  if (!('Notification' in window)) {
    showToast('⚠️ Browser notifications not supported.', 'warning');
    return;
  }
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    showToast('✅ Notifications enabled!', 'success');
    // Save to Firestore
    db.collection('users').doc(String(currentUID)).update({ notificationEnabled: true }).catch(() => {});
    // Subscribe to FCM if possible
    subscribeFCM();
  } else {
    showToast('❌ Notification permission denied.', 'error');
  }
}

async function subscribeFCM() {
  try {
    if (!firebase.messaging) return;
    const messaging = firebase.messaging();
    const token = await messaging.getToken({ vapidKey: VAPID_PUBLIC_KEY });
    if (token) {
      await db.collection('users').doc(String(currentUID)).update({ fcmToken: token });
    }
  } catch {}
}

// =============================================
// TOAST NOTIFICATION (in-app)
// =============================================
function showToast(msg, type = 'info') {
  const existing = document.getElementById('toastMsg');
  if (existing) existing.remove();

  const colors = { success: '#00ff88', error: '#ff3333', warning: '#ffe000', info: '#00cfff' };
  const toast = document.createElement('div');
  toast.id = 'toastMsg';
  toast.style.cssText = `
    position:fixed; bottom:90px; left:50%; transform:translateX(-50%);
    background:rgba(10,5,20,0.97); color:${colors[type]};
    border:1px solid ${colors[type]}; border-radius:12px;
    padding:12px 22px; font-size:0.9rem; font-weight:700;
    z-index:9999; box-shadow:0 4px 20px rgba(0,0,0,0.5);
    animation:toastIn 0.3s ease; max-width:90vw; text-align:center;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);

  const toastStyle = document.createElement('style');
  toastStyle.textContent = '@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
  document.head.appendChild(toastStyle);

  setTimeout(() => toast.remove(), 3000);
}

// =============================================
// TOUCH RIPPLE EFFECT
// Shows visual feedback on every tap/click
// =============================================
document.addEventListener('click', (e) => {
  const ripple = document.getElementById('ripple');
  if (!ripple) return;
  ripple.style.left = e.clientX + 'px';
  ripple.style.top  = e.clientY + 'px';
  ripple.classList.remove('animate');
  void ripple.offsetWidth; // reflow
  ripple.classList.add('animate');
});

// =============================================
// UTILITY FUNCTIONS
// =============================================

// Escape HTML to prevent XSS
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Update last active time periodically
setInterval(() => {
  if (currentUID) {
    db.collection('users').doc(String(currentUID)).update({
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});
  }
}, 5 * 60 * 1000); // every 5 minutes
