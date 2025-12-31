'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallback() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const run = async () => {
      const code = params.get('code')

      if (!code) return

      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      console.log('Exchange result:', data, error)

      if (error) {
        console.error('Erro no exchange:', error)
        return
      }

      const { data: sessionData } = await supabase.auth.getSession()
      console.log('Session após exchange:', sessionData)

      router.replace('/app/work')
    }

    run()
  }, [params, router])

  return <div>Autenticando...</div>
}
