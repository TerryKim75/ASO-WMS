import type { ClientType, ItemMaster } from '../types'

const HEADERS = ['고객유형', '분류', '품목명', '상세내용', '단위', '실행단가', '견적단가']

export async function exportItemMasterToExcel(rows: ItemMaster[]) {
  const XLSX = await import('xlsx')

  const sorted = [...rows].sort((a, b) => {
    if (a.client_type !== b.client_type) return a.client_type.localeCompare(b.client_type)
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    return a.sort_order - b.sort_order
  })

  const aoa: (string | number)[][] = [
    HEADERS,
    ...sorted.map((r) => [
      r.client_type, r.category, r.name, r.size || '', r.unit,
      r.default_execution_unit_cost, r.quoted_unit_price,
    ]),
  ]

  const worksheet = XLSX.utils.aoa_to_sheet(aoa)
  worksheet['!cols'] = [
    { wch: 10 }, { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 8 }, { wch: 14 }, { wch: 14 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '견적단가')
  XLSX.writeFile(workbook, `견적단가_전체_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export interface ParsedItemMasterRow {
  client_type: ClientType
  category: string
  name: string
  size: string
  unit: string
  default_execution_unit_cost: number
  quoted_unit_price: number
}

export class ItemMasterImportError extends Error {}

export async function parseItemMasterExcelFile(file: File): Promise<ParsedItemMasterRow[]> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new ItemMasterImportError('엑셀 파일에서 시트를 찾을 수 없습니다.')

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  if (raw.length === 0) throw new ItemMasterImportError('업로드한 파일에 데이터가 없습니다.')

  return raw.map((row, i) => {
    const rowNum = i + 2 // 헤더 다음 줄부터 시작
    const clientType = String(row['고객유형'] ?? '').trim()
    if (clientType !== '기획사용' && clientType !== '참가사용') {
      throw new ItemMasterImportError(`${rowNum}행: 고객유형은 "기획사용" 또는 "참가사용"이어야 합니다. (입력값: "${clientType}")`)
    }
    const category = String(row['분류'] ?? '').trim()
    if (!category) throw new ItemMasterImportError(`${rowNum}행: 분류가 비어 있습니다.`)
    const name = String(row['품목명'] ?? '').trim()
    if (!name) throw new ItemMasterImportError(`${rowNum}행: 품목명이 비어 있습니다.`)
    const unit = String(row['단위'] ?? '').trim()
    if (!unit) throw new ItemMasterImportError(`${rowNum}행: 단위가 비어 있습니다.`)

    return {
      client_type: clientType as ClientType,
      category,
      name,
      size: String(row['상세내용'] ?? '').trim(),
      unit,
      default_execution_unit_cost: Number(row['실행단가']) || 0,
      quoted_unit_price: Number(row['견적단가']) || 0,
    }
  })
}
