'use client'

import { createContext, useContext, useEffect, useState } from 'react'
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

  const fetchUsage = async () => {
    if (!session) return
    setLoading(true)
    const res = await api('/me/usage')
    setUsage(res)
    setLoading(false)
  }

  useEffect(() => {
    if (!sessionLoading && session) {
      fetchUsage()
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
