import { supabase } from './supabaseClient'

const API_BASE = process.env.NEXT_PUBLIC_API_URL

function isValidJWT(token: string) {
  return token.split('.').length === 3
}

async function getToken() {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.error('Erro ao obter sessão:', error)
    return null
  }

  const token = data.session?.access_token || null

  console.log('🔐 Token obtido:', token)

  if (token && !isValidJWT(token)) {
    console.error('❌ Token não é JWT válido:', token)
    return null
  }

  return token
}

export async function api(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {})

  const token = await getToken()
  if (!token) throw new Error('Token inválido ou ausente')

  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Content-Type', 'application/json')

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('❌ API erro:', res.status, text)
    throw new Error(`API ${res.status}: ${text}`)
  }

  return res.json()
}
