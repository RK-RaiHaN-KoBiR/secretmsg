// ===== CONFIG (Hidden via server-side proxy - not exposed in client) =====
// All sensitive keys are handled through /api/ endpoints only

const SITE_URL = "https://cithipathao.vercel.app";

// ===== USER STATE =====
let userData = {};
let userCaptions = [];
let sendHistory = [];
let receiveHistory = [];
let seenPopups = {};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  initUser();
  loadFromCookies();
  renderCaptions();
  renderSendHistory();
  renderReceiveHistory();
  updateStats();
  setupCharCounter();
  checkNewReplies();
  loadAdminCaptions();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Check notification permission status
  if ('Notification' in window && Notification.permission === 'default') {
    document.getElementById('notifAllowWrap').style.display = 'block';
  }
});

// ===== USER ID GENERATION =====
function generateUserId() {
  let id = '';
  for (let i = 0; i < 4; i++) id += Math.floor(Math.random() * 10);
  return id;
}

function initUser() {
  let uid = getCookie('userId');
  if (!uid) {
    uid = generateUserId();
    // Ensure uniqueness (basic)
    uid = uid + Math.floor(Math.random() * 100);
    setCookie('userId', uid, 36500); // ~100 years
    // New user alert after 3s
    setTimeout(() => sendNewUserAlert(), 3000);
  }
  userData.userId = uid;
  document.getElementById('displayUserId').textContent = uid;
  document.getElementById('profileUserId').textContent = uid;
}

// ===== COOKIE HELPERS =====
function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name) {
  const c = document.cookie.split(';').find(c => c.trim().startsWith(name + '='));
  return c ? decodeURIComponent(c.trim().split('=')[1]) : null;
}

function deleteCookie(name) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
}

// ===== LOAD FROM COOKIES =====
function loadFromCookies() {
  try {
    const sh = getCookie('sendHistory');
    if (sh) sendHistory = JSON.parse(decodeURIComponent(sh));
  } catch(e) { sendHistory = []; }

  try {
    const rh = getCookie('receiveHistory');
    if (rh) receiveHistory = JSON.parse(decodeURIComponent(rh));
  } catch(e) { receiveHistory = []; }

  try {
    const uc = getCookie('userCaptions');
    if (uc) userCaptions = JSON.parse(decodeURIComponent(uc));
  } catch(e) { userCaptions = []; }

  try {
    const sp = getCookie('seenPopups');
    if (sp) seenPopups = JSON.parse(decodeURIComponent(sp));
  } catch(e) { seenPopups = {}; }

  // Profile
  const name = getCookie('profileName') || '';
  const phone = getCookie('profilePhone') || '';
  const fb = getCookie('profileFb') || '';
  document.getElementById('profileName').value = name;
  document.getElementById('profilePhone').value = phone;
  document.getElementById('profileFb').value = fb;

  // Pre-fill sender fields
  if (name) document.getElementById('senderName').value = name;
  if (phone) document.getElementById('senderPhone').value = phone;
  if (fb) document.getElementById('senderFb').value = fb;
}

function saveToHistory(type, msg, time) {
  if (type === 'send') {
    sendHistory.unshift({ msg, time });
    if (sendHistory.length > 50) sendHistory = sendHistory.slice(0, 50);
    setCookie('sendHistory', encodeURIComponent(JSON.stringify(sendHistory)), 36500);
  } else {
    receiveHistory.unshift({ msg, time });
    if (receiveHistory.length > 50) receiveHistory = receiveHistory.slice(0, 50);
    setCookie('receiveHistory', encodeURIComponent(JSON.stringify(receiveHistory)), 36500);
  }
}

// ===== CHAR COUNTER =====
function setupCharCounter() {
  const ta = document.getElementById('msgInput');
  ta.addEventListener('input', () => {
    document.getElementById('charCount').textContent = ta.value.length;
  });
}

// ===== HOME TOGGLE =====
function toggleHome() {
  const d = document.getElementById('homeDropdown');
  d.style.display = d.style.display === 'none' ? 'block' : 'none';
}

