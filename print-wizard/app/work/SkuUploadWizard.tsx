'use client'

import { useRef, useState } from 'react'
import { api } from '@/lib/apiClient'
import { supabase } from '@/lib/supabaseClient'

type Props = { onComplete: () => void }

export default function SkuUploadWizard({ onComplete }: Props) {
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
  const [toast, setToast] = useState<string | null>(null)

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

  async function submit() {
    if (!front) return alert('Envie a frente.')
    if (!frontW || !frontH) return alert('Informe medidas da frente.')
    if (hasBack && (!back || !backW || !backH)) return alert('Complete as costas.')
    if (hasExtra && (!extra || !extraW || !extraH)) return alert('Complete a extra.')

    setLoading(true)

    try {
      const print = await api('/prints', {
        method: 'POST',
        body: JSON.stringify({
          name,
          sku,
          width_cm: Number(frontW.replace(',', '.')),
          height_cm: Number(frontH.replace(',', '.')),
          is_composite: hasBack || hasExtra,
        }),
      })

      const upload = async (file: File, type: string, w: string, h: string) => {
        const form = new FormData()
        form.append('file', file)
        form.append('type', type)
        form.append('width_cm', w.replace(',', '.'))
        form.append('height_cm', h.replace(',', '.'))

        const {
          data: { session },
        } = await supabase.auth.getSession()

        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/prints/${print.id}/upload`, {
          method: 'POST',
          body: form,
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        })
      }

      await upload(front, 'front', frontW, frontH)
      if (hasBack && back) await upload(back, 'back', backW, backH)
      if (hasExtra && extra) await upload(extra, 'extra', extraW, extraH)

      reset()
      onComplete()
      setToast('Estampa adicionada com sucesso!')

      setTimeout(() => {
        window.location.reload()
      }, 1200)
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
    <div className="relative rounded-2xl border bg-white p-6 space-y-6">
      {toast && (
        <div className="absolute top-3 right-3 bg-green-600 text-white text-sm px-4 py-2 rounded shadow">
          {toast}
        </div>
      )}

      <h2 className="text-xl font-semibold">Adicionar estampa</h2>

      <Slot title="Frente (principal)" active onPick={() => frontInput.current?.click()}>
        <input ref={frontInput} type="file" className="hidden" onChange={e => handleFront(e.target.files?.[0] || null)} />
        <Field label="Nome" value={name} onChange={setName} />
        <Field label="SKU" value={sku} onChange={setSku} />
        <TwoFields a={{ v: frontW, p: 'Largura frente (cm)', s: setFrontW }} b={{ v: frontH, p: 'Altura frente (cm)', s: setFrontH }} />
      </Slot>

      <Slot title="Costas" active onPick={() => hasBack && backInput.current?.click()}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasBack} onChange={e => setHasBack(e.target.checked)} />
          Possui costas?
        </label>

        <input ref={backInput} type="file" className="hidden" onChange={e => setBack(e.target.files?.[0] || null)} />

        <TwoFields a={{ v: backW, p: 'Largura costas (cm)', s: setBackW, d: !hasBack }} b={{ v: backH, p: 'Altura costas (cm)', s: setBackH, d: !hasBack }} />
      </Slot>

      <Slot title="Extra" active={hasBack} onPick={() => hasExtra && extraInput.current?.click()}>
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

/* ---------- helpers ---------- */

function Slot({ title, active = true, onPick, children }: any) {
  return (
    <div className={`border rounded-xl p-4 space-y-3 transition ${active ? 'opacity-100' : 'opacity-30'}`}>
      <div className="flex justify-between items-center font-medium">
        {title}
        <button type="button" onClick={onPick} className="px-3 py-1 border rounded text-sm hover:bg-gray-50">
          Abrir PNG
        </button>
      </div>
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
