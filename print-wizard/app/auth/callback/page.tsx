'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallback() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    console.log('AuthCallback montado')

    const code = params.get('code')
    console.log('OAuth code recebido:', code)

    if (!code) return

    const run = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      console.log('Resultado exchange:', error)

      if (!error) router.replace('/app/work')
    }

    run()
  }, [params, router])

  return <div>Autenticando...</div>
}
