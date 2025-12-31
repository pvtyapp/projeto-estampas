import { supabase } from '@/lib/supabaseClient'

export async function api(path: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()

  if (!data.session?.access_token) {
    throw new Error('No session available')
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${data.session.access_token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }

  return res.json()
}
