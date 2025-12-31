'use client'

import { useEffect, useState } from 'react'
import { useSession } from '@/app/providers/SessionProvider'
import { api } from '@/lib/apiClient'
import { Session } from '@supabase/supabase-js'

type Usage = {
  plan: string
  used: number
  limit: number
  credits: number
  status: string
}

export default function DashboardPanel() {
  const session = useSession()
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return

    api('/me/usage', session)
      .then(setUsage)
      .catch((e) => {
        console.error('Erro ao carregar usage:', e)
      })
      .finally(() => setLoading(false))
  }, [session])

  if (!session) return null
  if (loading) return <div className="p-4">Carregando uso...</div>
  if (!usage) return null

  return (
    <div className="border rounded p-4 space-y-1">
      <div>Plano: {usage.plan}</div>
      <div>Uso: {usage.used} / {usage.limit}</div>
      <div>Créditos: {usage.credits}</div>
      <div>Status: {usage.status}</div>
    </div>
  )
}
