// Test the new Vercel telegram endpoint with the API secret
async function testNewEndpoint() {
  const apiSecret = 'mr-sailnt-secret-2024';
  const vercelUrl = 'https://mr-sailnt.vercel.app/api/telegram';

  console.log('Testing new Vercel Telegram endpoint...');
  console.log('URL:', vercelUrl);
  console.log('Secret:', apiSecret);

  try {
    const res = await fetch(vercelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiSecret}`
      },
      body: JSON.stringify({
        message: '🧪 اختبار النظام الجديد - بدون Firebase Admin!',
        receiptImage: null
      })
    });

    console.log('\nResponse Status:', res.status);
    const data = await res.json();
    console.log('Response Body:', JSON.stringify(data, null, 2));

    if (res.ok && data.success) {
      console.log('\n✅ SUCCESS! Telegram notification sent successfully!');
    } else {
      console.log('\n❌ FAILED! Check the error above.');
    }
  } catch (err) {
    console.error('Network error:', err);
  }
}

testNewEndpoint();
