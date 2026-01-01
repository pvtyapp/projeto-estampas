export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL!

  const raw = localStorage.getItem(
    Object.keys(localStorage).find(k => k.endsWith('-auth-token')) || ''
  )

  if (!raw) {
    throw new Error('Token não encontrado no storage')
  }

  const { access_token } = JSON.parse(raw)

  if (!access_token) {
    throw new Error('access_token ausente')
  }

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
