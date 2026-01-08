'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'

type PreviewItem = {
  print_id: string
  qty: number
  name?: string
  sku?: string
}

type Job = {
  id: string
  status: 'preview' | 'preview_done' | 'queued' | 'processing' | 'done' | 'error'
  zip_url?: string
  error?: string
}

type GeneratedFile = {
  id: string
  url: string
}

type PreviewProps = {
  items: PreviewItem[]
  onJobCreated: (jobId: string) => void
  onReset: () => void
}

type JobProps = {
  jobId: string
  onReset?: () => void
}

type Props = PreviewProps | JobProps

function isPreviewProps(p: Props): p is PreviewProps {
  return Array.isArray((p as any)?.items)
}

export default function PreviewPanel(props: Props) {
  const [job, setJob] = useState<Job | null>(null)
  const [files, setFiles] = useState<GeneratedFile[]>([])
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [zoom, setZoom] = useState<string | null>(null)

  // 👉 detecta se veio do histórico (não tem items, só jobId)
  const fromHistory = !isPreviewProps(props)

  async function preview(items: PreviewItem[], onJobCreated: (id: string) => void) {
    setCreating(true)
    try {
      const res: { job_id: string } = await api('/print-jobs', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map(i => ({ print_id: i.print_id, qty: i.qty })),
        }),
      })
      onJobCreated(res.job_id)
    } finally {
      setCreating(false)
    }
  }

  async function confirm(jobId: string) {
    if (!job || job.status !== 'preview_done') return
    setConfirming(true)
    try {
      await api(`/print-jobs/${jobId}/confirm`, { method: 'POST' })
      setJob(j => (j ? { ...j, status: 'queued' } : j))
      setSeconds(0)
    } finally {
      setConfirming(false)
    }
  }

  function handleDownload(url: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    setTimeout(() => {
      window.location.reload()
    }, 5000)
  }

  // =======================
  // POLLING
  // =======================
  useEffect(() => {
    if (!('jobId' in props)) return

    let stop = false

    const interval = setInterval(async () => {
      if (stop) return
      try {
        const data: Job = await api(`/jobs/${props.jobId}`)
        setJob(data)

        if (data.status === 'preview_done') {
          const f: GeneratedFile[] = await api(`/jobs/${props.jobId}/files`)
          setFiles(f)
          setProgress(100)
          return
        }

        if (data.status === 'done') {
          setProgress(100)
          return
        }

        if (data.status === 'error') {
          setError(data.error || 'Erro no processamento')
          return
        }

        setProgress(p => Math.min(p + 6, 95))
        setSeconds(s => s + 2)
      } catch (e: any) {
        setError(e.message || 'Erro ao consultar status')
      }
    }, 2000)

    return () => {
      stop = true
      clearInterval(interval)
    }
  }, [props])

  // =======================
  // PREVIEW MODE
  // =======================
  if (isPreviewProps(props)) {
    const total = props.items.reduce((s, i) => s + i.qty, 0)

    return (
      <div className="border rounded-2xl p-8 bg-white min-h-[520px] flex flex-col justify-between">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Pré-visualização</h2>

          <div className="border rounded-lg p-4 max-h-[280px] overflow-y-auto text-sm space-y-2">
            {props.items.map(i => (
              <div key={i.print_id} className="flex justify-between">
                <span>{i.name || i.print_id}</span>
                <span>{i.qty}x</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-500 leading-snug">
            💡 Uma dica importante: veja seu último arquivo e certifique-se de que ele está completo na área de impressão — isso deixará os custos mais precisos.
          </p>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Total: {total}</span>
          <div className="flex gap-3">
            <button onClick={props.onReset} className="border px-5 py-2 rounded-lg">
              Cancelar
            </button>
            <button
              onClick={() => preview(props.items, props.onJobCreated)}
              disabled={creating}
              className="bg-black text-white px-6 py-2 rounded-lg disabled:opacity-50"
            >
              {creating ? 'Gerando…' : 'Gerar preview'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // =======================
  // JOB MODE
  // =======================
  return (
    <div className="border rounded-2xl p-8 bg-white min-h-[520px] flex flex-col justify-between">
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold">
          {job?.status === 'done' ? 'Concluído' : 'Processando'}
        </h2>

        {job?.status === 'done' && job.zip_url && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {fromHistory
                ? 'Faça novamente o download dos arquivos abaixo.'
                : `Foram gerados ${files.length} arquivos com sucesso.`}
            </p>
            <button
              onClick={() => handleDownload(job.zip_url!)}
              className="bg-black text-white px-8 py-3 rounded-lg"
            >
              Baixar arquivos finais
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        >
          <div onClick={e => e.stopPropagation()} className="bg-white p-4 rounded-xl shadow-lg">
            <img src={zoom} className="max-w-[90vw] max-h-[85vh] object-contain rounded blur-[0.5px]" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white font-bold text-xl">
              PRÉVIA
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
