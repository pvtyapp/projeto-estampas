'use client'
import { useState } from 'react'

export default function NewJob() {
  const [items, setItems] = useState<any[]>([])

  const submit = async () => {
    await fetch('/api/print-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    })
  }

  return (
    <div>
      <h1>Novo Job</h1>
      {/* Aqui entra seu wizard */}
      <button onClick={submit}>Gerar</button>
    </div>
  )
}
