"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/apiClient"

type Job = {
  id: string
  status: "queued" | "processing" | "done" | "error"
  result_urls?: string[]
  zip_url?: string
  error?: string
}

export default function PreviewPanel({ jobId }: { jobId: string | null }) {
  const [job, setJob] = useState<Job | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) {
      setJob(null)
      setProgress(0)
      setError(null)
      return
    }

    let stopped = false

    const interval = setInterval(async () => {
      try {
        const data = await api(`/jobs/${jobId}`)
        if (stopped) return

        setJob(data)

        setProgress(prev => {
          if (data.status === "done") return 100
          if (data.status === "error") return prev
          return Math.min(prev + 8, 95)
        })

        if (data.status === "done" || data.status === "error") {
          clearInterval(interval)
        }
      } catch (e: any) {
        setError(e.message || "Erro ao consultar status do job")
        clearInterval(interval)
      }
    }, 2000)

    return () => {
      stopped = true
      clearInterval(interval)
    }
  }, [jobId])

  if (!jobId) {
    return (
      <div className="border rounded-lg p-6 bg-white text-sm text-gray-500">
        Preencha as quantidades na biblioteca acima e clique em <b>Gerar folhas</b> para gerar a pré-visualização.
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-6 bg-white space-y-4">
      <h2 className="font-bold text-lg">Pré-visualização das folhas</h2>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!job && !error && <p className="text-sm text-gray-500">Consultando status…</p>}

      {job && job.status !== "done" && (
        <>
          <div className="w-full bg-gray-200 rounded h-3 overflow-hidden">
            <div
              className="h-full bg-black transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            {job.status === "queued" && "⏳ Aguardando processamento na nuvem…"}
            {job.status === "processing" && "⚙️ Gerando folhas em 300 DPI…"}
          </p>
        </>
      )}

      {job?.status === "error" && (
        <p className="text-red-600 text-sm">Erro: {job.error}</p>
      )}

      {job?.status === "done" && (
        <>
          {job.result_urls && (
            <div className="grid grid-cols-2 gap-4">
              {job.result_urls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  className="border rounded shadow"
                  alt={`Folha ${i + 1}`}
                />
              ))}
            </div>
          )}

          <div className="pt-4 flex gap-3 flex-wrap">
            {job.zip_url && (
              <a
                href={job.zip_url}
                download
                className="bg-black text-white px-4 py-2 rounded inline-block"
              >
                Baixar todas (ZIP)
              </a>
            )}

            {job.result_urls?.length === 1 && (
              <a
                href={job.result_urls[0]}
                download
                className="border px-4 py-2 rounded inline-block"
              >
                Baixar folha única
              </a>
            )}
          </div>
        </>
      )}
    </div>
  )
}
