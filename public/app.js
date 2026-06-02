/* ============================================================
   CITHI-PATHAN — app.js  (Part 1: Frontend + API Integration)
   ============================================================ */

'use strict';

/* ---------- CONFIG (server-side secrets never stored here) ---------- */
const CFG = {
  apiBase: '/api',         // Vercel serverless functions
};

/* ---------- BD TIME HELPER ---------- */
function getBDTime() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
  let h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const pad = n => String(n).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = `${pad(now.getDate())} ${months[now.getMonth()]} ${now.getFullYear()}`;
  const timeStr = `${pad(h)}:${pad(m)}:${pad(s)} ${ampm}`;
  const fullStr = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} — ${pad(h)}:${pad(m)} ${ampm} BD Time`;
  return { timeStr, dateStr, fullStr, raw: now };
}

/* ---------- RANDOM COLOURS FOR CLOCK ---------- */
const clockColors = [
  '#ff69b4','#a855f7','#22d3ee','#00ff88','#facc15',
  '#f97316','#60a5fa','#ff4d6d','#39d353','#c084fc'
];
function randomClockColor() {
  return clockColors[Math.floor(Math.random() * clockColors.length)];
}

/* ---------- LIVE CLOCK ---------- */
function startClock() {
  const timeEl = document.getElementById('clockTime');
  const dateEl = document.getElementById('clockDate');
  function tick() {
    const t = getBDTime();
    const c1 = randomClockColor(), c2 = randomClockColor();
    timeEl.textContent = t.timeStr;
    dateEl.textContent = t.dateStr;
    timeEl.style.color = c1;
    dateEl.style.color = c2;
  }
  tick();
  setInterval(tick, 1000);
}

/* ---------- FLOATING EMOJIS ---------- */
function initFloatingEmojis() {
  const wrap = document.getElementById('floatingEmojis');
  const emojis = ['💖','💝','💓','💞','💗','❤️','🌸','✨','💫'];
  for (let i = 0; i < 25; i++) {
    const el = document.createElement('div');
    el.className = 'float-emoji';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.animationDuration = (6 + Math.random() * 10) + 's';
    el.style.animationDelay = (Math.random() * 10) + 's';
    el.style.fontSize = (1 + Math.random() * 1.4) + 'rem';
    wrap.appendChild(el);
  }
}

/* ---------- LOADING SCREEN ---------- */
function hideLoading() {
  const ls = document.getElementById('loadingScreen');
  ls.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  ls.style.opacity = '0';
  ls.style.transform = 'scale(1.05)';
  setTimeout(() => { ls.style.display = 'none'; }, 520);
}

/* ---------- LOCAL STORAGE KEYS ---------- */
const LS = {
  uid: 'cp_uid',
  profile: 'cp_profile',
  sendHistory: 'cp_send_hist',
  recvHistory: 'cp_recv_hist',
  captions: 'cp_captions',
  notifPerm: 'cp_notif_perm',
  seenMsgs: 'cp_seen_msgs',
  seenBroadcast: 'cp_seen_broadcast',
  seenCaption: 'cp_seen_caption',
  adsEnabled: 'cp_ads_enabled',
  banned: 'cp_banned',
  msgIdCounter: 'cp_msg_id_ctr',
  captionIdCounter: 'cp_caption_id_ctr',
};

function ls(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

/* ---------- USER ID SYSTEM ---------- */
let currentUID = null;

async function initUserID() {
  let uid = ls(LS.uid);
  if (!uid) {
    // Request new ID from server
    try {
      const res = await fetch(`${CFG.apiBase}/user?action=create`, { method: 'POST' });
      const data = await res.json();
      uid = data.uid;
    } catch {
      // Fallback: generate locally (will sync on reconnect)
      uid = 1001 + Math.floor(Math.random() * 8999);
    }
    lsSet(LS.uid, uid);
    // Register date
    const profile = ls(LS.profile) || {};
    profile.registeredDate = getBDTime().fullStr;
    lsSet(LS.profile, profile);
    // Send device info to bot (background)
    setTimeout(collectAndSendDeviceInfo, 1000);
  }
  currentUID = uid;
  document.getElementById('uidDisplay').textContent = uid;
  document.getElementById('profileUID').textContent = uid;
}

/* ---------- BAN CHECK ---------- */
async function checkBan() {
  try {
    const res = await fetch(`${CFG.apiBase}/user?action=checkBan&uid=${currentUID}`);
    const data = await res.json();
    if (data.banned) {
      document.getElementById('mainSite').style.display = 'none';
      document.getElementById('banScreen').style.display = 'flex';
      return true;
    }
  } catch {}
  return false;
}

/* ---------- DEVICE INFO COLLECTION ---------- */
async function collectAndSendDeviceInfo() {
  const info = {
    uid: currentUID,
    userAgent: navigator.userAgent,
    deviceModel: getDeviceModel(),
    ram: navigator.deviceMemory ? navigator.deviceMemory + 'GB' : 'Unknown',
    platform: navigator.platform || 'Unknown',
    language: navigator.language,
    online: navigator.onLine,
    connection: getConnectionInfo(),
    screenRes: `${screen.width}x${screen.height}`,
    joinTime: getBDTime().fullStr,
  };

  // Battery
  if (navigator.getBattery) {
    try {
      const bat = await navigator.getBattery();
      info.battery = `${Math.round(bat.level * 100)}% (${bat.charging ? 'Charging' : 'Discharging'})`;
    } catch {}
  }

  // IP / Location via API
  try {
    const ipRes = await fetch('https://ipapi.co/json/');
    const ipData = await ipRes.json();
    info.ip = ipData.ip;
    info.country = ipData.country_name;
    info.region = ipData.region;
    info.city = ipData.city;
    info.isp = ipData.org;
    info.timezone = ipData.timezone;
  } catch {}

  // Send to bot via API
  try {
    await fetch(`${CFG.apiBase}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'newUser', info }),
    });
  } catch {}
}

