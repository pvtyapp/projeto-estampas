'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.signOut().then(() => {
      router.replace('/auth')
    })
  }, [])

  return null
}
