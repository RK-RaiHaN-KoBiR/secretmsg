// =============================================
// DATABASE SEED (database/seed.js)
// Run once after deployment to set up
// default Firestore documents & config
//
// Usage: node database/seed.js
// =============================================

require('dotenv').config();
const dbHelper = require('./db');
const { db, admin } = dbHelper;

async function seed() {
  console.log('🌱 Starting database seed...\n');

  try {
    // 1. Initialize UID counter (start from 1000, so first user gets 1001)
    await db.collection('_counters').doc('globalUID').set({ last: 1000 });
    console.log('✅ UID counter initialized (next UID will be 1001)');

    // 2. Initialize Caption ID counter
    await db.collection('_counters').doc('globalCapID').set({ last: 0 });
    console.log('✅ Caption ID counter initialized');

    // 3. Set default ads config (ON by default)
    await db.collection('_system').doc('adsConfig').set({ enabled: true });
    console.log('✅ Ads config set to ON');

    // 4. Set site config
    await db.collection('_system').doc('siteConfig').set({
      maintenanceMode: false,
      version: '1.0.0',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Site config initialized');

    // 5. Add default admin captions
    const defaultCaptions = [
      'স্বাগতম! 💌 এখানে আপনি মনের কথা নিরাপদে শেয়ার করতে পারবেন।',
      'ভালোবাসা প্রকাশ করতে ভয় পাবেন না — এখানে সবকিছু সম্পূর্ণ সুরক্ষিত। 🔒',
      '✨ "কিছু অনুভূতি আছে যা শুধু হৃদয় বোঝে, কথায় বলা যায় না।"',
      '💖 আপনার মনের কথা পৌঁছে দিন প্রিয় মানুষটির কাছে।'
    ];

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: '2-digit', month: '2-digit', year: 'numeric' }).split('/').join('-');

    for (const text of defaultCaptions) {
      const capID = await dbHelper.getNextID('globalCapID');
      await db.collection('captions').add({
        capID,
        text,
        addedBy:    'Admin',
        addedByUID: 'admin',
        addedTime:  timeStr,
        addedDate:  dateStr,
        timestamp:  admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Caption ${capID} added: "${text.substring(0, 40)}..."`);
    }

    console.log('\n🎉 Database seed complete!');
    console.log('📌 Your Firestore is ready to use.');
    console.log('🚀 Next step: Deploy to Vercel and visit /api/setup');

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }

  process.exit(0);
}

seed();