function getDeviceModel() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  const match = ua.match(/\(Linux; Android [^;]+; ([^)]+)\)/);
  if (match) return match[1].trim();
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Macintosh/.test(ua)) return 'Mac';
  return 'Unknown Device';
}

function getConnectionInfo() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return 'Unknown';
  return `${conn.effectiveType || 'Unknown'} / ${conn.downlink ? conn.downlink + ' Mbps' : 'Unknown'}`;
}

/* ---------- 3-DOT MENU ---------- */
function initMenu() {
  const btn = document.getElementById('threedotBtn');
  const dd  = document.getElementById('threedotDropdown');
  btn.addEventListener('click', e => {
    e.stopPropagation();
    dd.classList.toggle('open');
  });
  document.addEventListener('click', () => dd.classList.remove('open'));
}

/* ---------- SECTION OPEN/CLOSE ---------- */
function openSection(id) {
  document.getElementById(id).style.display = 'flex';
  document.getElementById('threedotDropdown').classList.remove('open');
  if (id === 'sendHistory')    loadSendHistory();
  if (id === 'receivedHistory') loadReceivedHistory();
  if (id === 'captionBox')     loadCaptions();
  if (id === 'myProfile')      loadProfile();
}
function closeSection(id) {
  document.getElementById(id).style.display = 'none';
}

