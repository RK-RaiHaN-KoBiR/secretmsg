/**
 * ═══════════════════════════════════════════════════════
 *  CITHI PATHAN — bot/webhook.js  →  /api/webhook.js
 *  Vercel Serverless Function for Telegram Webhook
 *  Also handles: sending push notifications to users
 * ═══════════════════════════════════════════════════════
 *
 *  IMPORTANT: Copy this file to /api/webhook.js so Vercel
 *  exposes it at https://your-site.vercel.app/api/webhook
 *  That URL is what you set as the Telegram webhook.
 * ═══════════════════════════════════════════════════════
 */

'use strict';

import { bot, BOT_TOKEN, ADMIN_ID, bdTime } from '../bot/bot.js';
import {
  getAllSubscriptions, dbGet, dbSet,
  sendReplyToUser, getUser
} from './database.js';

/* ──────────────────────────────────────────────────────
   VAPID CONFIG — for Web Push
────────────────────────────────────────────────────── */
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || "BIh4Gq9Jk7zAHcmViGZZLSmMVwl8zcmuOdAplHXSFzljdyffQdSIJ0ACpfNHTyGFhIeG2d9O8Y6MJJhZ-MpdxBY";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "-stTkJCFdwSCV2MsKMS1fioNYi75GT1l_vIeicJ42bc";
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT     || "mailto:Taniishaakhtar@gmail.com";
const SITE_URL          = process.env.SITE_URL          || "https://cithipathao.vercel.app";

/* ──────────────────────────────────────────────────────
   MAIN WEBHOOK HANDLER
────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  /* ── GET /api/webhook — Register webhook with Telegram ── */
  if (req.method === 'GET') {
    const action = req.query.action;

    // ?action=set → register the webhook
    if (action === 'set') {
      const webhookUrl = `${SITE_URL}/api/webhook`;
      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ url: webhookUrl, drop_pending_updates: true })
          }
        );
        const data = await tgRes.json();
        return res.status(200).json({
          status: data.ok ? 'Webhook set!' : 'Failed',
          url: webhookUrl,
          telegram: data
        });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ?action=info → get current webhook info
    if (action === 'info') {
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
      return res.status(200).json(await r.json());
    }

    // ?action=delete → remove webhook (for polling mode)
    if (action === 'delete') {
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
      return res.status(200).json(await r.json());
    }

    // ?action=push&uid=1001&msg=Hello → send push to specific user
    if (action === 'push') {
      const uid     = req.query.uid;
      const message = req.query.msg || 'New message from admin!';
      if (!uid) return res.status(400).json({ error: 'uid required' });
      await sendPushToUser(uid, message);
      return res.status(200).json({ success: true, uid, message });
    }

    return res.status(200).json({
      status: 'Cithi Pathan Webhook Active',
      endpoints: {
        'set webhook':    '?action=set',
        'webhook info':   '?action=info',
        'delete webhook': '?action=delete',
        'push user':      '?action=push&uid=1001&msg=Hello'
      }
    });
  }

  /* ── POST /api/webhook — Receive Telegram updates ── */
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Webhook error:', err);
      return res.status(200).json({ ok: true }); // Always 200 to Telegram
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/* ══════════════════════════════════════════════════════
   PUSH NOTIFICATION HELPERS
══════════════════════════════════════════════════════ */

/**
 * Send push notification to a specific user
 * Called after admin sends a reply via bot
 */
