'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'
import { useSession } from '@/app/providers/SessionProvider'

type Plan = 'free' | 'start' | 'profissional' | 'enterprise'

type Usage = {
  plan: Plan
  used: number
  limit: number
  credits: number
  remaining_days: number
  status: 'ok' | 'warning' | 'blocked' | 'using_credits'
}

export default function DashboardPanel() {
  const { session, loading: sessionLoading } = useSession()
  const [usage, setUsage] = useState<Usage | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (sessionLoading || !session) return

    let cancelled = false
    setError(false)

    api('/me/usage')
      .then(res => {
        if (!cancelled) setUsage(res)
      })
      .catch(() => {
        if (!cancelled) {
          setUsage(null)
          setError(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [sessionLoading, session])

  if (!session) return null

  if (!usage && !error) {
    return (
      <div className="bg-white border rounded-xl shadow p-6 flex flex-col gap-4 opacity-30 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-2 bg-gray-200 rounded w-full" />
        <div className="h-2 bg-gray-200 rounded w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white border rounded-xl shadow p-6 text-sm text-red-600">
        Não foi possível carregar seu uso agora. Recarregue a página.
      </div>
    )
  }

  if (!usage) return null

  const isFree = usage.plan === 'free'
  const percent =
    usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0

  const planLabel: Record<Plan, string> = {
    free: 'Free',
    start: 'Start',
    profissional: 'Profissional',
    enterprise: 'Enterprise',
  }

  const statusLabel = {
    ok: 'Tudo certo',
    warning: 'Atenção',
    blocked: 'Bloqueado',
    using_credits: 'Usando créditos',
  }[usage.status]

  const statusColor = {
    ok: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    blocked: 'bg-red-100 text-red-700',
    using_credits: 'bg-blue-100 text-blue-700',
  }[usage.status]

  return (
    <div className="bg-white border rounded-xl shadow p-6 flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-sm text-gray-500 mb-1">Seu plano ativo é:</div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold uppercase">
              {planLabel[usage.plan]}
            </span>
            <span className={`text-xs px-2 py-1 rounded ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm text-gray-500">Renovação</div>
          <div className="font-medium">
            {isFree ? 'Diária' : `Em ${usage.remaining_days} dias`}
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>
            {usage.used} / {usage.limit} arquivos {isFree ? 'hoje' : 'este mês'}
          </span>
          <span>{percent}%</span>
        </div>

        <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
          <div className="h-full bg-black transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="flex justify-between items-center text-sm text-gray-600">
        <span>Créditos extras: {usage.credits}</span>
        <button
          className="underline"
          onClick={() => {
            if (isFree) alert('Upgrade em breve 😄')
            else alert('Gerenciamento de plano em breve 😄')
          }}
        >
          {isFree ? 'Fazer upgrade' : 'Gerenciar plano'}
        </button>
      </div>
    </div>
  )
}
