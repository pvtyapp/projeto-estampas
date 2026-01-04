'use client'

import { X } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/lib/apiClient'

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

export default function EditPrintModal({ print, onClose, onUpdated, onDeleted }: Props) {
  const [local, setLocal] = useState<Print>(print)
  const [loading, setLoading] = useState(false)

  function updateSlot(type: Slot['type'], field: 'width_cm' | 'height_cm', value: number) {
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
      await api(`/prints/${local.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          slots: local.slots,
        }),
      })

      onUpdated(local)
      onClose()
    } catch (err) {
      alert('Erro ao salvar estampa')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function remove() {
    if (!confirm('Deseja realmente excluir esta estampa?')) return
    if (loading) return
    setLoading(true)
    try {
      await api(`/prints/${local.id}`, { method: 'DELETE' })
      onDeleted()
      onClose()
    } catch (err) {
      alert('Erro ao excluir')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const front = getSlot('front')
  const back = getSlot('back')
  const extra = getSlot('extra')

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-black">
          <X size={18} />
        </button>

        <h2 className="text-lg font-semibold mb-4">Editar {local.name}</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600">Nome</label>
            <input value={local.name} disabled className="w-full border rounded px-3 py-2 bg-gray-100" />
          </div>

          <div>
            <label className="text-sm text-gray-600">SKU</label>
            <input value={local.sku} disabled className="w-full border rounded px-3 py-2 bg-gray-100" />
          </div>

          {front && (
            <div>
              <div className="font-medium text-sm mb-1">Frente</div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  step="0.1"
                  value={front.width_cm}
                  onChange={e => updateSlot('front', 'width_cm', Number(e.target.value) || 0)}
                  className="border rounded px-3 py-2"
                  placeholder="Largura (cm)"
                />
                <input
                  type="number"
                  step="0.1"
                  value={front.height_cm}
                  onChange={e => updateSlot('front', 'height_cm', Number(e.target.value) || 0)}
                  className="border rounded px-3 py-2"
                  placeholder="Altura (cm)"
                />
              </div>
            </div>
          )}

          {back && (
            <div>
              <div className="font-medium text-sm mb-1">Costas</div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  step="0.1"
                  value={back.width_cm}
                  onChange={e => updateSlot('back', 'width_cm', Number(e.target.value) || 0)}
                  className="border rounded px-3 py-2"
                />
                <input
                  type="number"
                  step="0.1"
                  value={back.height_cm}
                  onChange={e => updateSlot('back', 'height_cm', Number(e.target.value) || 0)}
                  className="border rounded px-3 py-2"
                />
              </div>
            </div>
          )}

          {extra && (
            <div>
              <div className="font-medium text-sm mb-1">Extra</div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  step="0.1"
                  value={extra.width_cm}
                  onChange={e => updateSlot('extra', 'width_cm', Number(e.target.value) || 0)}
                  className="border rounded px-3 py-2"
                />
                <input
                  type="number"
                  step="0.1"
                  value={extra.height_cm}
                  onChange={e => updateSlot('extra', 'height_cm', Number(e.target.value) || 0)}
                  className="border rounded px-3 py-2"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-6">
          <button onClick={remove} disabled={loading} className="text-red-600 hover:underline text-sm">
            Excluir estampa
          </button>

          <div className="flex gap-2">
            <button onClick={onClose} disabled={loading} className="px-4 py-2 border rounded">
              Cancelar
            </button>
            <button onClick={save} disabled={loading} className="px-4 py-2 bg-black text-white rounded">
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
