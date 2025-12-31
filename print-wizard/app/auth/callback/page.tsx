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
      if (!session) return // 🔴 NÃO redireciona ainda
      handled = true
      router.replace('/work')
    }

    // Escuta primeiro — isso é o que garante a sessão
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        finish(session)
      }
    })

    // Depois tenta ler caso já exista
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish(data.session)
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
