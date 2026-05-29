const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync("c:/Users/Hanon Aldeboo/Downloads/mr-sailnt-firebase-adminsdk-fbsvc-b2688b104c.json", 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkSecrets() {
  try {
    const snap = await db.doc('settings/secrets').get();
    if (snap.exists) {
      console.log('Secrets Document exists!');
      const data = snap.data();
      console.log('Bot Token Length:', data.telegramBotToken ? data.telegramBotToken.length : 0);
      console.log('Chat ID:', data.telegramChatId);
    } else {
      console.log('Secrets Document does NOT exist in Firestore!');
    }
  } catch (err) {
    console.error('Error fetching secrets:', err);
  }
}

checkSecrets();
