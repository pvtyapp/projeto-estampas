'use client'

import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'

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

  useEffect(() => {
    setLocal(print)
  }, [print])

  function updateAsset(
    id: string,
    field: 'width_cm' | 'height_cm' | 'quantity',
    value: string,
  ) {
    const parsed = Number(value.replace(',', '.'))
    const num = Number.isFinite(parsed) ? parsed : 0

    setLocal(p => ({
      ...p,
      assets: p.assets.map(a =>
        a.id === id ? { ...a, [field]: field === 'quantity' ? Math.max(0, Math.round(num)) : num } : a,
      ),
    }))
  }

  async function save() {
    setLoading(true)
    try {
      for (const asset of local.assets) {
        await api(`/print-assets/${asset.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            width_cm: asset.width_cm,
            height_cm: asset.height_cm,
            quantity: asset.quantity,
          }),
        })
      }

      onUpdated(local)
      onClose()
    } catch (err) {
      console.error('Erro ao salvar estampa', err)
      alert('Erro ao salvar. Veja o console.')
    } finally {
      setLoading(false)
    }
  }

  async function remove() {
    if (!confirm('Excluir esta estampa?')) return
    try {
      await api(`/prints/${print.id}`, { method: 'DELETE' })
      onDeleted()
      onClose()
    } catch (err) {
      console.error('Erro ao excluir estampa', err)
      alert('Erro ao excluir. Veja o console.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999]">
      <div className="bg-white rounded-2xl p-8 w-full max-w-lg space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Editar {print.name}</h2>
          <button onClick={onClose} type="button">
            <X />
          </button>
        </div>

        <div className="space-y-4">
          {local.assets.map(asset => (
            <div key={asset.id} className="flex gap-4 items-center border rounded-xl p-3">
              <img
                src={asset.public_url}
                className="w-20 h-20 object-contain border rounded"
                alt="estampa"
              />

              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <input
                    className="input"
                    placeholder="Largura (cm)"
                    value={asset.width_cm}
                    onChange={e => updateAsset(asset.id, 'width_cm', e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Altura (cm)"
                    value={asset.height_cm}
                    onChange={e => updateAsset(asset.id, 'height_cm', e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Qtd"
                    value={asset.quantity}
                    onChange={e => updateAsset(asset.id, 'quantity', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-2">
          <button
            onClick={remove}
            className="text-red-600 hover:underline text-sm"
            type="button"
          >
            Excluir estampa
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="border rounded-xl px-4 py-2 hover:bg-gray-100"
              type="button"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={loading}
              className="bg-black text-white px-4 py-2 rounded-xl disabled:opacity-50"
              type="button"
            >
              {loading ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
