'use client'

import { useEffect, useState } from 'react'

type Package = {
  id: string
  name: string
  sheets: number
  price_cents: number
}

export default function BuyCreditsModal({ onClose }: { onClose: () => void }) {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/credit-packages`)
      .then(r => r.json())
      .then(setPackages)
  }, [])

  async function buy(id: string) {
    setLoading(true)
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/credits/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ package_id: id })
    })
    setLoading(false)
    onClose()
    location.reload()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Comprar créditos</h2>

        {packages.map(p => (
          <button
            key={p.id}
            onClick={() => buy(p.id)}
            disabled={loading}
            className="w-full border rounded-lg p-4 text-left hover:bg-gray-50 disabled:opacity-50"
          >
            <div className="font-medium">{p.name}</div>
            <div className="text-sm text-gray-500">
              {p.sheets} folhas — R$ {(p.price_cents / 100).toFixed(2)}
            </div>
          </button>
        ))}

        <button
          onClick={onClose}
          className="text-sm text-gray-500 hover:underline mt-2"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
