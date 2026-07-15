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

// ============================================================
// 견적서 (Estimate)
// ============================================================

export type ClientType = '기획사용' | '참가사용'
export type EstimateStatus = '작성중' | '발송완료' | '계약완료' | '취소'
// 기본 제공 분류 목록(드롭다운 프리셋). item_master/estimate_items의 실제 category 값은
// 사용자가 직접 입력한 새 분류도 허용하므로 string이며, 이 목록에 없을 수 있다.
export type EstimateCategory =
  | '시스템 자재' | '마감재' | '바닥' | '그래픽' | '전기/조명' | '가구/비품' | '운송'
  | '인건비' | '관리비' | '기타'
  | '목재' | '필름' | '영상장비' | '현장비'
export type EstimateUnit = '개' | '회배' | '식' | '세트' | '회' | '장' | '미터' | '대' | '시간' | 'KW' | '모듈'
export type AdjustmentType = 'overhead' | 'company_profit' | 'discount'
export type AdjustmentValueType = 'rate' | 'fixed'

export interface ItemMaster {
  id: string
  client_type: ClientType
  category: string
  name: string
  size?: string
  description?: string
  unit: EstimateUnit
  default_execution_unit_cost: number
  quoted_unit_price: number
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface PricingPolicy {
  id: string
  client_type: ClientType
  category: EstimateCategory | 'OVERALL'
  default_margin_rate: number
  min_margin_rate: number
  max_margin_rate: number
  created_at: string
}

export interface RiskOption {
  id: string
  name: string
  default_rate: number
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface Estimate {
  id: string
  estimate_number: string
  client_type: ClientType
  client_name: string
  client_contact?: string
  exhibition_name?: string
  venue?: string
  booth_size?: string
  booth_type?: string
  install_date?: string
  dismantle_date?: string
  pm?: string
  valid_until?: string
  project_id?: string
  status: EstimateStatus
  review_required: boolean
  vat_rate: number
  notes?: string
  customer_notes?: string
  payment_terms?: string
  included_scope?: string
  excluded_scope?: string
  execution_total: number
  final_total_amount: number
  expected_profit: number
  final_profit_rate: number
  created_at: string
  updated_at: string
}

export interface EstimateItem {
  id: string
  estimate_id: string
  item_master_id?: string
  category: string
  name: string
  size?: string
  description?: string
  unit: EstimateUnit
  execution_unit_cost: number
  quantity: number
  margin_rate: number
  execution_total: number
  quoted_unit_price: number
  quoted_amount: number
  show_to_client: boolean
  supplier?: string
  memo?: string
  is_custom: boolean
  sort_order: number
  created_at: string
}

export interface EstimateAdjustment {
  id: string
  estimate_id: string
  adjustment_type: AdjustmentType
  label?: string
  value_type: AdjustmentValueType
  value: number
  created_at: string
}

export interface EstimateRisk {
  id: string
  estimate_id: string
  risk_option_id?: string
  name: string
  rate: number
  created_at: string
}

// ============================================================
// 계약서 (Contract)
// ============================================================

export type ContractStatus = '작성중' | '발송완료' | '서명완료' | '계산서요청' | '완료' | '취소'

export interface Contract {
  id: string
  contract_number: string
  estimate_id?: string
  client_name: string
  client_contact?: string
  client_business_number?: string
  client_representative?: string
  client_address?: string
  exhibition_name?: string
  venue?: string
  booth_size?: string
  install_date?: string
  dismantle_date?: string
  total_amount: number
  contract_date?: string
  payment_terms?: string
  special_terms?: string
  notes?: string
  status: ContractStatus
  invoice_requested_at?: string
  created_at: string
  updated_at: string
}
