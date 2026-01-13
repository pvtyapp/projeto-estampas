'use client'

import { useState } from 'react'
import FiscalModal from './FiscalModal'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function UserMenu() {
  const [open, setOpen] = useState(false)
  const [showFiscal, setShowFiscal] = useState(false)
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="px-3 py-1 rounded-lg border bg-white shadow"
      >
        ⚙
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-white border rounded-xl shadow z-50">
          <button className="menu-item" onClick={() => alert('Em breve')}>
            Como usar
          </button>
          <button className="menu-item" onClick={() => router.push('/plans')}>
            Planos
          </button>
          <button
            className="menu-item"
            onClick={() => {
              setShowFiscal(true)
              setOpen(false)
            }}
          >
            Dados pessoais
          </button>
          <button className="menu-item text-red-600" onClick={handleSignOut}>
            Sair
          </button>
        </div>
      )}

      {showFiscal && <FiscalModal onClose={() => setShowFiscal(false)} />}
    </div>
  )
}
