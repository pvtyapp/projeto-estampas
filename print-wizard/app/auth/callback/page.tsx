'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useSession } from '@/app/providers/SessionProvider'

export default function AuthCallback() {
  const router = useRouter()
  const session = useSession()

  useEffect(() => {
    if (session) {
      router.replace('/work')
    }
  }, [session, router])

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-600">
      Confirmando login...
    </div>
  )
}
