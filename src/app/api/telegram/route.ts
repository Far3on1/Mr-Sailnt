import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { botToken, chatId, message, receiptImage } = await request.json();

    if (!botToken || !chatId) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    if (receiptImage && receiptImage.startsWith('data:image')) {
      // Convert base64 to Buffer on server side
      const parts = receiptImage.split(',');
      const buffer = Buffer.from(parts[1], 'base64');
      const mimeString = parts[0].split(':')[1].split(';')[0];

      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('caption', message);

      const blob = new Blob([buffer], { type: mimeString });
      formData.append('photo', blob, 'receipt.jpg');

      const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        body: formData,
      });

      const telegramData = await telegramRes.json();
      if (telegramRes.ok) {
        return NextResponse.json({ success: true, data: telegramData });
      } else {
        return NextResponse.json({ error: 'Telegram API error', details: telegramData }, { status: 500 });
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
        return NextResponse.json({ error: 'Telegram API error', details: telegramData }, { status: 500 });
      }
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
