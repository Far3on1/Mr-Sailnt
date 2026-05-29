import { NextResponse } from 'next/server';

// Internal endpoint called server-to-server during purchase
// Protected by a shared API secret stored in environment variables
export async function POST(request: Request) {
  try {
    // Verify the internal API secret
    const authHeader = request.headers.get('Authorization');
    const apiSecret = process.env.TELEGRAM_API_SECRET;

    if (!apiSecret || !authHeader || authHeader !== `Bearer ${apiSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Telegram credentials from environment variables
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('[Telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env vars.');
      return NextResponse.json({ error: 'Telegram credentials not configured' }, { status: 500 });
    }

    // Extract request body
    const body = await request.json();
    const { message, receiptImage } = body;

    if (!message) {
      return NextResponse.json({ error: 'Missing message content' }, { status: 400 });
    }

    console.log('[Telegram] Sending notification to chat:', chatId);

    // Send Message / Photo to Telegram API
    if (receiptImage && typeof receiptImage === 'string' && receiptImage.startsWith('data:image')) {
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
        console.log('[Telegram] Photo sent successfully!');
        return NextResponse.json({ success: true });
      } else {
        console.error('[Telegram] sendPhoto failed:', telegramData);
        return NextResponse.json({ error: 'Telegram photo send failed', details: telegramData }, { status: 500 });
      }
    } else {
      // Send text only
      const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      });

      const telegramData = await telegramRes.json();
      if (telegramRes.ok) {
        console.log('[Telegram] Message sent successfully!');
        return NextResponse.json({ success: true });
      } else {
        console.error('[Telegram] sendMessage failed:', telegramData);
        return NextResponse.json({ error: 'Telegram message send failed', details: telegramData }, { status: 500 });
      }
    }
  } catch (err: any) {
    console.error('[Telegram] Error in route handler:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
