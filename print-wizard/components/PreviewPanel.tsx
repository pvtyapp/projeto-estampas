'use client'

import { useEffect, useState, useMemo } from 'react'
import { api } from '@/lib/apiClient'

type PreviewItem = {
  print_id: string
  qty: number
  name?: string
  sku?: string
}

type Job = {
  id: string
  status: 'preview' | 'preview_done' | 'confirming' | 'queued' | 'processing' | 'done' | 'error'
  zip_url?: string
  error?: string
}

type GeneratedFile = {
  id: string
  url: string
}

type PreviewProps = {
  sheetSize: '30x100' | '57x100'
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

function groupByPrint(items: PreviewItem[]): PreviewItem[] {
  const map: Record<string, PreviewItem> = {}

  for (const i of items) {
    if (!map[i.print_id]) {
      map[i.print_id] = { ...i, qty: 0 }
    }
    map[i.print_id].qty += i.qty || 1
  }

  return Object.values(map)
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

  const groupedItems = useMemo(() => {
    if (!isPreviewProps(props)) return []
    return groupByPrint(props.items)
  }, [props])

  async function preview(items: PreviewItem[], onJobCreated: (id: string) => void) {
    if (creating) return
    if (!isPreviewProps(props)) return
    setCreating(true)
    try {
      const grouped = groupByPrint(items)

      const res: { job_id: string } = await api('/print-jobs', {
        method: 'POST',
        
        body: JSON.stringify({
          items: grouped.map(i => ({ print_id: i.print_id, qty: i.qty })),
          sheet_size: props.sheetSize,
        }),
      })

      onJobCreated(res.job_id)
    } finally {
      setCreating(false)
    }
  }

  async function confirm(jobId: string) {
    if (!job || job.status !== 'preview_done' || confirming) return
    setConfirming(true)
    try {
      await api(`/print-jobs/${jobId}/confirm`, { method: 'POST' })
      setJob(j => (j ? { ...j, status: 'queued' } : j))
      setSeconds(0)
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
          return
        }

        if (data.status === 'done') {
          const f: GeneratedFile[] = await api(`/jobs/${props.jobId}/files`)
          setFiles(f)
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

  if (isPreviewProps(props)) {
    const total = groupedItems.reduce((s, i) => s + i.qty, 0)

    return (
      <div className="border rounded-2xl p-8 bg-white min-h-[520px] flex flex-col justify-between">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Pré-visualização</h2>

          <div className="border rounded-lg p-4 max-h-[280px] overflow-y-auto text-sm space-y-2">
            {groupedItems.map(i => (
              <div key={i.print_id} className="flex justify-between">
                <span>{i.name || i.print_id}</span>
                <span>{i.qty}x</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-500 leading-snug">
            💡 O custo final depende do número de folhas geradas após o preview.
          </p>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">{total} kits selecionados</span>
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

  const remaining = Math.max(0, 120 - seconds)

  return (
    <div className="border rounded-2xl p-10 bg-white min-h-[320px] flex flex-col justify-between">
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-center">
          {job?.status === 'done' ? 'Concluído' : job?.status === 'confirming' ? 'Confirmando' : 'Processando'}
        </h2>

        {job?.status !== 'done' && (
          <>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-black h-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="text-xs text-gray-500 text-center">
              ~ {remaining} segundos restantes
            </p>
          </>
        )}

        {job?.status === 'preview_done' && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-600">
              {files.length} folhas geradas (prévia) — consumo estimado: {files.length} créditos
            </p>

            <div className="flex justify-center gap-4 flex-wrap max-h-[220px] overflow-y-auto">
              {files.map(f => (
                <button
                  key={f.id}
                  onClick={() => setZoom(f.url)}
                  className="relative w-32 h-24 border rounded-lg overflow-hidden hover:ring-2 hover:ring-black"
                >
                  <img src={f.url} className="w-full h-full object-cover blur-[0.5px] opacity-90" />
                  <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold bg-black/30">
                    PRÉVIA
                  </div>
                </button>
              ))}
            </div>

            <p className="text-xs text-gray-500">
              Ao concluir, {files.length} créditos serão consumidos.
            </p>

            <div className="flex justify-center gap-4 pt-4">
              <button onClick={() => window.location.reload()} className="border px-6 py-2 rounded-lg">
                Refazer
              </button>

              <button
                onClick={() => confirm(props.jobId)}
                disabled={confirming}
                className="bg-black text-white px-6 py-2 rounded-lg disabled:opacity-50"
              >
                {confirming ? 'Concluindo…' : `Concluir (${files.length} créditos)`}
              </button>
            </div>
          </div>
        )}

        {job?.status === 'done' && job.zip_url && (
          <div className="space-y-4 text-center">
            <p className="text-sm font-medium">Foram gerados {files.length} arquivos com sucesso.</p>
            <a
              href={job.zip_url}
              onClick={() => setTimeout(() => window.location.reload(), 5000)}
              className="bg-black text-white px-8 py-3 rounded-lg inline-block"
            >
              Baixar arquivos finais
            </a>

            <button
              onClick={() => window.location.reload()}
              className="text-sm text-gray-500 underline mt-2"
            >
              Fazer outro arquivo
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      </div>

      <div className="flex justify-end">
        <span className="text-xs text-gray-400 italic">
          Aproveite esse tempo para beber água!!! 💧
        </span>
      </div>

      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        >
          <div onClick={e => e.stopPropagation()} className="bg-white p-4 rounded-xl shadow-lg">
            <img src={zoom} className="max-w-[90vw] max-h-[85vh] object-contain rounded" />
          </div>
        </div>
      )}
    </div>
  )
}
