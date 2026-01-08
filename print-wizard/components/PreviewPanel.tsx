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

  async function preview(items: PreviewItem[], onJobCreated: (id: string) => void) {
    setCreating(true)
    try {
      const res: { job_id: string } = await api('/print-jobs', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map(i => ({
            print_id: i.print_id,
            qty: i.qty,
          })),
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
    } finally {
      setConfirming(false)
    }
  }

  useEffect(() => {
    if (!('jobId' in props)) return

    let stop = false
    const interval = setInterval(async () => {
      if (stop) return

      try {
        const data: Job = await api(`/jobs/${props.jobId}`)
        setJob(data)

        if (data.status === 'preview_done' || data.status === 'done') {
          const f: GeneratedFile[] = await api(`/jobs/${props.jobId}/files`)
          setFiles(f)
          setProgress(100)
        } else {
          setProgress(p => Math.min(p + 8, 95))
        }

        if (data.status !== 'done') {
          setSeconds(s => s + 2)
        }
      } catch (e: any) {
        setError(e.message || 'Erro ao consultar status')
        clearInterval(interval)
      }
    }, 2000)

    return () => {
      stop = true
      clearInterval(interval)
    }
  }, [props])

  if (isPreviewProps(props)) {
    const total = props.items.reduce((s, i) => s + i.qty, 0)

    return (
      <div className="border rounded-xl p-6 bg-white h-[420px] flex flex-col justify-between overflow-hidden">
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">Pré-visualização</h2>
          <div className="border rounded p-3 max-h-[260px] overflow-y-auto text-sm space-y-1">
            {props.items.map(i => (
              <div key={i.print_id} className="flex justify-between">
                <span>{i.name || i.print_id}</span>
                <span>{i.qty}x</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Total: {total}</span>
          <div className="flex gap-3">
            <button onClick={props.onReset} className="border px-4 py-2 rounded">
              Cancelar
            </button>
            <button
              onClick={() => preview(props.items, props.onJobCreated)}
              disabled={creating}
              className="bg-black text-white px-5 py-2 rounded"
            >
              Gerar preview
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isFinal = job?.status === 'done'

  return (
    <div className={`border rounded-xl bg-white h-[420px] flex flex-col justify-center items-center overflow-hidden ${!isFinal ? 'p-6' : 'p-10 text-center'}`}>
      {!isFinal && (
        <>
          <h2 className="font-semibold text-lg mb-2">Processando</h2>

          <div className="w-64 bg-gray-200 rounded h-2 mb-2">
            <div className="bg-black h-full transition-all" style={{ width: `${progress}%` }} />
          </div>

          <p className="text-sm text-gray-500 mb-1">
            Tempo estimado de processamento
          </p>

          <p className="text-xs text-gray-400">~{Math.max(10, 120 - seconds)} segundos</p>
        </>
      )}

      {isFinal && job?.zip_url && (
        <>
          <h2 className="font-semibold text-xl mb-2">Processamento concluído</h2>
          <p className="text-sm text-gray-600 mb-1">
            Foram gerados <b>{files.length}</b> arquivos finais.
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Total de estampas: <b>{files.length}</b>
          </p>
          <a
            href={job.zip_url}
            className="bg-black text-white px-8 py-3 rounded-lg"
          >
            Baixar arquivos finais
          </a>
        </>
      )}

      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white p-4 rounded-xl max-w-3xl max-h-[85vh] shadow-lg"
          >
            <img src={zoom} className="max-w-full max-h-[75vh] object-contain rounded" />
          </div>
        </div>
      )}
    </div>
  )
}
