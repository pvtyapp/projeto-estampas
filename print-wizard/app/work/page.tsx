'use client'

import { useState } from 'react'
import DashboardPanel from '../dashboard/DashboardPanel'
import Library from './Library'
import PreviewPanel from '../../components/PreviewPanel'
import SkuUploadWizard from './SkuUploadWizard'

export default function WorkPage() {
  const [lastJobId, setLastJobId] = useState<string | null>(null)

  return (
    <div className="space-y-10 max-w-6xl mx-auto p-6">
      <DashboardPanel />

      <SkuUploadWizard onComplete={() => {
        // por enquanto só limpa o preview
        setLastJobId(null)
      }} />

      <Library />

      <PreviewPanel jobId={lastJobId} />
    </div>
  )
}
