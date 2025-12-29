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
        router.replace('/?error=auth')
      }
    })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-600">
      Confirmando sua conta...
    </div>
  )
}
