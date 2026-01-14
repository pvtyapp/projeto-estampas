'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'

type FiscalData = {
  person_type?: 'cpf' | 'cnpj'
  document?: string
  full_name?: string
  phone?: string
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  cep?: string
}

export default function FiscalModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<FiscalData>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api('/me/fiscal').then(res => {
      setData(res || {})
      setLoading(false)
    })
  }, [])

  const save = async () => {
    setSaving(true)
    await api('/me/fiscal', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    setSaving(false)
    onClose()
  }

  if (loading) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-lg rounded-2xl p-6 space-y-3 shadow">
        <h2 className="text-xl font-semibold">Dados pessoais</h2>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={data.person_type || ''}
            onChange={e => setData({ ...data, person_type: e.target.value as any })}
            className="input"
          >
            <option value="">Tipo</option>
            <option value="cpf">CPF</option>
            <option value="cnpj">CNPJ</option>
          </select>

          <input
            placeholder="CPF ou CNPJ"
            value={data.document || ''}
            onChange={e => setData({ ...data, document: e.target.value })}
            className="input"
          />

          <input
            placeholder="Nome / Razão social"
            value={data.full_name || ''}
            onChange={e => setData({ ...data, full_name: e.target.value })}
            className="input col-span-2"
          />

          <input placeholder="Telefone" value={data.phone || ''} onChange={e => setData({ ...data, phone: e.target.value })} className="input" />
          <input placeholder="CEP" value={data.cep || ''} onChange={e => setData({ ...data, cep: e.target.value })} className="input" />
          <input placeholder="Rua" value={data.street || ''} onChange={e => setData({ ...data, street: e.target.value })} className="input col-span-2" />
          <input placeholder="Número" value={data.number || ''} onChange={e => setData({ ...data, number: e.target.value })} className="input" />
          <input placeholder="Complemento" value={data.complement || ''} onChange={e => setData({ ...data, complement: e.target.value })} className="input" />
          <input placeholder="Bairro" value={data.neighborhood || ''} onChange={e => setData({ ...data, neighborhood: e.target.value })} className="input" />
          <input placeholder="Cidade" value={data.city || ''} onChange={e => setData({ ...data, city: e.target.value })} className="input" />
          <input placeholder="Estado" value={data.state || ''} onChange={e => setData({ ...data, state: e.target.value })} className="input" />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">
            Cancelar
          </button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-black text-white rounded-lg">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
