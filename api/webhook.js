import crypto from 'crypto';
import { supabase } from '../lib/supabaseClient.js';

// LINE表現検証
function verifySignature(body, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64');
  ハッシュ値と署名値を返す。
}

// LINEへ返信
async function replyToLine(replyToken, text) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    メソッド: 'POST'、
    ヘッダー: {
      'Content-Type': 'application/json',
      認証: `ベアラー ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`、
    },
    body: JSON.stringify({
      返信トークン、
      メッセージ: [{ type: 'text', text }],
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ message: 'ok' });
  }

  // ── 認証検証 ──────────────
  const signature = req.headers['x-line-signature'];
  const rawBody = JSON.stringify(req.body);
  if (!verifySignature(rawBody, signature)) {
    return res.status(401).json({ message: '無効な署名' });
  }

  const events = req.body.events;
  if (!events || events.length === 0) {
    return res.status(200).json({ message: 'ok' });
  }

  for (const event of events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;

    const lineUserId = event.source.userId;
    const text = event.message.text.trim();
    const replyToken = event.replyToken;

    // ── 入庫 ──--------------------------------------------------------
    if (text === '入庫') {
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', lineUserId)
        .eq('status', 'active')
        。シングル（）;

      （既存の）{
        await ReplyToLine(replyToken, '⚠️すでに庫内に入っています。先に「受け取って」ください。');
        続く;
      }

      const { error } = await supabase
        .from('sessions')
        .insert([{ user_id: lineUserId, status: 'active', start_time: new Date().toISOString() }]);

      返信を待つ(
        返信トークン、
        エラー
          ? `❌ 入庫に失敗しました：${error.message}`
          : '🚗入庫を記録しました！\n回収するときは「受取」と言ってください。'
      );
    }

    // ── 受け取り ─────────────
    else if (text === '避難') {
      const { data: session, error: fetchError } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', lineUserId)
        .eq('status', 'active')
        。シングル（）;

      if (fetchError || !session) {
        await ReplyToLine(replyToken, '⚠️アクティブな入庫記録が見つかりません。');
        続く;
      }

      const startTime = new Date(session.start_time);
      const now = new Date();
      const diffMin = Math.floor((now - startTime) / 60000);
      const fee = Math.min(Math.ceil(diffMin / 30) * 100, 800);

      const { error: updateError } = await supabase
        .from('sessions')
        .update({ status: 'finished', end_time: now.toISOString(), fee })
        .eq('id', session.id);

      返信を待つ(
        返信トークン、
        updateError
          ? `❌ 侵入に失敗しました：${updateError.message}`
          : `✅ 確保しました！\n⏱ 駐車時間：${diffMin}分\n💴 料金：${fee}円`
      );
    }

    // ── その他 ──────────────
    それ以外 {
      await ReplyToLine(replyToken, '「入庫」または「受け取り」と送ってください🚗');
    }
  }

  return res.status(200).json({ message: 'ok' });
}
