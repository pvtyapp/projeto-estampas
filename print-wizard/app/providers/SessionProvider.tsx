'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(() => setReady(true))
  }, [])

  if (!ready) return null

  return <>{children}</>
}
