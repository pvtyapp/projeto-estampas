'use client'

import { useRef, useState } from 'react'
import { api } from '@/lib/apiClient'

type Props = {
  onComplete: () => void
}

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

        await api(`/prints/${print.id}/upload`, { method: 'POST', body: form, headers: {} })
      }

      await upload(front, 'front', frontW, frontH)
      if (hasBack && back) await upload(back, 'back', backW, backH)
      if (hasExtra && extra) await upload(extra, 'extra', extraW, extraH)

      reset()
      onComplete()
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

      {/* SLOT 1 */}
      <Slot
        title="Frente (principal)"
        active
        file={front}
        inputRef={frontInput}
        onPick={() => frontInput.current?.click()}
        onFile={handleFront}
      >
        <input className="input" placeholder="Nome" value={name} onChange={e => setName(e.target.value)} />
        <input className="input bg-gray-100 text-gray-500" disabled value={sku} />
        <div className="flex gap-3">
          <input className="input" placeholder="Largura frente (cm)" value={frontW} onChange={e => setFrontW(e.target.value)} />
          <input className="input" placeholder="Altura frente (cm)" value={frontH} onChange={e => setFrontH(e.target.value)} />
        </div>
      </Slot>

      {/* SLOT 2 */}
      <Slot
        title="Costas"
        active={hasBack}
        file={back}
        inputRef={backInput}
        onPick={() => backInput.current?.click()}
        onFile={setBack}
      >
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasBack} onChange={e => setHasBack(e.target.checked)} />
          Possui costas?
        </label>
        <div className="flex gap-3">
          <input disabled={!hasBack} className="input" placeholder="Largura costas (cm)" value={backW} onChange={e => setBackW(e.target.value)} />
          <input disabled={!hasBack} className="input" placeholder="Altura costas (cm)" value={backH} onChange={e => setBackH(e.target.value)} />
        </div>
      </Slot>

      {/* SLOT 3 */}
      <Slot
        title="Extra"
        active={hasExtra}
        file={extra}
        inputRef={extraInput}
        onPick={() => extraInput.current?.click()}
        onFile={setExtra}
      >
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasExtra} onChange={e => setHasExtra(e.target.checked)} />
          Adicionar estampa extra?
        </label>
        <div className="flex gap-3">
          <input disabled={!hasExtra} className="input" placeholder="Largura extra (cm)" value={extraW} onChange={e => setExtraW(e.target.value)} />
          <input disabled={!hasExtra} className="input" placeholder="Altura extra (cm)" value={extraH} onChange={e => setExtraH(e.target.value)} />
        </div>
      </Slot>

      <button onClick={submit} disabled={loading} className="bg-black text-white px-5 py-2 rounded-lg">
        {loading ? 'Enviando...' : 'Adicionar à biblioteca'}
      </button>
    </div>
  )
}

/* ---------- Slot visual ---------- */

function Slot({
  title,
  active,
  file,
  onPick,
  onFile,
  inputRef,
  children,
}: any) {
  return (
    <div className={`border rounded-xl p-4 space-y-3 transition ${active ? 'opacity-100' : 'opacity-40'}`}>
      <div className="flex justify-between items-center">
        <span className="font-medium">{title}</span>
        <button
          type="button"
          disabled={!active}
          onClick={onPick}
          className="text-sm px-3 py-1 border rounded disabled:opacity-40"
        >
          Abrir PNG
        </button>
      </div>

      {file && <div className="text-xs text-gray-500">Arquivo: {file.name}</div>}

      <input type="file" ref={inputRef} className="hidden" onChange={e => onFile(e.target.files?.[0] || null)} />

      {children}
    </div>
  )
}
