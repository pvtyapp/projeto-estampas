'use client'

import { Session } from '@supabase/supabase-js'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SessionProvider({
  initialSession,
}: {
  initialSession: Session | null
}) {
  useEffect(() => {
    if (initialSession) {
      supabase.auth.setSession(initialSession)
    }
  }, [initialSession])

  return null
}
