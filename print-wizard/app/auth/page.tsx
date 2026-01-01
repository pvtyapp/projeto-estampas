'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [session, setSession] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const login = async () => {
    setError(null)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      return
    }

    setSession(data.session)
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>DEBUG AUTH</h1>

      <input
        placeholder="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />

      <input
        placeholder="senha"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />

      <button onClick={login}>Login</button>

      {error && <pre style={{ color: 'red' }}>{error}</pre>}

      <h3>Session:</h3>
      <pre>{JSON.stringify(session, null, 2)}</pre>

      <h3>localStorage:</h3>
      <pre>
        {typeof window !== 'undefined'
          ? JSON.stringify(localStorage, null, 2)
          : 'no window'}
      </pre>
    </div>
  )
}
