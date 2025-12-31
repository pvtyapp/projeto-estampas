import { Session } from '@supabase/supabase-js'

export async function api(path: string, session: Session, options: RequestInit = {}) {
  if (!session?.access_token) {
    throw new Error('No session available')
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }

  return res.json()
}
