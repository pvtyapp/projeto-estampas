'use client'

import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    address: '',
    password: '',
    confirm: '',
  })

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

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
    if (form.password !== form.confirm) {
      setError('As senhas não conferem')
      return
    }

    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (error || !data.user) {
      setLoading(false)
      setError(error?.message || 'Erro ao criar usuário')
      return
    }

    await supabase.from('profiles').insert({
      id: data.user.id,
      name: form.name,
      phone: form.phone,
      cpf: form.cpf,
      address: form.address,
    })

    setLoading(false)
    setShowRegister(false)
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <motion.div
        className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl grid md:grid-cols-2 overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Lado esquerdo */}
        <div className="hidden md:flex flex-col justify-center px-12 py-16">
          <Image src="/logo.png" alt="PVTY" width={260} height={120} className="mb-8" />
          <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
            O padrão moderno para quem leva produção a sério.
          </h1>
          <p className="text-gray-600 text-lg">
            Automatize seus arquivos, reduza erros e ganhe escala.
          </p>
        </div>

        {/* Lado direito */}
        <div className="flex flex-col justify-center px-10 py-16">
          <h2 className="text-2xl font-semibold mb-6 text-gray-900">Acesse sua conta</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              className="w-full px-4 py-3 rounded-lg bg-gray-100 focus:bg-white border focus:outline-none"
              placeholder="Seu email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              className="w-full px-4 py-3 rounded-lg bg-gray-100 focus:bg-white border focus:outline-none"
              placeholder="Sua senha"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-black to-gray-800 text-white py-3 rounded-lg font-medium shadow-lg"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <button
            onClick={() => setShowRegister(true)}
            className="mt-4 text-sm underline text-center text-gray-700"
          >
            Criar conta grátis
          </button>
        </div>
      </motion.div>

      {/* Modal de cadastro */}
      <AnimatePresence>
        {showRegister && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <h3 className="text-xl font-semibold mb-6">Criar conta</h3>

              <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input placeholder="Nome" className="input" onChange={e => update('name', e.target.value)} required />
                <input placeholder="Email" className="input" onChange={e => update('email', e.target.value)} required />
                <input placeholder="Telefone" className="input" onChange={e => update('phone', e.target.value)} required />
                <input placeholder="CPF" className="input" onChange={e => update('cpf', e.target.value)} required />
                <input placeholder="Endereço" className="input md:col-span-2" onChange={e => update('address', e.target.value)} required />
                <input type="password" placeholder="Senha" className="input" onChange={e => update('password', e.target.value)} required />
                <input type="password" placeholder="Confirmar senha" className="input" onChange={e => update('confirm', e.target.value)} required />

                <button className="md:col-span-2 bg-black text-white py-3 rounded-lg">
                  {loading ? 'Criando...' : 'Criar conta'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowRegister(false)}
                  className="md:col-span-2 underline text-sm text-center"
                >
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
