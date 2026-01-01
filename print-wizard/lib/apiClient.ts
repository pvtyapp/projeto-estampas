import { supabase } from './supabaseClient'

const API_BASE = process.env.NEXT_PUBLIC_API_URL

if (!API_BASE) {
  console.warn('⚠️ NEXT_PUBLIC_API_URL não configurada')
}

type ApiOptions = RequestInit & {
  skipAuth?: boolean
}

async function getToken() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session?.access_token || null
}

export async function api(path: string, options: ApiOptions = {}) {
  const headers = new Headers(options.headers || {})

  if (!options.skipAuth) {
    const token = await getToken()
    if (!token) throw new Error('Usuário não autenticado')

    headers.set('Authorization', `Bearer ${token}`)
  }

  headers.set('Content-Type', 'application/json')

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (!res.ok) {
    let detail = ''
    try {
      const json = await res.json()
      detail = json.detail || JSON.stringify(json)
    } catch {}

    throw new Error(`API ${res.status}: ${detail || res.statusText}`)
  }

  return res.json()
}
