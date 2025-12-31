'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    let handled = false

    const finish = (session: any) => {
      if (handled) return
      handled = true

      if (session) {
        router.replace('/work')
      } else {
        router.replace('/?error=auth')
      }
    }

    // 1️⃣ Verifica sessão imediatamente
    supabase.auth.getSession().then(({ data }) => {
      finish(data.session)
    })

    // 2️⃣ Escuta mudanças futuras
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      finish(session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-600">
      Confirmando sua conta...
    </div>
  )
}
