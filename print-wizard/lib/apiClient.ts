'use client'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ''

type RequestOptions = RequestInit & {
  auth?: boolean
}

type AuthHeader = Record<string, string>

async function getAuthHeader(): Promise<AuthHeader> {
  const token = localStorage.getItem('token')
  if (!token) return {}

  return {
    Authorization: `Bearer ${token}`,
  }
}

export async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = options

  const authHeader = auth ? await getAuthHeader() : {}

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(headers as HeadersInit),
      ...(authHeader as HeadersInit),
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Erro na requisição')
  }

  return res.json()
}
