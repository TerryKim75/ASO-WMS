export interface ResearchEvent {
  event_id: string; year: number; name: string; alias: string; start: string; end: string; period: string;
  city: string; venue: string; organizer: string; organizer_role: string; industry: string; items: string;
  exhibitors: number | null; visitors: number | null; stats_year: number | null; stat_basis: string;
  website: string; phone: string; email: string; source: string; stat_source: string; note: string;
  status: string; group_scope: string; priority: string
}
export interface ResearchCompany {
  id: string; company_id: string; name: string; name_en: string; manufacturer: string; evidence: string;
  products: string; country: string; address: string; contact: string; contact_email: string; contact_phone: string;
  email: string; phone: string; website: string; shows: string; years: string; show_count: number;
  contact_status: string; evidence_source: string; participation_source: string; contact_source: string; note: string
}
export interface Participation {
  id: string; companyId: string; company_id: string; name: string; year: number; show: string; booth: string;
  products: string; status: string; country: string; source: string; source_list: string; note: string; eventId: string | null
}
export interface ScaleRecord {
  name: string; alias: string; date: string; venue: string; stats_year: number; exhibitors: number | null;
  visitors: number | null; scope: string; source: string
}
export interface Coverage {
  year: number; show: string; records: number; companies: number; manufacturer: number; named: number;
  email: number; phone: number; source: string; note: string
}
export interface ResearchData {
  schemaVersion: number; version: string; events: ResearchEvent[]; companies: ResearchCompany[];
  participations: Participation[]; stats: ScaleRecord[]; coverage: Coverage[];
  audit: {manufacturer_candidates: number; with_email: number; with_phone: number; named_contacts: number}
}
export const SALES_STAGES = ['미접촉', '접촉 예정', '연락 완료', '상담 중', '견적 제안', '수주', '보류', '수신거부'] as const
export type SalesStage = typeof SALES_STAGES[number]
export interface MarketingLead {
  company_key: string; company_name: string; source_company_id: string; dataset_version: string;
  stage: SalesStage; owner: string; priority: string; next_contact_date: string | null;
  notes: string; revision: number; updated_at: string
}
export interface MarketingActivity {
  id: string; company_key: string; body: string; actor: string; kind: string; created_at: string
}
