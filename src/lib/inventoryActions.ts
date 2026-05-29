import { supabase } from './supabase'

const today = () => new Date().toISOString().split('T')[0]

export async function createInitialStock(itemId: string, quantity: number, notes?: string) {
  const { error } = await supabase.from('inventory_transactions').insert({
    item_id: itemId,
    transaction_type: '입고',
    quantity,
    transaction_date: today(),
    notes: notes ?? '최초입력',
  })
  if (error) throw error
}

export async function createInbound(itemId: string, quantity: number, date?: string, notes?: string) {
  const { error } = await supabase.from('inventory_transactions').insert({
    item_id: itemId,
    transaction_type: '입고',
    quantity,
    transaction_date: date ?? today(),
    notes: notes ?? null,
  })
  if (error) throw error
}

export async function createProjectOutbound(
  itemId: string,
  projectId: string,
  quantity: number,
  date?: string,
  notes?: string
) {
  const { error } = await supabase.from('inventory_transactions').insert({
    item_id: itemId,
    project_id: projectId,
    transaction_type: '출고',
    quantity,
    transaction_date: date ?? today(),
    notes: notes ?? null,
  })
  if (error) throw error
}

export async function createProjectReturn(
  itemId: string,
  projectId: string,
  quantity: number,
  date?: string,
  notes?: string
) {
  const { error } = await supabase.from('inventory_transactions').insert({
    item_id: itemId,
    project_id: projectId,
    transaction_type: '반입',
    quantity,
    transaction_date: date ?? today(),
    notes: notes ?? null,
  })
  if (error) throw error
}

// delta > 0: stock increase, delta < 0: stock decrease (stored as '재고조정' with abs quantity and direction in notes)
export async function createAdjustment(itemId: string, delta: number, notes?: string) {
  if (delta === 0) return
  const { error } = await supabase.from('inventory_transactions').insert({
    item_id: itemId,
    transaction_type: delta > 0 ? '재고조정' : '손실',
    quantity: Math.abs(delta),
    transaction_date: today(),
    notes: notes ?? '재고조정',
  })
  if (error) throw error
}

export async function createDiscard(itemId: string, quantity: number, notes?: string) {
  const { error } = await supabase.from('inventory_transactions').insert({
    item_id: itemId,
    transaction_type: '폐기',
    quantity,
    transaction_date: today(),
    notes: notes ?? null,
  })
  if (error) throw error
}
