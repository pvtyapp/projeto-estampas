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
  const saveTimers = useRef<Record<string, any>>({})

  const totalSelected = useMemo(
    () => Object.values(qty).reduce((sum, v) => sum + (v || 0), 0),
    [qty],
  )

  const overLimit = totalSelected > 100

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [printsData, usageData, notesData] = await Promise.all([
        api('/prints'),
        api('/me/usage'),
        api('/print-notes'),
      ])
      setPrints(printsData)
      setUsage(usageData)

      const map: Record<string, string> = {}
      for (const n of notesData || []) {
        map[n.print_id] = n.note || ''
      }
      setNotes(map)
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

    if (overLimit) {
      alert('O limite máximo por job é 100 estampas.')
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
  }

  function getSlot(p: Print, type: Slot['type']) {
    return p.slots.find(s => s.type === type)
  }

  function updateNote(printId: string, value: string) {
    setNotes(n => ({ ...n, [printId]: value }))

    clearTimeout(saveTimers.current[printId])
    saveTimers.current[printId] = setTimeout(async () => {
      try {
        await api('/print-notes', {
          method: 'POST',
          body: JSON.stringify({ print_id: printId, note: value }),
        })
      } catch (e) {
        console.error('Erro ao salvar nota', e)
      }
    }, 600)
  }

  return (
    <div className="h-[810px] flex flex-col">
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

      <div className="flex flex-col gap-1 overflow-y-auto flex-1 pr-2">
        {loading && <p className="text-sm text-gray-400">Carregando...</p>}

        {!loading &&
          filtered.map(p => {
            const front = getSlot(p, 'front')
            const back = getSlot(p, 'back')
            const extra = getSlot(p, 'extra')
            const note = notes[p.id] || ''

            const current = qty[p.id] || 0

            return (
              <div
                key={p.id}
                className="border rounded-md px-3 h-[56px] flex items-center justify-between gap-2 relative overflow-hidden bg-white/60 hover:bg-white transition"
              >
                <div className="flex-1 overflow-hidden">
                  <div className="text-sm font-medium truncate">
                    {p.name} / {p.sku}
                  </div>

                  <div className="text-xs text-gray-400 flex gap-3 truncate">
                    {front && <span>F: {front.width_cm}×{front.height_cm}</span>}
                    {back && <span>C: {back.width_cm}×{back.height_cm}</span>}
                    {extra && <span>E: {extra.width_cm}×{extra.height_cm}</span>}
                  </div>

                  {note && openNote !== p.id && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        setOpenNote(p.id)
                      }}
                      className="text-[10px] text-yellow-700 italic mt-0.5 truncate max-w-[200px] text-left hover:underline"
                      title="Clique para editar anotação"
                    >
                      📝 {note.split('\n')[0]}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    className="w-14 border rounded px-2 py-0.5 text-xs text-center"
                    value={current}
                    onChange={e => {
                      const value = Number(e.target.value) || 0
                      const nextTotal = totalSelected - current + value
                      if (nextTotal > 100) return
                      setQty(q => ({ ...q, [p.id]: value }))
                    }}
                  />
                  <span className="text-xs text-gray-400">QTY</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      setOpenNote(openNote === p.id ? null : p.id)
                    }}
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
                      onChange={e => updateNote(p.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      placeholder="Anotações sobre esta estampa..."
                      className="w-full h-24 text-xs border rounded p-1 resize-none"
                    />
                  </div>
                )}
              </div>
            )
          })}
      </div>

      <div className="mt-auto flex flex-col items-center gap-1">
        <button
          onClick={buildPreview}
          disabled={isBlocked || overLimit || totalSelected === 0}
          className="bg-black text-white px-5 py-2 rounded disabled:opacity-50"
          type="button"
        >
          Gerar folhas
        </button>

        <span className={`text-xs ${overLimit ? 'text-red-600' : 'text-gray-500'}`}>
          Total selecionado: {totalSelected} / 100
        </span>

        {overLimit && (
          <span className="text-[10px] text-red-600">
            Limite máximo por job é 100 estampas
          </span>
        )}
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
