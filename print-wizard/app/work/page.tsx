'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/app/providers/SessionProvider'
import DashboardPanel from '@/app/dashboard/DashboardPanel'
import Library from '@/app/work/Library'
import { PreviewItem } from '@/app/types/preview'
import PreviewPanel from '@/components/PreviewPanel'
import SkuUploadWizard from '@/app/work/SkuUploadWizard'
import JobHistory from '@/app/work/JobHistory'
import { supabase } from '@/lib/supabaseClient'

export default function WorkPage() {
  const router = useRouter()
  const { session, loading } = useSession()

  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [previewItems, setPreviewItems] = useState<PreviewItem[] | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    if (!loading && !session && !isLoggingOut) {
      router.replace('/auth')
    }
  }, [loading, session, isLoggingOut, router])

  if (loading) return <p className="p-6 text-gray-500">Carregando sessão...</p>
  if (!session && !isLoggingOut) return null

  async function logout() {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between">
          <span className="text-sm text-gray-600">Olá, {session?.user.email}</span>
          <div className="text-xl font-semibold tracking-widest">PVTY</div>
          <button onClick={logout} className="text-sm text-red-600">
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <DashboardPanel />

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6 bg-white rounded-2xl shadow p-6">
            <SkuUploadWizard onComplete={() => {}} />

            <Library
              onPreview={items => {
                setPreviewItems(items)
                setSelectedJob(null)
              }}
            />
          </div>

          <div className="bg-white rounded-2xl shadow p-6 min-h-[300px]">
            {previewItems ? (
              <PreviewPanel
                items={previewItems}
                onJobCreated={jobId => {
                  setSelectedJob(jobId)
                  setPreviewItems(null)
                }}
                onReset={() => setPreviewItems(null)}
              />
            ) : selectedJob ? (
              <PreviewPanel jobId={selectedJob} />
            ) : (
              <div className="text-gray-400 text-sm">
                Preencha as quantidades e clique em “Gerar folhas”.
              </div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-6">
          <JobHistory onSelect={setSelectedJob} />
        </section>
      </main>
    </div>
  )
}
