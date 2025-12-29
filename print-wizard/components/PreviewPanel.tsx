"use client"

import { useEffect, useState } from "react"

type Job = {
  id: string
  status: "queued" | "processing" | "done" | "error"
  result_urls?: string[]
  error?: string
}

export default function PreviewPanel({ jobId }: { jobId: string | null }) {
  const [job, setJob] = useState<Job | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!jobId) {
      setJob(null)
      setProgress(0)
      return
    }

    const interval = setInterval(async () => {
      const res = await fetch(`http://localhost:8000/jobs/${jobId}`)
      const data = await res.json()
      setJob(data)

      setProgress(prev => {
        if (data.status === "done") return 100
        if (data.status === "error") return prev
        return Math.min(prev + 8, 95)
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [jobId])

  if (!jobId) {
    return (
      <div className="border rounded-lg p-6 bg-white text-sm text-gray-500">
        Preencha as quantidades na biblioteca acima e clique em <b>Processar</b> para gerar a pré-visualização das folhas.
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-6 bg-white space-y-4">
      <h2 className="font-bold text-lg">Pré-visualização das folhas</h2>

      {!job && <p className="text-sm text-gray-500">Consultando status…</p>}

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

      {job?.status === "done" && job.result_urls && (
        <>
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

          <div className="pt-4">
            {job.result_urls.length === 1 ? (
              <a
                href={job.result_urls[0]}
                download
                className="bg-black text-white px-4 py-2 rounded inline-block"
              >
                Baixar folha
              </a>
            ) : (
              <p className="text-sm text-gray-600">
                Em breve você poderá baixar todas as folhas juntas em um ZIP.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
