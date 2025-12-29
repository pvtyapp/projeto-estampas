"use client"

import { useEffect, useState } from "react"

type Slot = {
  id: string
  url: string
  width_cm: number | null
  height_cm: number | null
}

type Print = {
  id: string
  name: string
  sku: string
  slots: {
    front?: Slot
    back?: Slot
    extra?: Slot
  }
}

type EditModalProps = {
  print: Print
  onClose: () => void
  onDelete: (id: string) => void
  onUpdated: (updated: Print) => void
}

type Props = {
  onJobCreated?: (jobId: string) => void
}

export default function LibraryPanel({ onJobCreated }: Props) {
  const [prints, setPrints] = useState<Print[]>([])
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [edit, setEdit] = useState<Print | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    const r = await fetch("http://localhost:8000/prints")
    const data = await r.json()
    setPrints(Array.isArray(data) ? data : [])
  }

  useEffect(() => { load() }, [])

  function handleQty(id: string, v: string) {
    const n = Number(v)
    if (!isNaN(n) && n >= 0) setQtys(p => ({ ...p, [id]: n }))
  }

  function totalQty() {
    return Object.values(qtys).reduce((s, v) => s + v, 0)
  }

  async function handleProcess() {
    const total = totalQty()
    if (!total) return alert("Informe ao menos uma quantidade.")
    if (total > 100) return alert("Limite máximo: 100 unidades.")

    const items = prints
      .map(p => ({
        print_id: p.id,
        qty: qtys[p.id] || 0,
        width_cm: p.slots.front?.width_cm || 0,
        height_cm: p.slots.front?.height_cm || 0,
      }))
      .filter(i => i.qty > 0)

    setLoading(true)
    try {
      const r = await fetch("http://localhost:8000/print-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      if (!r.ok) throw new Error()

      const data = await r.json()
      onJobCreated?.(data.job_id)

    } catch {
      alert("Erro ao processar.")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este produto?")) return
    await fetch(`http://localhost:8000/prints/${id}`, { method: "DELETE" })
    await load()
    setEdit(null)
  }

  return (
    <div className="border rounded-lg p-6 bg-white space-y-4">
      <h2 className="font-bold text-lg">Biblioteca</h2>

      <div className="grid grid-cols-2 gap-3 max-h-[320px] overflow-y-auto border rounded p-3">
        {prints.map(p => (
          <div key={p.id} className="border rounded p-3">
            <div className="font-medium text-center">{p.name}</div>
            <div className="text-xs text-gray-400 text-center">SKU: {p.sku}</div>

            <div className="flex justify-between pt-2">
              <input
                type="number"
                min={0}
                className="w-16 border rounded px-2 py-1 text-right"
                value={qtys[p.id] ?? ""}
                onChange={e => handleQty(p.id, e.target.value)}
              />
              <button className="text-xs text-blue-600" onClick={() => setEdit(p)}>editar</button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleProcess} disabled={loading} className="bg-black text-white px-6 py-2 rounded">
        {loading ? "Processando..." : "Processar"}
      </button>

      {edit && (
        <EditModal
          print={edit}
          onClose={() => setEdit(null)}
          onDelete={handleDelete}
          onUpdated={(u) => {
            setPrints(p => p.map(x => x.id === u.id ? u : x))
            setEdit(null)
          }}
        />
      )}
    </div>
  )
}

function EditModal({ print, onClose, onDelete, onUpdated }: EditModalProps) {
  const [local, setLocal] = useState<Print>(print)

  async function saveSlot(slot: Slot) {
    await fetch(
      `http://localhost:8000/print-files/${slot.id}?width_cm=${slot.width_cm}&height_cm=${slot.height_cm}`,
      { method: "PATCH" }
    )
  }

  async function saveAll() {
    const tasks: Promise<any>[] = []
    for (const s of Object.values(local.slots)) {
      if (s) tasks.push(saveSlot(s))
    }
    await Promise.all(tasks)
    onUpdated(local)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded w-[480px] space-y-4">
        <h3 className="font-bold text-lg text-center">{local.name}</h3>

        {(Object.entries(local.slots) as [string, Slot][]).map(([k, s]) => (
          <div key={k} className="border rounded p-3 space-y-2">
            <div className="font-medium text-center capitalize">{k}</div>
            <img src={s.url} className="h-28 mx-auto object-contain border rounded" />

            <div className="grid grid-cols-2 gap-2 text-sm">
              <input
                type="number"
                step="0.01"
                value={s.width_cm ?? ""}
                onChange={e =>
                  setLocal(p => ({
                    ...p,
                    slots: {
                      ...p.slots,
                      [k]: { ...s, width_cm: e.target.value === "" ? null : Number(e.target.value) }
                    }
                  }))
                }
                placeholder="Largura (cm)"
                className="border rounded px-2 py-1"
              />
              <input
                type="number"
                step="0.01"
                value={s.height_cm ?? ""}
                onChange={e =>
                  setLocal(p => ({
                    ...p,
                    slots: {
                      ...p.slots,
                      [k]: { ...s, height_cm: e.target.value === "" ? null : Number(e.target.value) }
                    }
                  }))
                }
                placeholder="Altura (cm)"
                className="border rounded px-2 py-1"
              />
            </div>
          </div>
        ))}

        <div className="flex justify-between pt-3">
          <button onClick={onClose} className="border px-3 py-1 rounded">Cancelar</button>
          <div className="flex gap-2">
            <button onClick={() => onDelete(local.id)} className="border border-red-500 text-red-600 px-3 py-1 rounded">Excluir</button>
            <button onClick={saveAll} className="bg-black text-white px-3 py-1 rounded">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
