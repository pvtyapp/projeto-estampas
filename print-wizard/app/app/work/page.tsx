'use client'

import { useState } from 'react'
import DashboardPanel from '../../dashboard/DashboardPanel'
import UploadPanel from './UploadPanel'
import LibraryPanel from '../../../components/LibraryPanel'
import PreviewPanel from '../../../components/PreviewPanel'

export default function WorkPage() {
  const [lastJobId, setLastJobId] = useState<string | null>(null)

  return (
    <div className="space-y-10 max-w-6xl mx-auto p-6">
      <DashboardPanel />
      <UploadPanel />
      <LibraryPanel onJobCreated={setLastJobId} />
      <PreviewPanel jobId={lastJobId} />
    </div>
  )
}
