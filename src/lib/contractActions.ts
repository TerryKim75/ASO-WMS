import { supabase } from './supabase'
import type { Contract, ContractStatus } from '../types'

function todayCompact() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

export async function generateContractNumber(): Promise<string> {
  const prefix = `CT-${todayCompact()}-`
  const { data, error } = await supabase
    .from('contracts')
    .select('contract_number')
    .like('contract_number', `${prefix}%`)
    .order('contract_number', { ascending: false })
    .limit(1)
  if (error) throw error
  const last = data?.[0]?.contract_number as string | undefined
  const lastSeq = last ? Number(last.slice(prefix.length)) || 0 : 0
  return `${prefix}${String(lastSeq + 1).padStart(3, '0')}`
}

export async function fetchContractList(): Promise<Contract[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Contract[]
}

export async function fetchContract(id: string): Promise<Contract> {
  const { data, error } = await supabase.from('contracts').select('*').eq('id', id).single()
  if (error) throw error
  return data as Contract
}

export type ContractDraft = Omit<Contract, 'id' | 'created_at' | 'updated_at'> & { id?: string }

export async function saveContract(draft: ContractDraft): Promise<string> {
  const { data, error } = await supabase.from('contracts').upsert(draft).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function deleteContract(id: string) {
  const { error } = await supabase.from('contracts').delete().eq('id', id)
  if (error) throw error
}

export async function setContractStatus(id: string, status: ContractStatus) {
  const { error } = await supabase.from('contracts').update({ status }).eq('id', id)
  if (error) throw error
}

// 계산서 발행 요청 시각을 기록한다 (실제 메일 발송은 mailto 링크로 클라이언트에서 처리).
export async function markInvoiceRequested(id: string): Promise<string> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('contracts')
    .update({ invoice_requested_at: now, status: '계산서요청' })
    .eq('id', id)
  if (error) throw error
  return now
}
