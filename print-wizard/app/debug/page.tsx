'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Debug() {
  useEffect(() => {
    ;(window as any).supabase = supabase
    console.log('Supabase client no window:', supabase)

    supabase.auth.getSession().then(res => {
      console.log('Sessão atual:', res)
    })
  }, [])

  return <div>Veja o console</div>
}
