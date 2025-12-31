'use client'

import { supabase } from '@/lib/supabaseClient'

export default function AuthPage() {
  async function login() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <button
        onClick={login}
        className="px-6 py-3 rounded-xl bg-black text-white"
      >
        Entrar com Google
      </button>
    </div>
  )
}
