import { ReactNode } from 'react'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies as nextCookies } from 'next/headers'
import SessionProvider from './providers/SessionProvider'

export default async function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  const cookieStore = await nextCookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name, options) {
          cookieStore.delete({ name, ...options })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  return (
    <html lang="pt-BR">
      <body>
        <SessionProvider initialSession={session} />
        {children}
      </body>
    </html>
  )
}
