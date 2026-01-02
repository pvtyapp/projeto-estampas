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

  function scrollToHelp() {
    document.getElementById('como-usar')?.scrollIntoView({ behavior: 'smooth' })
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-sm text-gray-600">Olá, {session.user.email}</span>

          <div className="text-xl font-semibold tracking-widest text-gray-900">
            PVTY
          </div>

          <div className="flex gap-4 items-center">
            <button onClick={scrollToHelp} className="text-sm underline">
              Como usar
            </button>
            <button onClick={logout} className="text-sm text-red-600 hover:underline">
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO */}
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-12">

        <section className="bg-white rounded-2xl shadow p-6">
          <DashboardPanel />
        </section>

        <section className="bg-white rounded-2xl shadow p-6">
          <SkuUploadWizard onComplete={() => {}} />
        </section>

        <section className="bg-white rounded-2xl shadow p-6">
          <Library onJobCreated={setSelectedJob} />
        </section>

        <section className="bg-white rounded-2xl shadow p-6">
          <JobHistory onSelect={setSelectedJob} />
        </section>

        <section className="bg-white rounded-2xl shadow p-6">
          <PreviewPanel jobId={selectedJob} />
        </section>

        {/* COMO USAR */}
        <section id="como-usar" className="bg-white rounded-2xl shadow p-10">
          <h2 className="text-2xl font-semibold mb-4">Como usar</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Adicione suas estampas na biblioteca.</li>
            <li>Defina as quantidades desejadas.</li>
            <li>Clique em gerar folhas para montar os arquivos.</li>
            <li>Baixe e envie direto para impressão.</li>
          </ol>
        </section>

      </main>
    </div>
  )
}
