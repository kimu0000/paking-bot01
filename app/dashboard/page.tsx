'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [msg, setMsg] = useState('')
  const [activeSession, setActiveSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        router.push('/login')
        return
      }

      setUser(data.user)

      const { data: session } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', data.user.id)
        .eq('status', 'active')
        .maybeSingle()  // single()はデータなしでエラーになるのでmaybeSingleに変更

      setActiveSession(session)
      setLoading(false)
    }

    init()
  }, [])

  const handleCheckIn = async () => {
    if (!user) return
    setMsg('')

    const { error } = await supabase.from('sessions').insert({
      user_id: user.id,
      status: 'active',
      start_time: new Date().toISOString(),
    })

    if (error) {
      setMsg(`❌ エラー：${error.message}`)
    } else {
      setMsg('🚗 入庫しました！')
      location.reload()
    }
  }

  const handleCheckOut = async () => {
    if (!activeSession) return
    setMsg('')

    const startTime = new Date(activeSession.start_time)
    const now = new Date()
    const diffMin = Math.floor((now.getTime() - startTime.getTime()) / 60000)
    const fee = Math.min(Math.ceil(diffMin / 30) * 100, 800)

    const { error } = await supabase
      .from('sessions')
      .update({
        status: 'finished',
        end_time: now.toISOString(),
        fee,
      })
      .eq('id', activeSession.id)

    if (error) {
      setMsg(`❌ エラー：${error.message}`)
    } else {
      setMsg(`✅ 出庫しました！　駐車時間：${diffMin}分　料金：${fee}円`)
      location.reload()
    }
  }

  if (loading) return <p style={{ padding: 20 }}>読み込み中...</p>

  return (
    <div style={{ padding: 20 }}>
      <h1>ダッシュボード</h1>
      <p>ログイン中：{user?.email}</p>

      {!activeSession ? (
        <button onClick={handleCheckIn}>🚗 入庫する</button>
      ) : (
        <>
          <p>入庫時刻：{new Date(activeSession.start_time).toLocaleString('ja-JP')}</p>
          <button onClick={handleCheckOut}>✅ 出庫する</button>
        </>
      )}

      {msg && <p>{msg}</p>}
    </div>
  )
}
