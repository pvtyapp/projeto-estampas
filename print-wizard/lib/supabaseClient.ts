import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  }
)

if (typeof window !== 'undefined') {
  // @ts-ignore
  window.supabase = supabase
  supabase.auth.getSession()
}
