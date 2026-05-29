const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync("c:/Users/Hanon Aldeboo/Downloads/mr-sailnt-firebase-adminsdk-fbsvc-b2688b104c.json", 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function testOrderCounter() {
  console.log('🔍 Testing orderCounter...\n');

  // 1. Read current counter
  const snap = await db.doc('settings/orderCounter').get();
  if (snap.exists) {
    console.log('✅ orderCounter exists!');
    console.log('   Current count:', snap.data().count);
  } else {
    console.log('❌ orderCounter does NOT exist!');
  }

  // 2. Test increment
  const { FieldValue } = require('firebase-admin/firestore');
  await db.doc('settings/orderCounter').update({ count: FieldValue.increment(1) });
  const snap2 = await db.doc('settings/orderCounter').get();
  console.log('   After increment:', snap2.data().count);

  // Revert
  await db.doc('settings/orderCounter').update({ count: FieldValue.increment(-1) });
  const snap3 = await db.doc('settings/orderCounter').get();
  console.log('   Reverted back to:', snap3.data().count);

  console.log('\n✅ orderCounter is working perfectly!');
  process.exit(0);
}

testOrderCounter().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
