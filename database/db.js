// =============================================
// DATABASE HELPERS (database/db.js)
// Reusable Firestore operations
// Used by bot and API routes
// =============================================

const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
function initFirebase() {
  if (admin.apps.length) return admin.app();
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID   || 'cithi-pathan',
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || ''
    })
  });
}

initFirebase();
const db = admin.firestore();

module.exports = {

  // ---- USER OPERATIONS ----

  // Get a user by UID
  async getUser(uid) {
    const doc = await db.collection('users').doc(String(uid)).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  // Get all users (sorted by creation date)
  async getAllUsers(limit = 50) {
    const snap = await db.collection('users')
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // Ban a user
  async banUser(uid) {
    await db.collection('users').doc(String(uid)).update({ banned: true });
  },

  // Unban a user
  async unbanUser(uid) {
    await db.collection('users').doc(String(uid)).update({ banned: false });
  },

  // Check if user is banned
  async isBanned(uid) {
    const user = await this.getUser(uid);
    return user ? user.banned === true : false;
  },

  // Update user profile fields
  async updateUser(uid, data) {
    await db.collection('users').doc(String(uid)).update(data);
  },

  // Clear ALL data for a specific user
  async clearUserData(uid) {
    const batch = db.batch();

    // Delete sent messages
    const sentSnap = await db.collection('sentMessages')
      .where('userID', '==', parseInt(uid))
      .get();
    sentSnap.forEach(d => batch.delete(d.ref));

    // Delete received replies
    const recvSnap = await db.collection('adminReplies')
      .where('toUID', '==', parseInt(uid))
      .get();
    recvSnap.forEach(d => batch.delete(d.ref));

    // Delete user captions
    const capSnap = await db.collection('captions')
      .where('addedByUID', '==', parseInt(uid))
      .get();
    capSnap.forEach(d => batch.delete(d.ref));

    // Delete user doc
    batch.delete(db.collection('users').doc(String(uid)));

    // Delete counters
    batch.delete(db.collection('_counters').doc(`sentMessages_${uid}`));
    batch.delete(db.collection('_counters').doc(`adminReplies_${uid}`));

    await batch.commit();
    return true;
  },

  // ---- MESSAGE OPERATIONS ----

  // Get messages sent by a specific user
  async getUserSentMessages(uid, limit = 20) {
    const snap = await db.collection('sentMessages')
      .where('userID', '==', parseInt(uid))
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // Get all received messages (from all users)
  async getAllReceivedMessages(limit = 20) {
    const snap = await db.collection('sentMessages')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // Delete a message by document ID
  async deleteMessage(collection, docId) {
    await db.collection(collection).doc(docId).delete();
  },

  // ---- ADMIN REPLY OPERATIONS ----

  // Get replies sent to a specific user
  async getUserReplies(uid, limit = 20) {
    const snap = await db.collection('adminReplies')
      .where('toUID', '==', parseInt(uid))
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // Get all admin replies (reply history)
  async getAllReplies(limit = 20) {
    const snap = await db.collection('adminReplies')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // Mark a reply as seen by user
  async markReplySeen(docId, seenTime, seenDate) {
    await db.collection('adminReplies').doc(docId).update({
      seenByUser: true,
      seenTime,
      seenDate
    });
  },

  // ---- CAPTION OPERATIONS ----

  // Get all captions
  async getAllCaptions(limit = 50) {
    const snap = await db.collection('captions')
      .orderBy('timestamp', 'asc')
      .limit(limit)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // Add a new caption
  async addCaption(text, addedBy, addedByUID, timeStr, dateStr) {
    const capID = await this.getNextID('globalCapID');
    const ref   = await db.collection('captions').add({
      capID,
      text,
      addedBy,
      addedByUID,
      addedTime:  timeStr,
      addedDate:  dateStr,
      timestamp:  admin.firestore.FieldValue.serverTimestamp()
    });
    return { id: ref.id, capID };
  },

  // Edit a caption
  async editCaption(docId, newText) {
    await db.collection('captions').doc(docId).update({ text: newText });
  },

  // Delete a caption
  async deleteCaption(docId) {
    await db.collection('captions').doc(docId).delete();
  },

  // ---- BROADCAST OPERATIONS ----

  // Send a broadcast message (saved to Firestore, users see via realtime)
  async addBroadcast(message, timeStr, dateStr) {
    const ref = await db.collection('broadcasts').add({
      message,
      sendTime:  timeStr,
      sendDate:  dateStr,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },

  // ---- ADS CONTROL ----

  // Get ads status
  async getAdsStatus() {
    const doc = await db.collection('_system').doc('adsConfig').get();
    return !doc.exists || doc.data().enabled !== false;
  },

  // Set ads status
  async setAdsStatus(enabled) {
    await db.collection('_system').doc('adsConfig').set({ enabled });
  },

  // ---- SEQUENTIAL ID GENERATOR ----

  // Generate next sequential ID (atomic, no duplicates)
  async getNextID(counterKey) {
    return db.runTransaction(async (t) => {
      const ref = db.collection('_counters').doc(counterKey);
      const doc = await t.get(ref);
      let next  = 1;
      if (doc.exists) next = (doc.data().last || 0) + 1;
      t.set(ref, { last: next });
      return String(next).padStart(2, '0');
    });
  },

  // ---- STATS ----

  // Get overall site statistics
  async getSiteStats() {
    const [usersSnap, msgSnap, replySnap, captionSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('sentMessages').get(),
      db.collection('adminReplies').get(),
      db.collection('captions').get()
    ]);

    const banned   = usersSnap.docs.filter(d => d.data().banned).length;
    const notified = usersSnap.docs.filter(d => d.data().notificationEnabled).length;
    const adsOn    = await this.getAdsStatus();

    return {
      totalUsers:    usersSnap.size,
      bannedUsers:   banned,
      notifEnabled:  notified,
      totalMessages: msgSnap.size,
      totalReplies:  replySnap.size,
      totalCaptions: captionSnap.size,
      adsEnabled:    adsOn
    };
  },

  // Direct Firestore access (for advanced use)
  db,
  admin
};
