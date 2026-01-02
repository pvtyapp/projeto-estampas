'use client'

import { useState } from 'react'
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
  const [hasVariants, setHasVariants] = useState(false)
  const [hasExtra, setHasExtra] = useState(false)
  const [loading, setLoading] = useState(false)

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

    if (hasVariants && !back) return alert('Envie a estampa das costas.')
    if (hasVariants && (!backW || !backH)) return alert('Informe medidas das costas.')

    if (hasExtra && !extra) return alert('Envie a estampa extra.')
    if (hasExtra && (!extraW || !extraH)) return alert('Informe medidas da estampa extra.')

    setLoading(true)

    try {
      const print = await api('/prints', {
        method: 'POST',
        body: JSON.stringify({
          name,
          sku,
          width_cm: Number(frontW.replace(',', '.')),
          height_cm: Number(frontH.replace(',', '.')),
          is_composite: hasVariants || hasExtra
        })
      })

      const upload = async (
        file: File,
        type: 'front' | 'back' | 'extra',
        w: string,
        h: string,
      ) => {
        const form = new FormData()
        form.append('file', file)
        form.append('type', type)
        form.append('width_cm', w.replace(',', '.'))
        form.append('height_cm', h.replace(',', '.'))

        await api(`/prints/${print.id}/upload`, {
          method: 'POST',
          body: form,
          headers: {}
        })
      }

      await upload(front, 'front', frontW, frontH)
      if (hasVariants && back) await upload(back, 'back', backW, backH)
      if (hasExtra && extra) await upload(extra, 'extra', extraW, extraH)

      reset()
      onComplete()
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
    setHasVariants(false)
    setHasExtra(false)
  }

  return (
    <div className="rounded-2xl border bg-white p-8 space-y-4">
      <h2 className="text-xl font-semibold">Adicionar estampa</h2>

      <Upload label="Frente (principal)" onFile={handleFront} />

      {front && (
        <>
          <input className="w-full border rounded-lg px-4 py-2" value={name} onChange={e => setName(e.target.value)} placeholder="Nome" />
          <input className="w-full border rounded-lg px-4 py-2 bg-gray-50" value={sku} disabled />

          <div className="flex gap-4">
            <input className="w-full border rounded-lg px-4 py-2" placeholder="Largura frente (cm)" value={frontW} onChange={e => setFrontW(e.target.value)} />
            <input className="w-full border rounded-lg px-4 py-2" placeholder="Altura frente (cm)" value={frontH} onChange={e => setFrontH(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hasVariants} onChange={e => setHasVariants(e.target.checked)} />
            Possui costas?
          </label>
        </>
      )}

      {hasVariants && (
        <>
          <Upload label="Costas" onFile={setBack} />
          <div className="flex gap-4">
            <input className="w-full border rounded-lg px-4 py-2" placeholder="Largura costas (cm)" value={backW} onChange={e => setBackW(e.target.value)} />
            <input className="w-full border rounded-lg px-4 py-2" placeholder="Altura costas (cm)" value={backH} onChange={e => setBackH(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hasExtra} onChange={e => setHasExtra(e.target.checked)} />
            Adicionar estampa extra?
          </label>
        </>
      )}

      {hasExtra && (
        <>
          <Upload label="Extra" onFile={setExtra} />
          <div className="flex gap-4">
            <input className="w-full border rounded-lg px-4 py-2" placeholder="Largura extra (cm)" value={extraW} onChange={e => setExtraW(e.target.value)} />
            <input className="w-full border rounded-lg px-4 py-2" placeholder="Altura extra (cm)" value={extraH} onChange={e => setExtraH(e.target.value)} />
          </div>
        </>
      )}

      <button onClick={submit} disabled={loading} className="bg-black text-white px-6 py-2 rounded-lg">
        {loading ? 'Enviando...' : 'Adicionar à biblioteca'}
      </button>
    </div>
  )
}

function Upload({ label, onFile }: { label: string; onFile: (f: File | null) => void }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input type="file" onChange={e => onFile(e.target.files?.[0] || null)} />
    </div>
  )
}
