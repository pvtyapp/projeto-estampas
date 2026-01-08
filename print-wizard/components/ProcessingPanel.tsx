'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Clock, Loader2 } from 'lucide-react'

type Stage = 'preview' | 'processing' | 'finalizing' | 'done'

export default function ProcessingPanel({ stage, eta }: { stage: Stage; eta: number }) {
  const [remaining, setRemaining] = useState(eta)

  useEffect(() => {
    if (stage !== 'processing') return
    const i = setInterval(() => setRemaining(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(i)
  }, [stage])

  const steps = [
    { key: 'preview', label: 'Prévia gerada' },
    { key: 'processing', label: 'Processando no servidor' },
    { key: 'finalizing', label: 'Gerando arquivos finais' },
    { key: 'done', label: 'Pronto para download' },
  ]

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-wide">Processamento</h2>
        {stage === 'processing' && (
          <div className="font-mono text-sm text-emerald-400 flex items-center gap-2">
            <Clock size={14} />
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {steps.map((s, i) => {
          const done = steps.findIndex(x => x.key === stage) > i || stage === s.key
          const active = stage === s.key

          return (
            <div key={s.key} className="flex items-center gap-3">
              {done ? (
                <CheckCircle className="text-emerald-500" size={18} />
              ) : active ? (
                <Loader2 className="animate-spin text-blue-400" size={18} />
              ) : (
                <div className="w-4 h-4 rounded-full border border-gray-600" />
              )}
              <span className={done ? 'text-emerald-400' : active ? 'text-blue-400' : 'text-gray-400'}>
                {s.label}
              </span>
            </div>
          )
        })}
      </div>

      {stage === 'done' && (
        <button className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-2 rounded-lg">
          Baixar arquivos finais
        </button>
      )}
    </div>
  )
}
