const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync("c:/Users/Hanon Aldeboo/Downloads/mr-sailnt-firebase-adminsdk-fbsvc-b2688b104c.json", 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function assignOrderNumbers() {
  console.log('📦 جاري ترقيم الأوردرات القديمة...\n');

  // 1. Get ALL transactions
  const snap = await db.collection('transactions').get();
  const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // 2. Filter purchase transactions only
  const purchases = allDocs.filter(d => d.type === 'purchase');
  console.log(`إجمالي أوردرات الشراء: ${purchases.length}`);

  // 3. Sort by createdAt ascending (oldest first)
  purchases.sort((a, b) => {
    const aTime = a.createdAt?.seconds || a.createdAt?._seconds || 0;
    const bTime = b.createdAt?.seconds || b.createdAt?._seconds || 0;
    return aTime - bTime;
  });

  // 4. Find orders without orderNumber
  const needsNumber = purchases.filter(o => !o.orderNumber);
  const hasNumber = purchases.filter(o => o.orderNumber);

  console.log(`أوردرات بدون رقم: ${needsNumber.length}`);
  console.log(`أوردرات عندها رقم بالفعل: ${hasNumber.length}`);

  if (needsNumber.length === 0) {
    console.log('\n✅ كل الأوردرات مرقمة بالفعل!');
    process.exit(0);
    return;
  }

  // 5. Start numbering from 1000
  let nextNumber = 1000;

  console.log(`\nسيتم ترقيم ${needsNumber.length} أوردر بدءاً من #${nextNumber}...\n`);

  const batch = db.batch();
  let count = 0;

  for (const order of needsNumber) {
    const num = nextNumber + count;
    batch.update(db.collection('transactions').doc(order.id), { orderNumber: num });
    const name = order.displayName || order.userEmail || 'مجهول';
    const service = order.serviceName || '-';
    const date = order.createdAt?.seconds
      ? new Date(order.createdAt.seconds * 1000).toLocaleDateString('ar-EG')
      : (order.createdAt?._seconds ? new Date(order.createdAt._seconds * 1000).toLocaleDateString('ar-EG') : '?');
    console.log(`  #${num} → ${name} | ${service} | ${date}`);
    count++;
  }

  // 6. Update the counter to the highest number
  const finalCounter = nextNumber + count - 1;
  batch.set(db.collection('settings').doc('orderCounter'), { count: finalCounter }, { merge: true });

  console.log(`\nجاري الحفظ...`);
  await batch.commit();

  console.log(`\n✅ تم ترقيم ${count} أوردر بنجاح!`);
  console.log(`📊 الكاونتر الحالي: ${finalCounter}`);
  console.log(`📊 الأوردر القادم سيكون: #${finalCounter + 1}`);

  process.exit(0);
}

assignOrderNumbers().catch(err => {
  console.error('خطأ:', err);
  process.exit(1);
});
