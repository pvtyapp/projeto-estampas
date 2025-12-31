'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const restore = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.replace('/auth')
      } else {
        setReady(true)
      }
    }

    restore()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/auth')
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [router])

  if (!ready) return <div>Carregando sessão...</div>

  return <>{children}</>
}
