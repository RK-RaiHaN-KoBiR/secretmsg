// ===== CHITHI PATHAO — FRONTEND APP =====
'use strict';

const CONFIG = {
  API_BASE: '/api',
  BD_TZ: 'Asia/Dhaka'
};

// ===== STATE =====
let userId = null;
let seenPopups = JSON.parse(localStorage.getItem('cp_seen_popups') || '{}');
let profile = JSON.parse(localStorage.getItem('cp_profile') || '{}');
let pollInterval = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  createParticles();
  setupCharCounter();
  await initUser();
  await checkBanStatus();
  await checkPendingPopups();
  startPolling();
  registerServiceWorker();
});

// ===== PARTICLES =====
function createParticles() {
  const container = document.getElementById('bgParticles');
  const colors = ['rgba(180,127,255,0.5)','rgba(255,110,180,0.4)','rgba(92,240,255,0.3)','rgba(255,209,102,0.3)'];
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 2;
    p.style.cssText = `
      width:${size}px;height:${size}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      left:${Math.random()*100}%;
      animation-duration:${Math.random()*15+10}s;
      animation-delay:${Math.random()*10}s;
    `;
    container.appendChild(p);
  }
}

// ===== CHAR COUNTER =====
function setupCharCounter() {
  const ta = document.getElementById('msgInput');
  const cc = document.getElementById('charCount');
  if (ta && cc) {
    ta.addEventListener('input', () => { cc.textContent = ta.value.length; });
  }
}

// ===== USER ID SYSTEM =====
async function initUser() {
  userId = localStorage.getItem('cp_user_id');
  if (!userId) {
    // Register new user
    const deviceInfo = await collectDeviceInfo();
    try {
      const res = await fetch(`${CONFIG.API_BASE}/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', deviceInfo })
      });
      const data = await res.json();
      if (data.userId) {
        userId = data.userId;
        localStorage.setItem('cp_user_id', userId);
        // Set registered date
        if (!profile.registeredDate) {
          profile.registeredDate = getBDTimeString();
          localStorage.setItem('cp_profile', JSON.stringify(profile));
        }
        showUserIdToast(userId);
        // Send new user notification to bot (background)
        sendNewUserAlert(deviceInfo, userId);
      }
    } catch (e) {
      // Fallback: generate local ID
      userId = String(Math.floor(Math.random() * 8999) + 1001);
      localStorage.setItem('cp_user_id', userId);
      showUserIdToast(userId);
    }
  } else {
    showUserIdToast(userId);
  }
}

async function checkBanStatus() {
  if (!userId) return;
  try {
    const res = await fetch(`${CONFIG.API_BASE}/user?action=checkBan&userId=${userId}`);
    const data = await res.json();
    if (data.banned) {
      document.getElementById('banScreen').classList.remove('hidden');
    }
  } catch (e) {}
}

function showUserIdToast(id) {
  const toast = document.getElementById('userIdToast');
  const span = document.getElementById('toastUserId');
  if (toast && span) {
    span.textContent = id;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 5000);
  }
}

// ===== DEVICE INFO =====
async function collectDeviceInfo() {
  const info = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    deviceMemory: navigator.deviceMemory || 'Unknown',
    hardwareConcurrency: navigator.hardwareConcurrency || 'Unknown',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    online: navigator.onLine,
    timestamp: getBDTimeString()
  };

  // Network info
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    info.networkType = conn.effectiveType || conn.type || 'Unknown';
  }

  // Battery
  if (navigator.getBattery) {
    try {
      const bat = await navigator.getBattery();
      info.batteryLevel = Math.round(bat.level * 100) + '%';
      info.charging = bat.charging ? 'Charging ⚡' : 'Not Charging 🔋';
    } catch (e) {}
  }

  // IP & Location
  try {
    const r = await fetch('https://ipapi.co/json/');
    const d = await r.json();
    info.ip = d.ip; info.country = d.country_name;
    info.region = d.region; info.city = d.city; info.isp = d.org;
  } catch (e) {}

  return info;
}

async function sendNewUserAlert(deviceInfo, uid) {
  try {
    await fetch(`${CONFIG.API_BASE}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'newUserAlert', userId: uid, deviceInfo })
    });
  } catch (e) {}
}

