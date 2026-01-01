'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

import DashboardPanel from '../dashboard/DashboardPanel'
import Library from './Library'
import PreviewPanel from '../../components/PreviewPanel'
import SkuUploadWizard from './SkuUploadWizard'

export default function WorkPage() {
  const [lastJobId, setLastJobId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      console.log('SESSION:', data?.session)
      console.log('TOKEN:', data?.session?.access_token)
      if (error) console.error('SESSION ERROR:', error)
    })
  }, [])

  return (
    <div className="space-y-10 max-w-6xl mx-auto p-6">
      <DashboardPanel />

      <SkuUploadWizard onComplete={() => {
        setLastJobId(null)
      }} />

      <Library />

      <PreviewPanel jobId={lastJobId} />
    </div>
  )
}
