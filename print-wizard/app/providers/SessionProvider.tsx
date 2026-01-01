'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Session } from '@supabase/supabase-js'

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setLoading(false)
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) router.push('/auth')
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [router])

  if (loading) return null

  if (!session) {
    router.push('/auth')
    return null
  }

  return <>{children}</>
}
