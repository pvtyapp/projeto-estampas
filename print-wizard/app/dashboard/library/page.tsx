'use client'

import { useEffect, useState } from 'react'
import BlocksLibrary from '@/components/BlocksLibrary'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

export default function LibraryPage() {
  const [prints, setPrints] = useState([])
  const [blocks, setBlocks] = useState([])

  useEffect(() => {
    async function load() {
      const session = JSON.parse(localStorage.getItem('sb-session') || 'null')
      const token = session?.access_token

      const headers: any = token
        ? { Authorization: `Bearer ${token}` }
        : {}

      const p = await fetch(`${API}/prints`, { headers }).then(r => r.json())
      const b = await fetch(`${API}/blocks`, { headers }).then(r => r.json())

      setPrints(p)
      setBlocks(b)
    }

    load()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Biblioteca de Estampas</h1>
      <BlocksLibrary initialPrints={prints} initialBlocks={blocks} />
    </div>
  )
}
