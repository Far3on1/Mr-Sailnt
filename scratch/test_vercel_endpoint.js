const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync("c:/Users/Hanon Aldeboo/Downloads/mr-sailnt-firebase-adminsdk-fbsvc-b2688b104c.json", 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function testVercelEndpoint() {
  try {
    // Generate a custom token and exchange it or create a session
    // Actually, we can generate a Firebase Auth ID Token for a test user or the admin email
    const uid = 'admin-test-uid-1234';
    const customToken = await admin.auth().createCustomToken(uid);
    
    // We can exchange the custom token for an ID token using Google's securetoken API
    const apiKey = "AIzaSyBGdJCRsN8wOq3KZMlX-rKq_DE0xWuiDWQ"; // from .env.local
    const exchangeRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true
      })
    });
    
    const exchangeData = await exchangeRes.json();
    const idToken = exchangeData.idToken;

    if (!idToken) {
      console.error('Failed to exchange custom token for ID token:', exchangeData);
      return;
    }

    console.log('Successfully generated user ID Token. Sending request to Vercel...');

    const res = await fetch('https://mr-sailnt.vercel.app/api/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        message: '🧪 فحص الاتصال من السيرفر Vercel API!',
        receiptImage: null
      })
    });

    console.log('Vercel API Response Status:', res.status);
    const data = await res.json();
    console.log('Vercel API Response Body:', JSON.stringify(data, null, 2));

  } catch (err) {
    console.error('Error testing Vercel endpoint:', err);
  }
}

testVercelEndpoint();
