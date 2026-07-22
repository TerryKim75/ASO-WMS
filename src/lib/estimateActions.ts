import { supabase } from './supabase'
import type {
  Estimate,
  EstimateItem,
  EstimateAdjustment,
  EstimateRisk,
  ItemMaster,
  PricingPolicy,
  RiskOption,
  ClientType,
} from '../types'

function todayCompact() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

export async function generateEstimateNumber(): Promise<string> {
  const prefix = `EST-${todayCompact()}-`
  const { data, error } = await supabase
    .from('estimates')
    .select('estimate_number')
    .like('estimate_number', `${prefix}%`)
    .order('estimate_number', { ascending: false })
    .limit(1)
  if (error) throw error
  const last = data?.[0]?.estimate_number as string | undefined
  const lastSeq = last ? Number(last.slice(prefix.length)) || 0 : 0
  return `${prefix}${String(lastSeq + 1).padStart(3, '0')}`
}

export async function fetchEstimateList(): Promise<Estimate[]> {
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Estimate[]
}

export interface EstimateFull {
  estimate: Estimate
  items: EstimateItem[]
  adjustments: EstimateAdjustment[]
  risks: EstimateRisk[]
}

export async function fetchEstimateFull(id: string): Promise<EstimateFull> {
  const [estimateRes, itemsRes, adjustmentsRes, risksRes] = await Promise.all([
    supabase.from('estimates').select('*').eq('id', id).single(),
    supabase.from('estimate_items').select('*').eq('estimate_id', id).order('sort_order'),
    supabase.from('estimate_adjustments').select('*').eq('estimate_id', id),
    supabase.from('estimate_risks').select('*').eq('estimate_id', id),
  ])
  if (estimateRes.error) throw estimateRes.error
  if (itemsRes.error) throw itemsRes.error
  if (adjustmentsRes.error) throw adjustmentsRes.error
  if (risksRes.error) throw risksRes.error

  return {
    estimate: estimateRes.data as Estimate,
    items: (itemsRes.data || []) as EstimateItem[],
    adjustments: (adjustmentsRes.data || []) as EstimateAdjustment[],
    risks: (risksRes.data || []) as EstimateRisk[],
  }
}

export interface EstimateDraft {
  estimate: Omit<Estimate, 'id' | 'created_at' | 'updated_at'> & { id?: string }
  items: Omit<EstimateItem, 'id' | 'estimate_id' | 'created_at'>[]
  adjustments: Omit<EstimateAdjustment, 'id' | 'estimate_id' | 'created_at'>[]
  risks: Omit<EstimateRisk, 'id' | 'estimate_id' | 'created_at'>[]
}

// estimates row를 upsert한 뒤, 하위 항목/조정/리스크는 전량 삭제 후 재삽입한다.
// 트랜잭션이 아니므로 중간에 실패하면 일부만 반영될 수 있다 — 단일 편집자 내부 툴 기준으로 허용.
export async function saveEstimate(draft: EstimateDraft): Promise<string> {
  const { data: savedEstimate, error: estimateError } = await supabase
    .from('estimates')
    .upsert(draft.estimate)
    .select('id')
    .single()
  if (estimateError) throw estimateError
  const estimateId = savedEstimate.id as string

  const [delItems, delAdjustments, delRisks] = await Promise.all([
    supabase.from('estimate_items').delete().eq('estimate_id', estimateId),
    supabase.from('estimate_adjustments').delete().eq('estimate_id', estimateId),
    supabase.from('estimate_risks').delete().eq('estimate_id', estimateId),
  ])
  if (delItems.error) throw delItems.error
  if (delAdjustments.error) throw delAdjustments.error
  if (delRisks.error) throw delRisks.error

  if (draft.items.length > 0) {
    const { error } = await supabase
      .from('estimate_items')
      .insert(draft.items.map((item) => ({ ...item, estimate_id: estimateId })))
    if (error) throw error
  }
  if (draft.adjustments.length > 0) {
    const { error } = await supabase
      .from('estimate_adjustments')
      .insert(draft.adjustments.map((a) => ({ ...a, estimate_id: estimateId })))
    if (error) throw error
  }
  if (draft.risks.length > 0) {
    const { error } = await supabase
      .from('estimate_risks')
      .insert(draft.risks.map((r) => ({ ...r, estimate_id: estimateId })))
    if (error) throw error
  }

  return estimateId
}

