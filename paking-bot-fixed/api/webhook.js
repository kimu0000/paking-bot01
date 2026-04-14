import crypto from 'crypto';
import { supabase } from '../lib/supabaseClient.js';

// LINE署名検証
function verifySignature(body, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// LINEへ返信
async function replyToLine(replyToken, text) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ message: 'ok' });
  }

  // ── 署名検証 ──────────────────────────────
  const signature = req.headers['x-line-signature'];
  const rawBody = JSON.stringify(req.body);
  if (!verifySignature(rawBody, signature)) {
    return res.status(401).json({ message: 'Invalid signature' });
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

    // ── 入庫 ──────────────────────────────────
    if (text === '入庫') {
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', lineUserId)
        .eq('status', 'active')
        .single();

      if (existing) {
        await replyToLine(replyToken, '⚠️ すでに入庫中です。先に「出庫」してください。');
        continue;
      }

      const { error } = await supabase
        .from('sessions')
        .insert([{ user_id: lineUserId, status: 'active', start_time: new Date().toISOString() }]);

      await replyToLine(
        replyToken,
        error
          ? `❌ 入庫に失敗しました：${error.message}`
          : '🚗 入庫を記録しました！\n出庫するときは「出庫」と送ってください。'
      );
    }

    // ── 出庫 ──────────────────────────────────
    else if (text === '出庫') {
      const { data: session, error: fetchError } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', lineUserId)
        .eq('status', 'active')
        .single();

      if (fetchError || !session) {
        await replyToLine(replyToken, '⚠️ アクティブな入庫記録が見つかりません。');
        continue;
      }

      const startTime = new Date(session.start_time);
      const now = new Date();
      const diffMin = Math.floor((now - startTime) / 60000);
      const fee = Math.min(Math.ceil(diffMin / 30) * 100, 800);

      const { error: updateError } = await supabase
        .from('sessions')
        .update({ status: 'finished', end_time: now.toISOString(), fee })
        .eq('id', session.id);

      await replyToLine(
        replyToken,
        updateError
          ? `❌ 出庫に失敗しました：${updateError.message}`
          : `✅ 出庫しました！\n⏱ 駐車時間：${diffMin}分\n💴 料金：${fee}円`
      );
    }

    // ── その他 ────────────────────────────────
    else {
      await replyToLine(replyToken, '「入庫」または「出庫」と送ってください🚗');
    }
  }

  return res.status(200).json({ message: 'ok' });
}
