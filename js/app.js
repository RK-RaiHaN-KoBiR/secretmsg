// ============================================================
// 💌 Secret Message Box — Main App Logic
// ============================================================

(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────
  const STATE = {
    userId: null,
    currentPage: 'home',
    menuOpen: false,
    isAnonymous: false,
    sendHistory: [],
    receiveHistory: [],
  };

  // ── DOM Ready ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    initParticles();
    initUserId();
    initMenu();
    initForm();
    initAnonymousCheckbox();
    initCharCount();
    checkForReplies();
    registerSW();
    trackNewUser();
    initNotificationBanner();
    loadHistoryFromStorage();
  }

  // ── Service Worker ───────────────────────────────────────
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('✅ SW registered');
        setInterval(() => {
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'CHECK_REPLIES', userId: STATE.userId
            });
          }
        }, 60000); // Poll every 60s
      }).catch(console.error);

      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'POLL_REPLIES') checkForReplies();
      });
    }
  }

  // ── User ID ───────────────────────────────────────────────
  function initUserId() {
    let uid = localStorage.getItem('smb_uid');
    if (!uid) {
      uid = String(Math.floor(100 + Math.random() * 900));
      // Ensure uniqueness attempt (simple timestamp salt in display but keep 3-digit key)
      localStorage.setItem('smb_uid', uid);
      localStorage.setItem('smb_uid_created', new Date().toISOString());
    }
    STATE.userId = uid;
    const el = document.getElementById('userIdDisplay');
    if (el) el.textContent = uid;
  }

  // ── Floating Particles ───────────────────────────────────
  function initParticles() {
    const canvas = document.querySelector('.bg-canvas');
    if (!canvas) return;
    const particles = ['💖', '✨', '🌸', '💫', '❤️', '🌷', '💕', '⭐', '🦋'];
    const count = window.innerWidth < 480 ? 10 : 18;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.textContent = particles[Math.floor(Math.random() * particles.length)];
      p.style.cssText = `
        left: ${Math.random() * 100}%;
        font-size: ${0.7 + Math.random() * 1.2}rem;
        animation-duration: ${6 + Math.random() * 12}s;
        animation-delay: ${-Math.random() * 15}s;
      `;
      canvas.appendChild(p);
    }
  }

  // ── Dropdown Menu ─────────────────────────────────────────
  function initMenu() {
    const btn = document.getElementById('menuBtn');
    const menu = document.getElementById('dropdownMenu');
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      STATE.menuOpen = !STATE.menuOpen;
      menu.classList.toggle('open', STATE.menuOpen);
    });
    document.addEventListener('click', () => {
      STATE.menuOpen = false;
      menu.classList.remove('open');
    });

    // Menu items
    document.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(el.dataset.page);
        menu.classList.remove('open');
        STATE.menuOpen = false;
      });
    });
  }

  // ── Page Navigation ───────────────────────────────────────
  function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');
    STATE.currentPage = page;

    if (page === 'send-history') renderSendHistory();
    if (page === 'receive-history') renderReceiveHistory();
    if (page === 'settings') renderSettings();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Back buttons
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-back]')) navigateTo('home');
  });

  // ── Anonymous Checkbox ────────────────────────────────────
  function initAnonymousCheckbox() {
    const cb = document.getElementById('anonCheckbox');
    const nameInput = document.getElementById('inputName');
    const phoneInput = document.getElementById('inputPhone');
    const fbInput = document.getElementById('inputFb');
    if (!cb) return;

    cb.addEventListener('change', () => {
      STATE.isAnonymous = cb.checked;
      const fields = [nameInput, phoneInput, fbInput];
      fields.forEach(f => {
        if (!f) return;
        f.disabled = cb.checked;
        if (cb.checked) {
          f._prev = f.value;
          f.value = '';
          f.placeholder = f.dataset.anonPlaceholder || '🔒 Hidden';
        } else {
          f.value = f._prev || '';
          f.placeholder = f.dataset.placeholder || '';
        }
      });
    });
  }

  // ── Char Counter ──────────────────────────────────────────
  function initCharCount() {
    const ta = document.getElementById('inputMessage');
    const counter = document.getElementById('charCount');
    if (!ta || !counter) return;
    const MAX = 1000;
    ta.addEventListener('input', () => {
      const len = ta.value.length;
      counter.textContent = `${len} / ${MAX}`;
      counter.className = 'char-count' + (len > MAX * 0.9 ? ' warn' : '') + (len > MAX ? ' over' : '');
    });
  }

  // ── Form Submit ───────────────────────────────────────────
  function initForm() {
    const form = document.getElementById('msgForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSend();
    });
  }

  async function handleSend() {
    const btn = document.getElementById('sendBtn');
    const msg = document.getElementById('inputMessage')?.value.trim();
    if (!msg) {
      showToast('⚠️ বার্তা লিখুন! Message box blank রাখা যাবে না।', 'error');
      return;
    }
    if (msg.length > 1000) {
      showToast('⚠️ Message too long! Max 1000 characters.', 'error');
      return;
    }

    const cb = document.getElementById('anonCheckbox');
    const isAnon = cb?.checked;
    const name  = isAnon ? 'Unknown User' : (document.getElementById('inputName')?.value.trim() || 'Unknown');
    const phone = isAnon ? 'Hidden' : (document.getElementById('inputPhone')?.value.trim() || 'Not provided');
    const fb    = isAnon ? 'Hidden' : (document.getElementById('inputFb')?.value.trim() || 'Not provided');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Sending...';

    try {
      const res = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: STATE.userId,
          name, phone, fb, message: msg,
          isAnonymous: isAnon,
          timestamp: new Date().toISOString()
        })
      });
      const data = await res.json();

      if (data.success) {
        showToast('💌 Message sent successfully! Admin কে জানানো হয়েছে।', 'success');
        document.getElementById('inputMessage').value = '';
        document.getElementById('charCount').textContent = '0 / 1000';
        if (!isAnon) {
          if (document.getElementById('inputName')) document.getElementById('inputName').value = '';
          if (document.getElementById('inputPhone')) document.getElementById('inputPhone').value = '';
          if (document.getElementById('inputFb')) document.getElementById('inputFb').value = '';
        }
        if (cb?.checked) { cb.checked = false; cb.dispatchEvent(new Event('change')); }

        // Save to send history
        const entry = { id: data.msgId || Date.now(), message: msg, name, isAnon, time: new Date().toLocaleString('en-BD'), status: 'sent' };
        STATE.sendHistory.unshift(entry);
        localStorage.setItem('smb_send_history', JSON.stringify(STATE.sendHistory.slice(0, 50)));
      } else {
        showToast('❌ ' + (data.error || 'Failed to send. Please try again.'), 'error');
      }
    } catch (err) {
      showToast('❌ Network error. Check your connection.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'SEND MESSAGE <span class="btn-icon">💌</span>';
    }
  }

  // ── Track New User (background) ───────────────────────────
  async function trackNewUser() {
    const key = 'smb_tracked_' + STATE.userId;
    if (localStorage.getItem(key)) return;
    try {
      await fetch('/api/track-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: STATE.userId, timestamp: new Date().toISOString() })
      });
      localStorage.setItem(key, '1');
    } catch (_) {}
  }

  // ── Check For Replies ─────────────────────────────────────
  async function checkForReplies() {
    if (!STATE.userId) return;
    try {
      const res = await fetch('/api/get-reply?userId=' + STATE.userId);
      const data = await res.json();
      if (data.hasNewReply && data.reply) {
        // Save to receive history
        const existing = STATE.receiveHistory.find(r => r.id === data.reply.id);
        if (!existing) {
          STATE.receiveHistory.unshift(data.reply);
          localStorage.setItem('smb_receive_history', JSON.stringify(STATE.receiveHistory.slice(0, 50)));

          // Show popup (once per message id)
          const seenKey = 'smb_seen_reply_' + data.reply.id;
          if (!localStorage.getItem(seenKey)) {
            showReplyPopup(data.reply);
            localStorage.setItem(seenKey, '1');

            // Mark as seen on server
            fetch('/api/mark-seen', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: STATE.userId, replyId: data.reply.id })
            }).catch(() => {});
          }
        }
      }
    } catch (_) {}
  }

  // ── Reply Popup ───────────────────────────────────────────
  function showReplyPopup(reply) {
    const overlay = document.getElementById('replyOverlay');
    const msgEl = document.getElementById('popupMessage');
    const metaEl = document.getElementById('popupMeta');
    if (!overlay || !msgEl) return;

    msgEl.textContent = reply.message;
    if (metaEl) metaEl.textContent = '🕒 ' + reply.time + '  |  👑 Message From Admin';

    overlay.classList.add('active');
  }

  document.addEventListener('click', (e) => {
    if (e.target.matches('#closeReplyPopup') || e.target.matches('#replyOverlay')) {
      document.getElementById('replyOverlay')?.classList.remove('active');
    }
  });

  // ── Notification Permission Banner ─────────────────────────
  function initNotificationBanner() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    if (localStorage.getItem('smb_notif_dismissed')) return;

    setTimeout(() => {
      document.getElementById('notifBanner')?.classList.add('show');
    }, 2500);
  }

  window.allowNotifications = async function () {
    const banner = document.getElementById('notifBanner');
    banner?.classList.remove('show');
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      showToast('🔔 Notifications enabled! আপনি নোটিফিকেশন পাবেন।', 'success');
    }
  };
  window.dismissNotifBanner = function () {
    document.getElementById('notifBanner')?.classList.remove('show');
    localStorage.setItem('smb_notif_dismissed', '1');
  };

  // ── History Rendering ─────────────────────────────────────
  function loadHistoryFromStorage() {
    try {
      STATE.sendHistory = JSON.parse(localStorage.getItem('smb_send_history') || '[]');
      STATE.receiveHistory = JSON.parse(localStorage.getItem('smb_receive_history') || '[]');
    } catch (_) {}
  }

  function renderSendHistory() {
    const list = document.getElementById('sendHistoryList');
    if (!list) return;
    if (!STATE.sendHistory.length) {
      list.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span><p>এখনো কোনো Message পাঠানো হয়নি।</p></div>`;
      return;
    }
    list.innerHTML = STATE.sendHistory.map(item => `
      <div class="history-item">
        <div class="history-meta">
          <span class="history-id">🆔 ${item.name || 'Unknown'} ${item.isAnon ? '🕶' : ''}</span>
          <span class="history-badge badge-${item.status || 'sent'}">${statusLabel(item.status)}</span>
        </div>
        <div class="history-time" style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px">🕒 ${item.time}</div>
        <div class="history-msg">${escapeHtml(item.message)}</div>
        ${item.reply ? `<div class="history-reply">💬 Admin Reply: ${escapeHtml(item.reply)}</div>` : ''}
      </div>
    `).join('');
  }

  function renderReceiveHistory() {
    const list = document.getElementById('receiveHistoryList');
    if (!list) return;
    if (!STATE.receiveHistory.length) {
      list.innerHTML = `<div class="empty-state"><span class="empty-icon">📥</span><p>এখনো কোনো Reply পাওয়া যায়নি।</p></div>`;
      return;
    }
    list.innerHTML = STATE.receiveHistory.map(item => `
      <div class="history-item">
        <div class="history-meta">
          <span class="history-id">👑 Admin</span>
          <span class="history-badge badge-replied">💬 Reply</span>
        </div>
        <div class="history-time" style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px">🕒 ${item.time}</div>
        <div class="history-msg">${escapeHtml(item.message)}</div>
      </div>
    `).join('');
  }

  function renderSettings() {
    const el = document.getElementById('settingsUserId');
    if (el) el.textContent = STATE.userId;
  }

  function statusLabel(s) {
    const map = { sent: '✅ Sent', pending: '⏳ Pending', replied: '💬 Replied' };
    return map[s] || '✅ Sent';
  }

  // ── Toast ─────────────────────────────────────────────────
  window.showToast = function (msg, type = 'info') {
    let toast = document.getElementById('mainToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'mainToast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'toast ' + type;
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3800);
  };

  // ── Utilities ─────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Expose for inline onclick attrs
  window.navigateTo = navigateTo;
  window.checkForReplies = checkForReplies;

})();
