export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ message: 'ok' });
  }

  const events = req.body.events;
  if (!events || events.length === 0) {
    return res.status(200).json({ message: 'ok' });
  }

  for (const event of events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;

    const replyToken = event.replyToken;
    const text = event.message.text;

    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text: `受信しました：${text}` }],
      }),
    });
  }

  return res.status(200).json({ message: 'ok' });
}
