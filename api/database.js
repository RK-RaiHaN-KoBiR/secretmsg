/**
 * ═══════════════════════════════════════════════════════
 *  /api/database.js — Firebase REST helper
 *  Used by other API routes to read/write Firebase data
 *  without the Admin SDK (pure fetch-based REST calls)
 * ═══════════════════════════════════════════════════════
 */

'use strict';

const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || "https://cithi-pathan-default-rtdb.firebaseio.com";
const FIREBASE_SECRET = process.env.FIREBASE_SECRET || ""; // optional legacy secret

/* ──────────────────────────────────────────────────────
   AUTH PARAM — appended to every request if secret exists
────────────────────────────────────────────────────── */
function authParam() {
  return FIREBASE_SECRET ? `?auth=${FIREBASE_SECRET}` : '';
}

/* ──────────────────────────────────────────────────────
   READ  →  GET /path.json
────────────────────────────────────────────────────── */
export async function dbGet(path) {
  const url = `${FIREBASE_DB_URL}/${path}.json${authParam()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firebase GET failed: ${res.status}`);
  return res.json();
}

/* ──────────────────────────────────────────────────────
   WRITE  →  PUT /path.json  (overwrites)
────────────────────────────────────────────────────── */
export async function dbSet(path, data) {
  const url = `${FIREBASE_DB_URL}/${path}.json${authParam()}`;
  const res = await fetch(url, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Firebase SET failed: ${res.status}`);
  return res.json();
}

/* ──────────────────────────────────────────────────────
   UPDATE  →  PATCH /path.json  (merges)
────────────────────────────────────────────────────── */
export async function dbUpdate(path, data) {
  const url = `${FIREBASE_DB_URL}/${path}.json${authParam()}`;
  const res = await fetch(url, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Firebase UPDATE failed: ${res.status}`);
  return res.json();
}

/* ──────────────────────────────────────────────────────
   DELETE  →  DELETE /path.json
────────────────────────────────────────────────────── */
export async function dbDelete(path) {
  const url = `${FIREBASE_DB_URL}/${path}.json${authParam()}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Firebase DELETE failed: ${res.status}`);
  return res.json();
}

/* ──────────────────────────────────────────────────────
   PUSH  →  POST /path.json  (Firebase auto-key)
────────────────────────────────────────────────────── */
export async function dbPush(path, data) {
  const url = `${FIREBASE_DB_URL}/${path}.json${authParam()}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Firebase PUSH failed: ${res.status}`);
  return res.json(); // returns { name: "-MxAutoKey..." }
}

/* ──────────────────────────────────────────────────────
   GET ALL USERS  (helper for bot use)
────────────────────────────────────────────────────── */
export async function getAllUsers() {
  const data = await dbGet('users');
  if (!data) return [];
  return Object.entries(data).map(([uid, val]) => ({ uid, ...val }));
}

/* ──────────────────────────────────────────────────────
   GET USER  (by UID)
────────────────────────────────────────────────────── */
export async function getUser(uid) {
  return dbGet(`users/${uid}`);
}

/* ──────────────────────────────────────────────────────
   BAN / UNBAN USER
────────────────────────────────────────────────────── */
export async function banUser(uid)   { return dbUpdate(`users/${uid}`, { banned: true }); }
export async function unbanUser(uid) { return dbUpdate(`users/${uid}`, { banned: false }); }

/* ──────────────────────────────────────────────────────
   CLEAR USER DATA  (admin: wipe a user from DB)
────────────────────────────────────────────────────── */
export async function clearUser(uid) {
  return dbDelete(`users/${uid}`);
}

/* ──────────────────────────────────────────────────────
   SEND REPLY TO USER  (write to receivedMessages)
────────────────────────────────────────────────────── */
export async function sendReplyToUser(uid, message, adminId) {
  // Get existing message count for sequential ID
  const existing = await dbGet(`users/${uid}/receivedMessages`);
  const count    = existing ? Object.keys(existing).length : 0;
  const msgId    = String(count + 1).padStart(2, '0');

  const msgData = {
    msgId,
    message,
    timestamp: Date.now(),
    sentBy:    'admin',
    seenAt:    null
  };

  await dbSet(`users/${uid}/receivedMessages/${msgId}`, msgData);

  // Increment totalRecv in profile
  const user = await getUser(uid);
  const prev = user?.profile?.totalRecv || 0;
  await dbUpdate(`users/${uid}/profile`, { totalRecv: prev + 1 });

  return msgData;
}

/* ──────────────────────────────────────────────────────
   DELETE MESSAGE from both sides
────────────────────────────────────────────────────── */
export async function deleteMessage(uid, msgId, type) {
  // type: 'sent' | 'received'
  const path = type === 'sent'
    ? `users/${uid}/sendHistory/${msgId}`
    : `users/${uid}/receivedMessages/${msgId}`;
  return dbDelete(path);
}

/* ──────────────────────────────────────────────────────
   BROADCAST to Firebase  (bot writes here, frontend listens)
────────────────────────────────────────────────────── */
export async function writeBroadcast(message) {
  const data = {
    id:        Date.now().toString(),
    message,
    timestamp: Date.now()
  };
  await dbSet('broadcast/latest', data);
  return data;
}

/* ──────────────────────────────────────────────────────
   CAPTIONS CRUD
────────────────────────────────────────────────────── */
export async function getAllCaptions() {
  const data = await dbGet('captions');
  if (!data) return [];
  return Object.entries(data).map(([k, v]) => ({ _key: k, ...v }));
}

export async function addCaption(text, addedBy) {
  const existing = await dbGet('captions');
  const count    = existing ? Object.keys(existing).length : 0;
  const capId    = String(count + 1).padStart(2, '0');
  const capData  = { capId, text, addedBy, timestamp: Date.now() };
  await dbSet(`captions/${capId}`, capData);
  return capData;
}

export async function updateCaption(capId, text) {
  return dbUpdate(`captions/${capId}`, { text });
}

export async function deleteCaption(capId) {
  return dbDelete(`captions/${capId}`);
}

/* ──────────────────────────────────────────────────────
   ADS TOGGLE  (admin bot controls this)
────────────────────────────────────────────────────── */
export async function setAdsStatus(enabled) {
  return dbSet('settings/adsEnabled', enabled);
}

export async function getAdsStatus() {
  const val = await dbGet('settings/adsEnabled');
  return val !== false; // default true
}

/* ──────────────────────────────────────────────────────
   SITE VERSION  (increment to force reload all clients)
────────────────────────────────────────────────────── */
export async function bumpVersion() {
  const ver = Date.now();
  await dbSet('settings/version', ver);
  return ver;
}

/* ──────────────────────────────────────────────────────
   GET ALL PUSH SUBSCRIPTIONS  (for broadcast push)
────────────────────────────────────────────────────── */
export async function getAllSubscriptions() {
  const data = await dbGet('pushSubscriptions');
  if (!data) return [];
  return Object.values(data);
}

/* ──────────────────────────────────────────────────────
   DEFAULT EXPORT — for Vercel route health check
────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  // Health check
  return res.status(200).json({ status: 'ok', service: 'database helper' });
}
