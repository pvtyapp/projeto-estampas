'use client'

import { X } from 'lucide-react'
import { useState } from 'react'
import { request } from '@/lib/apiClient'

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

type Props = {
  print: Print
  onClose: () => void
  onUpdated: (p: Print) => void
  onDeleted: () => void
}

export default function EditPrintModal({
  print,
  onClose,
  onUpdated,
  onDeleted,
}: Props) {
  const [local, setLocal] = useState<Print>(print)
  const [loading, setLoading] = useState(false)

  function updateSlot(
    type: Slot['type'],
    field: 'width_cm' | 'height_cm',
    value: number
  ) {
    setLocal(p => ({
      ...p,
      slots: p.slots.map(s =>
        s.type === type ? { ...s, [field]: value } : s
      ),
    }))
  }

  function getSlot(type: Slot['type']) {
    return local.slots.find(s => s.type === type)
  }

  async function save() {
    if (loading) return
    const front = getSlot('front')
    if (!front || !front.width_cm || !front.height_cm) {
      alert('A frente precisa ter largura e altura válidas.')
      return
    }

    setLoading(true)
    try {
      await request(`/prints/${local.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ slots: local.slots }),
      })
      onUpdated(local)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  async function remove() {
    if (!confirm('Deseja realmente excluir esta estampa?')) return
    if (loading) return
    setLoading(true)
    try {
      await request(`/prints/${local.id}`, { method: 'DELETE' })
      onDeleted()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const front = getSlot('front')
  const back = getSlot('back')
  const extra = getSlot('extra')

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg p-4 shadow-xl relative space-y-3">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-black"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-semibold">Editar {local.name}</h2>

        {[front, back, extra].map(slot => {
          if (!slot) return null
          const label =
            slot.type === 'front'
              ? 'Frente'
              : slot.type === 'back'
              ? 'Costas'
              : 'Extra'

          return (
            <div
              key={slot.type}
              className="flex items-center gap-3 border rounded p-2"
            >
              {slot.url && (
                <img
                  src={slot.url}
                  className="w-20 h-20 object-contain border rounded"
                />
              )}

              <div className="flex-1 space-y-1">
                <div className="text-sm font-medium">{label}</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={slot.width_cm}
                    onChange={e =>
                      updateSlot(
                        slot.type,
                        'width_cm',
                        Number(e.target.value) || 0
                      )
                    }
                    className="border rounded px-2 py-1 w-full text-sm"
                    placeholder="Largura"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={slot.height_cm}
                    onChange={e =>
                      updateSlot(
                        slot.type,
                        'height_cm',
                        Number(e.target.value) || 0
                      )
                    }
                    className="border rounded px-2 py-1 w-full text-sm"
                    placeholder="Altura"
                  />
                </div>
              </div>
            </div>
          )
        })}

        <div className="flex justify-between items-center pt-2">
          <button
            onClick={remove}
            disabled={loading}
            className="text-red-600 text-sm"
          >
            Excluir
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1 border rounded text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={loading}
              className="px-3 py-1 bg-black text-white rounded text-sm"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
