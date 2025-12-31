'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { usePathname, useRouter } from 'next/navigation'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const isPublic =
        pathname.startsWith('/auth') ||
        pathname === '/' ||
        pathname.startsWith('/info')

      if (!data.session && !isPublic) {
        router.replace('/auth')
      }

      setLoading(false)
    })
  }, [pathname])

  if (loading) return <div>Carregando sessão...</div>

  return <>{children}</>
}
