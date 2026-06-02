/* ============================================================
   api/database.js — JSONBin Database Helper
   ============================================================ */

const JSONBIN_BIN_ID     = process.env.JSONBIN_BIN_ID     || '6a048364250b1311c344cc10';
const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY  || '$2a$10$dFJuDsfbDqqnkKBPh2bGMuHea6RJjPSU2bv67bkIM9GaJkypisWdW';
const JSONBIN_ACCESS_KEY = process.env.JSONBIN_ACCESS_KEY  || '$2a$10$YzxVA/b2UjEZCT9QRI5j0.zgsb1l4ZPRMA4PPFb6Q7QvJG7joNRRy';

const BASE_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

/* Default DB shape */
const DEFAULT_DB = {
  meta: { nextUID: 1001, nextCaptionNum: 1, adsEnabled: true },
  users: {},       // keyed by uid
  messages: [],    // { id, fromUID, toUID, text, time, seen, deleted }
  captions: [],    // { id, captionNum, text, addedBy, time }
  broadcasts: [],  // { id, text, time, seenBy: [] }
  replies: [],     // { id, toUID, text, time, seen }
};

let _dbCache = null;
let _lastFetch = 0;
const CACHE_TTL = 4000; // ms

async function readDB() {
  const now = Date.now();
  if (_dbCache && (now - _lastFetch) < CACHE_TTL) return _dbCache;
  const res = await fetch(`${BASE_URL}/latest`, {
    headers: {
      'X-Master-Key': JSONBIN_MASTER_KEY,
      'X-Access-Key': JSONBIN_ACCESS_KEY,
    },
  });
  if (!res.ok) {
    if (_dbCache) return _dbCache;
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
  const json = await res.json();
  _dbCache = { ...DEFAULT_DB, ...json.record };
  _lastFetch = now;
  return _dbCache;
}

async function writeDB(db) {
  _dbCache = db;
  _lastFetch = Date.now();
  const res = await fetch(BASE_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_MASTER_KEY,
      'X-Access-Key': JSONBIN_ACCESS_KEY,
    },
    body: JSON.stringify(db),
  });
  if (!res.ok) throw new Error('DB write failed');
  return true;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

module.exports = { readDB, writeDB, genId, DEFAULT_DB };