// ===== SEND MESSAGE =====
async function sendMessage() {
  const msg = document.getElementById('msgInput').value.trim();
  if (!msg) { showToast('⚠️ Please write a message first!', 'error'); return; }

  const isAnon = document.getElementById('anonCheck').checked;
  const name = isAnon ? 'Unknown User' : (document.getElementById('senderName').value.trim() || 'Unknown User');
  const wa = isAnon ? 'Hidden' : (document.getElementById('senderWa').value.trim() || 'Not Provided');
  const fb = isAnon ? 'Hidden' : (document.getElementById('senderFb').value.trim() || 'Not Added');

  const deviceInfo = await collectDeviceInfo();

  try {
    const res = await fetch(`${CONFIG.API_BASE}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId, name, wa, fb, message: msg, anonymous: isAnon, deviceInfo
      })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('msgInput').value = '';
      document.getElementById('charCount').textContent = '0';
      showPopup('sendSuccessPopup');

      // Increment sent count in profile
      profile.totalSend = (parseInt(profile.totalSend) || 0) + 1;
      localStorage.setItem('cp_profile', JSON.stringify(profile));

      // Request notification
      setTimeout(() => {
        if (Notification.permission === 'default') showPopup('notifPopup');
      }, 1500);
    }
  } catch (e) {
    showToast('❌ Failed to send. Please try again.', 'error');
  }
}

// ===== HOME MENU =====
function toggleHomeMenu() {
  const menu = document.getElementById('homeMenu');
  menu.classList.toggle('hidden');
}
function closeHomeMenu() {
  document.getElementById('homeMenu').classList.add('hidden');
}

function openHome(section) {
  closeHomeMenu();
  const panelOverlay = document.getElementById('panelOverlay');
  const panels = ['sendPanel','receivedPanel','captionPanel','profilePanel','helpPanel'];
  panels.forEach(p => document.getElementById(p).classList.add('hidden'));
  panelOverlay.classList.remove('hidden');

  const map = { send:'sendPanel', received:'receivedPanel', caption:'captionPanel', profile:'profilePanel', help:'helpPanel' };
  const target = map[section];
  if (target) {
    document.getElementById(target).classList.remove('hidden');
    loadSectionData(section);
  }
}

function closePanel() {
  document.getElementById('panelOverlay').classList.add('hidden');
}

// ===== LOAD SECTION DATA =====
async function loadSectionData(section) {
  if (section === 'send') await loadSendHistory();
  else if (section === 'received') await loadReceivedHistory();
  else if (section === 'caption') await loadCaptions();
  else if (section === 'profile') loadProfile();
}

async function loadSendHistory() {
  const list = document.getElementById('sendHistoryList');
  list.innerHTML = '<p class="empty-msg">Loading...</p>';
  try {
    const res = await fetch(`${CONFIG.API_BASE}/send?userId=${userId}&action=history`);
    const data = await res.json();
    if (!data.messages || data.messages.length === 0) {
      list.innerHTML = '<p class="empty-msg">কোনো Message পাওয়া যায়নি।</p>'; return;
    }
    list.innerHTML = '';
    data.messages.forEach(m => {
      list.appendChild(createMsgCard(m, 'send'));
    });
  } catch (e) {
    list.innerHTML = '<p class="empty-msg">Data load করা যায়নি।</p>';
  }
}

async function loadReceivedHistory() {
  const list = document.getElementById('receivedHistoryList');
  list.innerHTML = '<p class="empty-msg">Loading...</p>';
  try {
    const res = await fetch(`${CONFIG.API_BASE}/send?userId=${userId}&action=received`);
    const data = await res.json();
    if (!data.messages || data.messages.length === 0) {
      list.innerHTML = '<p class="empty-msg">কোনো Reply পাওয়া যায়নি।</p>'; return;
    }
    list.innerHTML = '';
    data.messages.forEach(m => {
      list.appendChild(createMsgCard(m, 'received'));

      // Mark seen
      if (!seenPopups['seen_' + m.id]) {
        seenPopups['seen_' + m.id] = true;
        localStorage.setItem('cp_seen_popups', JSON.stringify(seenPopups));
        reportSeen(m.id);
      }
    });
    // Update receive count
    profile.totalReceive = data.messages.length;
    localStorage.setItem('cp_profile', JSON.stringify(profile));
  } catch (e) {
    list.innerHTML = '<p class="empty-msg">Data load করা যায়নি।</p>';
  }
}

function createMsgCard(m, type) {
  const div = document.createElement('div');
  div.className = 'msg-card';
  div.innerHTML = `
    <div class="msg-card-row"><span class="msg-card-label">Msg ID:</span><span class="msg-card-value">${m.msgId || m.id}</span></div>
    <div class="msg-card-row"><span class="msg-card-label">User ID:</span><span class="msg-card-value">${userId}</span></div>
    <div class="msg-card-row"><span class="msg-card-label">Message:</span><span class="msg-card-value msg-card-text">${escHtml(m.message)}</span></div>
    <div class="msg-card-row"><span class="msg-card-label">${type==='send'?'Send':'Receive'} Time:</span><span class="msg-card-value" style="color:#5cf0ff;font-size:.82rem;">${m.time || '—'}</span></div>
  `;
  return div;
}

async function reportSeen(msgId) {
  try {
    await fetch(`${CONFIG.API_BASE}/send`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'seen', userId, msgId })
    });
  } catch(e){}
}

// ===== CAPTIONS =====
async function loadCaptions() {
  const adminList = document.getElementById('captionListAdmin');
  const userList = document.getElementById('captionListUser');
  adminList.innerHTML = '';
  userList.innerHTML = '';
  try {
    const res = await fetch(`${CONFIG.API_BASE}/caption?userId=${userId}`);
    const data = await res.json();

    const adminCaptions = (data.captions || []).filter(c => c.addedBy === 'admin');
    const userCaptions = (data.captions || []).filter(c => c.addedBy === userId);

    if (adminCaptions.length > 0) {
      const h = document.createElement('p');
      h.style.cssText = 'color:#ffd166;font-size:.82rem;margin-bottom:8px;font-weight:600;';
      h.textContent = '👑 Admin Captions';
      adminList.appendChild(h);
      adminCaptions.forEach(c => adminList.appendChild(createCaptionCard(c, false)));
    }

    if (userCaptions.length > 0) {
      const h = document.createElement('p');
      h.style.cssText = 'color:#06d6a0;font-size:.82rem;margin:12px 0 8px;font-weight:600;';
      h.textContent = '✏️ My Captions';
      userList.appendChild(h);
      userCaptions.forEach(c => userList.appendChild(createCaptionCard(c, true)));
    }

    if (adminCaptions.length === 0 && userCaptions.length === 0) {
      adminList.innerHTML = '<p class="empty-msg">কোনো Caption পাওয়া যায়নি।</p>';
    }
  } catch (e) {
    adminList.innerHTML = '<p class="empty-msg">Caption load করা যায়নি।</p>';
  }
}

function createCaptionCard(c, isOwn) {
  const div = document.createElement('div');
  div.className = `caption-card ${isOwn ? 'user-caption' : 'admin-caption'}`;
  div.innerHTML = `
    <div style="font-size:.78rem;color:var(--text-muted);">📌 Caption #${c.number}</div>
    <p class="caption-text">${escHtml(c.text)}</p>
    <div class="caption-meta">🕒 ${c.time}</div>
    <div class="caption-actions">
      <button class="btn-caption-action" onclick="copyCaption('${escAttr(c.text)}')">📋 Copy</button>
      ${isOwn ? `<button class="btn-caption-action" onclick="editCaption('${c.id}','${escAttr(c.text)}')">✏️ Edit</button>
                 <button class="btn-caption-action del" onclick="deleteCaption('${c.id}')">🗑️ Delete</button>` : ''}
      ${!isOwn ? '<span style="font-size:.75rem;color:var(--text-muted);">🔒 Cannot Edit</span>' : ''}
    </div>
  `;
  return div;
}

async function saveCaption() {
  const input = document.getElementById('newCaptionInput');
  const text = input.value.trim();
  if (!text) { showToast('⚠️ Caption লিখুন!', 'error'); return; }
  try {
    const res = await fetch(`${CONFIG.API_BASE}/caption`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'add', userId, text })
    });
    const data = await res.json();
    if (data.success) {
      input.value = '';
      showToast('✅ Caption saved!', 'success');
      await loadCaptions();
    }
  } catch (e) { showToast('❌ Failed to save caption.', 'error'); }
}

function copyCaption(text) {
  navigator.clipboard.writeText(text).then(() => showToast('📋 Copied!', 'success'));
}

async function editCaption(id, oldText) {
  const newText = prompt('✏️ Edit Caption:', oldText);
  if (!newText || newText === oldText) return;
  try {
    await fetch(`${CONFIG.API_BASE}/caption`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'edit', userId, captionId: id, text: newText })
    });
    await loadCaptions();
  } catch(e){}
}

async function deleteCaption(id) {
  if (!confirm('🗑️ Delete this caption?')) return;
  try {
    await fetch(`${CONFIG.API_BASE}/caption`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'delete', userId, captionId: id })
    });
    await loadCaptions();
  } catch(e){}
}

// ===== PROFILE =====
function loadProfile() {
  const p = profile;
  document.getElementById('profileId').textContent = userId || '—';
  document.getElementById('profileName').value = p.name || '';
  document.getElementById('profileWa').value = p.wa || '';
  document.getElementById('profileFb').value = p.fb || '';
  document.getElementById('profileSend').textContent = p.totalSend || 0;
  document.getElementById('profileReceive').textContent = p.totalReceive || 0;
  document.getElementById('profileDate').textContent = p.registeredDate || '—';
  updateNotifBtn();
}

function saveProfile() {
  profile.name = document.getElementById('profileName').value.trim();
  profile.wa = document.getElementById('profileWa').value.trim();
  profile.fb = document.getElementById('profileFb').value.trim();
  localStorage.setItem('cp_profile', JSON.stringify(profile));
  showToast('✅ Profile saved!', 'success');
}

function updateNotifBtn() {
  const btn = document.getElementById('notifToggleBtn');
  if (!btn) return;
  const perm = Notification.permission;
  if (perm === 'granted') {
    btn.textContent = '✅ Enabled'; btn.classList.add('enabled');
  } else {
    btn.textContent = 'Enable Now'; btn.classList.remove('enabled');
  }
}

function toggleNotification() {
  requestNotification();
}

async function requestNotification() {
  closePopup('notifPopup');
  if (Notification.permission === 'granted') {
    showToast('🔔 Notifications already enabled!', 'success'); return;
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    showToast('✅ Notifications enabled!', 'success');
    updateNotifBtn();
  }
}

// ===== POPUPS =====
function showPopup(id) {
  document.getElementById('popupOverlay').classList.remove('hidden');
  const popup = document.getElementById(id);
  if (popup) {
    // Hide all popups first
    document.querySelectorAll('.popup-box').forEach(p => p.classList.add('hidden'));
    popup.classList.remove('hidden');
  }
}

function closePopup(id) {
  const popup = document.getElementById(id);
  if (popup) popup.classList.add('hidden');
  // If no visible popups, hide overlay
  const any = [...document.querySelectorAll('.popup-box')].some(p => !p.classList.contains('hidden'));
  if (!any) document.getElementById('popupOverlay').classList.add('hidden');
}

async function checkPendingPopups() {
  if (!userId) return;
  try {
    const res = await fetch(`${CONFIG.API_BASE}/send?userId=${userId}&action=pendingPopups`);
    const data = await res.json();

    if (data.replies && data.replies.length > 0) {
      const r = data.replies[0];
      const popupKey = 'popup_reply_' + r.id;
      if (!seenPopups[popupKey]) {
        seenPopups[popupKey] = true;
        localStorage.setItem('cp_seen_popups', JSON.stringify(seenPopups));
        document.getElementById('popupReplyText').textContent = r.message;
        document.getElementById('popupReplyTime').textContent = r.time;
        showPopup('replyPopup');
      }
    }

    if (data.broadcast) {
      const b = data.broadcast;
      const popupKey = 'popup_broadcast_' + b.id;
      if (!seenPopups[popupKey]) {
        seenPopups[popupKey] = true;
        localStorage.setItem('cp_seen_popups', JSON.stringify(seenPopups));
        document.getElementById('popupBroadcastText').textContent = b.message;
        document.getElementById('popupBroadcastTime').textContent = b.time;
        setTimeout(() => showPopup('broadcastPopup'), 500);
        setTimeout(() => closePopup('broadcastPopup'), 5500);
        // Report seen
        fetch(`${CONFIG.API_BASE}/broadcast`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'seen', userId, broadcastId: b.id })
        }).catch(()=>{});
      }
    }

    if (data.newCaption) {
      const c = data.newCaption;
      const popupKey = 'popup_caption_' + c.id;
      if (!seenPopups[popupKey]) {
        seenPopups[popupKey] = true;
        localStorage.setItem('cp_seen_popups', JSON.stringify(seenPopups));
        document.getElementById('popupCaptionText').textContent = c.text;
        document.getElementById('popupCaptionTime').textContent = c.time;
        setTimeout(() => showPopup('captionPopup'), 1000);
        setTimeout(() => closePopup('captionPopup'), 6000);
      }
    }
  } catch (e) {}
}

function scrollToMessage() {
  closePopup('replyPopup');
  document.getElementById('messageSection').scrollIntoView({ behavior: 'smooth' });
}

// ===== POLLING =====
function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(checkPendingPopups, 30000);
}

// ===== SERVICE WORKER =====
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js');
    } catch (e) {}
  }
}

// ===== BD TIME =====
function getBDTimeString() {
  return new Intl.DateTimeFormat('en-BD', {
    timeZone: 'Asia/Dhaka', day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit', hour12: true
  }).format(new Date()).replace(',', ' —');
}

// ===== TOAST =====
function showToast(msg, type='info') {
  const old = document.getElementById('tempToast');
  if (old) old.remove();
  const toast = document.createElement('div');
  toast.id = 'tempToast';
  toast.style.cssText = `
    position:fixed;bottom:30px;left:50%;transform:translateX(-50%);
    background:${type==='error'?'linear-gradient(135deg,#e11d48,#9f1239)':type==='success'?'linear-gradient(135deg,#06d6a0,#059669)':'linear-gradient(135deg,#7c3aed,#9333ea)'};
    color:white;padding:12px 22px;border-radius:100px;font-family:'Hind Siliguri',sans-serif;
    font-size:.9rem;z-index:9999;box-shadow:0 6px 24px rgba(0,0,0,0.4);
    animation:toastIn 0.4s ease;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===== HELPERS =====
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  return String(str).replace(/'/g,'&#39;').replace(/"/g,'&quot;');
}
