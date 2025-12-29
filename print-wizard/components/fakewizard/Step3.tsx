"use client"

import { useState } from "react"
import JSZip from "jszip"

type StepProps = {
  data: any
  onBack: () => void
}

type Result = {
  total_items: number
  total_sheets: number
  urls: string[]
}

export default function Step3({ data, onBack }: StepProps) {
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    const items =
      data.blocks?.flatMap((block: any) =>
        block.prints.map((bp: any) => ({
          print_id: bp.print.id,
          qty: bp.qty,
          width_cm: bp.print.width_cm,
          height_cm: bp.print.height_cm,
        }))
      ) || []

    if (!items.length) {
      alert("Nenhuma estampa com quantidade > 0.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/print-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })

      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || "Erro ao gerar folhas")
      }

      const data = await res.json()
      setResult(data)
    } catch (e: any) {
      console.error(e)
      setError(e.message || "Erro inesperado")
    } finally {
      setLoading(false)
    }
  }

  async function handleDownload() {
    if (!result) return

    setDownloading(true)

    try {
      if (result.urls.length === 1) {
        const res = await fetch(result.urls[0])
        const blob = await res.blob()
        triggerDownload(blob, "folha.png")
      } else {
        const zip = new JSZip()

        await Promise.all(
          result.urls.map(async (url, i) => {
            const res = await fetch(url)
            const blob = await res.blob()
            zip.file(`folha-${i + 1}.png`, blob)
          })
        )

        const zipBlob = await zip.generateAsync({ type: "blob" })
        triggerDownload(zipBlob, "folhas.zip")
      }
    } catch (e) {
      console.error(e)
      alert("Erro ao baixar arquivos")
    } finally {
      setDownloading(false)
    }
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Etapa 3 — Gerar e baixar</h2>

      {error && <div className="mb-3 text-red-600">{error}</div>}

      {!result && (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
        >
          {loading ? "Gerando..." : "Gerar folhas"}
        </button>
      )}

      {result && (
        <div className="space-y-2">
          <div>Total de artes: {result.total_items}</div>
          <div>Total de folhas: {result.total_sheets}</div>

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
          >
            {downloading ? "Baixando..." : "Baixar arquivos"}
          </button>
        </div>
      )}

      <button onClick={onBack} className="mt-6 text-sm text-gray-600 underline">
        Voltar
      </button>
    </div>
  )
}