function showSection(id) {
  const panels = ['sendHistory','receiveHistory','captionBox','profile','helpSection'];
  panels.forEach(p => {
    document.getElementById(p).style.display = 'none';
  });
  document.getElementById(id).style.display = 'block';
  document.getElementById('homeDropdown').style.display = 'none';

  // Render contents
  if (id === 'sendHistory') renderSendHistory();
  if (id === 'receiveHistory') renderReceiveHistory();
  if (id === 'captionBox') renderCaptions();

  // Scroll to section
  setTimeout(() => {
    document.getElementById(id).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function closeSection(id) {
  document.getElementById(id).style.display = 'none';
}

// ===== RENDER HISTORIES =====
function renderSendHistory() {
  const list = document.getElementById('sendHistoryList');
  if (!sendHistory.length) {
    list.innerHTML = '<div class="empty-msg">💬 এখনো কোনো মেসেজ পাঠাননি।</div>';
    return;
  }
  list.innerHTML = sendHistory.map(item => `
    <div class="history-item">
      <div class="h-time">📅 ${item.time}</div>
      <div class="h-msg">💌 ${escHtml(item.msg)}</div>
    </div>
  `).join('');
}

function renderReceiveHistory() {
  const list = document.getElementById('receiveHistoryList');
  if (!receiveHistory.length) {
    list.innerHTML = '<div class="empty-msg">📭 এখনো কোনো reply আসেনি।</div>';
    return;
  }
  list.innerHTML = receiveHistory.map(item => `
    <div class="history-item received">
      <div class="h-time">📅 ${item.time}</div>
      <div class="h-msg">💬 ${escHtml(item.msg)}</div>
    </div>
  `).join('');
}

// ===== CAPTIONS =====
const defaultCaptions = [
  '╔══════════════╗\n✨ "আল্লাহর উপর ভরসা রাখুন,\nতিনি কখনো নিরাশ করেন না।" ✨\n╚══════════════╝',
  '╔══════════════╗\n🌙 "নামাজ হলো শান্তির চাবিকাঠি।" 🌙\n╚══════════════╝',
  '╔══════════════╗\n🤍 "যে হৃদয়ে কুরআন আছে,\nসে হৃদয় কখনো অন্ধকার নয়।" 🤍\n╚══════════════╝',
  '╔══════════════╗\n✨ "সবর করুন,\nআল্লাহ সবচেয়ে সুন্দর সময়টাই বেছে রাখেন।" ✨\n╚══════════════╝',
  '╔══════════════╗\n🌸 "দুনিয়া ক্ষণস্থায়ী,\nআখিরাত চিরস্থায়ী।" 🌸\n╚══════════════╝',
  '╔══════════════╗\n🕋 "আল্লাহর স্মরণেই\nঅন্তর প্রশান্তি পায়।" 🕋\n╚══════════════╝',
  '╔══════════════╗\n🌙 "প্রতিটি কষ্টের পরেই\nরয়েছে স্বস্তি।" 🌙\n╚══════════════╝',
  '╔══════════════╗\n🤲 "দোয়া কখনো বৃথা যায় না।" 🤲\n╚══════════════╝',
  '╔══════════════╗\n✨ "পাপ যত বড়ই হোক,\nআল্লাহর রহমত তার চেয়েও বড়।" ✨\n╚══════════════╝',
  '╔══════════════╗\n🌸 "ভালোবাসা চাইলে\nআল্লাহর কাছেই চান।" 🌸\n╚══════════════╝'
];

let adminCaptions = [];

async function loadAdminCaptions() {
  try {
    const r = await fetch('/api/captions');
    if (r.ok) {
      const d = await r.json();
      if (d.captions) adminCaptions = d.captions;
      renderCaptions();
    }
  } catch(e) {}
}

function renderCaptions() {
  const list = document.getElementById('captionList');
  if (!list) return;

  const allCaps = [...defaultCaptions, ...adminCaptions];
  const userCaps = [...userCaptions];

  let html = '';

  // Default/Admin captions
  allCaps.forEach((cap, i) => {
    html += `
    <div class="caption-item">
      <div class="caption-text">${escHtml(cap)}</div>
      <div class="caption-meta">📅 Default Caption</div>
      <div class="caption-actions">
        <button class="cap-btn copy" onclick="copyCap(${i})">📋 Copy</button>
      </div>
    </div>`;
  });

  // User saved captions
  userCaps.forEach((cap, i) => {
    html += `
    <div class="caption-item">
      <div class="caption-text">${escHtml(cap.text)}</div>
      <div class="caption-meta">📅 ${cap.time}</div>
      <div class="caption-actions">
        <button class="cap-btn copy" onclick="copyUserCap(${i})">📋 Copy</button>
        <button class="cap-btn edit" onclick="editUserCap(${i})">✏️ Edit</button>
        <button class="cap-btn del" onclick="delUserCap(${i})">🗑️ Delete</button>
      </div>
    </div>`;
  });

  list.innerHTML = html || '<div class="empty-msg">কোনো caption নেই।</div>';
}

const allDefaultCaps = [...defaultCaptions];

function copyCap(i) {
  const all = [...defaultCaptions, ...adminCaptions];
  navigator.clipboard.writeText(all[i]).then(() => showToast('📋 Copied!')).catch(() => {});
}

function copyUserCap(i) {
  navigator.clipboard.writeText(userCaptions[i].text).then(() => showToast('📋 Copied!')).catch(() => {});
}

function editUserCap(i) {
  const newText = prompt('✏️ Caption Edit করুন:', userCaptions[i].text);
  if (newText !== null && newText.trim()) {
    userCaptions[i].text = newText.trim();
    userCaptions[i].time = nowStr();
    setCookie('userCaptions', encodeURIComponent(JSON.stringify(userCaptions)), 36500);
    sendUserCaptionToBot(newText.trim(), 'edited');
    renderCaptions();
  }
}

function delUserCap(i) {
  if (confirm('🗑️ এই caption মুছে ফেলবেন?')) {
    userCaptions.splice(i, 1);
    setCookie('userCaptions', encodeURIComponent(JSON.stringify(userCaptions)), 36500);
    renderCaptions();
  }
}

async function addUserCaption() {
  const inp = document.getElementById('newCaptionInput');
  const text = inp.value.trim();
  if (!text) { showToast('⚠️ Caption লিখুন!'); return; }

  const cap = { text, time: nowStr() };
  userCaptions.unshift(cap);
  setCookie('userCaptions', encodeURIComponent(JSON.stringify(userCaptions)), 36500);
  inp.value = '';
  renderCaptions();
  showToast('✅ Caption Save হয়েছে!');

  // Send to admin bot
  await sendUserCaptionToBot(text, 'new');
}

async function sendUserCaptionToBot(text, action) {
  try {
    await fetch('/api/caption-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userData.userId,
        text,
        action,
        time: nowStr()
      })
    });
  } catch(e) {}
}

