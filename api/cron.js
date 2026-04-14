import { supabase } from '../lib/supabaseClient.js';

// LINEプッシュ通知
async function pushToLine(userId, text) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text }],
    }),
  });
}

function calcFee(startTime) {
  const now = new Date();
  const diffMin = Math.floor((now - new Date(startTime)) / 60000);
  const fee = Math.min(Math.ceil(diffMin / 30) * 100, 800);
  return { fee, diffMin };
}

export default async function handler(req, res) {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('status', 'active');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  for (const session of sessions) {
    const { fee, diffMin } = calcFee(session.start_time);

    // 30分ごとの料金加算の1分前に通知（29, 59, 89...分）
    if (diffMin > 0 && diffMin % 30 === 29) {
      await pushToLine(
        session.user_id,
        `⚠️ あと1分で料金が加算されます！\n現在：${fee}円 → 次：${Math.min(fee + 100, 800)}円`
      );
    }

    // 最大料金到達時に一度だけ通知（ちょうど最大になった瞬間）
    if (diffMin > 0 && fee >= 800 && (diffMin - 1) * 100 / 30 < 800) {
      await pushToLine(
        session.user_id,
        '🚗 最大料金（800円）に到達しました。\n以降は追加料金はかかりません！'
      );
    }
  }

  res.status(200).json({ processed: sessions.length });
}
