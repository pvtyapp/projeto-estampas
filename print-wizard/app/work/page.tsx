'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/app/providers/SessionProvider'
import DashboardPanel from '@/app/dashboard/DashboardPanel'
import Library from '@/app/work/Library'
import PreviewPanel from '@/components/PreviewPanel'
import SkuUploadWizard from '@/app/work/SkuUploadWizard'

export default function WorkPage() {
  const router = useRouter()
  const { session, loading } = useSession()

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/auth')
    }
  }, [loading, session, router])

  if (loading) {
    return <p className="p-6 text-gray-500">Carregando sessão...</p>
  }

  if (!session) {
    return null
  }

  return (
    <div className="space-y-10 max-w-6xl mx-auto p-6">
      <DashboardPanel />
      <SkuUploadWizard onComplete={() => {}} />
      <Library />
      <PreviewPanel jobId={null} />
    </div>
  )
}
