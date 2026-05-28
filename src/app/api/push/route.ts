import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { serverKey, tokens, title, body, clickAction } = await request.json();

    if (!serverKey || !tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const fcmRes = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${serverKey}`,
      },
      body: JSON.stringify({
        registration_ids: tokens,
        notification: {
          title: title || 'طلب خدمة جديد 🔔',
          body: body || 'لديك طلب جديد قيد المراجعة',
          click_action: clickAction || '/dashboard',
        },
      }),
    });

    const fcmData = await fcmRes.json();
    return NextResponse.json({ success: fcmRes.ok, data: fcmData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