export async function deleteEstimate(id: string) {
  const { error } = await supabase.from('estimates').delete().eq('id', id)
  if (error) throw error
}

// 승인 워크플로우는 phase 1 범위 밖 — 상태값만 두고 자유롭게 토글 가능하게 한다.
export async function setEstimateReviewRequired(id: string, reviewRequired: boolean) {
  const { error } = await supabase.from('estimates').update({ review_required: reviewRequired }).eq('id', id)
  if (error) throw error
}

export async function setEstimateStatus(id: string, status: Estimate['status']) {
  const { error } = await supabase.from('estimates').update({ status }).eq('id', id)
  if (error) throw error
}

export async function saveCustomItemToMaster(item: {
  client_type: ClientType
  category: ItemMaster['category']
  name: string
  size?: string
  description?: string
  unit: ItemMaster['unit']
  execution_unit_cost: number
  quoted_unit_price: number
}) {
  const { error } = await supabase.from('item_master').insert({
    client_type: item.client_type,
    category: item.category,
    name: item.name,
    size: item.size ?? null,
    description: item.description ?? null,
    unit: item.unit,
    default_execution_unit_cost: item.execution_unit_cost,
    quoted_unit_price: item.quoted_unit_price,
  })
  if (error) throw error
}

// 견적서 작성 시 선택된 고객유형의 견적단가만 불러온다.
export async function fetchItemMaster(clientType: ClientType): Promise<ItemMaster[]> {
  const { data, error } = await supabase
    .from('item_master')
    .select('*')
    .eq('is_active', true)
    .eq('client_type', clientType)
    .order('category')
    .order('sort_order')
  if (error) throw error
  return (data || []) as ItemMaster[]
}

// 견적단가 관리 화면용 — 비활성 품목도 함께 보여준다.
export async function fetchItemMasterForAdmin(): Promise<ItemMaster[]> {
  const { data, error } = await supabase
    .from('item_master')
    .select('*')
    .order('category')
    .order('sort_order')
  if (error) throw error
  return (data || []) as ItemMaster[]
}

export type ItemMasterDraft = Omit<ItemMaster, 'id' | 'created_at'> & { id?: string }

export async function upsertItemMasterRows(rows: ItemMasterDraft[]): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabase.from('item_master').upsert(rows)
  if (error) throw error
}

export async function deleteItemMasterRow(id: string) {
  const { error } = await supabase.from('item_master').delete().eq('id', id)
  if (error) throw error
}

// 엑셀 업로드로 견적단가 전체를 교체한다 — 기존 품목을 모두 삭제한 뒤 새 목록을 삽입한다.
// 호출 전에 반드시 파괴적 작업임을 사용자에게 확인받아야 한다.
export async function replaceAllItemMaster(rows: ItemMasterDraft[]): Promise<void> {
  const { error: deleteError } = await supabase.from('item_master').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (deleteError) throw deleteError
  if (rows.length === 0) return
  const { error: insertError } = await supabase.from('item_master').insert(rows)
  if (insertError) throw insertError
}

export async function fetchPricingPolicies(): Promise<PricingPolicy[]> {
  const { data, error } = await supabase.from('pricing_policies').select('*')
  if (error) throw error
  return (data || []) as PricingPolicy[]
}

export async function fetchRiskOptions(): Promise<RiskOption[]> {
  const { data, error } = await supabase
    .from('risk_options')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return (data || []) as RiskOption[]
}
