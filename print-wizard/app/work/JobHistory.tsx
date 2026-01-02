"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/apiClient"

type Job = {
  id: string
  status: string
  created_at: string
  finished_at?: string
  zip_url?: string
  error?: string
}

export default function JobHistory({ onSelect }: { onSelect?: (jobId: string) => void }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setLoading(true)
      const data = await api("/jobs/history")
      setJobs(data)
    } catch {
      alert("Erro ao carregar histórico")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border rounded-lg p-6 bg-white space-y-3">
      <h2 className="font-bold text-lg">Histórico</h2>

      {loading && <p className="text-sm text-gray-500">Carregando…</p>}

      {!loading && jobs.length === 0 && (
        <p className="text-sm text-gray-500">Nenhum processamento ainda.</p>
      )}

      {!loading && jobs.map(job => (
        <div
          key={job.id}
          className="flex items-center justify-between border rounded p-3 hover:bg-gray-50 cursor-pointer"
          onClick={() => onSelect?.(job.id)}
        >
          <div>
            <div className="text-sm font-medium">Job {job.id.slice(0, 8)}</div>
            <div className="text-xs text-gray-500">
              {new Date(job.created_at).toLocaleString()}
            </div>
          </div>

          <div className="text-xs">
            {job.status === "done" && <span className="text-green-600">Concluído</span>}
            {job.status === "processing" && <span className="text-yellow-600">Processando</span>}
            {job.status === "queued" && <span className="text-gray-500">Na fila</span>}
            {job.status === "error" && <span className="text-red-600">Erro</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
