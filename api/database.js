// ===== DATABASE HELPER — JSONBin =====
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID || '6a048364250b1311c344cc10';
const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY || '$2a$10$dFJuDsfbDqqnkKBPh2bGMuHea6RJjPSU2bv67bkIM9GaJkypisWdW';
const JSONBIN_ACCESS_KEY = process.env.JSONBIN_ACCESS_KEY || '$2a$10$YzxVA/b2UjEZCT9QRI5j0.zgsb1l4ZPRMA4PPFb6Q7QvJG7joNRRy';
const BASE_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

let _cache = null;

async function readDB() {
  if (_cache) return JSON.parse(JSON.stringify(_cache));
  const res = await fetch(BASE_URL + '/latest', {
    headers: { 'X-Master-Key': JSONBIN_MASTER_KEY, 'X-Access-Key': JSONBIN_ACCESS_KEY }
  });
  const data = await res.json();
  const record = data.record || getDefaultDB();
  _cache = record;
  return JSON.parse(JSON.stringify(record));
}

async function writeDB(record) {
  _cache = JSON.parse(JSON.stringify(record));
  const res = await fetch(BASE_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_MASTER_KEY,
      'X-Access-Key': JSONBIN_ACCESS_KEY
    },
    body: JSON.stringify(record)
  });
  return res.ok;
}

function getDefaultDB() {
  return {
    meta: { lastUserId: 1000 },
    users: {},
    messages: [],
    replies: [],
    captions: [],
    broadcast: null,
    newCaption: null,
    adsEnabled: true
  };
}

function getBDTime() {
  return new Intl.DateTimeFormat('en-BD', {
    timeZone: 'Asia/Dhaka', day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit', hour12: true
  }).format(new Date()).replace(',', ' —') + ' BD Time';
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function invalidateCache() { _cache = null; }

module.exports = { readDB, writeDB, getDefaultDB, getBDTime, genId, invalidateCache };
