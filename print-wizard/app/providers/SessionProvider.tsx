'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (mounted) setReady(true) // marca ready mesmo sem sessão
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: string, _session: Session | null) => {
        if (mounted) setReady(true)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (!ready) {
    return <div className="text-gray-400 text-sm p-4">Inicializando sessão...</div>
  }

  return <>{children}</>
}
