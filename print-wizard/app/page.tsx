'use client'

import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Cpu, Layers, Users, BarChart3, Zap } from 'lucide-react'

export default function maskPhone(v: string){return v.replace(/\D/g,'').replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d)/,'$1-$2').slice(0,15)}

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
    cpf: '',
    street: '',
    number: '',
    cep: '',
    address: '',
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

  

function onlyDigits(v:string){return v.replace(/\D/g,'')}

function maskDocument(v:string){
  const d=onlyDigits(v)
  if(form.person_type==='cpf'){
    return d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/,'$1.$2.$3-$4')
  }else{
    return d.replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{2})\.(\d{3})\.(\d{3})(\d)/,'$1.$2.$3/$4').replace(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d{1,2})/,'$1.$2.$3/$4-$5')
  }
}

function validateReal(){
  const d=onlyDigits(form.document)
  return (form.person_type==='cpf' && d.length===11)||(form.person_type==='cnpj' && d.length===14)
}

function validateDocument(){
  if(form.person_type==='cpf' && form.document.replace(/\D/g,'').length!==11) return false;
  if(form.person_type==='cnpj' && form.document.replace(/\D/g,'').length!==14) return false;
  return true;
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

    const { data , error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { name: form.name, phone: form.phone, person_type: form.person_type, document: form.document, street: form.street,
        number: form.number,
        cep: form.cep } },
    })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setRegisteredEmail(form.email)
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/after-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.NEXT_PUBLIC_INTERNAL_KEY || '' },
        body: JSON.stringify({ id: data?.user?.id, user_metadata: { person_type: form.person_type, document: form.document, name: form.name, phone: form.phone, street: form.street,
        number: form.number,
        cep: form.cep } })
      })

      setCooldown(120)
    }
  }

  async function resend() {
    if (!registeredEmail) return
    await supabase.auth.resend({ type: 'signup', email: registeredEmail })
    setCooldown(120)
  }

  return (
    <main className="min-h-screen bg-gray-50 relative overflow-hidden">

      {/* LOGO BACKGROUND */}
      <Image src="/logo.png" alt="" fill className="absolute opacity-[0.04] object-contain pointer-events-none" />

      {/* HEADER LOGO */}
      <header className="relative z-10 flex justify-center pt-12 pb-6">
        <Image src="/logo.png" alt="PVTY" width={200} height={100} className="opacity-90" />
      </header>

      {/* HERO */}
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

      {/* BLOCO TECNOLÓGICO */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto bg-black text-white rounded-2xl p-10 grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-bold mb-4">Pare de arrastar arquivo por arquivo no Photoshop.</h2>
            <p className="text-gray-300 mb-6">Aqui você gera produção real com um clique.</p>
            <ul className="space-y-2 text-gray-200">
              <li className="flex gap-2"><Layers className="w-5 h-5" /> Gere centenas de estampas por clique</li>
              <li className="flex gap-2"><Layers className="w-5 h-5" /> Monte metros lineares automaticamente</li>
              <li className="flex gap-2"><Layers className="w-5 h-5" /> Pronto para qualquer escala</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-3">Infraestrutura</h3>
            <ul className="space-y-2 text-gray-200">
              <li className="flex gap-2"><Cpu className="w-5 h-5" /> Processamento em nuvem paralelo</li>
              <li className="flex gap-2"><Cpu className="w-5 h-5" /> 8 vCPU disponiveis</li>
              <li className="flex gap-2"><Cpu className="w-5 h-5" /> Alta performance em DPI alto</li>
              <li className="flex gap-2"><Cpu className="w-5 h-5" /> Melhor aproveitamento no encaixe</li>            
            </ul>
          </div>
        </div>
      </section>

      {/* 3 BLOCOS */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          {[{
            icon: <Users className="w-8 h-8 mb-3" />,
            title: 'Menos estresse operacional',
            items: ['Menos retrabalho', 'Menos erros', 'Menos responsabilidade']
          },{
            icon: <BarChart3 className="w-8 h-8 mb-3" />,
            title: 'Mais controle e margem',
            items: ['Custo visível', 'Processo padronizado', 'Encaixe Inteligente']
          },{
            icon: <Zap className="w-8 h-8 mb-3" />,
            title: 'Vantagem competitiva',
            items: ['Entrega mais rápida', 'Mais tempo para gestão', 'Mais lucro']
          }].map((b,i)=>(
            <div key={i} className="bg-white rounded-2xl shadow p-8">
              {b.icon}
              <h3 className="font-semibold mb-3">{b.title}</h3>
              <ul className="text-gray-600 space-y-1">
                {b.items.map((it,j)=><li key={j}>• {it}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* MODAL */}
      <AnimatePresence>
        {showRegister && (
          <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl"
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              {!registeredEmail ? (
                <>
                  <h3 className="text-xl font-semibold mb-4">Criar conta</h3>
                  <form onSubmit={handleRegister} className="space-y-3">
                    <select className="input" value={form.person_type} onChange={e=>update('person_type',e.target.value)}>
  <option value="cpf">Pessoa Física (CPF)</option>
  <option value="cnpj">Pessoa Jurídica (CNPJ)</option>
</select>
<input className="input" placeholder={form.person_type==='cpf'?'Nome completo':'Razão social'} onChange={e=>update('name',e.target.value)} />
                    <input className="input" placeholder="Email" onChange={e=>update('email',e.target.value)} />
                    <input className="input" placeholder="Telefone" onChange={e=>update('phone',maskPhone(e.target.value))} />
                    <input placeholder={form.person_type==='cpf'?'CPF':'CNPJ'} value={form.document} onChange={e=>update('document',maskDocument(e.target.value))} className={`input ${error?'border-red-500':''}`} />
                    <input className="input" placeholder="Rua" onChange={e=>update('street',e.target.value)} />
<input className="input" placeholder="Número" onChange={e=>update('number',e.target.value)} />
<input className="input" placeholder="CEP" onChange={e=>update('cep',e.target.value.replace(/\D/g,'').slice(0,8))} />
                    <input type="password" className="input" placeholder="Senha" onChange={e=>update('password',e.target.value)} />
                    <input type="password" className="input" placeholder="Confirmar senha" onChange={e=>update('confirm',e.target.value)} />

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
                  <button disabled={cooldown>0} onClick={resend}
                    className="w-full bg-black text-white py-3 rounded-lg disabled:opacity-50">
                    {cooldown>0 ? `Reenviar em ${cooldown}s` : 'Reenviar e-mail'}
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
