'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { api } from '@/lib/apiClient'

type Usage = {
  plan: string
  used: number
  limit: number
  renew_at?: string
}

export default function DashboardPanel() {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const fetchUsage = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        console.log('Session:', data.session)

        if (!data.session) {
          setLoading(false)
          return
        }

        const result = await api('/me/usage')
        if (!cancelled) setUsage(result)
      } catch (err: any) {
        console.error('Erro:', err)
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchUsage()

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) fetchUsage()
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  if (loading) return <div>Carregando plano…</div>
  if (error) return <div className="text-red-600">{error}</div>
  if (!usage) return null

  const percent = Math.round((usage.used / usage.limit) * 100)

  return (
    <div className="border p-4 rounded">
      <div className="flex justify-between">
        <strong>{usage.plan}</strong>
        <span>{usage.used}/{usage.limit}</span>
      </div>

      <div className="w-full bg-gray-200 h-2 mt-2">
        <div className="bg-black h-2" style={{ width: `${percent}%` }} />
      </div>

      {usage.renew_at && (
        <div className="text-xs mt-2">
          Renova em {new Date(usage.renew_at).toLocaleDateString('pt-BR')}
        </div>
      )}
    </div>
  )
}