// ===== PROFILE =====
function saveProfile() {
  const name = document.getElementById('profileName').value.trim();
  const phone = document.getElementById('profilePhone').value.trim();
  const fb = document.getElementById('profileFb').value.trim();

  setCookie('profileName', name, 36500);
  setCookie('profilePhone', phone, 36500);
  setCookie('profileFb', fb, 36500);

  // Update send form too
  if (name) document.getElementById('senderName').value = name;
  if (phone) document.getElementById('senderPhone').value = phone;
  if (fb) document.getElementById('senderFb').value = fb;

  showToast('✅ Profile Save হয়েছে!');
}

// ===== STATS =====
function updateStats() {
  document.getElementById('totalSend').textContent = sendHistory.length;
  document.getElementById('totalReceive').textContent = receiveHistory.length;
}

// ===== SEND MESSAGE =====
async function sendMessage() {
  const msg = document.getElementById('msgInput').value.trim();
  if (!msg) { showToast('⚠️ মেসেজ লিখুন!'); return; }

  const isAnon = document.getElementById('anonCheck').checked;
  const name = isAnon ? 'Unknown User' : (document.getElementById('senderName').value.trim() || 'Anonymous');
  const phone = isAnon ? 'Hidden' : (document.getElementById('senderPhone').value.trim() || 'N/A');
  const fb = isAnon ? 'Hidden' : (document.getElementById('senderFb').value.trim() || 'N/A');

  const btn = document.querySelector('.send-btn');
  const btnText = document.querySelector('.send-btn-text');
  const loader = document.getElementById('sendLoader');

  btn.disabled = true;
  btnText.style.display = 'none';
  loader.style.display = 'inline';

  const time = nowStr();

  try {
    // Collect device info
    const devInfo = await getDeviceInfo();

    const payload = {
      userId: userData.userId,
      name,
      phone,
      fb,
      message: msg,
      time,
      anon: isAnon,
      deviceInfo: devInfo
    };

    const r = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (r.ok) {
      // Save to history
      saveToHistory('send', msg, time);
      renderSendHistory();
      updateStats();

      document.getElementById('msgInput').value = '';
      document.getElementById('charCount').textContent = '0';

      // Show success popup
      document.getElementById('successTime').textContent = '📅 ' + time;
      showPopup('successPopup');

      // Ask notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        setTimeout(() => showPopup('notifPopup'), 800);
      }
    } else {
      showToast('❌ মেসেজ পাঠাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
  } catch(e) {
    showToast('❌ Network Error। আবার চেষ্টা করুন।');
  }

  btn.disabled = false;
  btnText.style.display = 'inline';
  loader.style.display = 'none';
}

// ===== NEW USER ALERT =====
async function sendNewUserAlert() {
  try {
    const devInfo = await getDeviceInfo();
    await fetch('/api/new-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userData.userId,
        time: nowStr(),
        deviceInfo: devInfo
      })
    });
  } catch(e) {}
}

