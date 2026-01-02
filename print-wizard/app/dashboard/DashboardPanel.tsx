'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/apiClient'
import { useSession } from '@/app/providers/SessionProvider'

type Usage = {
  plan: string
  used: number
  limit: number
  renew_at?: string
}

type Print = {
  id: string
  name: string
  sku: string
}

export default function DashboardPanel() {
  const { session, loading: sessionLoading } = useSession()

  const [usage, setUsage] = useState<Usage | null>(null)
  const [prints, setPrints] = useState<Print[]>([])
  const [search, setSearch] = useState('')
  const [qty, setQty] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (sessionLoading || !session) return
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        const [usageRes, printsRes] = await Promise.all([
          api('/me/usage'),
          api('/prints'),
        ])
        if (!cancelled) {
          setUsage(usageRes)
          setPrints(printsRes)
        }
      } catch (e: any) {
        console.error(e)
        if (!cancelled) setError(e?.message || 'Erro ao carregar dados')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [sessionLoading, session])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return prints.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q),
    )
  }, [prints, search])

  if (sessionLoading || loading) {
    return <div className="text-gray-500 text-sm">Carregando…</div>
  }

  if (error) {
    return (
      <div className="border border-red-400 bg-red-50 text-red-700 p-3 rounded mb-4">
        {error}
      </div>
    )
  }

  if (!usage) return null

  const percent =
    usage.limit > 0
      ? Math.min(100, Math.round((usage.used / usage.limit) * 100))
      : 0

  return (
    <div className="space-y-6">
      {/* Plano */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-lg">Seu plano</h2>
          <span className="text-sm bg-gray-100 px-2 py-1 rounded">
            {usage.plan}
          </span>
        </div>

        <div className="text-sm text-gray-600 mb-2">
          Uso: {usage.used} de {usage.limit} folhas
        </div>

        <div className="w-full h-2 bg-gray-200 rounded overflow-hidden mb-2">
          <div
            className="h-full bg-black transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-gray-500">
          <span>{percent}% utilizado</span>
          {usage.renew_at && (
            <span>
              Renova em{' '}
              {new Date(usage.renew_at).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>
      </div>

      {/* Biblioteca */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
        <h2 className="font-semibold text-lg mb-2">Biblioteca</h2>

        <input
          type="text"
          placeholder="Buscar por nome ou SKU…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border rounded px-3 py-1 text-sm mb-3"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
          {filtered.map(p => (
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
                    onChange={e =>
                      setQty(q => ({
                        ...q,
                        [p.id]: Number(e.target.value),
                      }))
                    }
                    className="w-20 border rounded px-2 py-0.5"
                  />
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() =>
                    setOpenNoteId(openNoteId === p.id ? null : p.id)
                  }
                  className="text-xs text-gray-600 hover:text-black"
                >
                  📝 Anotações
                </button>
                <button
                  onClick={() => alert('Editar estampa')}
                  className="text-xs text-gray-400 hover:text-black"
                >
                  Editar
                </button>
              </div>

              {openNoteId === p.id && (
                <div className="absolute top-0 left-0 w-full h-full bg-white border rounded p-2 z-10">
                  <textarea
                    placeholder="Anotações..."
                    value={notes[p.id] || ''}
                    onChange={e =>
                      setNotes(n => ({ ...n, [p.id]: e.target.value }))
                    }
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
    </div>
  )
}
