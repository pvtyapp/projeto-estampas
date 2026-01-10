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

export default function PlansPage() {
  const { session, loading } = useSession()
  const router = useRouter()

  const [plans, setPlans] = useState<Plan[]>([])
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/auth')
    }
  }, [loading, session, router])

  useEffect(() => {
    async function load() {
      const res = await api('/plans')
      setPlans(res.plans || [])
      setCurrentPlan(res.current_plan || null)
    }
    load()
  }, [])

  if (!session) return null

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-20">
      <div>
        <h1 className="text-2xl font-semibold mb-8">Planos</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map(plan => {
            const isCurrent = plan.id === currentPlan

            return (
              <div
                key={plan.id}
                className={`border rounded-2xl p-6 shadow-sm bg-white flex flex-col ${
                  isCurrent ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <h2 className="text-lg font-semibold mb-1">{plan.name}</h2>

                <div className="text-2xl font-bold mb-4">
                  {plan.price > 0 ? `R$ ${plan.price.toFixed(2)}` : 'Grátis'}
                  <span className="text-sm text-gray-500"> / mês</span>
                </div>

                <ul className="text-sm text-gray-600 space-y-1 mb-6">
                  {plan.monthly_limit && <li>• {plan.monthly_limit} arquivos/mês</li>}
                  {plan.daily_limit && <li>• {plan.daily_limit} arquivos/dia</li>}
                  {plan.library_limit && <li>• {plan.library_limit} na biblioteca</li>}
                </ul>

                <div className="mt-auto">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2 rounded bg-gray-200 text-gray-600 cursor-default"
                    >
                      Plano atual
                    </button>
                  ) : (
                    <button
                      onClick={() => alert('Stripe entra aqui depois')}
                      className="w-full py-2 rounded bg-black text-white hover:opacity-90"
                    >
                      Trocar para este plano
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Marketing */}
      <section className="space-y-16">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl font-semibold mb-4">
            O PVTY não é só um software — é um operador digital de produção.
          </h2>
          <p className="text-gray-600 text-lg">
            Ele substitui planilhas, montagens manuais e retrabalho por um fluxo automático,
            previsível e econômico.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
          <div className="space-y-2">
            <div className="text-4xl font-bold text-black">−37%</div>
            <p className="text-sm text-gray-600">
              redução média no desperdício de mídia de impressão nas primeiras semanas de uso.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-4xl font-bold text-black">3x</div>
            <p className="text-sm text-gray-600">
              mais velocidade na criação de arquivos comparado ao processo manual.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-4xl font-bold text-black">0</div>
            <p className="text-sm text-gray-600">
              necessidade de alguém dedicado só para montar layouts e arquivos.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="bg-white border rounded-2xl p-8 shadow-sm">
            <h3 className="text-xl font-semibold mb-3">Benefícios práticos</h3>
            <ul className="space-y-2 text-gray-700 text-sm">
              <li>• Geração automática de folhas de impressão.</li>
              <li>• Organização centralizada de estampas e tamanhos.</li>
              <li>• Padronização do processo, independentemente de quem esteja operando.</li>
              <li>• Redução de erros humanos e arquivos errados.</li>
              <li>• Previsibilidade de custo por pedido.</li>
            </ul>
          </div>

          <div className="bg-white border rounded-2xl p-8 shadow-sm">
            <h3 className="text-xl font-semibold mb-3">Benefícios emocionais</h3>
            <ul className="space-y-2 text-gray-700 text-sm">
              <li>• Você não depende mais de uma pessoa específica para “saber montar”.</li>
              <li>• Você ganha tempo para focar em vendas, clientes e crescimento.</li>
              <li>• Sua operação fica mais profissional e previsível.</li>
              <li>• Menos estresse, menos urgência, menos retrabalho.</li>
              <li>• Mais controle sobre seu negócio.</li>
            </ul>
          </div>
        </div>

        <div className="text-center max-w-2xl mx-auto">
          <p className="text-gray-600">
            O PVTY foi criado para quem quer sair do modo “apagar incêndio” todos os dias
            e entrar no modo de operação organizada, escalável e lucrativa.
          </p>
        </div>
      </section>
    </div>
  )
}
