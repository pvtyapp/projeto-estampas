'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    supabase.auth.getSession()
  }, [])

  return <>{children}</>
}
