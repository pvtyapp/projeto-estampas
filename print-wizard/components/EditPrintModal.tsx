'use client'

import { X } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/lib/apiClient'

type Print = {
  id: string
  name: string
  sku: string
  width_cm: number
  height_cm: number
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

  async function save() {
    if (!local.width_cm || !local.height_cm) {
      alert('Informe largura e altura válidas.')
      return
    }

    if (loading) return
    setLoading(true)
    try {
      await api(`/prints/${local.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          width_cm: Number(local.width_cm) || 0,
          height_cm: Number(local.height_cm) || 0,
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

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-black">
          <X size={18} />
        </button>

        <h2 className="text-lg font-semibold mb-4">Editar {local.name}</h2>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">Nome</label>
            <input
              value={local.name}
              disabled
              className="w-full border rounded px-3 py-2 bg-gray-100"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">SKU</label>
            <input
              value={local.sku}
              disabled
              className="w-full border rounded px-3 py-2 bg-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600">Largura (cm)</label>
              <input
                type="number"
                step="0.1"
                value={local.width_cm}
                onChange={e =>
                  setLocal(p => ({ ...p, width_cm: Number(e.target.value) || 0 }))
                }
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">Altura (cm)</label>
              <input
                type="number"
                step="0.1"
                value={local.height_cm}
                onChange={e =>
                  setLocal(p => ({ ...p, height_cm: Number(e.target.value) || 0 }))
                }
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-6">
          <button
            onClick={remove}
            disabled={loading}
            className="text-red-600 hover:underline text-sm"
          >
            Excluir estampa
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border rounded"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={loading}
              className="px-4 py-2 bg-black text-white rounded"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
