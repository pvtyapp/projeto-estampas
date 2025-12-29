import { ReactNode } from 'react'
import AppHeader from '@/components/AppHeader'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="pt-6">{children}</main>
    </div>
  )
}
