/* ===== database.js — JSONBin DB Helper ===== */

const JSONBIN_BIN_ID    = process.env.JSONBIN_BIN_ID    || '6a048364250b1311c344cc10';
const JSONBIN_MASTER_KEY= process.env.JSONBIN_MASTER_KEY || '$2a$10$dFJuDsfbDqqnkKBPh2bGMuHea6RJjPSU2bv67bkIM9GaJkypisWdW';
const JSONBIN_ACCESS_KEY= process.env.JSONBIN_ACCESS_KEY || '$2a$10$YzxVA/b2UjEZCT9QRI5j0.zgsb1l4ZPRMA4PPFb6Q7QvJG7joNRRy';

const BIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
const HEADERS  = {
  'Content-Type': 'application/json',
  'X-Master-Key': JSONBIN_MASTER_KEY,
  'X-Access-Key': JSONBIN_ACCESS_KEY
};

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 5000; // 5s

async function readDB() {
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;
  const res  = await fetch(BIN_URL + '/latest', { headers: HEADERS });
  const json = await res.json();
  _cache = json.record || getDefaultDB();
  _cacheTime = Date.now();
  return _cache;
}

async function writeDB(data) {
  _cache = data;
  _cacheTime = Date.now();
  const res = await fetch(BIN_URL, {
    method: 'PUT', headers: HEADERS,
    body: JSON.stringify(data)
  });
  return res.ok;
}

function getDefaultDB() {
  return {
    nextUserId: 1001,
    nextMsgId: 1,
    users: {},
    sentMessages: [],
    receivedMessages: [],
    captions: [],
    broadcasts: [],
    nextCaptionId: 1,
    nextCaptionNum: 1
  };
}

function getBDTime() {
  return new Date().toLocaleString('en-GB', {
    timeZone: 'Asia/Dhaka', hour12: true,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

module.exports = { readDB, writeDB, getBDTime, getDefaultDB };