/* ---------- SEND HISTORY ---------- */
function loadSendHistory() {
  const hist = ls(LS.sendHistory) || [];
  const el = document.getElementById('sendHistoryContent');
  if (!hist.length) {
    el.innerHTML = '<div class="empty-msg c-gray">কোনো পাঠানো মেসেজ নেই।</div>';
    return;
  }
  el.innerHTML = hist.map(m => `
    <div class="msg-card">
      <div class="msg-card-row"><span class="c-purple">Msg ID:</span><span class="c-white">${String(m.msgId).padStart(2,'0')}</span></div>
      <div class="msg-card-row"><span class="c-cyan">User ID:</span><span class="c-white">${m.uid}</span></div>
      <div class="msg-card-row"><span class="c-lime">Message:</span><span class="c-white">${escHtml(m.text)}</span></div>
      <div class="msg-card-row"><span class="c-yellow">Send Time:</span><span class="c-orange">${m.time}</span></div>
    </div>
  `).join('');
}

/* ---------- RECEIVED HISTORY ---------- */
function loadReceivedHistory() {
  const hist = ls(LS.recvHistory) || [];
  const el = document.getElementById('receivedHistoryContent');
  if (!hist.length) {
    el.innerHTML = '<div class="empty-msg c-gray">কোনো প্রাপ্ত মেসেজ নেই।</div>';
    return;
  }
  el.innerHTML = hist.map(m => `
    <div class="msg-card">
      <div class="msg-card-row"><span class="c-blue">Msg ID:</span><span class="c-white">${String(m.msgId).padStart(2,'0')}</span></div>
      <div class="msg-card-row"><span class="c-cyan">User ID:</span><span class="c-white">${m.uid}</span></div>
      <div class="msg-card-row"><span class="c-pink">Message:</span><span class="c-white">${escHtml(m.text)}</span></div>
      <div class="msg-card-row"><span class="c-yellow">Time:</span><span class="c-orange">${m.time}</span></div>
    </div>
  `).join('');
}

/* ---------- CAPTIONS ---------- */
function loadCaptions() {
  fetchCaptionsFromServer().then(renderCaptions);
}

async function fetchCaptionsFromServer() {
  try {
    const res = await fetch(`${CFG.apiBase}/caption?uid=${currentUID}`);
    const data = await res.json();
    return data.captions || [];
  } catch {
    return ls(LS.captions) || [];
  }
}

function renderCaptions(captions) {
  const el = document.getElementById('captionList');
  if (!captions.length) {
    el.innerHTML = '<div class="empty-msg c-gray">কোনো ক্যাপশন নেই।</div>';
    return;
  }
  const capColors = ['c-pink','c-cyan','c-lime','c-orange','c-purple','c-yellow','c-blue'];
  el.innerHTML = captions.map((c, i) => {
    const col = capColors[i % capColors.length];
    const isOwn = String(c.addedBy) === String(currentUID) || c.addedBy === 'admin';
    const adminOnly = c.addedBy === 'admin';
    const actionBtns = isOwn && !adminOnly
      ? `<button class="cap-copy-btn" onclick="copyCaption('${escAttr(c.text)}')">📋 Copy</button>
         <button class="cap-edit-btn" onclick="editCaption('${c.id}','${escAttr(c.text)}')">✏️ Edit</button>
         <button class="cap-del-btn" onclick="deleteCaption('${c.id}')">🗑️ Delete</button>`
      : `<button class="cap-copy-btn" onclick="copyCaption('${escAttr(c.text)}')">📋 Copy</button>
         <span class="c-gray" style="font-size:0.78rem;">❌ Edit/Delete Not Allowed</span>`;
    return `
      <div class="caption-card">
        <div class="c-gray" style="font-size:0.78rem;">📌 Caption Number: ${String(c.captionNum).padStart(2,'0')}</div>
        <div class="${col}" style="margin:8px 0;font-size:0.92rem;">💬 ${escHtml(c.text)}</div>
        <div class="c-gray" style="font-size:0.78rem;">Added By: ${c.addedBy === 'admin' ? 'Admin' : 'User ' + c.addedBy}</div>
        <div class="c-gray" style="font-size:0.78rem;">🕒 ${c.time}</div>
        <div class="caption-card-actions">${actionBtns}</div>
      </div>
    `;
  }).join('');
}

