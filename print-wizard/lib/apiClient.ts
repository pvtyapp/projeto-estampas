import { supabase } from './supabaseClient'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

export async function api(path: string, options: RequestInit = {}) {
  // Garante que o Supabase terminou de hidratar a sessão
  let session = (await supabase.auth.getSession()).data.session

  if (!session) {
    await new Promise(resolve => setTimeout(resolve, 50))
    session = (await supabase.auth.getSession()).data.session
  }

  if (!session) {
    throw new Error('Usuário não autenticado')
  }

  const token = session.access_token

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
    Authorization: `Bearer ${token}`,
  }

  const res = await fetch(`${API_URL}${path}`, {
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
