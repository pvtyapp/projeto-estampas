'use client'

import { supabase } from '@/lib/supabaseClient'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL!

function getAccessTokenFromStorage() {
  if (typeof window === 'undefined') return null

  const key = Object.keys(localStorage).find(k => k.endsWith('-auth-token'))
  if (!key) return null

  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const data = JSON.parse(raw)
    return data?.access_token || null
  } catch {
    return null
  }
}

export async function api(path: string, options: RequestInit = {}) {
  if (typeof window === 'undefined') {
    throw new Error('api() foi chamado no server — isso é inválido')
  }

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token || getAccessTokenFromStorage()

  if (!token) {
    console.error('❌ Token não encontrado no client')
    throw new Error('Usuário não autenticado')
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${token}`,
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }

  return res.json()
}
