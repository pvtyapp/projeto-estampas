'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/apiClient'
import { useSession } from '@/app/providers/SessionProvider'

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
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchedRef = useRef(false)
  const sessionRef = useRef<string | null>(null)

  const fetchUsage = async () => {
    if (!session) return
    setLoading(true)
    try {
      const res = await api('/me/usage')
      setUsage(res)
      fetchedRef.current = true
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!sessionLoading && !session) {
      setUsage(null)
      fetchedRef.current = false
      sessionRef.current = null
      return
    }

    if (!sessionLoading && session) {
      const userObj = session.user as unknown as { id?: string; sub?: string }
      const currentUser = userObj.id || userObj.sub || null

      if (sessionRef.current !== currentUser) {
        fetchedRef.current = false
        sessionRef.current = currentUser
      }

      if (!fetchedRef.current) {
        fetchUsage()
      }
    }
  }, [sessionLoading, session])

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
