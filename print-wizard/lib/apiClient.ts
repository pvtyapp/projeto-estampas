import { supabase } from "@/lib/supabaseClient";

export async function api(path: string, options: RequestInit = {}) {
  if (typeof window === "undefined") {
    throw new Error("api() called on server");
  }

  let session = null;

  for (let i = 0; i < 10; i++) {
    const res = await supabase.auth.getSession();
    session = res.data.session;
    if (session?.access_token) break;
    await new Promise((r) => setTimeout(r, 150));
  }

  if (!session?.access_token) {
    throw new Error("No session available");
  }

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  return res.json();
}
