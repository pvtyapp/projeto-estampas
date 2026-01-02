'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'
import { PreviewItem } from '@/app/types/preview'

type Job = {
  id: string
  status: 'queued' | 'processing' | 'done' | 'error'
  result_urls?: string[]
  zip_url?: string
  error?: string
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
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  async function confirm(items: PreviewItem[], onJobCreated: (id: string) => void) {
    setCreating(true)
    try {
      const res: { job_id: string } = await api('/print-jobs', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map(i => ({
            print_id: i.print_id,
            qty: i.qty,
            width_cm: i.width_cm,
            height_cm: i.height_cm,
          })),
        }),
      })

      onJobCreated(res.job_id)
    } catch (e: any) {
      alert(e.message || 'Erro ao criar job')
    } finally {
      setCreating(false)
    }
  }

  if (isPreviewProps(props)) {
    const totalUnits = props.items.reduce((s, i) => s + i.qty, 0)

    return (
      <div className="border rounded-lg p-6 bg-white space-y-4">
        <h2 className="font-bold text-lg">Confirmar geração</h2>

        <div className="text-sm text-gray-600">
          Total de estampas: <b>{totalUnits}</b>
        </div>

        <div className="border rounded p-3 max-h-[240px] overflow-y-auto space-y-2">
          {props.items.map(i => (
            <div key={i.print_id} className="flex justify-between text-sm">
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
            onClick={() => confirm(props.items, props.onJobCreated)}
            disabled={creating}
            className="bg-black text-white px-4 py-2 rounded"
          >
            {creating ? 'Criando...' : 'Confirmar e gerar'}
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
    setProgress(0)
    setError(null)

    const interval = setInterval(async () => {
      try {
        const data: Job = await api(`/jobs/${jobId}`)
        if (stopped) return

        setJob(data)
        setProgress(p =>
          data.status === 'done' ? 100 : data.status === 'error' ? p : Math.min(p + 8, 95),
        )

        if (data.status === 'done' || data.status === 'error') clearInterval(interval)
      } catch (e: any) {
        setError(e.message || 'Erro ao consultar status')
        clearInterval(interval)
      }
    }, 2000)

    return () => {
      stopped = true
      clearInterval(interval)
    }
  }, [jobId])

  return (
    <div className="border rounded-lg p-6 bg-white space-y-4">
      <h2 className="font-bold text-lg">Processamento</h2>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {job && job.status !== 'done' && (
        <>
          <div className="w-full bg-gray-200 rounded h-3 overflow-hidden">
            <div className="h-full bg-black transition-all" style={{ width: `${progress}%` }} />
          </div>

          <p className="text-sm text-gray-600">
            {job.status === 'queued' && '⏳ Na fila de processamento'}
            {job.status === 'processing' && '⚙️ Gerando folhas...'}
          </p>
        </>
      )}

      {job?.status === 'done' && (
        <>
          <div className="pt-4 flex gap-3 flex-wrap">
            {job.zip_url && (
              <a href={job.zip_url} download className="bg-black text-white px-4 py-2 rounded">
                Baixar todas (ZIP)
              </a>
            )}
            <button onClick={() => window.location.reload()} className="border px-4 py-2 rounded">
              Criar novo job
            </button>
          </div>
        </>
      )}
    </div>
  )
}
