'use client'

import { useEffect, useState } from 'react'
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core'
import { supabase } from '@/lib/supabaseClient'

type Print = {
  id: string
  name: string
}

type Block = {
  id: string
  name: string
  prints: Print[]
}

export default function Library() {
  const [blocks, setBlocks] = useState<Block[]>([])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase.from('blocks').select(`
      id, name,
      block_prints(print_id, prints(id, name))
    `)

    const formatted = (data || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      prints: (b.block_prints || []).map((bp: any) => bp.prints),
    }))

    setBlocks(formatted)
  }

  function handleDrag(event: any) {
    const { active, over } = event
    if (!over) return

    const printId = active.id
    const targetBlockId = over.id

    // aqui depois a gente salva no backend
    console.log('Mover', printId, 'para bloco', targetBlockId)
  }

  return (
    <DndContext onDragEnd={handleDrag}>
      <div className="flex gap-6 flex-wrap">
        {blocks.map(b => (
          <BlockBubble key={b.id} block={b} />
        ))}
      </div>
    </DndContext>
  )
}

function BlockBubble({ block }: { block: Block }) {
  const { setNodeRef } = useDroppable({ id: block.id })

  return (
    <div
      ref={setNodeRef}
      className="rounded-full border bg-white p-6 w-64 h-64 flex flex-col items-center justify-center shadow-sm"
    >
      <h3 className="font-semibold mb-2">{block.name}</h3>
      <div className="space-y-1">
        {block.prints.map(p => (
          <PrintItem key={p.id} print={p} />
        ))}
      </div>
    </div>
  )
}

function PrintItem({ print }: { print: Print }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: print.id,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
      className="px-3 py-1 bg-gray-100 rounded-full text-sm cursor-grab"
    >
      {print.name}
    </div>
  )
}
