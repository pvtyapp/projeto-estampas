'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    let active = true

    async function handleAuth() {
      const { data } = await supabase.auth.getSession()

      if (data.session) {
        if (active) router.replace('/work')
        return
      }

      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)

      if (error) {
        console.error('Auth callback error:', error)
      }

      if (active) router.replace('/work')
    }

    handleAuth()

    return () => {
      active = false
    }
  }, [router])

  return <p>Autenticando...</p>
}
