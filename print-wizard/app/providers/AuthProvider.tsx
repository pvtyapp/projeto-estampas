'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { useSession } from './SessionProvider'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!session && !pathname.startsWith('/auth')) {
      router.replace('/auth')
    }
  }, [session, pathname, router])

  return <>{children}</>
}
