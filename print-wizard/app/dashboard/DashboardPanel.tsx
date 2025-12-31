'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'
import { useSession } from '@/app/providers/SessionProvider'

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
    const load = async () => {
      try {
        const data = await api('/me/usage')
        setUsage(data)
      } catch (e) {
        console.warn('Erro ao carregar usage:', e)
      } finally {
        setLoading(false)
      }
    }

    if (session) load()
  }, [session])

  if (loading) return <div className="p-4">Carregando uso...</div>
  if (!usage) return null

  return (
    <div className="border rounded p-4">
      <div>Plano: {usage.plan}</div>
      <div>Uso: {usage.used} / {usage.limit}</div>
      <div>Créditos: {usage.credits}</div>
      <div>Status: {usage.status}</div>
    </div>
  )
}
