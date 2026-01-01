'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/app/work')
      } else {
        supabase.auth.exchangeCodeForSession(window.location.href).then(({ error }) => {
          if (error) {
            console.error('Auth callback error:', error)
          }
          router.replace('/app/work')
        })
      }
    })
  }, [])

  return <p>Autenticando...</p>
}
