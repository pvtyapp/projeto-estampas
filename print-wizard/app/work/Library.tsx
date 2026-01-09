'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { api } from '@/lib/apiClient'
import { Pencil, StickyNote } from 'lucide-react'
import EditPrintModal from '@/components/EditPrintModal'

type Slot = {
  type: 'front' | 'back' | 'extra'
  width_cm: number
  height_cm: number
  url?: string
}

type Print = {
  id: string
  name: string
  sku: string
  slots: Slot[]
}

type PreviewItem = {
  print_id: string
  qty: number
  name?: string
  sku?: string
}

type Usage = {
  library_limit: number | null
}

type Props = {
  onPreview: (items: PreviewItem[]) => void
  version: number
}

export default function Library({ onPreview, version }: Props) {
  const [prints, setPrints] = useState<Print[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [usage, setUsage] = useState<Usage | null>(null)

  const [notes, setNotes] = useState<Record<string, string>>({})
  const [openNote, setOpenNote] = useState<string | null>(null)
  const [editing, setEditing] = useState<Print | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [qty, setQty] = useState<Record<string, number>>({})

  const noteRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [printsData, usageData] = await Promise.all([
        api('/prints'),
        api('/me/usage'),
      ])
      setPrints(printsData)
      setUsage(usageData)
    } catch (err) {
      console.error('Erro ao carregar biblioteca', err)
      alert('Erro ao carregar biblioteca. Veja o console.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [version, load])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (noteRef.current && !noteRef.current.contains(e.target as Node)) {
        setOpenNote(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return prints
      .filter(
        p =>
          String(p.name).toLowerCase().includes(q) ||
          String(p.sku).toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [prints, search])

  const limit = usage?.library_limit || Infinity
  const used = prints.length
  const percent = (used / limit) * 100
  const isBlocked = used >= limit

  const counterColor =
    percent >= 100
      ? 'text-red-600'
      : percent >= 70
      ? 'text-yellow-600'
      : 'text-gray-500'

  const tooltip =
    percent >= 100
      ? 'Você atingiu o limite do seu plano. Faça upgrade para adicionar mais estampas.'
      : percent >= 70
      ? 'Você está se aproximando do limite do seu plano.'
      : 'Quantidade de estampas usadas no seu plano.'

  function buildPreview() {
    if (isBlocked) {
      alert('Você atingiu o limite do seu plano. Faça upgrade para continuar.')
      return
    }

    const items: PreviewItem[] = Object.entries(qty)
      .filter(([, v]) => v > 0)
      .map(([id, v]) => {
        const p = prints.find(p => p.id === id)
        return {
          print_id: id,
          qty: v,
          name: p?.name,
          sku: p?.sku,
        }
      })

    if (!items.length) {
      alert('Informe ao menos um QTY maior que zero.')
      return
    }

    onPreview(items)
    setToast('Preview gerado 👇')
    setTimeout(() => setToast(null), 2000)

    setTimeout(() => {
      document.getElementById('preview-anchor')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 200)
  }

  function getSlot(p: Print, type: Slot['type']) {
    return p.slots.find(s => s.type === type)
  }

  return (
    <div className="space-y-4 h-full min-h-[720px] flex flex-col">
      {toast && (
        <div className="fixed top-4 right-4 bg-black text-white px-4 py-2 rounded shadow z-50">
          {toast}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-lg">Biblioteca</h2>
        <span className={`text-sm ${counterColor}`} title={tooltip}>
          {used} / {limit}
        </span>
      </div>

      <input
        type="text"
        placeholder="Buscar por nome ou SKU..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border rounded px-3 py-1 text-sm"
      />

      <div className="grid grid-cols-1 gap-2 max-h-[420px] overflow-y-auto pr-2 flex-1">
        {loading && <p className="text-sm text-gray-400">Carregando...</p>}

        {!loading &&
          filtered.map(p => {
            const front = getSlot(p, 'front')
            const back = getSlot(p, 'back')
            const extra = getSlot(p, 'extra')
            const note = notes[p.id] || ''

            return (
              <div
                key={p.id}
                className="border rounded px-3 py-2 flex items-center justify-between gap-3 relative"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {p.name} / {p.sku}
                  </div>

                  <div className="text-xs text-gray-400 flex gap-3">
                    {front && <span>F: {front.width_cm}×{front.height_cm}</span>}
                    {back && <span>C: {back.width_cm}×{back.height_cm}</span>}
                    {extra && <span>E: {extra.width_cm}×{extra.height_cm}</span>}
                  </div>

                  {note && openNote !== p.id && (
                    <div className="text-[10px] text-yellow-600 italic mt-1 truncate max-w-[200px]">
                      📝 {note.slice(0, 30)}…
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    disabled={isBlocked}
                    className="w-14 border rounded px-2 py-0.5 text-xs text-center disabled:opacity-40"
                    value={qty[p.id] ?? 0}
                    onChange={e =>
                      setQty(q => ({ ...q, [p.id]: Number(e.target.value) }))
                    }
                  />
                  <span className="text-xs text-gray-400">QTY</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setOpenNote(openNote === p.id ? null : p.id)}
                    className="text-gray-400 hover:text-black"
                    type="button"
                  >
                    <StickyNote size={16} />
                  </button>

                  <button
                    onClick={async () => {
                      const full = await api(`/prints/${p.id}`)
                      setEditing(full)
                    }}
                    className="text-gray-400 hover:text-black"
                    type="button"
                  >
                    <Pencil size={16} />
                  </button>
                </div>

                {openNote === p.id && (
                  <div
                    ref={noteRef}
                    className="absolute top-full right-0 mt-1 bg-yellow-100 border border-yellow-300 rounded shadow p-2 w-64 z-50"
                  >
                    <textarea
                      value={notes[p.id] || ''}
                      onChange={e =>
                        setNotes(n => ({ ...n, [p.id]: e.target.value }))
                      }
                      placeholder="Anotações sobre esta estampa..."
                      className="w-full h-24 text-xs border rounded p-1 resize-none"
                    />
                  </div>
                )}
              </div>
            )
          })}
      </div>

      <div className="pt-2">
        <button
          onClick={buildPreview}
          disabled={isBlocked}
          className="bg-black text-white px-5 py-2 rounded disabled:opacity-50"
          type="button"
        >
          Gerar folhas
        </button>
      </div>

      {editing && (
        <EditPrintModal
          print={editing}
          onClose={() => setEditing(null)}
          onUpdated={async () => {
            await load()
            setEditing(null)
          }}
          onDeleted={async () => {
            await load()
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
