import { supabase } from '@/lib/supabaseClient'

export async function api(path: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const session = data.session

  if (!session?.access_token) {
    throw new Error('No session token available')
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) throw new Error(await res.text())

  return res.json()
}
