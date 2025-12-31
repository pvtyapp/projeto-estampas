'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, usePathname } from 'next/navigation'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let handled = false

    const decide = (session: any) => {
      if (handled) return
      handled = true

      if (!session) {
        if (!pathname.startsWith('/auth')) {
          router.replace('/auth')
        }
      } else {
        setReady(true)
      }
    }

    // 1️⃣ Checa sessão atual
    supabase.auth.getSession().then(({ data }) => {
      decide(data.session)
    })

    // 2️⃣ Escuta mudanças futuras
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      decide(session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, pathname])

  if (!ready && !pathname.startsWith('/auth')) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Carregando sessão...
      </div>
    )
  }

  return <>{children}</>
}
