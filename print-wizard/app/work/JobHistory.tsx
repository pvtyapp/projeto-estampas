"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/apiClient"

type Job = {
  id: string
  status: string
  created_at: string
  zip_url?: string
  file_count?: number
  print_count?: number
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

export default function JobHistory() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState<Period>("7d")
  const [price, setPrice] = useState("0")
  const [silenced, setSilenced] = useState<string[]>([])

  useEffect(() => {
    load()
  }, [period])

  async function load() {
    setLoading(true)

    const now = new Date()
    let from: Date | null = null

    if (period === "today") {
      from = new Date(now.setHours(0, 0, 0, 0))
    } else if (period === "yesterday") {
      const y = new Date()
      y.setDate(y.getDate() - 1)
      from = new Date(y.setHours(0, 0, 0, 0))
    } else {
      const days = { "7d": 7, "30d": 30, "60d": 60 }[period]
      from = new Date(Date.now() - days * 86400000)
    }

    const params = from ? `?from=${from.toISOString()}` : ""

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

  const numericPrice = Number(price.replace(",", ".")) || 0

  const forgotten = stats?.not_used || []
  const activeForgotten = forgotten.filter(n => !silenced.includes(n.name))
  const silencedForgotten = forgotten.filter(n => silenced.includes(n.name))

  return (
    <div className="space-y-4">
      {/* FILTRO */}
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
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Panel title="Top mais utilizadas">
              <ScrollableList items={stats.top_used.map(p => `${p.name} (${p.count})`)} />
            </Panel>

            <Panel title="Top esquecidas (≥ 45 dias sem uso)">
              <div className="space-y-1">
                {activeForgotten.slice(0, 30).map(p => (
                  <div key={p.name} className="flex justify-between text-sm">
                    <span>{p.name}</span>
                    <button
                      onClick={() => setSilenced(s => [...s, p.name])}
                      className="text-xs text-gray-400 hover:text-black"
                    >
                      silenciar
                    </button>
                  </div>
                ))}
              </div>

              {silencedForgotten.length > 0 && (
                <div className="mt-3 border-t pt-2 space-y-1">
                  <div className="text-xs text-gray-400">Silenciadas</div>
                  {silencedForgotten.slice(0, 30).map(p => (
                    <div key={p.name} className="flex justify-between text-xs italic text-gray-400">
                      <span>{p.name}</span>
                      <button
                        onClick={() =>
                          setSilenced(s => s.filter(n => n !== p.name))
                        }
                        className="hover:text-black"
                      >
                        reativar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Indicadores de custo">
              <div className="space-y-2 text-sm text-gray-700">
                <Row label="Preço do metro (R$)">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="border rounded px-2 py-1 w-24 text-right"
                  />
                </Row>
                <Row label="Arquivos gerados">{stats.costs.files}</Row>
                <Row label="Estampas incluídas">{stats.costs.prints}</Row>
                <Row label="Custo médio por estampa">
                  R$ {stats.costs.prints > 0 ? ((stats.costs.files * numericPrice) / stats.costs.prints).toFixed(2) : "0"}
                </Row>
              </div>
            </Panel>
          </div>
        </>
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
    <div className="max-h-[240px] overflow-y-auto space-y-1 text-sm text-gray-700 pr-1">
      {items.map((item, i) => (
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
