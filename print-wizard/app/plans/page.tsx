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

  async function checkout(planId: string) {
    try {
      setLoadingCheckout(planId)
      const res = await api(`/stripe/checkout?plan=${planId}`, { method: 'POST' })
      window.location.href = res.url
    } catch (e) {
      console.error(e)
      alert('Erro ao iniciar pagamento')
    } finally {
      setLoadingCheckout(null)
    }
  }

  if (!session) return null

  const currentPlan = usage?.plan || null

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-24">
      {/* Header */}
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

      {/* Plans */}
      <div>
        <h1 className="text-3xl font-semibold mb-10 text-center">
          Escolha o plano ideal para sua operação
        </h1>

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

                <h2 className="text-lg font-semibold mb-1">{plan.name}</h2>

                <div className="text-3xl font-bold mb-4">
                  {plan.price > 0 ? `R$ ${plan.price.toFixed(2)}` : 'Grátis'}
                  <span className="text-sm text-gray-500 font-normal"> / mês</span>
                </div>

                <ul className="text-sm text-gray-600 space-y-1 mb-6">
                  {plan.monthly_limit && <li>• {plan.monthly_limit} arquivos / mês</li>}
                  {plan.daily_limit && <li>• {plan.daily_limit} arquivos / dia</li>}
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
                      onClick={() => checkout(plan.id)}
                      disabled={loadingCheckout === plan.id}
                      className="w-full py-2 rounded bg-black text-white hover:opacity-90 transition disabled:opacity-50"
                    >
                      {loadingCheckout === plan.id
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

        {/* Extra Packs */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-2xl p-6 bg-white shadow-sm">
            <h3 className="text-lg font-semibold mb-2">Pacote Extra — 20 arquivos</h3>
            <p className="text-gray-600 text-sm mb-4">
              Para quando você precisa produzir mais em um período específico.
            </p>
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold">R$ 20,00</span>
              <button
                onClick={() => checkout('extra20')}
                disabled={loadingCheckout === 'extra20'}
                className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {loadingCheckout === 'extra20' ? 'Redirecionando...' : 'Comprar pacote'}
              </button>
            </div>
          </div>

          <div className="border rounded-2xl p-6 bg-white shadow-sm">
            <h3 className="text-lg font-semibold mb-2">Pacote Extra — 50 arquivos</h3>
            <p className="text-gray-600 text-sm mb-4">
              Ideal para picos de produção, datas sazonais ou grandes pedidos.
            </p>
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold">R$ 35,00</span>
              <button
                onClick={() => checkout('extra50')}
                disabled={loadingCheckout === 'extra50'}
                className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {loadingCheckout === 'extra50' ? 'Redirecionando...' : 'Comprar pacote'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Marketing */}
      <section className="space-y-20">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-4xl font-semibold mb-4">
            O PVTY não é só um software — é um operador digital de produção.
          </h2>
          <p className="text-gray-600 text-lg">
            Ele substitui planilhas, montagens manuais e retrabalho por um fluxo automático,
            previsível e econômico.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
          <div className="space-y-2">
            <div className="text-5xl font-bold">−80%</div>
            <p className="text-sm text-gray-600">
              redução média no desperdício do seu tempo operacional.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-5xl font-bold">13x</div>
            <p className="text-sm text-gray-600">
              mais velocidade na criação de arquivos comparado ao processo manual.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-5xl font-bold">0</div>
            <p className="text-sm text-gray-600">
              necessidade de alguém dedicado só para montar layouts.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="bg-white border rounded-2xl p-8 shadow-sm">
            <h3 className="text-xl font-semibold mb-3">Benefícios práticos</h3>
            <ul className="space-y-2 text-gray-700 text-sm">
              <li>• Geração automática de folhas de impressão.</li>
              <li>• Organização centralizada de estampas e tamanhos.</li>
              <li>• Padronização do processo, independente do operador.</li>
              <li>• Redução de erros humanos e arquivos errados.</li>
              <li>• Previsibilidade de custo por pedido.</li>
            </ul>
          </div>

          <div className="bg-white border rounded-2xl p-8 shadow-sm">
            <h3 className="text-xl font-semibold mb-3">Benefícios emocionais</h3>
            <ul className="space-y-2 text-gray-700 text-sm">
              <li>• Você não depende mais de alguém que “sabe montar”.</li>
              <li>• Você ganha tempo para focar em vendas e crescimento.</li>
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