// ===== DEVICE INFO =====
async function getDeviceInfo() {
  const info = {};

  info.userAgent = navigator.userAgent;
  info.platform = navigator.platform || 'Unknown';
  info.language = navigator.language;
  info.screenRes = `${screen.width}x${screen.height}`;
  info.charging = 'Unknown';
  info.network = navigator.connection ? (navigator.connection.effectiveType || 'Unknown') : 'Unknown';

  // Battery
  if (navigator.getBattery) {
    try {
      const b = await navigator.getBattery();
      info.charging = b.charging ? `Charging (${Math.round(b.level * 100)}%)` : `${Math.round(b.level * 100)}%`;
    } catch(e) {}
  }

  // IP & Location from API
  try {
    const ipR = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (ipR.ok) {
      const ipData = await ipR.json();
      info.ip = ipData.ip || 'N/A';
      info.country = ipData.country_name || 'N/A';
      info.region = ipData.region || 'N/A';
      info.city = ipData.city || 'N/A';
      info.isp = ipData.org || 'N/A';
    }
  } catch(e) {
    info.ip = 'N/A';
    info.country = 'N/A';
    info.region = 'N/A';
    info.city = 'N/A';
    info.isp = 'N/A';
  }

  // RAM
  info.ram = navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'Unknown';

  // Device model from UA
  const ua = navigator.userAgent;
  let model = 'Unknown';
  const mMatch = ua.match(/\(([^)]+)\)/);
  if (mMatch) model = mMatch[1].split(';')[0].trim();
  info.deviceModel = model;

  return info;
}

// ===== CHECK REPLIES =====
async function checkNewReplies() {
  try {
    const r = await fetch(`/api/replies?userId=${userData.userId}`);
    if (r.ok) {
      const d = await r.json();
      if (d.replies && d.replies.length) {
        d.replies.forEach(reply => {
          const key = `reply_${reply.id}`;
          if (!seenPopups[key]) {
            seenPopups[key] = true;
            setCookie('seenPopups', encodeURIComponent(JSON.stringify(seenPopups)), 36500);

            // Save to receive history
            saveToHistory('receive', reply.message, reply.time);
            renderReceiveHistory();
            updateStats();

            // Show popup (only once)
            document.getElementById('replyMsgContent').innerHTML = `
              <div><b>📅 Time:</b> ${escHtml(reply.time)}</div>
              <div style="margin-top:8px"><b>💬 Message From Admin:</b></div>
              <div style="margin-top:4px">${escHtml(reply.message)}</div>
            `;
            showPopup('replyPopup');

            // Push notification
            showPushNotification('💌 নতুন Reply এসেছে!', reply.message);

            // Mark as seen
            fetch('/api/mark-seen', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: userData.userId, replyId: reply.id, time: nowStr() })
            }).catch(() => {});
          }
        });
      }
    }
  } catch(e) {}

  // Check every 30s
  setTimeout(checkNewReplies, 30000);
}

// ===== NOTIFICATIONS =====
async function requestNotification() {
  if (!('Notification' in window)) {
    showToast('❌ এই browser-এ Notification support নেই।');
    closePopup('notifPopup');
    return;
  }

  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    showToast('✅ Notification Allow হয়েছে!');
    closePopup('notifPopup');

    // Subscribe to push if SW available
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        // Store subscription via API
        await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userData.userId })
        });
      } catch(e) {}
    }

    document.getElementById('notifAllowWrap').style.display = 'none';
  } else {
    showToast('⚠️ Notification allow করা হয়নি।');
    closePopup('notifPopup');
  }
}

function showPushNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body.substring(0, 100),
        icon: '/icon.png',
        badge: '/icon.png',
        tag: 'secret-msg-reply'
      });
    } catch(e) {}
  }
}

// ===== POPUP HELPERS =====
function showPopup(id) {
  document.getElementById(id).style.display = 'flex';
}

function closePopup(id) {
  document.getElementById(id).style.display = 'none';
}

function goToReceived() {
  closePopup('successPopup');
  closePopup('replyPopup');
  showSection('receiveHistory');
}

// ===== TOAST =====
function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  t.style.cssText = `
    position:fixed;bottom:30px;left:50%;transform:translateX(-50%);
    background:linear-gradient(90deg,#7c3aed,#ec4899);
    color:#fff;padding:10px 20px;border-radius:30px;
    font-size:0.85rem;font-weight:700;z-index:99999;
    box-shadow:0 4px 20px rgba(124,58,237,0.5);
    font-family:'Hind Siliguri',sans-serif;
    animation:fadeIn 0.3s ease;
    white-space:nowrap;max-width:90vw;text-align:center;
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ===== UTILS =====
function nowStr() {
  return new Date().toLocaleString('bn-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

// ===== SERVICE WORKER MESSAGE LISTENER =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'NEW_REPLY') {
      checkNewReplies();
    }
  });
}
