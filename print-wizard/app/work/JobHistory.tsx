"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/apiClient"

type Job = {
  id: string
  status: string
  created_at: string
  zip_url?: string
}

type Stats = {
  top_used: { name: string; count: number }[]
  not_used: { name: string }[]
  costs: {
    files: number
    prints: number
    total_cost: number
  }
}

type Period = "today" | "yesterday" | "7d" | "30d" | "60d"

type JobHistoryProps = {
  onSelect?: (jobId: string) => void
}

export default function JobHistory({ onSelect }: JobHistoryProps) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState<Period>("30d")
  const [price, setPrice] = useState(0)

  useEffect(() => {
    load()
  }, [period])

  async function load() {
    setLoading(true)

    const now = new Date()
    let from: Date | null = null
    let to: Date | null = null

    if (period === "today") {
      from = new Date(now.setHours(0, 0, 0, 0))
    } else if (period === "yesterday") {
      const y = new Date()
      y.setDate(y.getDate() - 1)
      from = new Date(y.setHours(0, 0, 0, 0))
      to = new Date(y.setHours(23, 59, 59, 999))
    } else {
      const days = { "7d": 7, "30d": 30, "60d": 60 }[period]
      from = new Date(Date.now() - days * 86400000)
    }

    let params = ""
    if (from) params += `?from=${from.toISOString()}`
    if (to) params += `&to=${to.toISOString()}`

    try {
      const [jobsData, statsData] = await Promise.all([
        api(`/jobs/history${params}`),
        api(`/stats/prints${params}`),
      ])
      setJobs(jobsData || [])
      setStats(statsData || null)
    } finally {
      setLoading(false)
    }
  }

  const recentJobs = jobs.filter(
    j => Date.now() - new Date(j.created_at).getTime() < 48 * 60 * 60 * 1000
  )

  return (
    <div className="space-y-4">
      {/* Period Filter */}
      <div className="flex justify-between items-center">
        <select
          value={period}
          onChange={e => setPeriod(e.target.value as Period)}
          className="border rounded px-3 py-1 text-sm"
        >
          <option value="today">Hoje</option>
          <option value="yesterday">Ontem</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="60d">Últimos 60 dias</option>
        </select>
      </div>

      {loading && <p className="text-sm text-gray-500">Carregando dados…</p>}

      {!loading && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Panel title="Top mais utilizadas">
            <ScrollableList items={stats.top_used?.map(p => `${p.name} (${p.count})`) || []} />
          </Panel>

          <Panel title="Top esquecidas">
            <ScrollableList items={stats.not_used?.map(p => p.name) || []} />
          </Panel>

          <Panel title="Indicadores de custo">
            <div className="space-y-2 text-sm text-gray-700">
              <Row label="Preço do metro (R$)">
                <input
                  type="number"
                  value={price}
                  onChange={e => setPrice(Number(e.target.value))}
                  className="border rounded px-2 py-1 w-24 text-right"
                />
              </Row>
              <Row label="Arquivos gerados">{stats.costs.files}</Row>
              <Row label="Estampas incluídas">{stats.costs.prints}</Row>
              <Row label="Custo médio por estampa">
                R$ {stats.costs.prints > 0 ? ((stats.costs.files * price) / stats.costs.prints).toFixed(2) : "0"}
              </Row>
            </div>
          </Panel>

          <Panel title="Downloads recentes (48h)">
            {recentJobs.length === 0 && <p className="text-sm text-gray-500">Nenhum disponível.</p>}
            {recentJobs.map((j: Job) => {
              const d = new Date(j.created_at)
              const label = `JOB ${d.toLocaleDateString()} ${d.toLocaleTimeString().slice(0, 5)}`
              return (
                <div key={j.id} className="flex justify-between text-sm">
                  <span onClick={() => onSelect?.(j.id)} className="cursor-pointer hover:underline">
                    {label}
                  </span>
                  {j.zip_url && (
                    <a href={j.zip_url} className="text-blue-600 hover:underline">
                      Download
                    </a>
                  )}
                </div>
              )
            })}
          </Panel>
        </div>
      )}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-xl shadow p-4 space-y-2">
      <h3 className="font-semibold text-sm text-gray-800">{title}</h3>
      {children}
    </div>
  )
}

function ScrollableList({ items }: { items: string[] }) {
  return (
    <div className="max-h-[240px] overflow-y-auto space-y-1 text-sm text-gray-700">
      {items.slice(0, 30).map((item, i) => (
        <div key={i}>{item}</div>
      ))}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span>{label}</span>
      <span>{children}</span>
    </div>
  )
}
