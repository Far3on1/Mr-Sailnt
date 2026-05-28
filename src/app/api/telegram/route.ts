import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

export async function POST(request: Request) {
  // Initialize Firebase Admin SDK using clean standard method
  if (!admin.apps.length) {
    try {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mr-sailnt';
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY
        ?.replace(/^"|"$/g, '') // Remove surrounding quotes if pasted with quotes
        ?.replace(/\\n/g, '\n');

      if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        console.log('Firebase Admin initialized successfully with credentials.');
      } else {
        console.warn('Firebase Admin initialized with fallback project ID (missing credentials).');
        admin.initializeApp({
          projectId,
        });
      }
    } catch (err) {
      console.error('Firebase Admin initialization error:', err);
    }
  }

  try {
    // 1. Authenticate Request using Firebase ID Token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (authErr) {
      console.error('Token verification failed:', authErr);
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json({ error: 'Unauthorized: Invalid user session' }, { status: 401 });
    }

    // 2. Fetch Telegram secrets securely from Firestore server-side
    const db = admin.firestore();
    const secretsSnap = await db.doc('settings/secrets').get();
    
    if (!secretsSnap.exists) {
      return NextResponse.json({ error: 'Telegram settings not configured on server' }, { status: 404 });
    }

    const secrets = secretsSnap.data() || {};
    const botToken = secrets.telegramBotToken;
    const chatId = secrets.telegramChatId;

    if (!botToken || !chatId) {
      return NextResponse.json({ error: 'Telegram Bot credentials not configured' }, { status: 404 });
    }

    // 3. Extract request parameters
    const { message, receiptImage } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Missing message content' }, { status: 400 });
    }

    // 4. Send Message / Photo to Telegram API
    if (receiptImage && receiptImage.startsWith('data:image')) {
      const parts = receiptImage.split(',');
      const buffer = Buffer.from(parts[1], 'base64');
      const mimeString = parts[0].split(':')[1].split(';')[0];

      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('caption', message);

      const file = new File([buffer], 'receipt.jpg', { type: mimeString });
      formData.append('photo', file);

      const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        body: formData,
      });

      const telegramData = await telegramRes.json();
      if (telegramRes.ok) {
        return NextResponse.json({ success: true, data: telegramData });
      } else {
        return NextResponse.json({ error: 'Telegram API photo sending failed', details: telegramData }, { status: 500 });
      }
    } else {
      const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
        }),
      });

      const telegramData = await telegramRes.json();
      if (telegramRes.ok) {
        return NextResponse.json({ success: true, data: telegramData });
      } else {
        return NextResponse.json({ error: 'Telegram API message sending failed', details: telegramData }, { status: 500 });
      }
    }
  } catch (err: any) {
    console.error('Error in secure Telegram API route:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
