import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // 1. Verify secret API key (simple and reliable - no Firebase Admin needed)
    const authHeader = request.headers.get('Authorization');
    const apiSecret = process.env.TELEGRAM_API_SECRET;

    if (!apiSecret) {
      console.error('TELEGRAM_API_SECRET env var is not configured on server.');
      return NextResponse.json({ error: 'Server misconfiguration: missing API secret' }, { status: 500 });
    }

    if (!authHeader || authHeader !== `Bearer ${apiSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get Telegram credentials from environment variables directly
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env vars.');
      return NextResponse.json({ error: 'Telegram credentials not configured on server' }, { status: 500 });
    }

    // 3. Extract request body
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
        console.error('Telegram sendPhoto failed:', telegramData);
        return NextResponse.json({ error: 'Telegram photo send failed', details: telegramData }, { status: 500 });
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
        console.error('Telegram sendMessage failed:', telegramData);
        return NextResponse.json({ error: 'Telegram message send failed', details: telegramData }, { status: 500 });
      }
    }
  } catch (err: any) {
    console.error('Error in Telegram API route:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
