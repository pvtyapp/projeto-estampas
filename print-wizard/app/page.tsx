'use client'

import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { Users, BarChart3, Zap, Cpu, Layers } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({ email: regEmail, password: regPassword })
    setLoading(false)
    if (error) setError(error.message)
    else setShowRegister(false)
  }

  return (
    <main className="min-h-screen bg-gray-50">

      {/* HERO */}
      <section className="flex items-center justify-center px-4 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="w-full max-w-5xl bg-white rounded-2xl shadow-xl grid md:grid-cols-2 overflow-hidden"
        >
          <div className="hidden md:flex flex-col justify-center px-10 py-12">
            <Image src="/logo.png" alt="PVTY" width={220} height={100} className="mb-6" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              O padrão moderno para quem leva produção a sério.
            </h1>
            <p className="text-gray-600">
              Automatize seus arquivos, reduza erros e ganhe escala.
            </p>
          </div>

          <div className="flex flex-col justify-center px-8 py-12">
            <h2 className="text-2xl font-semibold mb-6 text-gray-900">Acesse sua conta</h2>

            <form onSubmit={handleLogin} className="space-y-4">
              <input type="email" placeholder="Seu email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg" required />
              <input type="password" placeholder="Sua senha" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg" required />

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button disabled={loading} className="w-full bg-black text-white py-3 rounded-lg">
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <button onClick={() => setShowRegister(true)} className="mt-4 text-sm underline text-center">
              Criar conta grátis
            </button>
          </div>
        </motion.div>
      </section>

      {/* BLOCO TECNOLÓGICO */}
      <section className="px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-5xl mx-auto bg-black text-white rounded-2xl shadow-xl p-10 grid md:grid-cols-2 gap-8"
        >
          <div>
            <h2 className="text-2xl font-bold mb-4">Pare de arrastar arquivo por arquivo no Photoshop.</h2>
            <p className="text-gray-300 mb-6">Aqui você gera produção de verdade com um clique.</p>
            <ul className="space-y-3 text-gray-200">
              <li className="flex gap-2 items-start"><Layers className="w-5 h-5 mt-1" /> Gere dezenas de folhas em alta resolução</li>
              <li className="flex gap-2 items-start"><Layers className="w-5 h-5 mt-1" /> Monte automaticamente metros lineares em segundos</li>
              <li className="flex gap-2 items-start"><Layers className="w-5 h-5 mt-1" /> Pronto para pequenas e grandes operações</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Infraestrutura de processamento</h3>
            <ul className="space-y-3 text-gray-200">
              <li className="flex gap-2 items-start"><Cpu className="w-5 h-5 mt-1" /> Workers paralelos em nuvem</li>
              <li className="flex gap-2 items-start"><Cpu className="w-5 h-5 mt-1" /> Até 32 vCPUs disponíveis por job</li>
              <li className="flex gap-2 items-start"><Cpu className="w-5 h-5 mt-1" /> Fila inteligente com distribuição automática de carga</li>
              <li className="flex gap-2 items-start"><Cpu className="w-5 h-5 mt-1" /> Processamento independe do seu computador</li>
            </ul>
          </div>
        </motion.div>
      </section>

      {/* BLOCOS INFERIORES */}
      <section className="px-4 py-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {[{
            icon: <Users className="w-8 h-8 mb-4 text-gray-900" />,
            title: 'Menos gente apagando incêndio. Mais gente fazendo o negócio crescer.',
            items: [
              'Reduza a dependência de operadores montando arquivos manualmente.',
              'Elimine erros que geram retrabalho, atrasos e desperdício.',
              'Tenha uma operação mais leve, previsível e sob controle.'
            ]
          },{
            icon: <BarChart3 className="w-8 h-8 mb-4 text-gray-900" />,
            title: 'Um sistema construído para padronizar e reduzir custo operacional.',
            items: [
              'Automatiza a parte mais lenta e propensa a erro da produção.',
              'Substitui horas de trabalho manual por processamento automático.',
              'Dashboard que mostra custos, consumo e eficiência em tempo real.'
            ]
          },{
            icon: <Zap className="w-8 h-8 mb-4 text-gray-900" />,
            title: 'Quem não automatiza, perde margem. Simples assim.',
            items: [
              'Enquanto você automatiza, outros continuam limitados pela mão humana.',
              'Quem produz mais rápido ganha prazo, preço e mercado.',
              'A diferença não está no equipamento. Está no processo.',
              'E processo hoje se chama automação.'
            ]
          }].map((b, i) => (
            <motion.div key={i} whileHover={{ y: -6 }} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-white rounded-2xl shadow p-8"
            >
              {b.icon}
              <h3 className="text-lg font-semibold mb-4">{b.title}</h3>
              <ul className="text-gray-700 space-y-2">
                {b.items.map((it, j) => <li key={j}>{it}</li>)}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* MODAL CADASTRO */}
      <AnimatePresence>
        {showRegister && (
          <motion.div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div className="bg-white rounded-xl p-8 w-full max-w-sm"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3 className="text-xl font-semibold mb-4">Criar conta</h3>
              <form onSubmit={handleRegister} className="space-y-4">
                <input type="email" placeholder="Email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg" required />
                <input type="password" placeholder="Senha" value={regPassword} onChange={e => setRegPassword(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg" required />

                <button disabled={loading} className="w-full bg-black text-white py-3 rounded-lg">
                  {loading ? 'Criando...' : 'Criar conta'}
                </button>

                <button type="button" onClick={() => setShowRegister(false)} className="text-sm underline w-full text-center">
                  Cancelar
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  )
}
