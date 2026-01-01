import { supabase } from './supabaseClient'

const API_BASE = process.env.NEXT_PUBLIC_API_URL

async function getAccessToken(): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession()

  if (sessionData.session?.access_token) {
    return sessionData.session.access_token
  }

  // fallback: tenta forçar refresh
  const { data: refreshed } = await supabase.auth.refreshSession()
  if (refreshed.session?.access_token) {
    return refreshed.session.access_token
  }

  console.warn('⚠️ Nenhum access_token disponível')
  return null
}

export async function api(path: string, options: RequestInit = {}) {
  const token = await getAccessToken()

  const headers = new Headers(options.headers || {})

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  headers.set('Content-Type', 'application/json')

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }

  return res.json()
}
