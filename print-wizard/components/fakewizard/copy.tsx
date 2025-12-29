"use client"

import { useEffect, useState } from "react"
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core"
import { listPrints, listBlocks, createBlock } from "@/app/services/api"

type StepProps = {
  data: any
  setData: React.Dispatch<React.SetStateAction<any>>
  onNext: () => void
}

type Print = {
  id: string
  name: string
  sku: string
}

type BlockPrint = {
  id: string
  qty: number
  print: Print
}

type Block = {
  id: string
  name: string
  prints: BlockPrint[]
}

type Kit = {
  sku: string
  baseName: string
  prints: {
    front?: Print
    back?: Print
    extra?: Print
  }
}

export default function Step1({ data, setData, onNext }: StepProps) {
  const [kits, setKits] = useState<Kit[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [newBlock, setNewBlock] = useState("")

  useEffect(() => {
    listPrints().then((p: Print[]) => setKits(groupBySku(p)))
    listBlocks().then((b: Block[]) => setBlocks(b))
  }, [])

  function onDragEnd(event: any) {
    const { active, over } = event
    if (!over) return

    const data = active.data.current
    const blockId = over.id

    setBlocks(prev =>
      prev.map(b => {
        if (b.id !== blockId) return b

        if (data.type === "kit") {
          const prints = Object.values(data.kit.prints) as (Print | undefined)[]
          return { ...b, prints: mergePrints(b.prints, prints) }
        }

        if (data.type === "print") {
          return { ...b, prints: mergePrints(b.prints, [data.print]) }
        }

        return b
      })
    )
  }

  function mergePrints(existing: BlockPrint[], incoming: (Print | undefined)[]) {
    const map = new Map(existing.map(p => [p.print.id, p]))

    for (const p of incoming) {
      if (!p) continue
      if (map.has(p.id)) map.get(p.id)!.qty++
      else map.set(p.id, { id: crypto.randomUUID(), qty: 1, print: p })
    }

    return Array.from(map.values())
  }

  async function handleCreateBlock() {
    if (!newBlock) return
    const b = await createBlock(newBlock)
    setBlocks(prev => [...prev, { ...b, prints: [] }])
    setNewBlock("")
  }

  function handleNext() {
    setData((prev: any) => ({ ...prev, blocks }))
    onNext()
  }

  return (
    <DndContext onDragEnd={onDragEnd}>
      <div className="flex mt-8 border-t pt-6">

        {/* Biblioteca */}
        <div className="w-1/2 pr-4 border-r">
          <h2 className="font-bold mb-4">Biblioteca</h2>
          {kits.map(kit => <KitBubble key={kit.sku} kit={kit} />)}
        </div>

        {/* Blocos */}
        <div className="w-1/2 pl-4">
          <h2 className="font-bold mb-2">Blocos</h2>

          <div className="flex gap-2 mb-4">
            <input
              value={newBlock}
              onChange={e => setNewBlock(e.target.value)}
              className="border p-2 flex-1"
              placeholder="Nome do bloco"
            />
            <button onClick={handleCreateBlock} className="bg-black text-white px-3 rounded">
              Criar
            </button>
          </div>

          {blocks.map(block => (
            <BlockDrop key={block.id} block={block} setBlocks={setBlocks} />
          ))}

          <button
            onClick={handleNext}
            className="mt-4 bg-green-600 text-white px-4 py-2 rounded"
          >
            Continuar
          </button>
        </div>
      </div>
    </DndContext>
  )
}

// -------- Subcomponentes --------

function KitBubble({ kit }: { kit: Kit }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `kit-${kit.sku}`,
    data: { type: "kit", kit }
  })

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className="border rounded p-3 mb-2 cursor-grab bg-white shadow">
      <div className="font-semibold">{kit.baseName}</div>
      <div className="text-xs text-gray-500 mb-1">SKU: {kit.sku}</div>

      {Object.values(kit.prints).map(p => p && <PrintItem key={p.id} print={p} />)}
    </div>
  )
}

function PrintItem({ print }: { print: Print }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: print.id,
    data: { type: "print", print }
  })

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className="text-sm text-gray-600 cursor-grab flex justify-between">
      {print.name}
      <button className="text-xs text-blue-600">editar</button>
    </div>
  )
}

function BlockDrop({ block, setBlocks }: { block: Block; setBlocks: any }) {
  const { setNodeRef } = useDroppable({ id: block.id })

  function changeQty(id: string, qty: number) {
    setBlocks((prev: Block[]) =>
      prev.map(b =>
        b.id === block.id
          ? { ...b, prints: b.prints.map(p => p.id === id ? { ...p, qty } : p) }
          : b
      )
    )
  }

  return (
    <div ref={setNodeRef} className="border rounded p-3 mb-3 min-h-[80px] bg-gray-50">
      <div className="font-semibold mb-2">{block.name}</div>

      {block.prints.map(bp => (
        <div key={bp.id} className="flex justify-between text-sm items-center mb-1">
          <span>{bp.print.name}</span>
          <input
            type="number"
            min={1}
            value={bp.qty}
            onChange={e => changeQty(bp.id, Number(e.target.value))}
            className="border w-16 p-1 text-right"
          />
        </div>
      ))}
    </div>
  )
}

// -------- Helpers --------

function groupBySku(prints: Print[]): Kit[] {
  const map: Record<string, Kit> = {}

  for (const p of prints) {
    if (!map[p.sku]) {
      map[p.sku] = {
        sku: p.sku,
        baseName: p.name.replace(/ - (Frente|Verso|Costas|Adicional)$/i, ""),
        prints: {}
      }
    }

    if (/frente/i.test(p.name)) map[p.sku].prints.front = p
    else if (/verso|costas/i.test(p.name)) map[p.sku].prints.back = p
    else map[p.sku].prints.extra = p
  }

  return Object.values(map)
}
