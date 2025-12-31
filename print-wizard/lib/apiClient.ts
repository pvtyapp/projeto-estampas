// print-wizard/lib/apiClient.ts
'use client'

import { supabase } from './supabaseClient'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(txt || 'Erro na API')
  }

  return res.json()
}
