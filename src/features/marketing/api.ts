import { supabase } from '../../lib/supabase'
import type { MarketingLead, MarketingActivity, ResearchCompany } from './types'

export async function loadLeads(): Promise<MarketingLead[]> {
  const rows: MarketingLead[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('marketing_leads').select('*').order('company_key').range(from, from + 999)
    if (error) throw new Error('영업 기록을 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.')
    rows.push(...(data || [])); if (!data || data.length < 1000) return rows
  }
}
export async function loadActivities(companyKey: string): Promise<MarketingActivity[]> {
  const { data, error } = await supabase.from('marketing_activities').select('*').eq('company_key', companyKey).order('created_at', { ascending: false }).limit(100)
  if (error) throw new Error('상담 이력을 불러오지 못했습니다.')
  return data || []
}
export async function saveLead(company: ResearchCompany, version: string, lead: Pick<MarketingLead, 'stage' | 'owner' | 'priority' | 'next_contact_date' | 'notes'>, revision: number, activity: string): Promise<MarketingLead> {
  const { data, error } = await supabase.rpc('marketing_save_lead', {
    p_company_key: company.id, p_company_name: company.name, p_source_company_id: company.company_id, p_dataset_version: version,
    p_stage: lead.stage, p_owner: lead.owner.trim(), p_priority: lead.priority, p_next_contact_date: lead.next_contact_date || null,
    p_notes: lead.notes.trim(), p_expected_revision: revision, p_activity: activity.trim(),
  })
  if (error) {
    if (error.message.includes('MARKETING_CONFLICT')) throw new Error('다른 사용자가 이 업체를 수정했습니다. 창을 닫고 영업 기록을 새로고침한 뒤 다시 저장해 주세요.')
    throw new Error('저장하지 못했습니다. 작성 내용은 유지됩니다. 연결 상태를 확인하고 다시 시도해 주세요.')
  }
  if (!data) throw new Error('저장 결과를 확인하지 못했습니다. 새로고침으로 저장 여부를 확인해 주세요.')
  return data as MarketingLead
}
