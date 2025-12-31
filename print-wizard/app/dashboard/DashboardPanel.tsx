'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'
import { useSession } from '@/app/providers/SessionProvider'

export default function DashboardPanel() {
  const session = useSession()
  const [usage, setUsage] = useState<any>(null)

  useEffect(() => {
    if (!session) return

    api('/me/usage').then(setUsage).catch(console.error)
  }, [session])

  if (!usage) return null

  return (
    <div className="border rounded p-4">
      <div>Plano: {usage.plan}</div>
      <div>Uso: {usage.used} / {usage.limit}</div>
    </div>
  )
}
