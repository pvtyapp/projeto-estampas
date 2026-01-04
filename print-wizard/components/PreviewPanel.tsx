'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'
import { PreviewItem } from '@/app/types/preview'

type Job = {
  id: string
  status: 'preview' | 'preview_done' | 'queued' | 'processing' | 'done' | 'error'
  zip_url?: string
  error?: string
}

type GeneratedFile = {
  id: string
  public_url: string
  page_index: number
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
  return (p as PreviewProps).items !== undefined
}

export default function PreviewPanel(props: Props) {
  const [job, setJob] = useState<Job | null>(null)
  const [files, setFiles] = useState<GeneratedFile[]>([])
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function preview(items: PreviewItem[], onJobCreated: (id: string) => void) {
    setCreating(true)
    setProgress(5)
    try {
      const res: { job_id: string } = await api('/print-jobs', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map(i => ({
            print_id: i.print_id,
            asset_id: i.asset_id,
            qty: i.qty,
            width_cm: i.width_cm,
            height_cm: i.height_cm,
          })),
        }),
      })
      onJobCreated(res.job_id)
      setToast('🔍 Gerando preview — isto é apenas uma visualização.')
      setTimeout(() => setToast(null), 4000)
    } catch (e: any) {
      alert(e.message || 'Erro ao gerar preview')
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
      setProgress(5)
    } catch (e: any) {
      alert(e.message || 'Erro ao confirmar')
    } finally {
      setConfirming(false)
    }
  }

  if (isPreviewProps(props)) {
    const totalUnits = props.items.reduce((s, i) => s + i.qty, 0)

    return (
      <div className="border rounded-lg p-6 bg-white space-y-4">
        <h2 className="font-bold text-lg">Gerar preview</h2>

        <div className="text-sm text-gray-600">
          Total de artes: <b>{totalUnits}</b>
        </div>

        <div className="border rounded p-3 max-h-[240px] overflow-y-auto space-y-2">
          {props.items.map(i => (
            <div key={`${i.print_id}-${i.asset_id}`} className="flex justify-between text-sm">
              <span>{i.name} / {i.sku}</span>
              <span className="font-medium">{i.qty}x</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={props.onReset} className="border px-4 py-2 rounded">
            Cancelar
          </button>

          <button
            onClick={() => preview(props.items, props.onJobCreated)}
            disabled={creating}
            className="bg-black text-white px-4 py-2 rounded"
          >
            {creating ? 'Gerando...' : 'Gerar preview'}
          </button>
        </div>
      </div>
    )
  }

  const { jobId } = props

  useEffect(() => {
    if (!jobId) return

    let stopped = false
    setJob(null)
    setFiles([])
    setProgress(10)
    setError(null)

    const interval = setInterval(async () => {
      try {
        const data: Job = await api(`/jobs/${jobId}`)
        if (stopped) return

        setJob(data)

        if (data.status === 'preview_done') {
          const f = await api(`/jobs/${jobId}/files`)
          setFiles(f)
          setProgress(100)
          clearInterval(interval)
        }

        if (data.status === 'done') {
          setProgress(100)
          clearInterval(interval)
        }

        if (data.status === 'error') {
          clearInterval(interval)
        }

        if (data.status !== 'preview_done' && data.status !== 'done') {
          setProgress(p => Math.min(p + 8, 95))
        }
      } catch (e: any) {
        setError(e.message || 'Erro ao consultar status')
        clearInterval(interval)
      }
    }, 1800)

    return () => {
      stopped = true
      clearInterval(interval)
    }
  }, [jobId])

  return (
    <div className="border rounded-lg p-6 bg-white space-y-4">
      <h2 className="font-bold text-lg">Processamento</h2>

      {toast && (
        <div className="fixed top-4 right-4 bg-black text-white px-4 py-2 rounded shadow z-50">
          {toast}
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {job && job.status !== 'preview_done' && job.status !== 'done' && (
        <>
          <div className="w-full bg-gray-200 rounded h-3 overflow-hidden">
            <div className="h-full bg-black transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm text-gray-600">
            {job.status === 'preview' && '🔍 Gerando preview…'}
            {job.status === 'queued' && '⏳ Na fila de processamento'}
            {job.status === 'processing' && '⚙️ Gerando arquivos finais…'}
          </p>
        </>
      )}

      {job?.status === 'preview_done' && (
        <>
          <p className="text-sm text-gray-600">
            {files.length} folhas geradas — isto é apenas uma prévia.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto">
            {files.map(f => (
              <img
                key={f.id}
                src={f.public_url}
                className="border rounded shadow pointer-events-none select-none"
                alt="preview"
              />
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => confirm(jobId)}
              disabled={confirming}
              className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {confirming ? 'Confirmando…' : 'Confirmar e gerar'}
            </button>
            <button onClick={() => window.location.reload()} className="border px-4 py-2 rounded">
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
