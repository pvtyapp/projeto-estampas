'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import DashboardPanel from '@/app/dashboard/DashboardPanel'
import Library from '@/app/work/Library'
import PreviewPanel from '@/components/PreviewPanel'
import SkuUploadWizard from '@/app/work/SkuUploadWizard'

export default function WorkPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/auth')
      } else {
        setLoading(false)
      }
    })
  }, [])

  if (loading) return <p className="p-6">Carregando...</p>

  return (
    <div className="space-y-10 max-w-6xl mx-auto p-6">
      <DashboardPanel />
      <SkuUploadWizard onComplete={() => {}} />
      <Library />
      <PreviewPanel jobId={null} />
    </div>
  )
}
