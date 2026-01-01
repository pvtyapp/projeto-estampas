import { supabase } from './supabaseClient'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

export async function api(path: string, options: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers = new Headers(options.headers || {})
  headers.set('Content-Type', 'application/json')

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Erro ${res.status}`)
  }

  return res.json()
}
