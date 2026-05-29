const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync("c:/Users/Hanon Aldeboo/Downloads/mr-sailnt-firebase-adminsdk-fbsvc-b2688b104c.json", 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function readSecrets() {
  try {
    const snap = await db.doc('settings/secrets').get();
    if (!snap.exists) {
      console.log('settings/secrets document does NOT exist!');
      return;
    }
    const data = snap.data();
    console.log('=== FULL SECRETS ===');
    console.log('telegramBotToken:', data.telegramBotToken);
    console.log('telegramChatId:', data.telegramChatId);
    console.log('===================');
  } catch (err) {
    console.error('Error reading secrets:', err);
  }
  process.exit(0);
}

readSecrets();
