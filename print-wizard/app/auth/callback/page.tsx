'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    let active = true

    async function handleAuth() {
      const { data: sessionData } = await supabase.auth.getSession()

      let session = sessionData.session

      if (!session) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href)
        if (error) {
          console.error('Auth callback error:', error)
          return
        }
        session = data.session
      }

      if (!session) {
        console.error('No session after auth')
        return
      }

      const user = session.user

      // 🔹 Garante profile + plano free
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          plan_id: 'free',
          created_at: new Date().toISOString(),
        }, { onConflict: 'id' })

      if (profileError) {
        console.error('Failed to upsert profile:', profileError)
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
