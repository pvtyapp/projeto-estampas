'use client'

import DashboardPanel from './DashboardPanel'

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <DashboardPanel />

      <div className="rounded-xl border p-6 bg-white shadow-sm">
        <p className="text-sm text-gray-500">
          Use o menu acima para acessar a produção, biblioteca e histórico de arquivos.
        </p>
      </div>
    </div>
  )
}
