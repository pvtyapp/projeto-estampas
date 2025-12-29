'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Props = {
  onComplete: () => void
}

export default function SkuUploadWizard({ onComplete }: Props) {
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [extra, setExtra] = useState<File | null>(null)

  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [hasVariants, setHasVariants] = useState(false)
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
    if (!width || !height) return alert('Informe as medidas.')

    setLoading(true)

    const { data, error } = await supabase.from('prints').insert({
      name,
      sku,
      width_cm: Number(width.replace(',', '.')),
      height_cm: Number(height.replace(',', '.')),
      is_composite: hasVariants
    }).select().single()

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    const upload = async (file: File, label: string) => {
      const form = new FormData()
      form.append('file', file)
      form.append('label', label)

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/prints/${data.id}/upload`, {
        method: 'POST',
        body: form,
        credentials: 'include'
      })

      if (!res.ok) throw new Error(`Erro ao enviar ${label}`)
    }

    try {
      await upload(front, 'front')
      if (back) await upload(back, 'back')
      if (extra) await upload(extra, 'extra')
    } catch (e: any) {
      alert(e.message)
      setLoading(false)
      return
    }

    setFront(null)
    setBack(null)
    setExtra(null)
    setName('')
    setSku('')
    setWidth('')
    setHeight('')
    setHasVariants(false)
    setLoading(false)

    onComplete()
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
            <input className="w-full border rounded-lg px-4 py-2" placeholder="Largura (cm)" value={width} onChange={e => setWidth(e.target.value)} />
            <input className="w-full border rounded-lg px-4 py-2" placeholder="Altura (cm)" value={height} onChange={e => setHeight(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hasVariants} onChange={e => setHasVariants(e.target.checked)} />
            Possui outra estampa vinculada ao mesmo SKU?
          </label>
        </>
      )}

      {hasVariants && <Upload label="Costas" onFile={setBack} />}
      {back && <Upload label="Adicional (opcional)" onFile={setExtra} />}

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
