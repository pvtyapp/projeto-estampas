'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallback() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const code = params.get('code')

    if (!code) return

    const run = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Erro ao autenticar:', error)
      } else {
        router.replace('/app/work')
      }
    }

    run()
  }, [params, router])

  return <div>Autenticando...</div>
}
