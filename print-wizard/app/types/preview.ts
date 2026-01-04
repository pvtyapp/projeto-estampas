// app/types/preview.ts

export type PreviewItem = {
  print_id: string
  qty: number
}

export type PreviewJobRequest = {
  items: PreviewItem[]
}

export type GeneratedFile = {
  id: string
  public_url: string
  page_index: number
}

export type JobStatus =
  | 'preview'
  | 'preview_done'
  | 'queued'
  | 'processing'
  | 'done'
  | 'error'
