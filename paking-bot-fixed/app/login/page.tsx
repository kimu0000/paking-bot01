'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        router.push('/dashboard')
      }
    }
    checkUser()
  }, [])

  const login = async () => {
    const { error } = await supabase.auth.signInWithOtp({ email })

    if (error) {
      setMsg(error.message)
    } else {
      setMsg('メール送った！リンク踏んでログインしてね')
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>ログイン</h1>

      <input
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ border: '1px solid #ccc', padding: 8 }}
      />

      <button onClick={login} style={{ marginLeft: 10 }}>
        送信
      </button>

      <p>{msg}</p>
    </div>
  )
}
