export type Category = string
export type TransactionType = '입고' | '출고' | '반입' | '손실'
export type ProjectStatus = '제안중' | '계약완료' | '시공진행' | '완료' | '취소'

export interface CategoryDef {
  id: string
  name: string
  color: string
  created_at: string
}

export interface ConstructionStaff {
  name: string
  phone: string
  email: string
}

export interface Item {
  id: string
  name: string
  category: Category
  unit: string
  description?: string
  image_url?: string
  created_at: string
  current_stock?: number
}

export interface WmsProject {
  id: string
  name: string
  exhibition?: string
  organizer?: string
  exhibitor?: string
  start_date?: string
  start_time?: string
  end_date?: string
  end_time?: string
  status: ProjectStatus
  manager?: string
  construction_staff?: ConstructionStaff[]
  shipping_date?: string
  return_date?: string
  notes?: string
  created_at: string
}

export interface InventoryTransaction {
  id: string
  item_id: string
  transaction_type: TransactionType
  quantity: number
  project_id?: string
  transaction_date: string
  notes?: string
  created_at: string
  items?: Item
  wms_projects?: WmsProject
}

export interface ItemWithStock extends Item {
  current_stock: number
  total_in: number
  total_out: number
  total_return: number
  total_loss: number
}