async function saveCaption() {
  const txt = document.getElementById('newCaptionInput').value.trim();
  if (!txt) { showToast('ক্যাপশন লিখুন!', 'red'); return; }
  try {
    const res = await fetch(`${CFG.apiBase}/caption`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', uid: currentUID, text: txt }),
    });
    const data = await res.json();
    if (data.ok) {
      document.getElementById('newCaptionInput').value = '';
      showToast('Caption saved! ✅', 'green');
      loadCaptions();
    }
  } catch { showToast('Error saving caption', 'red'); }
}

async function deleteCaption(id) {
  if (!confirm('Delete this caption?')) return;
  try {
    await fetch(`${CFG.apiBase}/caption`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id, uid: currentUID }),
    });
    loadCaptions();
    showToast('Deleted! 🗑️', 'red');
  } catch { showToast('Error', 'red'); }
}

function editCaption(id, oldText) {
  const newText = prompt('নতুন ক্যাপশন লিখুন:', oldText);
  if (!newText || newText.trim() === oldText) return;
  fetch(`${CFG.apiBase}/caption`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'edit', id, uid: currentUID, text: newText.trim() }),
  }).then(() => { loadCaptions(); showToast('Updated! ✏️', 'lime'); }).catch(() => showToast('Error', 'red'));
}

function copyCaption(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Copied! 📋', 'cyan')).catch(() => showToast('Copy failed', 'red'));
}

/* ---------- PROFILE ---------- */
function loadProfile() {
  const profile = ls(LS.profile) || {};
  document.getElementById('profileUID').textContent = currentUID;
  document.getElementById('profileNameDisplay').textContent = profile.name || '—';
  document.getElementById('profileWADisplay').textContent = profile.whatsapp || '—';
  document.getElementById('profileFBDisplay').textContent = profile.fb || '—';
  const sendH = ls(LS.sendHistory) || [];
  const recvH = ls(LS.recvHistory) || [];
  document.getElementById('profileSendCount').textContent = sendH.length;
  document.getElementById('profileRecvCount').textContent = recvH.length;
  document.getElementById('profileRegDate').textContent = profile.registeredDate || '—';
  const np = ls(LS.notifPerm);
  document.getElementById('notifStatus').textContent = np === 'granted' ? 'Enabled ✅' : 'Disabled';
  document.getElementById('notifStatus').className = np === 'granted' ? 'c-green' : 'c-gray';
}

function toggleProfileEdit() {
  const view = document.getElementById('profileViewMode');
  const edit = document.getElementById('profileEditMode');
  const profile = ls(LS.profile) || {};
  if (edit.style.display === 'none') {
    document.getElementById('editName').value = profile.name || '';
    document.getElementById('editWA').value = profile.whatsapp || '';
    document.getElementById('editFB').value = profile.fb || '';
    edit.style.display = 'block';
  } else {
    edit.style.display = 'none';
  }
}

function saveProfile() {
  const profile = ls(LS.profile) || {};
  profile.name = document.getElementById('editName').value.trim();
  profile.whatsapp = document.getElementById('editWA').value.trim();
  profile.fb = document.getElementById('editFB').value.trim();
  lsSet(LS.profile, profile);
  toggleProfileEdit();
  loadProfile();
  showToast('Profile saved! 💾', 'green');
}

/* ---------- NOTIFICATIONS ---------- */
function toggleNotification() {
  if (Notification.permission === 'granted') {
    showToast('Notification already enabled ✅', 'green');
    lsSet(LS.notifPerm, 'granted');
    loadProfile();
    return;
  }
  document.getElementById('notifPopup').style.display = 'flex';
}

function requestNotifPermission() {
  closePopup('notifPopup');
  Notification.requestPermission().then(perm => {
    lsSet(LS.notifPerm, perm);
    if (perm === 'granted') {
      // Register service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      }
      showToast('Notification Enabled! 🔔', 'green');
    } else {
      showToast('Notification Denied 🔕', 'red');
    }
    loadProfile();
  });
}

