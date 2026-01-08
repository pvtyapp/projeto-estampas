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

function hasOnReset(p: Props): p is PreviewProps {
  return typeof (p as any)?.onReset === 'function'
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

        if (data.status === 'preview_done') {
          const f: GeneratedFile[] = await api(`/jobs/${props.jobId}/files`)
          setFiles(f)
          setProgress(100)
        } else if (data.status === 'done') {
          setProgress(100)
        } else {
          setProgress(p => Math.min(p + 8, 95))
        }

        setSeconds(s => s + 2)
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

  return (
    <div className="border rounded-xl p-6 bg-white h-[420px] flex flex-col justify-between overflow-hidden">
      <div className="space-y-3">
        <h2 className="font-semibold text-lg">Processamento</h2>

        <div className="w-full bg-gray-200 rounded h-2">
          <div className="bg-black h-full transition-all" style={{ width: `${progress}%` }} />
        </div>

        <p className="text-xs text-gray-400">Tempo decorrido: {seconds}s</p>

        {job?.status === 'preview_done' && (
          <>
            <p className="text-sm text-gray-600">{files.length} folhas geradas (prévia)</p>

            <p className="text-xs text-gray-500 leading-snug">
              Uma dica importante: veja seu último arquivo e certifique-se de que ele está completo na área de impressão — isso deixará os custos mais precisos.
            </p>

            <div className="grid grid-cols-3 gap-3 max-h-[180px] overflow-y-auto pr-1">
              {files.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => setZoom(f.url)}
                  className="relative border rounded-lg overflow-hidden hover:ring-2 hover:ring-black transition"
                >
                  <img src={f.url} className="w-full h-24 object-cover opacity-90 blur-[0.5px]" />
                  <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold bg-black/30">
                    PRÉVIA
                  </div>
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
                    {i + 1}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2">
              {hasOnReset(props) && (
                <button onClick={props.onReset} className="border px-4 py-2 rounded text-sm">
                  Cancelar
                </button>
              )}

              <button
                onClick={() => confirm(props.jobId)}
                disabled={confirming}
                className="bg-black text-white px-5 py-2 rounded disabled:opacity-50"
              >
                {confirming ? 'Concluindo…' : 'Concluir'}
              </button>
            </div>
          </>
        )}
      </div>

      {job?.status === 'done' && job.zip_url && (
        <div className="space-y-2 text-center w-full">
          <p className="text-sm font-medium">Foram gerados {files.length} arquivos com sucesso.</p>
          <a href={job.zip_url} className="bg-black text-white px-6 py-3 rounded inline-block">
            Baixar arquivos finais
          </a>
        </div>
      )}

      {zoom && (
        <div onClick={() => setZoom(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div onClick={e => e.stopPropagation()} className="bg-white p-4 rounded-xl max-w-3xl max-h-[85vh] shadow-lg">
            <img src={zoom} className="max-w-full max-h-[75vh] object-contain rounded" />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
