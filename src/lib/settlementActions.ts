import { supabase } from './supabase'
import type { Settlement, SettlementItem } from '../types'

export interface SettlementFull {
  settlement: Settlement
  items: SettlementItem[]
}

export async function fetchSettlementByContractId(contractId: string): Promise<SettlementFull | null> {
  const { data: settlement, error } = await supabase
    .from('settlements')
    .select('*')
    .eq('contract_id', contractId)
    .maybeSingle()
  if (error) throw error
  if (!settlement) return null

  const { data: items, error: itemsError } = await supabase
    .from('settlement_items')
    .select('*')
    .eq('settlement_id', settlement.id)
    .order('sort_order')
  if (itemsError) throw itemsError

  return { settlement: settlement as Settlement, items: (items || []) as SettlementItem[] }
}

// Contracts.tsx 목록에서 "정산서 작성" / "정산서 보기"를 구분하기 위한 존재 여부 맵.
export async function fetchSettlementIdsByContractIds(contractIds: string[]): Promise<Record<string, string>> {
  if (contractIds.length === 0) return {}
  const { data, error } = await supabase
    .from('settlements')
    .select('id, contract_id')
    .in('contract_id', contractIds)
  if (error) throw error
  const map: Record<string, string> = {}
  for (const row of data || []) map[row.contract_id as string] = row.id as string
  return map
}

export type SettlementItemDraft = Omit<SettlementItem, 'id' | 'settlement_id' | 'created_at' | 'sort_order'>

export async function saveSettlement(
  contractId: string,
  estimateId: string | undefined,
  notes: string,
  items: SettlementItemDraft[]
): Promise<void> {
  const actualTotalCost = items.reduce((sum, i) => sum + i.actual_amount, 0)

  const { data: settlement, error } = await supabase
    .from('settlements')
    .upsert(
      { contract_id: contractId, estimate_id: estimateId || null, actual_total_cost: actualTotalCost, notes },
      { onConflict: 'contract_id' }
    )
    .select('id')
    .single()
  if (error) throw error

  const settlementId = settlement.id as string
  const { error: deleteError } = await supabase.from('settlement_items').delete().eq('settlement_id', settlementId)
  if (deleteError) throw deleteError

  if (items.length > 0) {
    const { error: insertError } = await supabase.from('settlement_items').insert(
      items.map((item, i) => ({ ...item, settlement_id: settlementId, sort_order: i }))
    )
    if (insertError) throw insertError
  }
}