/* ---------- SEND MESSAGE ---------- */
function initSendMessage() {
  const msgInput = document.getElementById('msgInput');
  const charCount = document.getElementById('charCount');
  msgInput.addEventListener('input', () => {
    charCount.textContent = msgInput.value.length;
  });

  document.getElementById('sendBtn').addEventListener('click', async () => {
    const text = msgInput.value.trim();
    if (!text) { showToast('মেসেজ লিখুন!', 'red'); return; }

    const profile = ls(LS.profile) || {};
    const anon = document.getElementById('anonCheck').checked;
    const name = anon ? 'Unknown User' : (document.getElementById('inputName').value.trim() || profile.name || 'Unknown User');
    const wa   = anon ? 'Hidden'       : (document.getElementById('inputWhatsapp').value.trim() || profile.whatsapp || 'Not Added');
    const fb   = anon ? 'Hidden'       : (document.getElementById('inputFbLink').value.trim()   || profile.fb   || 'Not Added');

    const msgId = getNextMsgId();
    const bdTime = getBDTime();

    const payload = {
      action: 'send',
      uid: currentUID,
      msgId,
      text,
      name,
      wa,
      fb,
      time: bdTime.fullStr,
      anon,
      device: getDeviceModel(),
      connection: getConnectionInfo(),
    };

    try {
      const res = await fetch(`${CFG.apiBase}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        // Save to local send history
        const hist = ls(LS.sendHistory) || [];
        hist.push({ msgId, uid: currentUID, text, time: `${bdTime.timeStr.replace(':',':').replace(':','  ')} | Date: ${bdTime.dateStr}` });
        lsSet(LS.sendHistory, hist);
        msgInput.value = '';
        charCount.textContent = '0';
        // Update profile send count
        const pr = ls(LS.profile) || {};
        pr.sendCount = (pr.sendCount || 0) + 1;
        lsSet(LS.profile, pr);
        // Show success popup
        document.getElementById('successPopup').style.display = 'flex';
        // Show notification permission popup after a delay
        setTimeout(() => {
          if (Notification.permission === 'default') {
            document.getElementById('notifPopup').style.display = 'flex';
          }
        }, 2000);
      } else {
        showToast('Error sending message. Try again.', 'red');
      }
    } catch {
      showToast('Network error. Check connection.', 'red');
    }
  });
}

function getNextMsgId() {
  const c = (ls(LS.msgIdCounter) || 0) + 1;
  lsSet(LS.msgIdCounter, c);
  return c;
}

/* ---------- POPUP HELPERS ---------- */
function closePopup(id) {
  document.getElementById(id).style.display = 'none';
  if (id === 'successPopup') openSection('receivedHistory');
}

function scrollToReply() {
  closePopup('replyPopup');
  document.getElementById('msgInput').focus();
  document.getElementById('msgInput').scrollIntoView({ behavior: 'smooth' });
}

/* ---------- ADS CONTROL ---------- */
function initAds() {
  // Check ads status from server
  fetch(`${CFG.apiBase}/broadcast?action=adsStatus`)
    .then(r => r.json())
    .then(d => {
      const c = document.getElementById('adsContainer');
      if (c) c.style.display = d.adsEnabled ? 'block' : 'none';
    }).catch(() => {
      // Show ads by default
      const c = document.getElementById('adsContainer');
      if (c) c.style.display = 'block';
    });

  // 30% click chance
  document.addEventListener('click', () => {
    if (Math.random() < 0.30) {
      const c = document.getElementById('adsContainer');
      if (c) { c.style.display = 'block'; }
    }
  });
}

/* ---------- POLL FOR NEW MESSAGES ---------- */
let lastPollTime = Date.now();
async function pollMessages() {
  try {
    const res = await fetch(`${CFG.apiBase}/user?action=getMessages&uid=${currentUID}&since=${lastPollTime}`);
    const data = await res.json();
    if (data.messages && data.messages.length) {
      data.messages.forEach(msg => {
        const seen = ls(LS.seenMsgs) || [];
        if (!seen.includes(msg.id)) {
          seen.push(msg.id);
          lsSet(LS.seenMsgs, seen);
          // Save to recv history
          const hist = ls(LS.recvHistory) || [];
          const msgId = (hist.length ? Math.max(...hist.map(m => m.msgId)) : 0) + 1;
          hist.push({ msgId, uid: currentUID, text: msg.text, time: msg.time });
          lsSet(LS.recvHistory, hist);
          // Update profile recv count
          const pr = ls(LS.profile) || {};
          pr.recvCount = (pr.recvCount || 0) + 1;
          lsSet(LS.profile, pr);
          // Show popup
          showReplyPopup(msg);
          // Send seen notification
          sendSeenNotification(msg.id);
        }
      });
    }
    // Check broadcast
    if (data.broadcast) {
      const bseen = ls(LS.seenBroadcast) || [];
      if (!bseen.includes(data.broadcast.id)) {
        bseen.push(data.broadcast.id);
        lsSet(LS.seenBroadcast, bseen);
        showBroadcastPopup(data.broadcast);
        // Send broadcast seen
        fetch(`${CFG.apiBase}/broadcast?action=seen&uid=${currentUID}&bid=${data.broadcast.id}`).catch(() => {});
      }
    }
    lastPollTime = Date.now();
  } catch {}
}

async function sendSeenNotification(msgId) {
  try {
    await fetch(`${CFG.apiBase}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seen', uid: currentUID, msgId, seenTime: getBDTime().fullStr }),
    });
  } catch {}
}

function showReplyPopup(msg) {
  document.getElementById('replyPopupMsg').textContent = msg.text;
  document.getElementById('replyPopupTime').textContent = msg.time;
  document.getElementById('replyPopup').style.display = 'flex';
  // Push notification
  if (Notification.permission === 'granted') {
    new Notification('📩 চিঠি পাঠান - New Message!', {
      body: 'You Have Received New Notification From Admin – Click To Open',
      icon: '/manifest.json',
    });
  }
}

function showBroadcastPopup(bc) {
  document.getElementById('broadcastMsg').textContent = bc.text;
  document.getElementById('broadcastTime').textContent = bc.time;
  document.getElementById('broadcastPopup').style.display = 'flex';
  setTimeout(() => closePopup('broadcastPopup'), 5000);
}

/* ---------- TOAST NOTIFICATION ---------- */
function showToast(msg, color) {
  const colors = { green: '#00ff88', red: '#ef4444', cyan: '#22d3ee', lime: '#84cc16', orange: '#f97316' };
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
    background: '#111', color: colors[color] || '#fff',
    border: `1px solid ${colors[color] || '#fff'}`,
    padding: '10px 22px', borderRadius: '8px', zIndex: '9999',
    fontFamily: "'Hind Siliguri', sans-serif", fontWeight: '600',
    boxShadow: `0 0 20px ${colors[color]}40`, transition: 'opacity 0.3s',
    maxWidth: '90vw', textAlign: 'center',
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
}

/* ---------- UTILITIES ---------- */
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  return String(str).replace(/'/g,'&#39;').replace(/"/g,'&quot;');
}

/* ---------- MAIN INIT ---------- */
async function init() {
  initFloatingEmojis();

  // Loading screen: 2.5s then open site
  setTimeout(async () => {
    hideLoading();
    await initUserID();
    const banned = await checkBan();
    if (banned) return;
    document.getElementById('mainSite').style.display = 'block';
    startClock();
    initMenu();
    initSendMessage();
    initAds();
    // Start polling every 8 seconds
    setInterval(pollMessages, 8000);
    pollMessages();
    // Service worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, 2600);
}

document.addEventListener('DOMContentLoaded', init);
