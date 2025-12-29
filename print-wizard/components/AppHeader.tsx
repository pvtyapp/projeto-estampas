'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AppHeader() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(r => setEmail(r.data.user?.email || null))
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    location.href = '/'
  }

  return (
    <header className="border-b bg-white">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Olá, {email || '...'}
        </div>

        <div className="font-bold text-lg">PrintWizard</div>

        <button onClick={logout} className="text-sm underline text-gray-600">
          Sair
        </button>
      </div>
    </header>
  )
}
