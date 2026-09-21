import { describe, expect, it } from 'vitest'
import { csvCell, safeUrl, localDate, isDue, isManufacturer } from './utils'
import type { MarketingLead, ResearchCompany } from './types'

describe('marketing outreach safeguards', () => {
  it('excludes closed and opted-out leads from due followups', () => {
    const lead = {stage: '상담 중', next_contact_date: '2026-09-18'} as MarketingLead
    expect(isDue(lead, '2026-09-19')).toBe(true)
    for (const stage of ['수신거부','수주','보류'] as const) expect(isDue({...lead,stage}, '2026-09-19')).toBe(false)
    expect(isDue({...lead,next_contact_date:null}, '2026-09-19')).toBe(false)
    expect(isDue({...lead,next_contact_date:'2026-09-20'}, '2026-09-19')).toBe(false)
  })
  it('never makes unsafe research URLs executable', () => {
    for (const url of ['javascript:alert(1)','data:text/html,hi','file:///etc/passwd','https://user:secret@example.com','invalid url']) expect(safeUrl(url)).toBeNull()
    expect(safeUrl('www.example.com/contact')).toBe('https://www.example.com/contact')
  })
  it('escapes spreadsheets formula injection and CSV quotes', () => {
    expect(csvCell('=CMD()')).toBe('"\'=CMD()"')
    expect(csvCell('a,"b"')).toBe('"a,""b"""')
    expect(csvCell(null)).toBe('""')
  })
  it('does not promote an uncertain manufacturer', () => {
    expect(isManufacturer({manufacturer:'제조 여부 확인 필요'} as ResearchCompany)).toBe(false)
    expect(isManufacturer({manufacturer:'제조 관련 표현(확인 필요)'} as ResearchCompany)).toBe(false)
    expect(isManufacturer({manufacturer:'제조 분류(전시회 등록)'} as ResearchCompany)).toBe(true)
  })
  it('uses the user local calendar for reminders', () => expect(localDate(new Date(2026,0,2,1))).toBe('2026-01-02'))
})
