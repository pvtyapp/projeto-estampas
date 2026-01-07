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

type Period = "7d" | "30d" | "90d" | "custom"

export default function JobHistory({ onSelect }: { onSelect?: (jobId: string) => void }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState<Period>("30d")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  useEffect(() => {
    load()
  }, [period, from, to])

  async function load() {
    try {
      setLoading(true)

      let params = ""
      if (period !== "custom") {
        const days = { "7d": 7, "30d": 30, "90d": 90 }[period]
        const start = new Date(Date.now() - days * 86400000)
        params = `?from=${start.toISOString()}`
      } else if (from && to) {
        params = `?from=${from}&to=${to}`
      }

      const [jobsData, statsData] = await Promise.all([
        api(`/jobs/history${params}`),
        api(`/stats/prints${params}`),
      ])

      setJobs(jobsData)
      setStats(statsData)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* FILTER */}
      <div className="flex items-center gap-4 text-sm">
        <select value={period} onChange={e => setPeriod(e.target.value as Period)} className="border rounded px-2 py-1">
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
          <option value="custom">Período personalizado</option>
        </select>

        {period === "custom" && (
          <>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border rounded px-2 py-1" />
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border rounded px-2 py-1" />
          </>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Carregando…</p>}

      {!loading && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <TopUsed data={stats.top_used} />
          <NotUsed data={stats.not_used} />
          <Costs data={stats.costs} />
          <LastJobs jobs={jobs} onSelect={onSelect} />
        </div>
      )}
    </div>
  )
}

function Panel({ title, children }: any) {
  return (
    <div className="bg-white border rounded-xl shadow p-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      {children}
    </div>
  )
}

function TopUsed({ data }: any) {
  return <Panel title="Top 15 mais usadas">{data.slice(0, 15).map((p: any, i: number) => <div key={i} className="text-sm">{p.name} ({p.count})</div>)}</Panel>
}

function NotUsed({ data }: any) {
  return <Panel title="15 não usadas">{data.slice(0, 15).map((p: any, i: number) => <div key={i} className="text-sm">{p.name}</div>)}</Panel>
}

function Costs({ data }: any) {
  if (!data) return <Panel title="Custos">Sem dados</Panel>
  const avg = data.prints > 0 ? (data.total_cost / data.prints).toFixed(2) : "0"
  return <Panel title="Custos">Arquivos: {data.files}<br />Estampas: {data.prints}<br />Média: R$ {avg}</Panel>
}

function LastJobs({ jobs, onSelect }: any) {
  return (
    <Panel title="Últimos jobs">
      {jobs.slice(0, 15).map((j: any) => (
        <div key={j.id} className="flex justify-between text-sm">
          <span onClick={() => onSelect?.(j.id)} className="cursor-pointer hover:underline">
            Job {j.id.slice(0, 8)}
          </span>
          {j.zip_url ? <a href={j.zip_url}>Download</a> : <span>{j.status}</span>}
        </div>
      ))}
    </Panel>
  )
}
