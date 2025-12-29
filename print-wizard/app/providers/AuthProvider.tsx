'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        window.location.href = '/auth'
      } else {
        setLoading(false)
      }
    })
  }, [])

  if (loading) return <div>Carregando sessão...</div>

  return <>{children}</>
}
