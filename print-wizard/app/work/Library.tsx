'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/apiClient'
import { PreviewItem } from '@/app/types/preview'
import { Print } from '@/app/types/print'
import { Pencil, StickyNote } from 'lucide-react'
import EditPrintModal from '@/components/EditPrintModal'

type Props = {
  onPreview: (items: PreviewItem[]) => void
  version: number
}

const EMPTY_SLOT = { url: '', width_cm: 0, height_cm: 0 }

function normalizePrint(p: any): Print {
  return {
    ...p,
    slots: {
      front: p.slots?.front ?? EMPTY_SLOT,
      back: p.slots?.back ?? EMPTY_SLOT,
      extra: p.slots?.extra ?? EMPTY_SLOT,
    },
  }
}

export default function Library({ onPreview, version }: Props) {
  const [prints, setPrints] = useState<Print[]>([])
  const [qty, setQty] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const [notes, setNotes] = useState<Record<string, string>>({})
  const [openNote, setOpenNote] = useState<string | null>(null)
  const [editing, setEditing] = useState<Print | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const noteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    load()
  }, [version])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (noteRef.current && !noteRef.current.contains(e.target as Node)) {
        setOpenNote(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function load() {
    try {
      setLoading(true)
      const data = (await api('/prints')) as any[]
      setPrints(data.map(normalizePrint))
    } catch (err) {
      console.error('Erro ao carregar biblioteca', err)
      alert('Erro ao carregar biblioteca. Veja o console.')
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
        width_cm: p.slots.front.width_cm || 10,
        height_cm: p.slots.front.height_cm || 10,
      }))
      .filter(i => i.qty > 0)

    if (!items.length) return alert('Informe a quantidade.')

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

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 bg-black text-white px-4 py-2 rounded shadow z-50">
          {toast}
        </div>
      )}

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
              className="border rounded p-3 flex justify-between items-start relative"
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

              <div className="flex gap-2">
                {/* Nota */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setOpenNote(openNote === p.id ? null : p.id)
                    }
                    className="text-gray-400 hover:text-black"
                    type="button"
                  >
                    <StickyNote size={16} />
                  </button>

                  {notes[p.id] && openNote !== p.id && (
                    <div className="absolute right-0 top-6 bg-yellow-100 border rounded p-2 text-xs w-48 shadow z-10">
                      {notes[p.id]}
                    </div>
                  )}

                  {openNote === p.id && (
                    <div
                      ref={noteRef}
                      className="absolute right-0 top-6 bg-yellow-100 border rounded p-2 text-xs w-48 shadow z-20"
                    >
                      <textarea
                        maxLength={500}
                        placeholder="Anotação..."
                        value={notes[p.id] || ''}
                        onChange={e =>
                          setNotes(n => ({ ...n, [p.id]: e.target.value }))
                        }
                        className="w-full h-24 bg-transparent outline-none resize-none"
                      />
                    </div>
                  )}
                </div>

                {/* Editar */}
                <button
                  onClick={async () => {
                    try {
                      const full = (await api(`/prints/${p.id}`)) as any
                      setEditing(normalizePrint(full))
                    } catch (err) {
                      console.error('Erro ao abrir estampa', err)
                      alert('Erro ao abrir estampa. Veja o console.')
                    }
                  }}
                  className="text-gray-400 hover:text-black"
                  type="button"
                >
                  <Pencil size={16} />
                </button>
              </div>
            </div>
          ))}
      </div>

      <div className="pt-2">
        <button
          onClick={buildPreview}
          className="bg-black text-white px-5 py-2 rounded"
          type="button"
        >
          Gerar folhas
        </button>
      </div>

      {editing && (
        <EditPrintModal
          print={editing}
          onClose={() => setEditing(null)}
          onUpdated={updated => {
            setPrints(prev => prev.map(x => (x.id === updated.id ? updated : x)))
            setEditing(null)
          }}
          onDeleted={() => {
            setPrints(prev => prev.filter(x => x.id !== editing.id))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
