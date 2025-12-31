import { supabase } from "@/lib/supabaseClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

async function waitForSession() {
  for (let i = 0; i < 10; i++) {
    const { data } = await supabase.auth.getSession()
    if (data.session) return data.session
    await new Promise(r => setTimeout(r, 200))
  }
  return null
}

export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const session = await waitForSession()
  const token = session?.access_token

  console.log("API token:", token ? "OK" : "MISSING")

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || "Erro na API")
  }

  return res.json()
}
