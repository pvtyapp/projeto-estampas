'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
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
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          if (!cancelled) setLoading(false)
          return
        }

        const data = await api('/me/usage')
        if (!cancelled) setUsage(data)
      } catch (err: any) {
        console.error('Erro ao carregar uso:', err)
        if (!cancelled) setError(err.message || 'Erro ao carregar plano')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchUsage()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        if (session) {
          fetchUsage()
        }
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return <div className="text-gray-500 text-sm">Carregando informações do plano...</div>
  }

  if (error) {
    return (
      <div className="border border-red-400 bg-red-50 text-red-700 p-3 rounded mb-4">
        {error}
      </div>
    )
  }

  if (!usage) {
    return (
      <div className="text-gray-400 text-sm mb-4">
        Nenhuma informação de plano disponível.
      </div>
    )
  }

  const percent =
    usage.limit > 0
      ? Math.min(100, Math.round((usage.used / usage.limit) * 100))
      : 0

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-6 bg-white shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-semibold text-lg">Seu plano</h2>
        <span className="text-sm bg-gray-100 px-2 py-1 rounded">
          {usage.plan}
        </span>
      </div>

      <div className="text-sm text-gray-600 mb-2">
        Uso: {usage.used} de {usage.limit} folhas
      </div>

      <div className="w-full h-2 bg-gray-200 rounded overflow-hidden mb-2">
        <div
          className="h-full bg-black transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-500">
        <span>{percent}% utilizado</span>
        {usage.renew_at && (
          <span>
            Renova em {new Date(usage.renew_at).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>
    </div>
  )
}
