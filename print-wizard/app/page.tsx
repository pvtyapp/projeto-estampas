'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const RESEND_SECONDS = 120

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSignup, setShowSignup] = useState(false)

  async function login() {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error || !data.session) {
      setError('Email ou senha inválidos.')
    } else {
      window.location.href = '/work'
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-6">
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-xl grid md:grid-cols-2 overflow-hidden">

        <div className="p-12 flex flex-col justify-center gap-6">
          <h1 className="text-4xl font-bold">PrintWizard</h1>
          <p className="text-gray-600 text-lg">
            Transforme suas artes em folhas prontas para impressão em segundos.
          </p>

          <div className="flex flex-wrap gap-3 mt-4">
            {['Menos desperdício', 'Mais produtividade', 'Padrão profissional', 'Sem complicação'].map((t) => (
              <span key={t} className="px-4 py-2 bg-gray-100 rounded-full text-sm text-gray-700">
                {t}
              </span>
            ))}
          </div>

          <p className="text-sm text-gray-500 mt-6">
            Comece grátis. Sem cartão de crédito.
          </p>
        </div>

        <div className="p-12 bg-gray-50 space-y-4">
          <h2 className="text-2xl font-semibold">Acesse sua conta</h2>

          <input className="w-full border rounded-xl px-4 py-3" placeholder="Seu email" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" className="w-full border rounded-xl px-4 py-3" placeholder="Sua senha" value={password} onChange={e => setPassword(e.target.value)} />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button onClick={login} disabled={loading} className="w-full bg-black text-white py-3 rounded-xl hover:opacity-90 transition">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <button onClick={() => setShowSignup(true)} className="text-sm underline text-gray-600">
            Criar conta grátis
          </button>
        </div>
      </div>

      {showSignup && <SignupModal onClose={() => setShowSignup(false)} />}
    </main>
  )
}

/* ===================== MODAL DE CADASTRO ===================== */

function SignupModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [seconds, setSeconds] = useState(RESEND_SECONDS)

  function update(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function submit() {
    if (!form.email || !form.password) return setError('Preencha email e senha.')
    if (form.password !== form.confirm) return setError('As senhas não conferem.')

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: form },
    })

    if (error) setError(error.message)
    else setSuccess(true)
  }

  useEffect(() => {
    if (!success || seconds <= 0) return
    const t = setTimeout(() => setSeconds(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds, success])

  async function resend() {
    await supabase.auth.resend({ type: 'signup', email: form.email })
    setSeconds(RESEND_SECONDS)
  }

  return (
    <Modal onClose={onClose}>
      {!success ? (
        <>
          <h2 className="text-xl font-semibold mb-2">Crie sua conta</h2>
          <p className="text-sm text-gray-500 mb-4">
            Leva menos de 1 minuto para começar 🚀
          </p>

          <Input placeholder="Nome completo" onChange={v => update('name', v)} />
          <Input placeholder="Telefone" onChange={v => update('phone', v)} />
          <Input placeholder="CPF ou CNPJ" onChange={v => update('doc', v)} />
          <Input placeholder="Endereço" onChange={v => update('address', v)} />
          <Input placeholder="Email" onChange={v => update('email', v)} />
          <Input placeholder="Senha" type="password" onChange={v => update('password', v)} />
          <Input placeholder="Confirmar senha" type="password" onChange={v => update('confirm', v)} />

          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

          <button onClick={submit} className="w-full bg-black text-white py-3 rounded-xl mt-4 hover:opacity-90 transition">
            Criar conta grátis
          </button>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold mb-2">Conta criada 🎉</h2>
          <p className="text-sm text-gray-600 mb-4">
            Enviamos um email de confirmação. Verifique sua caixa de entrada.
          </p>

          <button
            disabled={seconds > 0}
            onClick={resend}
            className="w-full border py-3 rounded-xl mb-2 disabled:opacity-50"
          >
            {seconds > 0
              ? `Reenviar em ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
              : 'Reenviar email de confirmação'}
          </button>

          <button onClick={onClose} className="w-full bg-black text-white py-3 rounded-xl">
            Voltar para login
          </button>
        </>
      )}
    </Modal>
  )
}

/* ===================== COMPONENTES ===================== */

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-2xl w-full max-w-md relative animate-fadeIn">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-black">✕</button>
        {children}
      </div>
    </div>
  )
}

function Input({
  placeholder,
  type = 'text',
  onChange,
}: {
  placeholder: string
  type?: string
  onChange: (value: string) => void
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      className="w-full border rounded-xl px-4 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-black/10"
      onChange={e => onChange(e.target.value)}
    />
  )
}
