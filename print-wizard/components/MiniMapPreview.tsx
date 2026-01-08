type PreviewFile = {
  id: string
  public_url: string
  page_index: number
}

type Props = {
  previews: PreviewFile[]
}

export default function MiniMapPreview({ previews }: Props) {
  if (!previews.length) return null

  return (
    <div className="mt-4 space-y-2">
      <div className="text-sm text-gray-600">
        {previews.length} folhas geradas (prévia)
      </div>

      <div className="grid grid-cols-4 gap-2">
        {previews.map(p => (
          <div
            key={p.id}
            className="relative border rounded-lg overflow-hidden bg-white shadow-sm"
          >
            <img
              src={p.public_url}
              alt={`Prévia ${p.page_index + 1}`}
              className="w-full object-contain"
            />

            {/* overlay leve para dar contraste */}
            <div className="absolute inset-0 bg-white/5" />

            {/* Marca d'água */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <img
                src="/pvty-watermark.svg"
                alt="Marca d’água"
                className="w-1/2 opacity-10 select-none"
              />
            </div>

            {/* Label pequeno no canto */}
            <div className="absolute top-1 right-1 text-[10px] font-semibold tracking-widest text-white bg-black/40 rounded px-1.5 py-0.5">
              PRÉVIA
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
