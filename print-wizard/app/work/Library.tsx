'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { api } from '@/lib/apiClient'
import { PreviewItem } from '@/app/types/preview'
import { Pencil, StickyNote } from 'lucide-react'
import EditPrintModal from '@/components/EditPrintModal'

type PrintAsset = {
  id: string
  public_url: string
  width_cm: number
  height_cm: number
  quantity: number
}

type Print = {
  id: string
  name: string
  sku: string
  assets: PrintAsset[]
}

type Props = {
  onPreview: (items: PreviewItem[]) => void
  version: number
}

export default function Library({ onPreview, version }: Props) {
  const [prints, setPrints] = useState<Print[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const [notes, setNotes] = useState<Record<string, string>>({})
  const [openNote, setOpenNote] = useState<string | null>(null)
  const [editing, setEditing] = useState<Print | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const noteRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = (await api('/prints')) as Print[]
      setPrints(data)
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
    return prints.filter(
      p =>
        String(p.name).toLowerCase().includes(q) ||
        String(p.sku).toLowerCase().includes(q),
    )
  }, [prints, search])

  function buildPreview() {
    const items: PreviewItem[] = prints
      .flatMap(p =>
        p.assets.map(a => ({
          print_id: p.id,
          asset_id: a.id,
          name: p.name,
          sku: p.sku,
          qty: Number(a.quantity) || 0,
          width_cm: Number(a.width_cm) || 0,
          height_cm: Number(a.height_cm) || 0,
        })),
      )
      .filter(i => i.qty > 0)

    if (!items.length) {
      alert('Informe a quantidade.')
      return
    }

    const invalid = items.find(i => !i.width_cm || !i.height_cm)
    if (invalid) {
      alert('Alguma arte está sem largura ou altura definida.')
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

                {p.assets.map(a => (
                  <div key={a.id} className="mt-2 flex items-center gap-2 text-sm">
                    {a.public_url ? (
                      <img
                        src={a.public_url}
                        className="w-8 h-8 border rounded object-contain"
                      />
                    ) : (
                      <div className="w-8 h-8 border rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                        ?
                      </div>
                    )}

                    <span>Qtd:</span>
                    <span className="font-mono">{a.quantity}</span>
                    <span className="text-xs text-gray-400">
                      {a.width_cm}×{a.height_cm}cm
                    </span>
                  </div>
                ))}
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
                      const full = await api(`/prints/${p.id}`)
                      setEditing(full)
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
