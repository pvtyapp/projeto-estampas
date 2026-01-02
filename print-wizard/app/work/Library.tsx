'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/apiClient'

type Print = {
  id: string
  name: string
  sku: string
  slots?: {
    front?: { url: string; width_cm: number; height_cm: number }
  }
}

type Props = {
  onJobCreated?: (jobId: string) => void
}

export default function Library({ onJobCreated }: Props) {
  const [prints, setPrints] = useState<Print[]>([])
  const [qty, setQty] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setLoading(true)
      const data = await api('/prints')
      setPrints(data)
    } catch {
      alert('Erro ao carregar biblioteca')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return prints.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
  }, [prints, search])

  function setPrintQty(id: string, value: number) {
    setQty(q => ({ ...q, [id]: Math.max(0, value) }))
  }

  async function createJob() {
    const items = prints
      .map(p => ({
        print_id: p.id,
        qty: qty[p.id] || 0,
        width_cm: p.slots?.front?.width_cm || 10,
        height_cm: p.slots?.front?.height_cm || 10,
      }))
      .filter(i => i.qty > 0)

    if (items.length === 0) {
      alert('Informe a quantidade de pelo menos uma estampa.')
      return
    }

    try {
      setCreating(true)
      const res = await api('/print-jobs', {
        method: 'POST',
        body: JSON.stringify({ items }),
      })
      onJobCreated?.(res.job_id)
    } catch (e: any) {
      alert(e.message || 'Erro ao criar job')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Biblioteca</h2>
        <button
          onClick={createJob}
          disabled={loading || creating}
          className="px-3 py-1 rounded bg-black text-white disabled:opacity-50"
        >
          {creating ? 'Gerando...' : 'Gerar folhas'}
        </button>
      </div>

      <input
        type="text"
        placeholder="Buscar por nome ou SKU..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border rounded px-3 py-1 text-sm"
      />

      {loading && <p className="text-sm text-gray-500">Carregando...</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
        {!loading &&
          filtered.map(p => (
            <div key={p.id} className="border p-3 rounded relative flex justify-between">
              <div>
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-gray-500">{p.sku}</div>

                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span>Qtd:</span>
                  <input
                    type="number"
                    min={0}
                    className="w-20 border rounded px-2 py-0.5"
                    value={qty[p.id] || ''}
                    onChange={e => setPrintQty(p.id, Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 text-xs">
                <button
                  onClick={() => setOpenNoteId(openNoteId === p.id ? null : p.id)}
                  className="text-gray-500 hover:text-black"
                >
                  📝 Anotações
                </button>
              </div>

              {openNoteId === p.id && (
                <div className="absolute inset-0 bg-white border rounded p-2 z-10">
                  <textarea
                    placeholder="Anotações..."
                    value={notes[p.id] || ''}
                    onChange={e => setNotes(n => ({ ...n, [p.id]: e.target.value }))}
                    className="w-full h-full border rounded p-2 text-sm"
                  />
                  <button
                    onClick={() => setOpenNoteId(null)}
                    className="absolute top-1 right-2 text-xs text-gray-500"
                  >
                    fechar
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
