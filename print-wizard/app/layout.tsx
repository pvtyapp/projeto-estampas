import './globals.css'
import SessionProvider from './providers/SessionProvider'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-white text-gray-900">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
