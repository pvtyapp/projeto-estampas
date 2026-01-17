'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'
import { useSession } from '@/app/providers/SessionProvider'
import { useUsage } from '@/app/providers/UsageProvider'
import { useRouter } from 'next/navigation'

type Plan = {
  id: string
  name: string
  monthly_limit: number | null
  daily_limit: number | null
  library_limit: number | null
  price: number
  price_id: string
}

export default function PlansPage() {
  const { session, loading } = useSession()
  const { usage } = useUsage()
  const router = useRouter()

  const [plans, setPlans] = useState<Plan[]>([])
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/auth')
    }
  }, [loading, session, router])

  useEffect(() => {
    async function load() {
      const res = await api('/plans')
      const sorted = (res.plans || []).sort((a: Plan, b: Plan) => a.price - b.price)
      setPlans(sorted)
    }
    load()
  }, [])

  async function checkout(priceId: string) {
    try {
      setLoadingCheckout(priceId)
      const res = await api('/stripe/checkout/', {
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        body: JSON.stringify({ price_id: priceId }),
      })
      if (res?.url) {
        window.location.href = res.url
      } else {
        throw new Error('No checkout url returned')
      }
    } catch (e) {
      console.error(e)
      alert('Erro ao iniciar pagamento')
    } finally {
      setLoadingCheckout(null)
    }
  }

  if (!session) return null

  const currentPriceId = usage?.plan || null

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-24">
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold tracking-widest text-gray-700">
          Print Velocity To You
        </div>
        <button
          onClick={() => router.push('/work')}
          className="text-sm underline text-gray-600 hover:text-black"
        >
          Voltar
        </button>
      </div>

      <div>
        <h1 className="text-3xl font-semibold mb-10 text-center">
          Escolha o plano ideal para sua operação
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map(plan => {
            const isCurrent = plan.price_id === currentPriceId
            const isPopular = plan.id === 'pro'
            const isFree = plan.id === 'free'

            return (
              <div
                key={plan.id}
                className={`relative border rounded-2xl p-6 shadow-sm bg-white flex flex-col ${
                  isCurrent ? 'ring-2 ring-black' : ''
                } ${isPopular ? 'border-black' : 'border-gray-200'}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-3 py-1 rounded-full">
                    Mais escolhido
                  </div>
                )}

                <h2 className="text-lg font-semibold mb-1">{plan.name}</h2>

                <div className="text-3xl font-bold mb-4">
                  {plan.price > 0 ? `R$ ${plan.price.toFixed(2)}` : 'Grátis'}
                  <span className="text-sm text-gray-500 font-normal"> / 30 dias</span>
                </div>

                <ul className="text-sm text-gray-600 space-y-1 mb-6">
                  {plan.monthly_limit && <li>• {plan.monthly_limit} arquivos / ciclo</li>}
                  {plan.library_limit && <li>• {plan.library_limit} na biblioteca</li>}
                  <li>• Geração automática de folhas</li>
                  <li>• Organização e padronização</li>
                  {plan.id === 'pro' && (
                    <li className="font-medium text-black">• Prioridade na fila</li>
                  )}
                  {plan.id === 'ent' && (
                    <li className="font-medium text-black">• Prioridade máxima na fila</li>
                  )}
                </ul>

                <div className="mt-auto">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2 rounded bg-gray-100 text-gray-500 cursor-default"
                    >
                      Plano atual
                    </button>
                  ) : isFree ? null : (
                    <button
                      onClick={() => checkout(plan.price_id)}
                      disabled={loadingCheckout === plan.price_id}
                      className="w-full py-2 rounded bg-black text-white hover:opacity-90 transition disabled:opacity-50"
                    >
                      {loadingCheckout === plan.price_id
                        ? 'Redirecionando...'
                        : plan.id === 'ent'
                        ? 'Falar com vendas'
                        : 'Escolher este plano'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
