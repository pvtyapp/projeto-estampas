'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'
import { useSession } from '@/app/providers/SessionProvider'

type Usage = {
  plan: string
  used: number
  limit: number
  remaining_days: number
  status: 'ok' | 'warning' | 'blocked' | 'using_credits'
}

export default function DashboardPanel() {
  const { session, loading: sessionLoading } = useSession()
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (sessionLoading || !session) return
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        const res = await api('/me/usage')
        if (!cancelled) setUsage(res)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [sessionLoading, session])

  if (sessionLoading || loading || !usage) return null

  const percent =
    usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0

  const statusColor = {
    ok: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    blocked: 'bg-red-100 text-red-700',
    using_credits: 'bg-blue-100 text-blue-700',
  }[usage.status]

  return (
    <div className="bg-white rounded-xl shadow border p-5 flex justify-between items-center">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-lg">{usage.plan}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${statusColor}`}>
            {usage.status}
          </span>
        </div>

        <div className="text-sm text-gray-600">
          {usage.used} / {usage.limit} folhas usadas ({percent}%)
        </div>

        <div className="w-48 h-2 bg-gray-200 rounded overflow-hidden mt-1">
          <div className="h-full bg-black" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="text-right">
        <div className="text-sm text-gray-600">Renova em</div>
        <div className="font-medium">{usage.remaining_days} dias</div>
        <button className="mt-2 text-sm underline">Renovar</button>
      </div>
    </div>
  )
}
