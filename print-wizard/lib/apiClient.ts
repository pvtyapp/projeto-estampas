import { supabase } from "@/lib/supabaseClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const token = session?.access_token;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Erro na API");
  }

  return res.json();
}
