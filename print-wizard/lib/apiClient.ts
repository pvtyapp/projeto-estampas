import { supabase } from './supabaseClient'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

export async function api(path: string, options: RequestInit = {}) {
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    console.error('Erro ao obter sessão:', error)
  }

  const token = data?.session?.access_token

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  if (typeof token === 'string' && token.includes('.')) {
    headers['Authorization'] = `Bearer ${token}`
  } else {
    console.warn('Token inválido ou ausente:', token)
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }

  return res.json()
}