export async function sendPushToUser(uid, message, title) {
  try {
    // Get user's push subscription from Firebase
    const sub = await dbGet(`pushSubscriptions/${uid}`);
    if (!sub) return { success: false, reason: 'No subscription' };

    const payload = JSON.stringify({
      title: title || '💌 চিঠি পাঠান — Cithi Pathan',
      body:  message,
      icon:  '/icons/icon-192.png',
      badge: '/icons/badge.png',
      tag:   `reply-${uid}-${Date.now()}`,
      url:   SITE_URL
    });

    const result = await webPush(sub, payload);
    return { success: true, result };
  } catch (err) {
    console.error('Push to user failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send push notification to ALL users (broadcast)
 */
export async function sendPushToAll(message, title) {
  const subs = await getAllSubscriptions();
  if (!subs.length) return { sent: 0 };

  let sent = 0;
  for (const sub of subs) {
    try {
      const payload = JSON.stringify({
        title: title || '📢 Admin Broadcast',
        body:  message,
        icon:  '/icons/icon-192.png',
        badge: '/icons/badge.png',
        tag:   `broadcast-${Date.now()}`,
        url:   SITE_URL
      });
      await webPush(sub, payload);
      sent++;
    } catch (_) {}
  }
  return { sent, total: subs.length };
}

/* ──────────────────────────────────────────────────────
   LOW-LEVEL WEB PUSH (manual VAPID — no web-push npm)
   Uses the Web Push Protocol with JWT signing via crypto
────────────────────────────────────────────────────── */
async function webPush(subscription, payload) {
  const endpoint = subscription.endpoint;
  const origin   = new URL(endpoint).origin;

  // Create VAPID JWT header + claims
  const vapidHeaders = await createVAPIDHeaders(origin);

  const headers = {
    'Content-Type':     'application/octet-stream',
    'Content-Encoding': 'aes128gcm',
    'TTL':              '86400',
    'Authorization':    vapidHeaders.Authorization
  };

  // Encrypt payload using the subscription's public key
  const encrypted = await encryptPayload(subscription, payload);

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: { ...headers, ...encrypted.headers },
    body:    encrypted.body
  });

  if (!res.ok && res.status !== 201) {
    const txt = await res.text();
    throw new Error(`Push failed ${res.status}: ${txt}`);
  }

  return { status: res.status };
}

/* ── VAPID JWT creation (ES256) ── */
async function createVAPIDHeaders(audience) {
  const now        = Math.floor(Date.now() / 1000);
  const exp        = now + 12 * 3600; // 12 hours
  const header     = { typ: 'JWT', alg: 'ES256' };
  const claims     = { aud: audience, exp, sub: VAPID_SUBJECT };

  const encHeader  = urlB64(JSON.stringify(header));
  const encClaims  = urlB64(JSON.stringify(claims));
  const sigInput   = `${encHeader}.${encClaims}`;

  // Import VAPID private key (URL-safe base64 → raw)
  const rawPriv    = base64ToBuffer(VAPID_PRIVATE_KEY);

  const cryptoKey  = await crypto.subtle.importKey(
    'pkcs8',
    toPKCS8(rawPriv),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const sigBytes   = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(sigInput)
  );

  const sig        = bufferToUrlB64(sigBytes);
  const jwt        = `${sigInput}.${sig}`;
  const pubKey     = VAPID_PUBLIC_KEY;

  return {
    Authorization: `vapid t=${jwt}, k=${pubKey}`
  };
}

/* ── Simple payload encryption (aes128gcm) ── */
async function encryptPayload(subscription, payload) {
  const serverKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, ['deriveBits']
  );

  const serverPubRaw = await crypto.subtle.exportKey('raw', serverKeys.publicKey);
  const clientPubRaw = base64ToBuffer(subscription.keys.p256dh);

  const clientKey = await crypto.subtle.importKey(
    'raw', clientPubRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, []
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey },
    serverKeys.privateKey, 256
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const auth = base64ToBuffer(subscription.keys.auth);

  // HKDF key derivation
  const prk  = await hkdf(auth, new Uint8Array(sharedBits), 'Content-Encoding: auth\0', 32);
  const cek  = await hkdf(salt, prk, buildInfo('aesgcm', clientPubRaw, serverPubRaw), 16);
  const nonce= await hkdf(salt, prk, buildInfo('nonce',  clientPubRaw, serverPubRaw), 12);

  // AES-GCM encrypt
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const data   = new TextEncoder().encode(payload);
  const padded = new Uint8Array([0, 0, ...data]); // 2-byte padding prefix

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey, padded
  );

  // Build aes128gcm content-encoding header (RFC 8188)
  const rs     = 4096;
  const keyId  = new Uint8Array(serverPubRaw);
  const header = new Uint8Array(21 + keyId.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs, false);
  header[20] = keyId.length;
  header.set(keyId, 21);

  const body = new Uint8Array(header.length + encrypted.byteLength);
  body.set(header, 0);
  body.set(new Uint8Array(encrypted), header.length);

  return {
    headers: { 'Content-Encoding': 'aes128gcm' },
    body:    body.buffer
  };
}

/* ── Crypto Utilities ── */
function urlB64(str) {
  return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function base64ToBuffer(b64) {
  const s = atob(b64.replace(/-/g,'+').replace(/_/g,'/'));
  return new Uint8Array([...s].map(c => c.charCodeAt(0))).buffer;
}
function bufferToUrlB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function toPKCS8(rawPriv) {
  // Minimal PKCS#8 wrapper for P-256 private key
  const header = new Uint8Array([
    0x30,0x41,0x02,0x01,0x00,0x30,0x13,0x06,0x07,0x2a,0x86,0x48,0xce,
    0x3d,0x02,0x01,0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,0x01,0x07,
    0x04,0x27,0x30,0x25,0x02,0x01,0x01,0x04,0x20
  ]);
  const raw = new Uint8Array(rawPriv);
  const out = new Uint8Array(header.length + raw.length);
  out.set(header); out.set(raw, header.length);
  return out.buffer;
}
async function hkdf(salt, ikm, info, length) {
  const keyMat  = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const infoEnc = typeof info === 'string' ? new TextEncoder().encode(info) : info;
  const bits    = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: infoEnc },
    keyMat, length * 8
  );
  return new Uint8Array(bits);
}
function buildInfo(type, clientKey, serverKey) {
  const enc     = new TextEncoder();
  const prefix  = enc.encode(`Content-Encoding: ${type}\0P-256\0`);
  const ck      = new Uint8Array(clientKey);
  const sk      = new Uint8Array(serverKey);
  const out     = new Uint8Array(prefix.length + 2 + ck.length + 2 + sk.length);
  let  offset   = 0;
  out.set(prefix, offset); offset += prefix.length;
  new DataView(out.buffer).setUint16(offset, ck.length, false); offset += 2;
  out.set(ck, offset); offset += ck.length;
  new DataView(out.buffer).setUint16(offset, sk.length, false); offset += 2;
  out.set(sk, offset);
  return out;
}
