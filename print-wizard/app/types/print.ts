export type Slot = {
  url?: string
  width_cm?: number
  height_cm?: number
}

export type Print = {
  id: string
  name: string
  sku: string
  slots?: {
    front?: Slot
    back?: Slot
    extra?: Slot
  }
}
