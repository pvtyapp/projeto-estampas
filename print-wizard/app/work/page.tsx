'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/app/providers/SessionProvider'
import DashboardPanel from '@/app/dashboard/DashboardPanel'
import Library from '@/app/work/Library'
import PreviewPanel from '@/components/PreviewPanel'
import SkuUploadWizard from '@/app/work/SkuUploadWizard'
import JobHistory from '@/app/work/JobHistory'
import { supabase } from '@/lib/supabaseClient'

export default function WorkPage() {
  const router = useRouter()
  const { session, loading } = useSession()
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    if (!loading && !session && !isLoggingOut) {
      router.replace('/auth')
    }
  }, [loading, session, isLoggingOut, router])

  if (loading) {
    return <p className="p-6 text-gray-500">Carregando sessão...</p>
  }

  if (!session && !isLoggingOut) {
    return null
  }

  async function logout() {
    setIsLoggingOut(true)
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-sm text-gray-600">Olá, {session?.user.email}</span>

          <div className="text-xl font-semibold tracking-widest text-gray-900">
            PVTY
          </div>

          <button onClick={logout} className="text-sm text-red-600 hover:underline">
            Sair
          </button>
        </div>
      </header>

      {/* CONTEÚDO */}
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">

        {/* DASHBOARD */}
        <section>
          <DashboardPanel />
        </section>

        {/* FLUXO PRINCIPAL */}
        <section className="bg-white rounded-2xl shadow p-6 space-y-8">
          <SkuUploadWizard onComplete={() => {}} />

          <Library onJobCreated={setSelectedJob} />

          {selectedJob && (
            <div className="pt-4 border-t">
              <PreviewPanel jobId={selectedJob} />
            </div>
          )}
        </section>

        {/* HISTÓRICO */}
        <section className="bg-white rounded-2xl shadow p-6">
          <JobHistory onSelect={setSelectedJob} />
        </section>

        {/* COMO USAR */}
        <section id="como-usar" className="bg-white rounded-2xl shadow p-10">
          <h2 className="text-2xl font-semibold mb-4">Como usar</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Adicione suas estampas.</li>
            <li>Defina as quantidades.</li>
            <li>Gere as folhas.</li>
            <li>Baixe e imprima.</li>
          </ol>
        </section>

      </main>
    </div>
  )
}
