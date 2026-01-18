
'use client'

import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Cpu, Layers, Users, BarChart3, Zap } from 'lucide-react'

export function maskPhone(v: any) {
  const s = String(v || '')
  return s
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15)
}

function Home() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    person_type: 'cpf',
    document: '',
    name: '',
    email: '',
    phone: '',
    street: '',
    number: '',
    cep: '',
    password: '',
    confirm: '',
  })

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  useEffect(() => {
    if (cooldown > 0) {
      const i = setInterval(() => setCooldown(c => c - 1), 1000)
      return () => clearInterval(i)
    }
  }, [cooldown])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      router.push('/work')
    }
  }

  function onlyDigits(v: any) {
    return String(v || '').replace(/\D/g, '')
  }

  function maskDocument(v: string) {
    const d = onlyDigits(v)
    if (form.person_type === 'cpf') {
      return d
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/, '$1.$2.$3-$4')
    } else {
      return d
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
        .replace(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5')
    }
  }

  function validateReal() {
    const d = onlyDigits(form.document)
    return (
      (form.person_type === 'cpf' && d.length === 11) ||
      (form.person_type === 'cnpj' && d.length === 14)
    )
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()

    if (!validateReal()) {
      setError(form.person_type === 'cpf' ? 'CPF deve ter 11 dígitos' : 'CNPJ deve ter 14 dígitos')
      return
    }

    if (form.password !== form.confirm) {
      setError('As senhas não conferem')
      return
    }

    setLoading(true)
    setError(null)

    // 1) SIGNUP MÍNIMO
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
      }),
    })

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.detail || 'Erro ao criar conta')
      setLoading(false)
      return
    }

    // 2) LOGIN
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (loginError) {
      setError(loginError.message)
      setLoading(false)
      return
    }

    // 3) AFTER SIGNUP (DADOS FISCAIS)
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/after-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        person_type: form.person_type,
        document: form.document,
        name: form.name,
        phone: form.phone,
        street: form.street,
        number: form.number,
        cep: form.cep,
        email: form.email,
      }),
    })

    setRegisteredEmail(form.email)
    setCooldown(120)
    setLoading(false)
  }

  async function resend() {
    if (!registeredEmail) return
    await supabase.auth.resend({ type: 'signup', email: registeredEmail })
    setCooldown(120)
  }

  return (
    <main className="min-h-screen bg-gray-50 relative overflow-hidden">
      <Image src="/logo.png" alt="" fill className="absolute opacity-[0.04] object-contain pointer-events-none" />

      <header className="relative z-10 flex justify-center pt-12 pb-6">
        <Image src="/logo.png" alt="PVTY" width={200} height={100} className="opacity-90" />
      </header>

      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 min-h-[70vh] pb-24">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight max-w-4xl">
          Economize até 80% do tempo, Automatize a montagem do metro de DTF direto para impressão...
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mb-10">
          Elimine o processo manual, evite erros de tamanho e ganhe escala SEM AUMENTAR A EQUIPE.
        </p>

        <form onSubmit={handleLogin} className="w-full max-w-md space-y-4 bg-white p-8 rounded-2xl shadow-xl">
          <input className="input" placeholder="Seu email" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" className="input" placeholder="Sua senha" value={password} onChange={e => setPassword(e.target.value)} />

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-900 transition">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <button type="button" onClick={() => setShowRegister(true)} className="text-sm underline">
            Criar conta grátis
          </button>
        </form>
      </section>

      <AnimatePresence>
        {showRegister && (
          <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
              {!registeredEmail ? (
                <>
                  <h3 className="text-xl font-semibold mb-4">Criar conta</h3>
                  <form onSubmit={handleRegister} className="space-y-3">
                    <select className="input" value={form.person_type} onChange={e => update('person_type', e.target.value)}>
                      <option value="cpf">Pessoa Física (CPF)</option>
                      <option value="cnpj">Pessoa Jurídica (CNPJ)</option>
                    </select>

                    <input className="input" placeholder={form.person_type === 'cpf' ? 'Nome completo' : 'Razão social'} onChange={e => update('name', e.target.value)} />
                    <input className="input" placeholder="Email" onChange={e => update('email', e.target.value)} />
                    <input className="input" placeholder="Telefone" onChange={e => update('phone', maskPhone(e.target.value))} />
                    <input className="input" placeholder={form.person_type === 'cpf' ? 'CPF' : 'CNPJ'} value={form.document} onChange={e => update('document', maskDocument(e.target.value))} />
                    <input className="input" placeholder="Rua" onChange={e => update('street', e.target.value)} />
                    <input className="input" placeholder="Número" onChange={e => update('number', e.target.value)} />
                    <input className="input" placeholder="CEP" onChange={e => update('cep', e.target.value.replace(/\D/g, '').slice(0, 8))} />
                    <input type="password" className="input" placeholder="Senha" onChange={e => update('password', e.target.value)} />
                    <input type="password" className="input" placeholder="Confirmar senha" onChange={e => update('confirm', e.target.value)} />

                    {error && <p className="text-red-600 text-sm">{error}</p>}

                    <button className="w-full bg-black text-white py-3 rounded-lg">
                      {loading ? 'Criando...' : 'Criar conta'}
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center space-y-4">
                  <h3 className="text-xl font-semibold">Verifique seu e-mail</h3>
                  <p>Enviamos um link para <strong>{registeredEmail}</strong></p>
                  <button disabled={cooldown > 0} onClick={resend} className="w-full bg-black text-white py-3 rounded-lg disabled:opacity-50">
                    {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar e-mail'}
                  </button>
                </div>
              )}

              <button onClick={() => setShowRegister(false)} className="mt-4 text-sm underline w-full">
                Fechar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

export default Home
