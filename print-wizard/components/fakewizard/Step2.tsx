"use client"

import { useState } from "react"

type StepProps = {
  data: any
  setData: React.Dispatch<React.SetStateAction<any>>
  onNext: () => void
  onBack: () => void
}

type Print = {
  id: string
  name: string
  sku: string
  width_cm: number
  height_cm: number
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

export default function Step2({ data, setData, onNext, onBack }: StepProps) {
  const blocks: Block[] = data.blocks || []
  const [localBlocks, setLocalBlocks] = useState<Block[]>(blocks)
  const [loading, setLoading] = useState(false)

  function handleQtyChange(blockId: string, bpId: string, qty: number) {
    setLocalBlocks(prev =>
      prev.map(b =>
        b.id === blockId
          ? {
              ...b,
              prints: b.prints.map(p =>
                p.id === bpId ? { ...p, qty } : p
              )
            }
          : b
      )
    )
  }

  function handleNext() {
    setData((prev: any) => ({ ...prev, blocks: localBlocks }))
    onNext()
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Etapa 2 — Quantidades</h2>

      {localBlocks.map(block => (
        <div key={block.id} className="mb-6 border rounded p-4 bg-gray-50">
          <div className="font-semibold mb-2">{block.name}</div>

          {block.prints.map(bp => (
            <div
              key={bp.id}
              className="flex justify-between items-center mb-1 text-sm"
            >
              <span>{bp.print.name}</span>
              <input
                type="number"
                min={0}
                value={bp.qty}
                onChange={e =>
                  handleQtyChange(block.id, bp.id, Number(e.target.value))
                }
                className="border w-20 p-1 text-right"
              />
            </div>
          ))}
        </div>
      ))}

      <div className="flex justify-between mt-6">
        <button onClick={onBack} className="px-4 py-2 border rounded">
          Voltar
        </button>
        <button
          onClick={handleNext}
          disabled={loading}
          className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
