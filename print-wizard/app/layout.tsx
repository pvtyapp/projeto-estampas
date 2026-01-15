import './globals.css'
import SessionProvider from './providers/SessionProvider'
import { UsageProvider } from './providers/UsageProvider'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-white text-gray-900">
        <SessionProvider>
          <UsageProvider>
            {children}
          </UsageProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
