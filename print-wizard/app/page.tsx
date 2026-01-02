'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Users, BarChart3, Zap, Cpu, Layers } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">

      {/* HERO */}
      <section className="flex items-center justify-center px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
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
            <h2 className="text-2xl font-semibold mb-6 text-gray-900">
              Acesse sua conta
            </h2>

            {/* Aqui você mantém seu login embutido/modal como já estava */}
            <Link href="/login" className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-900 transition text-center">
              Entrar
            </Link>

            <p className="text-sm text-gray-600 mt-4 text-center">
              Ainda não tem conta?{' '}
              <Link href="/register" className="text-black underline">
                Criar conta grátis
              </Link>
            </p>
          </div>
        </motion.div>
      </section>

      {/* NOVO BLOCO TECNOLÓGICO */}
      <section className="px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-5xl mx-auto bg-black text-white rounded-2xl shadow-xl p-10 grid md:grid-cols-2 gap-8"
        >
          <div>
            <h2 className="text-2xl font-bold mb-4">
              Pare de arrastar arquivo por arquivo no Photoshop.
            </h2>
            <p className="text-gray-300 mb-6">
              Aqui você gera produção de verdade com um clique.
            </p>
            <ul className="space-y-3 text-gray-200">
              <li className="flex gap-2 items-start"><Layers className="w-5 h-5 mt-1" /> Gere dezenas ou centenas de folhas em um único clique</li>
              <li className="flex gap-2 items-start"><Layers className="w-5 h-5 mt-1" /> Monte automaticamente metros lineares de produção em segundos</li>
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

          <motion.div whileHover={{ y: -6 }} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="bg-white rounded-2xl shadow p-8">
            <Users className="w-8 h-8 mb-4 text-gray-900" />
            <h3 className="text-lg font-semibold mb-4">
              Menos gente apagando incêndio. Mais gente fazendo o negócio crescer.
            </h3>
            <ul className="text-gray-700 space-y-2">
              <li>Reduza a dependência de operadores montando arquivos manualmente.</li>
              <li>Elimine erros que geram retrabalho, atrasos e desperdício.</li>
              <li>Tenha uma operação mais leve, previsível e sob controle.</li>
            </ul>
          </motion.div>

          <motion.div whileHover={{ y: -6 }} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }} className="bg-white rounded-2xl shadow p-8">
            <BarChart3 className="w-8 h-8 mb-4 text-gray-900" />
            <h3 className="text-lg font-semibold mb-4">
              Um sistema construído para padronizar e reduzir custo operacional.
            </h3>
            <ul className="text-gray-700 space-y-2">
              <li>Automatiza a parte mais lenta e propensa a erro da produção.</li>
              <li>Substitui horas de trabalho manual por processamento automático.</li>
              <li>Dashboard que mostra custos, consumo e eficiência em tempo real.</li>
            </ul>
          </motion.div>

          <motion.div whileHover={{ y: -6 }} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }} className="bg-white rounded-2xl shadow p-8">
            <Zap className="w-8 h-8 mb-4 text-gray-900" />
            <h3 className="text-lg font-semibold mb-4">
              Quem não automatiza, perde margem. Simples assim.
            </h3>
            <ul className="text-gray-700 space-y-2">
              <li>Enquanto você automatiza, outros continuam limitados pela mão humana.</li>
              <li>Quem produz mais rápido ganha prazo, preço e mercado.</li>
              <li>A diferença não está no equipamento. Está no processo.</li>
              <li>E processo hoje se chama automação.</li>
            </ul>
          </motion.div>

        </div>
      </section>

    </main>
  )
}
