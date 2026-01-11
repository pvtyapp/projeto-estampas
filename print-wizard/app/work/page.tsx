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
  const [libraryVersion, setLibraryVersion] = useState(0)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [sheetSize, setSheetSize] = useState<'30x100' | '57x100'>('30x100')

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

  function scrollToHelp() {
    const el = document.getElementById('footer-help')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  function goToPlans() {
    router.push('/plans')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 grid grid-cols-3 items-center">
          <span className="text-sm text-gray-600">Olá, {session?.user?.email ?? ''}</span>

          <div className="text-xl font-semibold tracking-widest text-center">
            PVTY
          </div>

          <div className="flex justify-end items-center gap-4">
            <button
              onClick={goToPlans}
              className="text-sm text-gray-600 hover:underline"
            >
              Planos
            </button>
            <button
              onClick={scrollToHelp}
              className="text-sm text-gray-600 hover:underline"
            >
              Como usar?
            </button>
            <button onClick={logout} className="text-sm text-red-600">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <DashboardPanel sheetSize={sheetSize} setSheetSize={setSheetSize} />

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="min-h-[720px]">
            <SkuUploadWizard onComplete={() => setLibraryVersion(v => v + 1)} />
          </div>

          <div className="min-h-[720px]">
            <Library
              version={libraryVersion}
              onPreview={items => {
                setPreviewItems(items)
                setSelectedJob(null)
              }}
            />
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-6 min-h-[200px] flex items-center justify-center">
          {previewItems && previewItems.length > 0 && !selectedJob ? (
            <PreviewPanel
              key={`preview-${previewItems.length}`}
              items={previewItems}
              sheetSize={sheetSize}
              onJobCreated={jobId => {
                setSelectedJob(jobId)
                setPreviewItems(null)
              }}
              onReset={() => setPreviewItems(null)}
            />
          ) : selectedJob ? (
            <PreviewPanel key={`job-${selectedJob}`} jobId={selectedJob} />
          ) : (
            <div className="text-gray-400 text-sm text-center">
              Preencha as quantidades na biblioteca e clique em “Gerar folhas”.
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow p-6">
          <JobHistory
            onSelect={jobId => {
              setSelectedJob(jobId)
              setPreviewItems(null)
            }}
          />
        </section>

        <section
          id="footer-help"
          className="mt-20 border-t pt-10 grid grid-cols-1 md:grid-cols-3 gap-10 text-sm text-gray-600"
        >
          <div>
            <h3 className="font-semibold mb-2 text-gray-800">Como usar</h3>
            <ul className="space-y-1 list-disc pl-4">
              <li>Envie suas estampas no painel da esquerda.</li>
              <li>Informe corretamente os tamanhos e salve na biblioteca.</li>
              <li>Defina as quantidades que precisa na biblioteca.</li>
              <li>Clique em “Gerar folhas” para montar o layout.</li>
              <li>Abra a última folha do preview e veja se cabe mais estampas.</li>
              <li>Use as anotações para marcar devoluções ou camisetas prontas.</li>
              <li>Baixe o arquivo final e envie para impressão.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-gray-800">Sobre o PVTY</h3>
            <p>
              O PVTY é uma plataforma criada para automatizar a montagem de folhas de impressão
              para DTF. Nosso objetivo é reduzir desperdício, economizar tempo e padronizar
              o seu fluxo de produção.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-semibold mb-2 text-gray-800">Institucional & Suporte</h3>
            <a href="/termos" className="hover:underline">Termos de Uso</a>
            <a href="/privacidade" className="hover:underline">Política de Privacidade</a>
            <a href="/seguranca" className="hover:underline">Segurança</a>
            <a
              href="https://wa.me/5516999653885"
              target="_blank"
              className="text-green-600 hover:underline mt-2"
            >
              Falar com suporte no WhatsApp
            </a>
          </div>
        </section>
      </main>
    </div>
  )
}
