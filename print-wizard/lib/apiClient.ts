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
  const { data } = await supabase.auth.getSession()
  let token = data.session?.access_token

  if (!token) {
    token = getAccessTokenFromStorage()
  }

  if (!token) {
    console.warn('⚠️ Nenhum token disponível ainda — abortando request:', path)
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
