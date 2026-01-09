'use client'

import { useRef, useState } from 'react'
import { api } from '@/lib/apiClient'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

type Props = { onComplete: () => void }

export default function SkuUploadWizard({ onComplete }: Props) {
  const router = useRouter()

  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [extra, setExtra] = useState<File | null>(null)

  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [frontW, setFrontW] = useState('')
  const [frontH, setFrontH] = useState('')
  const [backW, setBackW] = useState('')
  const [backH, setBackH] = useState('')
  const [extraW, setExtraW] = useState('')
  const [extraH, setExtraH] = useState('')

  const [hasBack, setHasBack] = useState(false)
  const [hasExtra, setHasExtra] = useState(false)
  const [loading, setLoading] = useState(false)

  const frontInput = useRef<HTMLInputElement>(null)
  const backInput = useRef<HTMLInputElement>(null)
  const extraInput = useRef<HTMLInputElement>(null)

  function handleFront(file: File | null) {
    if (!file) return
    setFront(file)
    const base = file.name.replace(/\.[^/.]+$/, '')
    setName(base)
    setSku(base.toLowerCase().replace(/\s+/g, '-'))
  }

  function preview(file: File | null) {
    if (!file) return null
    return URL.createObjectURL(file)
  }

  function parseNumber(v: string) {
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  async function submit() {
    const fw = parseNumber(frontW)
    const fh = parseNumber(frontH)
    const bw = parseNumber(backW)
    const bh = parseNumber(backH)
    const ew = parseNumber(extraW)
    const eh = parseNumber(extraH)

    if (!front) return alert('Envie a frente.')
    if (fw === null || fh === null) return alert('Informe medidas válidas da frente.')
    if (hasBack && (!back || bw === null || bh === null)) return alert('Complete as costas.')
    if (hasExtra && (!extra || ew === null || eh === null)) return alert('Complete a extra.')

    setLoading(true)
    try {
      const slots = [{ type: 'front', width_cm: fw, height_cm: fh }]

      if (hasBack) {
        slots.push({ type: 'back', width_cm: bw!, height_cm: bh! })
        if (hasExtra) slots.push({ type: 'extra', width_cm: ew!, height_cm: eh! })
      }

      const print = await api('/prints', {
        method: 'POST',
        body: JSON.stringify({ name, sku, slots }),
      })

      const upload = async (file: File, type: string, w: number, h: number) => {
        const form = new FormData()
        form.append('file', file)
        form.append('type', type)
        form.append('width_cm', String(w))
        form.append('height_cm', String(h))

        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.')

        const API_URL = process.env.NEXT_PUBLIC_API_URL!
        const res = await fetch(`${API_URL}/prints/${print.id}/upload`, {
          method: 'POST',
          body: form,
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (!res.ok) throw new Error(`Falha ao enviar ${type}`)
      }

      await upload(front, 'front', fw!, fh!)
      if (hasBack && back) await upload(back, 'back', bw!, bh!)
      if (hasExtra && extra) await upload(extra, 'extra', ew!, eh!)

      reset()
      onComplete()
      router.refresh()
    } catch (e: any) {
      alert(e.message || 'Erro ao enviar estampa')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setFront(null)
    setBack(null)
    setExtra(null)
    setName('')
    setSku('')
    setFrontW('')
    setFrontH('')
    setBackW('')
    setBackH('')
    setExtraW('')
    setExtraH('')
    setHasBack(false)
    setHasExtra(false)
  }

  return (
    <div className="rounded-2xl border bg-white p-6 space-y-6">
      <h2 className="text-xl font-semibold">Adicionar estampa</h2>

      <Slot title="Frente (principal)" onPick={() => frontInput.current?.click()} preview={preview(front)}>
        <input ref={frontInput} type="file" className="hidden" onChange={e => handleFront(e.target.files?.[0] || null)} />
        <Field label="Nome" value={name} onChange={setName} />
        <Field label="SKU" value={sku} onChange={setSku} />
        <TwoFields a={{ v: frontW, p: 'Largura frente (cm)', s: setFrontW }} b={{ v: frontH, p: 'Altura frente (cm)', s: setFrontH }} />
      </Slot>

      <Slot title="Costas" onPick={() => hasBack && backInput.current?.click()} preview={preview(back)} disabled={!hasBack}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasBack} onChange={e => setHasBack(e.target.checked)} />
          Possui costas?
        </label>
        <input ref={backInput} type="file" className="hidden" onChange={e => setBack(e.target.files?.[0] || null)} />
        <TwoFields a={{ v: backW, p: 'Largura costas (cm)', s: setBackW, d: !hasBack }} b={{ v: backH, p: 'Altura costas (cm)', s: setBackH, d: !hasBack }} />
      </Slot>

      <Slot title="Extra" onPick={() => hasExtra && extraInput.current?.click()} preview={preview(extra)} disabled={!hasExtra}>
        <label className={`flex items-center gap-2 text-sm ${hasBack ? '' : 'opacity-30'}`}>
          <input type="checkbox" checked={hasExtra} disabled={!hasBack} onChange={e => setHasExtra(e.target.checked)} />
          Adicionar estampa extra?
        </label>
        <input ref={extraInput} type="file" className="hidden" onChange={e => setExtra(e.target.files?.[0] || null)} />
        <TwoFields a={{ v: extraW, p: 'Largura extra (cm)', s: setExtraW, d: !hasExtra }} b={{ v: extraH, p: 'Altura extra (cm)', s: setExtraH, d: !hasExtra }} />
      </Slot>

      <button onClick={submit} disabled={loading} className="bg-black text-white px-5 py-2 rounded-lg">
        {loading ? 'Enviando...' : 'Adicionar à biblioteca'}
      </button>
    </div>
  )
}

/* helpers */

function Slot({ title, onPick, children, preview, disabled = false }: any) {
  return (
    <div className={`border rounded-xl p-4 space-y-3 transition ${disabled ? 'opacity-40' : ''}`}>
      <div className="flex justify-between items-center font-medium">
        {title}
        <button type="button" onClick={onPick} disabled={disabled} className="px-3 py-1 border rounded text-sm hover:bg-gray-50">
          Abrir PNG
        </button>
      </div>

      {preview && (
        <div className="flex justify-center">
          <img src={preview} className="max-h-28 object-contain border rounded" />
        </div>
      )}

      {children}
    </div>
  )
}

function Field({ label, value, onChange }: any) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <input className="input" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

function TwoFields({ a, b }: any) {
  return (
    <div className="flex gap-3">
      <input disabled={a.d} className="input" placeholder={a.p} value={a.v} onChange={e => a.s(e.target.value)} />
      <input disabled={b.d} className="input" placeholder={b.p} value={b.v} onChange={e => b.s(e.target.value)} />
    </div>
  )
}
