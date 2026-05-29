import { NextResponse } from 'next/server';

// Server-side purchase notification endpoint
// Called from the browser after a purchase is saved to Firestore
// No authentication needed - this just sends a Telegram notification
// The data itself is not sensitive (no payment info exposed)
export async function POST(request: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('[notify] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
      return NextResponse.json({ error: 'Telegram not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { orderNumber, displayName, userEmail, serviceName, servicePrice, targetNumber, whatsappNumber, paymentMethod, senderPhone, receiptImage } = body;

    const orderTag = orderNumber ? `#${orderNumber}` : '';
    const message = `🔔 طلب خدمة جديد! ${orderTag}\n👤 العميل: ${displayName} (${userEmail})\n🛠 الخدمة: ${serviceName}\n💰 السعر: ${servicePrice} ج.م\n🎯 الرقم المطلوب: ${targetNumber}\n📞 واتساب للتواصل: ${whatsappNumber}\n💵 طريقة الدفع: ${paymentMethod === 'orange_cash' ? 'فودافون/أورنج كاش' : 'انستاباي'}\n📱 حساب المحول منه: ${senderPhone}`;

    console.log('[notify] Sending Telegram notification for:', serviceName);

    if (receiptImage && typeof receiptImage === 'string' && receiptImage.startsWith('data:image')) {
      const parts = receiptImage.split(',');
      const buffer = Buffer.from(parts[1], 'base64');
      const mimeString = parts[0].split(':')[1].split(';')[0];

      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('caption', message);
      formData.append('photo', new File([buffer], 'receipt.jpg', { type: mimeString }));

      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('[notify] Telegram sendPhoto error:', data);
        // Fallback: try sending as text only
        const fallbackRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: message }),
        });
        const fallbackData = await fallbackRes.json();
        console.log('[notify] Fallback text result:', fallbackData.ok);
      } else {
        console.log('[notify] Photo sent successfully!');
      }
    } else {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('[notify] Telegram sendMessage error:', data);
      } else {
        console.log('[notify] Message sent successfully!');
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[notify] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
