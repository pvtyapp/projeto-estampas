'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const finishLogin = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)

      if (error) {
        console.error('Erro ao trocar código por sessão:', error)
        return
      }

      router.replace('/app/work')
    }

    finishLogin()
  }, [router])

  return <div className="p-6">Finalizando login...</div>
}
