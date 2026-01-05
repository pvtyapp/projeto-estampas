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
    <div className="mt-4">
      <div className="text-sm text-gray-600 mb-2">
        {previews.length} folhas geradas (prévia)
      </div>

      <div className="grid grid-cols-4 gap-2">
        {previews.map(p => (
          <div key={p.id} className="relative border rounded overflow-hidden">
            <img src={p.public_url} className="w-full opacity-80" />

            <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs bg-black/30">
              PRÉVIA
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
