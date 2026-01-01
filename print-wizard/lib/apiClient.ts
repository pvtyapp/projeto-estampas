import { supabase } from './supabaseClient'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

export async function api(path: string, options: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Erro na requisição')
  }

  return res.json()
}
