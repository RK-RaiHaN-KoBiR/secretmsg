// =============================================
// API: /api/ads-status
// Returns current ads on/off status from Firestore
// Also used by bot webhook to toggle ads
// =============================================

const admin = require('firebase-admin');

// Initialize Firebase Admin (server-side)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID || 'cithi-pathan',
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || ''
    })
  });
}

const db = admin.firestore();

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    // Return ads status for frontend
    try {
      const doc = await db.collection('_system').doc('adsConfig').get();
      const enabled = doc.exists ? doc.data().enabled !== false : true;
      return res.status(200).json({ enabled });
    } catch {
      return res.status(200).json({ enabled: true });
    }
  }

  if (req.method === 'POST') {
    // Toggle ads from bot (requires secret key)
    const { action, secret } = req.body;
    if (secret !== process.env.API_SECRET && secret !== 'cithi-secret-2026') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const enabled = action === 'on';
    await db.collection('_system').doc('adsConfig').set({ enabled });
    return res.status(200).json({ success: true, enabled });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
