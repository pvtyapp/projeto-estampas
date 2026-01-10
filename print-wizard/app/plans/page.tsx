'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'
import { useSession } from '@/app/providers/SessionProvider'
import { useRouter } from 'next/navigation'

type Plan = {
  id: string
  name: string
  monthly_limit: number | null
  daily_limit: number | null
  library_limit: number | null
  price: number
}

type CreditPackage = {
  id: string
  name: string
  sheets: number
  price_cents: number
}

export default function PlansPage() {
  const { session, loading } = useSession()
  const router = useRouter()

  const [plans, setPlans] = useState<Plan[]>([])
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/auth')
    }
  }, [loading, session, router])

  useEffect(() => {
    async function load() {
      const res = await api('/plans')
      const packs = await api('/credit-packages')

      setPlans((res.plans || []).sort((a: Plan, b: Plan) => a.price - b.price))
      setCurrentPlan(res.current_plan || null)
      setPackages(packs || [])
    }
    load()
  }, [])

  if (!session) return null

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-24">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Planos e créditos</h1>
          <p className="text-gray-600 text-sm mt-1">
            Controle previsível para crescer sem travar a operação.
          </p>
        </div>

        <button
          onClick={() => router.push('/work')}
          className="text-sm text-gray-600 hover:text-black hover:underline"
        >
          ← Voltar para o painel
        </button>
      </div>

      {/* Plans */}
      <div>
        <h2 className="text-3xl font-semibold mb-10 text-center">
          Escolha seu plano mensal
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map(plan => {
            const isCurrent = plan.id === currentPlan
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

                <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>

                <div className="text-3xl font-bold mb-4">
                  {plan.price > 0 ? `R$ ${plan.price.toFixed(2)}` : 'Grátis'}
                  <span className="text-sm text-gray-500 font-normal"> / mês</span>
                </div>

                <ul className="text-sm text-gray-600 space-y-1 mb-6">
                  {plan.monthly_limit && <li>• {plan.monthly_limit} arquivos / mês</li>}
                  {plan.daily_limit && <li>• {plan.daily_limit} arquivos / dia</li>}
                  {plan.library_limit && <li>• {plan.library_limit} na biblioteca</li>}
                  <li>• Geração automática</li>
                  <li>• Organização</li>
                  {plan.id === 'pro' && <li className="font-medium text-black">• Prioridade na fila</li>}
                  {plan.id === 'ent' && <li className="font-medium text-black">• Prioridade máxima</li>}
                </ul>

                <div className="mt-auto">
                  {isCurrent ? (
                    <button disabled className="w-full py-2 rounded bg-gray-100 text-gray-500">
                      Plano atual
                    </button>
                  ) : isFree ? null : (
                    <button
                      onClick={() =>
                        plan.id === 'ent'
                          ? alert('Em breve: contato comercial 😄')
                          : alert('Stripe entra aqui depois')
                      }
                      className="w-full py-2 rounded bg-black text-white hover:opacity-90"
                    >
                      {plan.id === 'ent' ? 'Falar com vendas' : 'Escolher plano'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Credit Packages */}
      <div>
        <h2 className="text-3xl font-semibold mb-8 text-center">
          Precisa de mais folhas este mês?
        </h2>

        <p className="text-center text-gray-600 mb-10">
          Compre pacotes extras e continue produzindo sem precisar trocar de plano.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {packages.map(pkg => (
            <div
              key={pkg.id}
              className="border rounded-2xl p-6 shadow-sm bg-white flex justify-between items-center"
            >
              <div>
                <h3 className="font-semibold text-lg">{pkg.name}</h3>
                <p className="text-sm text-gray-600">{pkg.sheets} folhas extras</p>
              </div>

              <div className="text-right">
                <div className="text-xl font-bold mb-2">
                  R$ {(pkg.price_cents / 100).toFixed(2)}
                </div>
                <button
                  onClick={() => alert('Stripe entra aqui depois')}
                  className="px-4 py-2 rounded bg-black text-white text-sm hover:opacity-90"
                >
                  Comprar pacote
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
