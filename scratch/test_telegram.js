const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync("c:/Users/Hanon Aldeboo/Downloads/mr-sailnt-firebase-adminsdk-fbsvc-b2688b104c.json", 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function testTelegram() {
  try {
    const snap = await db.doc('settings/secrets').get();
    if (!snap.exists) {
      console.error('Secrets not found in Firestore!');
      return;
    }
    const { telegramBotToken, telegramChatId } = snap.data();
    console.log('Sending test message using token:', telegramBotToken.substring(0, 10) + '...', 'to Chat:', telegramChatId);

    const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: '🧪 رسالة فحص فنية من Mr Sailnt Store!'
      })
    });

    const data = await res.json();
    console.log('Telegram API Response Status:', res.status);
    console.log('Telegram API Response Body:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error testing Telegram:', err);
  }
}

testTelegram();
