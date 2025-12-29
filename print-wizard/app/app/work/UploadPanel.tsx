'use client'

import { useState } from 'react'

export default function UploadPanel() {
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [front, setFront] = useState<File | null>(null)

  const [hasBack, setHasBack] = useState(false)
  const [back, setBack] = useState<File | null>(null)
  const [backWidth, setBackWidth] = useState('')
  const [backHeight, setBackHeight] = useState('')

  const [hasExtra, setHasExtra] = useState(false)
  const [extra, setExtra] = useState<File | null>(null)
  const [extraWidth, setExtraWidth] = useState('')
  const [extraHeight, setExtraHeight] = useState('')

  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!front) return alert('Envie a estampa principal.')
    if (!name || !sku || !width || !height) return alert('Preencha todos os campos do principal.')
    if (!sku.match(/^[a-zA-Z0-9-_]+$/)) return alert('SKU inválido.')

    if (hasBack && (!back || !backWidth || !backHeight)) {
      return alert('Preencha todos os dados da estampa secundária.')
    }

    if (hasExtra && (!extra || !extraWidth || !extraHeight)) {
      return alert('Preencha todos os dados da estampa adicional.')
    }

    setLoading(true)

    try {
      const headers = {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      }

      const baseSku = sku.toLowerCase()

      const mainRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/prints`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          sku: baseSku,
          width_cm: Number(width.replace(',', '.')),
          height_cm: Number(height.replace(',', '.')),
          is_composite: hasBack,
        }),
      })

      if (!mainRes.ok) throw new Error('Erro ao criar estampa')
      const print = await mainRes.json()

      await uploadFile(print.id, front, 'front', width, height)

      if (hasBack && back) {
        await uploadFile(print.id, back, 'back', backWidth, backHeight)
      }

      if (hasExtra && extra) {
        await uploadFile(print.id, extra, 'extra', extraWidth, extraHeight)
      }

      alert('Kit de estampas adicionado com sucesso!')
      reset()
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Erro ao enviar estampas.')
    } finally {
      setLoading(false)
    }
  }

  async function uploadFile(
    printId: string,
    file: File,
    type: 'front' | 'back' | 'extra',
    width: string,
    height: string
  ) {
    const form = new FormData()
    form.append('file', file)
    form.append('type', type)
    form.append('width_cm', width.replace(',', '.'))
    form.append('height_cm', height.replace(',', '.'))

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/prints/${printId}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: form,
    })

    if (!res.ok) throw new Error(`Erro ao enviar arquivo (${type})`)
  }

  function reset() {
    setName('')
    setSku('')
    setWidth('')
    setHeight('')
    setFront(null)
    setHasBack(false)
    setBack(null)
    setBackWidth('')
    setBackHeight('')
    setHasExtra(false)
    setExtra(null)
    setExtraWidth('')
    setExtraHeight('')
  }

  return (
    <div className="rounded-2xl border bg-white p-8 space-y-6">
      <h2 className="text-xl font-semibold">Adicionar kit de estampas</h2>

      <UploadSlot title="Principal / Frente" file={front} setFile={setFront} />

      <div className="grid md:grid-cols-4 gap-4">
        <input className="border rounded-lg px-4 py-2" placeholder="Nome" value={name} onChange={e => setName(e.target.value)} />
        <input className="border rounded-lg px-4 py-2" placeholder="SKU" value={sku} onChange={e => setSku(e.target.value)} />
        <input className="border rounded-lg px-4 py-2" placeholder="Largura (cm)" value={width} onChange={e => setWidth(e.target.value)} />
        <input className="border rounded-lg px-4 py-2" placeholder="Altura (cm)" value={height} onChange={e => setHeight(e.target.value)} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={hasBack} onChange={e => setHasBack(e.target.checked)} />
        Estampa composta (tem costas)?
      </label>

      {hasBack && (
        <>
          <UploadSlot title="Secundária / Costas" file={back} setFile={setBack} />

          <div className="grid md:grid-cols-2 gap-4">
            <input className="border rounded-lg px-4 py-2" placeholder="Largura (cm)" value={backWidth} onChange={e => setBackWidth(e.target.value)} />
            <input className="border rounded-lg px-4 py-2" placeholder="Altura (cm)" value={backHeight} onChange={e => setBackHeight(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hasExtra} onChange={e => setHasExtra(e.target.checked)} />
            Possui estampa adicional?
          </label>
        </>
      )}

      {hasBack && hasExtra && (
        <>
          <UploadSlot title="Adicional" file={extra} setFile={setExtra} />

          <div className="grid md:grid-cols-2 gap-4">
            <input className="border rounded-lg px-4 py-2" placeholder="Largura (cm)" value={extraWidth} onChange={e => setExtraWidth(e.target.value)} />
            <input className="border rounded-lg px-4 py-2" placeholder="Altura (cm)" value={extraHeight} onChange={e => setExtraHeight(e.target.value)} />
          </div>
        </>
      )}

      <button onClick={submit} disabled={loading} className="bg-black text-white px-6 py-2 rounded-lg disabled:opacity-50">
        {loading ? 'Enviando...' : 'Adicionar kit à biblioteca'}
      </button>
    </div>
  )
}

function UploadSlot({
  title,
  file,
  setFile,
}: {
  title: string
  file: File | null
  setFile: (f: File | null) => void
}) {
  return (
    <div className="border rounded-xl p-4 space-y-2 text-sm">
      <p className="font-semibold text-base">{title}</p>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <span className="px-3 py-1 border rounded-md text-sm bg-gray-50 hover:bg-gray-100">Escolher arquivo</span>
        <input type="file" accept="image/png" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
      </label>
      {file && <p className="text-xs text-green-600">Arquivo selecionado: {file.name}</p>}
      {!file && <p className="text-xs text-gray-500">Apenas PNG. Sem preview.</p>}
    </div>
  )
}
