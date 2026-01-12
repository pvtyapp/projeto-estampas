import { supabase } from './supabaseClient'

function normalizePath(path: string) {
  if (!path.startsWith('/')) return '/' + path
  return path
}

export async function api(path: string, options: RequestInit = {}) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL

  if (!API_URL) {
    throw new Error('Missing NEXT_PUBLIC_API_URL')
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const base = API_URL.replace(/\/$/, '')

  const res = await fetch(`${base}${normalizePath(path)}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }

  return res.json()
}
