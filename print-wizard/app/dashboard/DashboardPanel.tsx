'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'
import { useSession } from '@/app/providers/SessionProvider'

type Usage = {
  plan: 'free' | 'pro' | 'business'
  used: number
  limit: number
  credits: number
  remaining_days: number
  status: 'ok' | 'warning' | 'blocked' | 'using_credits'
}

export default function DashboardPanel() {
  const { session, loading: sessionLoading } = useSession()
  const [usage, setUsage] = useState<Usage | null>(null)

  useEffect(() => {
    if (sessionLoading || !session) return
    let cancelled = false

    api('/me/usage').then(res => {
      if (!cancelled) setUsage(res)
    })

    return () => {
      cancelled = true
    }
  }, [sessionLoading, session])

  if (!usage) {
    return (
      <div className="bg-white border rounded-xl shadow p-6 flex flex-col gap-4 opacity-30 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-2 bg-gray-200 rounded w-full" />
        <div className="h-2 bg-gray-200 rounded w-full" />
      </div>
    )
  }

  const isFree = usage.plan === 'free'
  const percent = usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0

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
            <span className="text-2xl font-semibold uppercase">{usage.plan}</span>
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
            {usage.used} / {usage.limit} folhas {isFree ? 'hoje' : 'este mês'}
          </span>
          <span>{percent}%</span>
        </div>

        <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
          <div className="h-full bg-black transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="flex justify-between items-center text-sm text-gray-600">
        <span>Créditos extras: {usage.credits}</span>
        <button className="underline">
          {isFree ? 'Fazer upgrade' : 'Gerenciar plano'}
        </button>
      </div>
    </div>
  )
}
