/* ========== CHITHI PATHAO — app.js ========== */
'use strict';

// ─── CONFIG ───────────────────────────────────────
const API_BASE = '/api';

// ─── STATE ────────────────────────────────────────
let currentUserId = null;
let userProfile   = {};
let seenMsgIds    = new Set();
let dropdownOpen  = false;
let pollInterval  = null;

// ─── INIT ─────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  buildStars();
  buildHearts();
  await initUser();
  await loadProfile();
  loadSendHistory();
  loadReceivedHistory();
  loadCaptions();
  checkPendingPopups();
  startPolling();
  registerServiceWorker();
  setupCharCounter();
  setupDropdownClose();
  document.getElementById('homeMenuBtn').addEventListener('click', toggleDropdown);
});

// ─── STAR FIELD ───────────────────────────────────
function buildStars() {
  const sf = document.getElementById('starField');
  for (let i = 0; i < 120; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    s.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;
      --dur:${2+Math.random()*4}s;--delay:${Math.random()*5}s;
      opacity:${0.1+Math.random()*0.6};width:${1+Math.random()*2}px;height:${1+Math.random()*2}px;`;
    sf.appendChild(s);
  }
}

function buildHearts() {
  const fh = document.getElementById('floatingHearts');
  const emojis = ['💌','💜','✨','🌸','💫','🕊️'];
  for (let i = 0; i < 18; i++) {
    const h = document.createElement('div');
    h.className = 'floating-heart';
    h.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    h.style.cssText = `left:${Math.random()*100}%;--dur:${6+Math.random()*8}s;--delay:${Math.random()*10}s;`;
    fh.appendChild(h);
  }
}

// ─── USER INIT ────────────────────────────────────
async function initUser() {
  let uid = localStorage.getItem('cpt_uid');
  if (uid) {
    currentUserId = uid;
    document.getElementById('userIdBadge').textContent = `🆔 ID: ${uid}`;
    // Check ban status
    await checkBan(uid);
    return;
  }

  // New user — register after 5 seconds
  setTimeout(async () => {
    try {
      const res  = await fetch(`${API_BASE}/user`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({action:'register'}) });
      const data = await res.json();
      if (data.userId) {
        currentUserId = data.userId;
        localStorage.setItem('cpt_uid', data.userId);
        localStorage.setItem('cpt_registered', data.registeredDate || getBDTime());
        document.getElementById('userIdBadge').textContent = `🆔 ID: ${data.userId}`;
        await checkBan(data.userId);
      }
    } catch(e) { console.error('Register error', e); }
  }, 5000);
}

async function checkBan(uid) {
  try {
    const res  = await fetch(`${API_BASE}/user?action=checkban&uid=${uid}`);
    const data = await res.json();
    if (data.banned) {
      document.getElementById('banScreen').classList.remove('hidden');
      document.getElementById('mainApp').classList.add('hidden');
    }
  } catch(e) {}
}

// ─── PROFILE ──────────────────────────────────────
async function loadProfile() {
  if (!currentUserId) return;
  try {
    const res  = await fetch(`${API_BASE}/user?action=profile&uid=${currentUserId}`);
    const data = await res.json();
    userProfile = data || {};
  } catch(e) {}
}

function renderProfile() {
  const p = userProfile;
  const uid = currentUserId || '----';
  const regDate = localStorage.getItem('cpt_registered') || '—';
  const notifStatus = Notification.permission === 'granted' ? '✅ Allowed' : '❌ Disabled';

  document.getElementById('profileBody').innerHTML = `
    <div class="profile-card">
      <div class="profile-row"><span class="profile-label">🆔 My ID</span><span class="profile-val" style="color:var(--neon-purple);font-family:'Orbitron',monospace">${uid}</span></div>
      <div class="profile-row"><span class="profile-label">👤 Name</span><span class="profile-val">${p.name||'Not Set'}</span></div>
      <div class="profile-row"><span class="profile-label">📱 WhatsApp</span><span class="profile-val">${p.whatsapp||'Not Set'}</span></div>
      <div class="profile-row"><span class="profile-label">🌐 FB Link</span><span class="profile-val">${p.fbLink||'Not Added'}</span></div>
      <div class="profile-row"><span class="profile-label">💌 Total Sent</span><span class="profile-val">${p.totalSent||0}</span></div>
      <div class="profile-row"><span class="profile-label">📩 Total Received</span><span class="profile-val">${p.totalReceived||0}</span></div>
      <div class="profile-row"><span class="profile-label">📅 Registered</span><span class="profile-val">${regDate}</span></div>
      <div class="profile-row"><span class="profile-label">🔔 Notification</span><span class="profile-val">${notifStatus}</span></div>
    </div>
    <div class="profile-edit-section">
      <label>✏️ Your Name (Optional)</label>
      <input type="text" id="editName" value="${p.name||''}" placeholder="আপনার নাম..."/>
      <label>📱 WhatsApp Number (Optional)</label>
      <input type="tel" id="editWhatsapp" value="${p.whatsapp||''}" placeholder="+8801XXXXXXXXX"/>
      <label>🌐 FB ID Link (Optional)</label>
      <input type="url" id="editFb" value="${p.fbLink||''}" placeholder="https://facebook.com/..."/>
      <button class="profile-save-btn" onclick="saveProfile()">💾 Save Profile</button>
    </div>
  `;
}

async function saveProfile() {
  const name     = document.getElementById('editName').value.trim();
  const whatsapp = document.getElementById('editWhatsapp').value.trim();
  const fbLink   = document.getElementById('editFb').value.trim();
  try {
    const res = await fetch(`${API_BASE}/user`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'updateProfile', uid:currentUserId, name, whatsapp, fbLink})
    });
    const data = await res.json();
    if (data.ok) { userProfile = {...userProfile, name, whatsapp, fbLink}; showToast('✅ Profile Saved!'); renderProfile(); }
  } catch(e) { showToast('❌ Error saving profile'); }
}

// ─── SEND MESSAGE ─────────────────────────────────
async function sendMessage() {
  const msgBox = document.getElementById('msgBox');
  const msg = msgBox.value.trim();
  if (!msg) { showToast('⚠️ Please write a message!'); return; }

  const isAnon = document.getElementById('anonCheck').checked;
  const name   = isAnon ? 'Unknown User' : (document.getElementById('userName').value.trim() || '');
  const wa     = isAnon ? '' : document.getElementById('userWhatsapp').value.trim();
  const fb     = isAnon ? '' : document.getElementById('userFbLink').value.trim();

  const btn = document.getElementById('sendBtn');
  btn.disabled = true;
  btn.querySelector('.send-btn-inner').textContent = '⏳ Sending...';

  try {
    const res  = await fetch(`${API_BASE}/send`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({uid: currentUserId, name, whatsapp: wa, fbLink: fb, message: msg, anonymous: isAnon})
    });
    const data = await res.json();
    if (data.ok) {
      msgBox.value = '';
      document.getElementById('charCount').textContent = '0';
      showPopup('sentPopup');
      loadSendHistory();
      setTimeout(() => { if (Notification.permission !== 'granted') showPopup('notifPopup'); }, 1500);
    } else { showToast('❌ Send failed. Try again.'); }
  } catch(e) { showToast('❌ Network error.'); }
  finally {
    btn.disabled = false;
    btn.querySelector('.send-btn-inner').textContent = '✉️ Send Message!';
  }
}

// ─── SEND HISTORY ─────────────────────────────────
async function loadSendHistory() {
  if (!currentUserId) return;
  try {
    const res  = await fetch(`${API_BASE}/send?uid=${currentUserId}`);
    const data = await res.json();
    const body = document.getElementById('sendHistoryBody');
    if (!data.messages || !data.messages.length) {
      body.innerHTML = '<div class="empty-state">💬 কোনো Message পাঠানো হয়নি।</div>'; return;
    }
    body.innerHTML = data.messages.map(m => `
      <div class="msg-card">
        <div class="msg-card-row"><span>Msg ID:</span><span style="color:var(--neon-purple)">${m.msgId}</span></div>
        <div class="msg-card-row"><span>User ID:</span><span style="color:var(--neon-blue)">${m.uid}</span></div>
        <div class="msg-card-text">${escHtml(m.message)}</div>
        <div class="msg-card-time">🕒 ${m.time}</div>
      </div>`).join('');
  } catch(e) {}
}

// ─── RECEIVED HISTORY ─────────────────────────────
async function loadReceivedHistory() {
  if (!currentUserId) return;
  try {
    const res  = await fetch(`${API_BASE}/send?uid=${currentUserId}&type=received`);
    const data = await res.json();
    const body = document.getElementById('receivedHistoryBody');
    if (!data.messages || !data.messages.length) {
      body.innerHTML = '<div class="empty-state">📭 কোনো Message Receive হয়নি।</div>'; return;
    }
    body.innerHTML = data.messages.map(m => `
      <div class="msg-card" data-msgid="${m.msgId}">
        <div class="msg-card-row"><span>Msg ID:</span><span style="color:var(--neon-blue)">${m.msgId}</span></div>
        <div class="msg-card-row"><span>From:</span><span style="color:var(--neon-green)">Admin</span></div>
        <div class="msg-card-text">${escHtml(m.message)}</div>
        <div class="msg-card-time">🕒 ${m.time}</div>
      </div>`).join('');
    // Mark as seen
    markSeen(data.messages);
  } catch(e) {}
}

async function markSeen(messages) {
  for (const m of messages) {
    if (!seenMsgIds.has(m.msgId)) {
      seenMsgIds.add(m.msgId);
      try {
        await fetch(`${API_BASE}/send`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({action:'markSeen', uid:currentUserId, msgId:m.msgId})
        });
      } catch(e) {}
    }
  }
}

// ─── CAPTIONS ─────────────────────────────────────
async function loadCaptions() {
  try {
    const res  = await fetch(`${API_BASE}/caption?uid=${currentUserId||''}`);
    const data = await res.json();
    renderCaptions(data.captions || []);
  } catch(e) {}
}

function renderCaptions(captions) {
  const body = document.getElementById('captionListBody');
  if (!captions.length) { body.innerHTML = '<div class="empty-state">📝 কোনো Caption নেই।</div>'; return; }

  body.innerHTML = captions.map(c => {
    const isAdmin = c.source === 'admin';
    const actions = isAdmin
      ? `<span class="cap-btn cap-copy" onclick="copyCaption('${escAttr(c.text)}')">📋 Copy</span>
         <span class="cap-readonly">❌ You Cannot Edit/Delete</span>`
      : (c.uid === currentUserId ? `
         <span class="cap-btn cap-copy" onclick="copyCaption('${escAttr(c.text)}')">📋 Copy</span>
         <span class="cap-btn cap-edit" onclick="editCaption('${c.id}','${escAttr(c.text)}')">✏️ Edit</span>
         <span class="cap-btn cap-delete" onclick="deleteCaption('${c.id}')">🗑️ Delete</span>` : '');
    return `<div class="caption-card">
      <div class="caption-num">📌 Caption Number: ${String(c.num).padStart(2,'0')}</div>
      <div class="caption-text">💬 ${escHtml(c.text)}</div>
      <div class="caption-time">🕒 ${c.time}</div>
      <div class="caption-actions">${actions}</div>
    </div>`;
  }).join('');
}

async function saveCaption() {
  const inp  = document.getElementById('newCaptionInput');
  const text = inp.value.trim();
  if (!text) { showToast('⚠️ Caption ফাঁকা রাখা যাবে না!'); return; }
  try {
    const res  = await fetch(`${API_BASE}/caption`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'add', uid:currentUserId, text})
    });
    const data = await res.json();
    if (data.ok) { inp.value = ''; showToast('✅ Caption Saved!'); loadCaptions(); }
    else showToast('❌ Failed to save');
  } catch(e) { showToast('❌ Network error'); }
}

async function deleteCaption(id) {
  if (!confirm('এই Caption Delete করতে চান?')) return;
  try {
    const res  = await fetch(`${API_BASE}/caption`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'delete', uid:currentUserId, id})
    });
    const data = await res.json();
    if (data.ok) { showToast('🗑️ Caption Deleted'); loadCaptions(); }
  } catch(e) {}
}

async function editCaption(id, oldText) {
  const newText = prompt('Caption Edit করুন:', oldText);
  if (!newText || newText.trim() === oldText) return;
  try {
    const res  = await fetch(`${API_BASE}/caption`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'edit', uid:currentUserId, id, text:newText.trim()})
    });
    const data = await res.json();
    if (data.ok) { showToast('✅ Caption Updated!'); loadCaptions(); }
  } catch(e) {}
}

function copyCaption(text) {
  navigator.clipboard.writeText(text).then(() => showToast('📋 Copied!')).catch(() => showToast('❌ Copy failed'));
}

// ─── NOTIFICATIONS ────────────────────────────────
function requestNotificationPermission() {
  closePopup('notifPopup');
  Notification.requestPermission().then(perm => {
    if (perm === 'granted') { showToast('🔔 Notifications Enabled!'); saveNotifStatus(true); }
    else showToast('🔕 Notification denied');
  });
}

async function saveNotifStatus(allowed) {
  try {
    await fetch(`${API_BASE}/user`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'updateNotif', uid:currentUserId, notifAllowed:allowed})
    });
  } catch(e) {}
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ─── POLLING ──────────────────────────────────────
function startPolling() {
  pollInterval = setInterval(pollNewMessages, 15000);
}

async function pollNewMessages() {
  if (!currentUserId) return;
  try {
    const res  = await fetch(`${API_BASE}/send?uid=${currentUserId}&type=received&poll=1`);
    const data = await res.json();
    if (data.newMessage) {
      showReplyPopup(data.newMessage);
      loadReceivedHistory();
      if (Notification.permission === 'granted') {
        new Notification('💌 চিঠি পাঠাও', {
          body: 'You Have Received New Notification From Admin – Click To Open',
          icon: '/icon-192.png'
        });
      }
    }
    if (data.broadcast) showBroadcastPopup(data.broadcast);
    if (data.newCaption) showNewCaptionPopup(data.newCaption);
  } catch(e) {}
}

// ─── POPUPS ───────────────────────────────────────
function showReplyPopup(msg) {
  const shown = localStorage.getItem(`cpt_seen_${msg.msgId}`);
  if (shown) return;
  localStorage.setItem(`cpt_seen_${msg.msgId}`, '1');
  document.getElementById('replyPopupMsg').textContent  = msg.message;
  document.getElementById('replyPopupTime').textContent = '🕒 ' + msg.time;
  showPopup('replyPopup');
}

function showBroadcastPopup(bc) {
  document.getElementById('broadcastMsg').textContent  = bc.message;
  document.getElementById('broadcastTime').textContent = '🕒 ' + bc.time;
  showPopup('broadcastPopup');
  setTimeout(() => closePopup('broadcastPopup'), 5000);
}

function showNewCaptionPopup(cap) {
  document.getElementById('newCaptionMsg').textContent  = cap.text;
  document.getElementById('newCaptionTime').textContent = '🕒 ' + cap.time;
  showPopup('newCaptionPopup');
  setTimeout(() => closePopup('newCaptionPopup'), 5000);
}

function checkPendingPopups() {
  const bc = localStorage.getItem('cpt_pending_bc');
  if (bc) { try { showBroadcastPopup(JSON.parse(bc)); localStorage.removeItem('cpt_pending_bc'); } catch(e) {} }
}

function checkReply() {
  closePopup('sentPopup');
  openSection('receivedHistory');
}

function clickToReply() {
  closePopup('replyPopup');
  document.getElementById('msgBox').focus();
  document.getElementById('msgBox').scrollIntoView({behavior:'smooth'});
}

// ─── SECTION NAVIGATION ───────────────────────────
function openSection(name) {
  closeDropdown();
  const map = {
    sendHistory:     'sendHistoryModal',
    receivedHistory: 'receivedHistoryModal',
    captionBox:      'captionBoxModal',
    myProfile:       'myProfileModal',
    helpSection:     'helpSectionModal'
  };
  const modalId = map[name];
  if (!modalId) return;
  if (name === 'myProfile') renderProfile();
  if (name === 'sendHistory') loadSendHistory();
  if (name === 'receivedHistory') loadReceivedHistory();
  if (name === 'captionBox') loadCaptions();
  document.getElementById(modalId).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeSection(modalId) {
  document.getElementById(modalId).classList.add('hidden');
  document.body.style.overflow = '';
}

function showPopup(id) {
  document.getElementById(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closePopup(id) {
  document.getElementById(id).classList.add('hidden');
  document.body.style.overflow = '';
}

// ─── DROPDOWN ─────────────────────────────────────
function toggleDropdown() {
  const dd = document.getElementById('homeDropdown');
  dropdownOpen = !dropdownOpen;
  dd.classList.toggle('hidden', !dropdownOpen);
}

function closeDropdown() {
  document.getElementById('homeDropdown').classList.add('hidden');
  dropdownOpen = false;
}

function setupDropdownClose() {
  document.addEventListener('click', e => {
    if (!e.target.closest('#homeDropdown') && !e.target.closest('#homeMenuBtn')) closeDropdown();
  });
}

// ─── CHAR COUNTER ─────────────────────────────────
function setupCharCounter() {
  document.getElementById('msgBox').addEventListener('input', function() {
    document.getElementById('charCount').textContent = this.value.length;
  });
}

// ─── TOAST ────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

// ─── HELPERS ──────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) {
  return String(s).replace(/'/g,"\\'").replace(/\n/g,'\\n');
}
function getBDTime() {
  return new Date().toLocaleString('en-GB', {
    timeZone:'Asia/Dhaka', hour12:true,
    day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit'
  });
}
