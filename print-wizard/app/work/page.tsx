'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function WorkPage() {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error(error)
      setToken(data?.session?.access_token || null)
    })
  }, [])

  return (
    <div style={{ padding: 40 }}>
      <h1>DEBUG TOKEN</h1>
      {token ? (
        <textarea style={{ width: '100%', height: 200 }}>{token}</textarea>
      ) : (
        <p>Token ainda não carregou ou usuário não logado.</p>
      )}
    </div>
  )
}
