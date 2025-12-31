import './globals.css'
import { ReactNode } from 'react'
import AuthProvider from './providers/AuthProvider'
import { SupabaseProvider } from './providers/SupabaseProvider'

export const metadata = {
  title: 'PrintWizard',
  description: 'Geração automática de folhas de impressão',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-white text-gray-900">
        <SupabaseProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </SupabaseProvider>
      </body>
    </html>
  )
}
