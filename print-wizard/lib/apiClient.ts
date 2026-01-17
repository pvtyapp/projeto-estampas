// lib/apiClient.ts

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

type ApiOptions = {
  method?: string
  headers?: Record<string, string>
  body?: any
  signal?: AbortSignal
}

export async function api(path: string, options: ApiOptions = {}) {
  const session = await supabase.auth.getSession()
  const token = session.data.session?.access_token

  const headers: Record<string, string> = {
    ...(options.headers || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let body = options.body

  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(body)
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body,
    signal: options.signal,
  })

  if (!res.ok) {
    let detail = ''
    try {
      const err = await res.json()
      detail = err.detail || ''
    } catch {}
    throw new Error(`API error ${res.status} ${detail}`)
  }

  return res.json()
}
