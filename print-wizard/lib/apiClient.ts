export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL!

  const rawKey = Object.keys(localStorage).find(k =>
    k.endsWith('-auth-token')
  )

  if (!rawKey) {
    throw new Error('Token não encontrado no localStorage')
  }

  const raw = localStorage.getItem(rawKey)
  if (!raw) throw new Error('Token não encontrado')

  const { access_token } = JSON.parse(raw)
  if (!access_token) throw new Error('access_token ausente')

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }

  return res.json()
}
