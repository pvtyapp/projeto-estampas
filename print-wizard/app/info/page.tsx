'use client'

import { useEffect, useState } from 'react'

export default function InfoPage() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/info/summary`, { credentials: 'include' })
      .then(r => r.json())
      .then(setData)
  }, [])

  if (!data) return <div>Carregando...</div>

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card title="Produção (48h)">
        {data.jobs_48h.length} arquivos gerados
      </Card>

      <Card title="Top estampas">
        <ul>
          {data.top_prints.map((p: any) => <li key={p.id}>{p.name}</li>)}
        </ul>
      </Card>

      <Card title="Paradas há 45 dias">
        <ul>
          {data.idle_prints.map((p: any) => <li key={p.id}>{p.name}</li>)}
        </ul>
      </Card>
    </div>
  )
}

function Card({ title, children }: any) {
  return (
    <div className="rounded-2xl border bg-white p-6">
      <h2 className="font-semibold mb-2">{title}</h2>
      {children}
    </div>
  )
}
