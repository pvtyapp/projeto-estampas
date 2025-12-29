"use client"

import { useEffect, useState } from "react"

type Print = {
  id: string
  name: string
  sku: string
  width_cm: number
  height_cm: number
}

type PreviewResult = {
  total_items: number
  total_sheets: number
  urls: string[]
}

export default function LibraryProcessor() {
  const [prints, setPrints] = useState<Print[]>([])
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/prints`)
      .then(r => r.json())
      .then(data =>
        setPrints(
          data.sort((a: Print, b: Print) => a.name.localeCompare(b.name))
        )
      )
  }, [])

  function setQty(id: string, value: number) {
    setQtys(prev => ({ ...prev, [id]: value }))
  }

  async function handlePreview() {
    const items = prints
      .map(p => ({
        print_id: p.id,
        qty: qtys[p.id] || 0,
        width_cm: p.width_cm,
        height_cm: p.height_cm,
      }))
      .filter(i => i.qty > 0)

    if (!items.length) {
      alert("Informe ao menos uma quantidade")
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/print-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, preview: true }),
      })

      const data = await res.json()
      setPreview(data)
    } catch (e) {
      alert("Erro ao gerar preview")
    } finally {
      setLoading(false)
    }
  }

  async function handleDownload() {
    if (!preview) return

    for (const url of preview.urls) {
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = "folha.png"
      a.click()
    }
  }

  return (
    <div className="flex gap-6">

      {/* Biblioteca */}
      <div className="w-2/3">
        <h2 className="font-semibold mb-2">Biblioteca</h2>
        <div className="grid grid-cols-2 gap-3 max-h-[420px] overflow-y-auto border rounded p-3">
          {prints.map(p => (
            <div key={p.id} className="border rounded p-2 flex justify-between items-center">
              <div>
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-gray-500">SKU: {p.sku}</div>
              </div>
              <input
                type="number"
                min={0}
                className="w-16 border rounded px-1 text-right"
                value={qtys[p.id] || ""}
                onChange={e => setQty(p.id, Number(e.target.value))}
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Preview / Processamento */}
      <div className="w-1/3 border rounded p-4 flex flex-col justify-between">
        <div>
          <h2 className="font-semibold mb-2">Processamento</h2>

          {!preview && (
            <button
              onClick={handlePreview}
              disabled={loading}
              className="w-full bg-black text-white py-2 rounded"
            >
              {loading ? "Gerando..." : "Preview"}
            </button>
          )}

          {preview && (
            <div className="space-y-2 text-sm">
              <div>Artes: {preview.total_items}</div>
              <div>Folhas: {preview.total_sheets}</div>
              <div>Arquivos: {preview.urls.length}</div>
            </div>
          )}
        </div>

        {preview && (
          <button
            onClick={handleDownload}
            className="mt-4 bg-green-600 text-white py-2 rounded"
          >
            Download
          </button>
        )}
      </div>

    </div>
  )
}
