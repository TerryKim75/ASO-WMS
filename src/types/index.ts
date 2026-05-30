export type Category = string
export type TransactionType = '입고' | '생산입고' | '출고' | '반입' | '손실' | '팩킹' | '파손' | '분실' | '재고조정' | '폐기'
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
  construction_date?: string
  demolition_date?: string
  design_file_url?: string
  drawing_file_url?: string
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

export type BidStatus = '대기' | '낙찰' | '거절'

export interface ProjectBid {
  id: string
  project_id: string
  bidder_name: string
  bidder_phone: string
  proposed_price: number
  note?: string
  status: BidStatus
  created_at: string
}

export interface ItemWithStock extends Item {
  current_stock: number
  total_in: number
  total_out: number
  total_return: number
  total_loss: number
}

export interface ProjectItem {
  id: string
  project_id: string
  item_id: string
  planned_quantity: number
  notes?: string
  created_at: string
}
