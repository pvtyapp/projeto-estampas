'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/apiClient'
import { useSession } from '@/app/providers/SessionProvider'
import { usePathname } from 'next/navigation'

type Usage = {
  plan: string
  used: number
  limit: number
  remaining_days: number
  status: 'ok' | 'warning' | 'blocked'
}

type UsageContextType = {
  usage: Usage | null
  loading: boolean
  refresh: () => Promise<void>
}

const UsageContext = createContext<UsageContextType | null>(null)

export function UsageProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: sessionLoading } = useSession()
  const pathname = usePathname()

  const [usage, setUsage] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  const fetchUsage = async () => {
    if (!session || sessionLoading) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    try {
      const res = await api('/me/usage', {
        signal: abortRef.current.signal,
      })
      setUsage(res)
    } catch {
      setUsage(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (pathname.startsWith('/plans') || pathname.startsWith('/auth')) return
    if (sessionLoading) return

    if (!session) {
      setUsage(null)
      abortRef.current?.abort()
      return
    }

    fetchUsage()

    return () => {
      abortRef.current?.abort()
    }
  }, [session, sessionLoading, pathname])

  return (
    <UsageContext.Provider value={{ usage, loading, refresh: fetchUsage }}>
      {children}
    </UsageContext.Provider>
  )
}

export function useUsage() {
  const ctx = useContext(UsageContext)
  if (!ctx) throw new Error('useUsage must be used dentro de UsageProvider')
  return ctx
}
