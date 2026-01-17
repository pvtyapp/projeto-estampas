'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/apiClient'
import { useSession } from '@/app/providers/SessionProvider'
import { usePathname } from 'next/navigation'

type Usage = {
  plan: 'free' | 'start' | 'pro' | 'ent'
  used: number
  limit: number
  credits: number
  remaining_days: number
  status: 'ok' | 'warning' | 'blocked' | 'using_credits'
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

  const fetchedRef = useRef(false)
  const sessionRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchUsage = async () => {
    if (!session || sessionLoading) return
    if (fetchedRef.current) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    try {
      const res = await api('/me/usage', {
        signal: abortRef.current.signal,
      })
      setUsage(res)
      fetchedRef.current = true
    } catch {
      setUsage(null)
      fetchedRef.current = false
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (pathname.startsWith('/plans') || pathname.startsWith('/auth')) {
      return
    }

    if (sessionLoading) return

    if (!session) {
      setUsage(null)
      fetchedRef.current = false
      sessionRef.current = null
      abortRef.current?.abort()
      return
    }

    const userObj = session.user as unknown as { id?: string; sub?: string }
    const currentUser = userObj.id || userObj.sub || null

    if (sessionRef.current !== currentUser) {
      fetchedRef.current = false
      sessionRef.current = currentUser
    }

    fetchUsage()

    return () => {
      abortRef.current?.abort()
    }
  }, [sessionLoading, session, pathname])

  return (
    <UsageContext.Provider value={{ usage, loading, refresh: fetchUsage }}>
      {children}
    </UsageContext.Provider>
  )
}

export function useUsage() {
  const ctx = useContext(UsageContext)
  if (!ctx) throw new Error('useUsage must be used inside UsageProvider')
  return ctx
}
