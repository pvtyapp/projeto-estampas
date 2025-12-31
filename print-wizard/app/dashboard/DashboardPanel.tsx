'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { api } from '@/lib/apiClient'

type Usage = {
  plan: string
  used: number
  limit: number
  credits: number
  percent: number
  remaining_days: number
  status: string
}

export default function DashboardPanel() {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const router = useRouter()

  // Espera a sessão existir
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) setSessionReady(true)
    }

    init()

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setSessionReady(true)
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  // Só chama API quando sessão existir
  useEffect(() => {
    if (!sessionReady) return

    api<Usage>('/me/usage')
      .then(setUsage)
      .catch(err => {
        console.error(err)
        setError('Não foi possível carregar o plano.')
      })
  }, [sessionReady])

  if (error) {
    return (
      <div className="border border-red-400 bg-red-50 text-red-600 rounded-xl p-4">
        {error}
      </div>
    )
  }

  if (!usage) {
    return <div className="p-4 text-gray-500">Carregando plano...</div>
  }

  return (
    <div className="border rounded-2xl p-6 space-y-4">
      <h2 className="text-lg font-semibold">Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card title="Plano" value={usage.plan} />
        <Card title="Uso" value={`${usage.used} / ${usage.limit}`} />
        <Card title="Restam" value={usage.plan !== 'Free' ? `${usage.remaining_days} dias` : '—'} />
        <Card title="Status" value={usage.status} />
        <Card title="Créditos extras" value={`${usage.credits} arquivos`} />
      </div>

      <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            usage.percent >= 80 ? 'bg-red-500' : 'bg-gray-400'
          }`}
          style={{ width: `${usage.percent}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
          Limite usado {usage.percent}%
        </span>
      </div>

      {usage.percent >= 80 && usage.percent < 100 && (
        <p className="text-xs text-yellow-600 text-center">
          Seu plano está perto do limite.
        </p>
      )}

      {usage.percent >= 100 && (
        <p className="text-xs text-red-600 text-center font-medium">
          Limite atingido. Faça upgrade ou compre créditos para continuar.
        </p>
      )}

      <div className="flex gap-3 justify-center pt-2">
        <button
          onClick={() => router.push('/billing/credits')}
          className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-100"
        >
          Comprar limite extra
        </button>

        <button
          onClick={() => router.push('/billing/plans')}
          className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-100"
        >
          Ver planos / Renovar
        </button>
      </div>
    </div>
  )
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="border rounded-xl p-3">
      <p className="text-xs text-gray-500">{title}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}
