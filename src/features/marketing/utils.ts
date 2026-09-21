import type { MarketingLead, ResearchCompany, SalesStage } from './types'
export function safeUrl(value: string): string | null {
  const text = value.trim()
  if (!text || /[\s<>]/.test(text) || /^(javascript|data|file|vbscript):/i.test(text)) return null
  try { const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`); return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') && !url.username && !url.password ? url.href : null } catch { return null }
}
export const splitValues = (value: string) => [...new Set(value.split(/\s*;\s*|\n/).map(s => s.trim()).filter(Boolean))]
export const isManufacturer = (c: ResearchCompany) => c.manufacturer.startsWith('제조 근거 있음') || c.manufacturer.startsWith('제조 분류')
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export const actionable = (stage: SalesStage) => !['수주', '보류', '수신거부'].includes(stage)
export const isDue = (lead: MarketingLead, today: string) => !!lead.next_contact_date && lead.next_contact_date <= today && actionable(lead.stage)
export function csvCell(value: unknown): string {
  let text = String(value ?? '')
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
export function downloadCsv(name: string, headers: string[], rows: unknown[][]) {
  const blob = new Blob(['\uFEFF' + [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function matches(value: string, search: string) {
  return value.normalize('NFKC').toLocaleLowerCase().includes(search.trim().normalize('NFKC').toLocaleLowerCase())
}
