const BOT_TOKEN = '8216712040:AAFwcz0_UGnO4YWJPBuUL7CVac8mpc8Nvu8';
const TELEGRAM_CHANNEL_ID = '-1003817953908';

async function testTelegram() {
  try {
    console.log('Testing connection to Telegram Bot API...');
    const getMeRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const getMeData = await getMeRes.json();
    console.log('getMe result:', JSON.stringify(getMeData, null, 2));

    if (!getMeData.ok) {
      console.error('Bot token is invalid!');
      return;
    }

    console.log('\nTesting connection to Telegram Channel...');
    const getChatRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID })
    });
    const getChatData = await getChatRes.json();
    console.log('getChat result:', JSON.stringify(getChatData, null, 2));
  } catch (err) {
    console.error('Test failed with error:', err);
  }
}

testTelegram();
