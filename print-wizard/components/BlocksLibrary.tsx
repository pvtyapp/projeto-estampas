'use client'

import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

type Print = { id: string; name: string }
type BlockPrint = { id: string; print: Print; position: number; qty: number }
type Block = { id: string; name: string; prints: BlockPrint[] }

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') {
    return { 'Content-Type': 'application/json' }
  }

  try {
    const sessionRaw = localStorage.getItem('sb-session')
    if (!sessionRaw) return { 'Content-Type': 'application/json' }

    const session = JSON.parse(sessionRaw)
    const token = session?.access_token

    if (!token) return { 'Content-Type': 'application/json' }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  } catch {
    return { 'Content-Type': 'application/json' }
  }
}

function SortableItem({ print }: { print: Print }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: print.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className="border rounded p-2 bg-white cursor-grab"
    >
      {print.name}
    </div>
  )
}

type Props = {
  initialPrints: Print[]
  initialBlocks: Block[]
}

export default function BlocksLibrary({ initialPrints, initialBlocks }: Props) {
  const [prints, setPrints] = useState<Print[]>(initialPrints)
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks)

  async function createBlock() {
    const name = prompt('Nome do bloco:')
    if (!name) return

    const res = await fetch(`${API}/blocks`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    })

    const block = await res.json()
    setBlocks(prev => [...prev, { ...block, prints: [] }])
  }

  async function onDragEnd(event: any) {
    const { active, over } = event
    if (!over) return

    const print = prints.find(p => p.id === active.id)
    if (!print) return

    const blockId = over.id

    await fetch(`${API}/blocks/${blockId}/prints`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ print_id: print.id, position: 0, qty: 1 }),
    })

    setPrints(prev => prev.filter(p => p.id !== print.id))
    setBlocks(prev =>
      prev.map(b =>
        b.id === blockId
          ? { ...b, prints: [...b.prints, { id: crypto.randomUUID(), print, position: 0, qty: 1 }] }
          : b
      )
    )
  }

  return (
    <div className="flex gap-6">
      <div className="w-1/4 space-y-4">
        <button onClick={createBlock} className="bg-black text-white px-3 py-2 rounded">
          + Novo bloco
        </button>

        {blocks.map(block => (
          <div key={block.id} id={block.id} className="border rounded p-3 min-h-[80px]">
            <h3 className="font-bold mb-2">{block.name}</h3>

            <SortableContext items={block.prints.map(p => p.id)} strategy={rectSortingStrategy}>
              <div className="space-y-2">
                {block.prints.map(bp => (
                  <SortableItem key={bp.id} print={bp.print} />
                ))}
              </div>
            </SortableContext>
          </div>
        ))}
      </div>

      <div className="flex-1">
        <h2 className="font-bold mb-2">Estampas</h2>
        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={prints.map(p => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-4 gap-4">
              {prints.map(p => (
                <SortableItem key={p.id} print={p} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}
