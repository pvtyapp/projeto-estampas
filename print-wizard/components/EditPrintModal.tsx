'use client'

import { X } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/lib/apiClient'

type Slot = {
  url: string
  width_cm: number
  height_cm: number
}

type Print = {
  id: string
  name: string
  sku: string
  slots?: {
    front?: Slot
    back?: Slot
    extra?: Slot
  }
}

type Props = {
  print: Print
  onClose: () => void
  onUpdated: (p: Print) => void
  onDeleted: () => void
}

export default function EditPrintModal({ print, onClose, onUpdated, onDeleted }: Props) {
  const [local, setLocal] = useState(print)
  const [loading, setLoading] = useState(false)

  function updateSlot(
    key: 'front' | 'back' | 'extra',
    field: 'width_cm' | 'height_cm',
    value: string
  ) {
    setLocal(p => ({
      ...p,
      slots: {
        ...p.slots,
        [key]: {
          ...(p.slots?.[key] as Slot),
          [field]: Number(value.replace(',', '.'))
        }
      }
    }))
  }

  async function save() {
    setLoading(true)
    try {
      await api(`/prints/${print.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          slots: local.slots
        })
      })
      onUpdated(local)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  async function remove() {
    if (!confirm('Excluir esta estampa?')) return
    await api(`/prints/${print.id}`, { method: 'DELETE' })
    onDeleted()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-lg space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Editar {print.name}</h2>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="space-y-4">
          {(['front', 'back', 'extra'] as const).map(
            k =>
              local.slots?.[k] && (
                <div key={k} className="flex gap-4 items-center border rounded-xl p-3">
                  <img
                    src={local.slots[k]!.url}
                    className="w-20 h-20 object-contain border rounded"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="font-medium capitalize">{k}</div>
                    <div className="flex gap-2">
                      <input
                        className="input"
                        placeholder="Largura (cm)"
                        value={local.slots[k]!.width_cm}
                        onChange={e => updateSlot(k, 'width_cm', e.target.value)}
                      />
                      <input
                        className="input"
                        placeholder="Altura (cm)"
                        value={local.slots[k]!.height_cm}
                        onChange={e => updateSlot(k, 'height_cm', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )
          )}
        </div>

        <div className="flex justify-between items-center pt-2">
          <button
            onClick={remove}
            className="text-red-600 hover:underline text-sm"
          >
            Excluir estampa
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="border rounded-xl px-4 py-2 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={loading}
              className="bg-black text-white px-4 py-2 rounded-xl"
            >
              {loading ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
