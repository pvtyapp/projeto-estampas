'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/apiClient'
import { PreviewItem } from '@/app/types/preview'

type Print = {
  id: string
  name: string
  sku: string
  slots?: {
    front?: { url: string; width_cm: number; height_cm: number }
    back?: { url: string; width_cm: number; height_cm: number }
    extra?: { url: string; width_cm: number; height_cm: number }
  }
}

type Props = {
  onPreview: (items: PreviewItem[]) => void
  version: number
}

export default function Library({ onPreview, version }: Props) {
  const [prints, setPrints] = useState<Print[]>([])
  const [qty, setQty] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [version])

  async function load() {
    try {
      setLoading(true)
      const data = await api('/prints')
      setPrints(data)
    } catch (e) {
      console.error(e)
      alert('Erro ao carregar biblioteca')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return prints.filter(
      p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    )
  }, [prints, search])

  function setPrintQty(id: string, value: number) {
    setQty(q => ({ ...q, [id]: Math.max(0, value) }))
  }

  function buildPreview() {
    const items: PreviewItem[] = prints
      .map(p => ({
        print_id: p.id,
        name: p.name,
        sku: p.sku,
        qty: qty[p.id] || 0,
        width_cm: p.slots?.front?.width_cm || 10,
        height_cm: p.slots?.front?.height_cm || 10,
      }))
      .filter(i => i.qty > 0)

    if (items.length === 0) {
      alert('Informe a quantidade de pelo menos uma estampa.')
      return
    }

    onPreview(items)
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">Biblioteca</h2>

      <input
        type="text"
        placeholder="Buscar por nome ou SKU..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border rounded px-3 py-1 text-sm"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-2">
        {loading && <p className="text-sm text-gray-400">Carregando...</p>}

        {!loading &&
          filtered.map(p => (
            <div
              key={p.id}
              className="border rounded p-3 flex justify-between items-start"
            >
              <div>
                <div className="text-sm font-medium">
                  {p.name} / {p.sku}
                </div>

                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span>Qtd:</span>
                  <input
                    type="number"
                    min={0}
                    value={qty[p.id] || ''}
                    onChange={e => setPrintQty(p.id, Number(e.target.value))}
                    className="w-20 border rounded px-2 py-0.5"
                  />
                </div>
              </div>
            </div>
          ))}
      </div>

      <div className="pt-2">
        <button
          onClick={buildPreview}
          className="bg-black text-white px-5 py-2 rounded"
        >
          Gerar folhas
        </button>
      </div>
    </div>
  )
}
