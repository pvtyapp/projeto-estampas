'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/app/providers/SupabaseProvider'

export default function AuthCallback() {
  const router = useRouter()
  const supabase = useSupabase()

  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error(error)
        router.replace('/?error=auth')
        return
      }

      if (data.session) {
        router.replace('/work')
      }
    }

    run()
  }, [router, supabase])

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-600">
      Confirmando login…
    </div>
  )
}
