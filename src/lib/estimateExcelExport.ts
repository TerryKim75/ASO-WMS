import type { CustomerEstimateHeader } from '../components/estimates/CustomerEstimateView'
import type { CustomerLineItem, CustomerSummary } from './estimateCustomerView'
import { ESTIMATE_CATEGORIES } from '../components/estimates/EstimateItemsAccordion'
import type { EstimateCategory } from '../types'

function formatDate(date?: string) {
  if (!date) return '-'
  return date.split('T')[0].replace(/-/g, '.')
}

// 품목의 sort_order는 카테고리별로 1부터 다시 시작하는 값이라 전체 목록을 그대로
// sort_order로만 정렬하면 카테고리가 뒤섞일 수 있다. 다른 견적서 출력 화면들과 동일하게
// 사전 정의된 카테고리 순서(+커스텀 카테고리는 뒤에)로 다시 그룹핑해 순서를 고정한다.
function orderLineItems(lineItems: CustomerLineItem[]): CustomerLineItem[] {
  const categories = [
    ...ESTIMATE_CATEGORIES,
    ...Array.from(new Set(lineItems.map((i) => i.category))).filter(
      (c) => !ESTIMATE_CATEGORIES.includes(c as EstimateCategory)
    ),
  ]
  return categories.flatMap((category) => lineItems.filter((i) => i.category === category))
}

export async function exportCustomerEstimateToExcel(
  header: CustomerEstimateHeader,
  lineItems: CustomerLineItem[],
  summary: CustomerSummary
) {
  const XLSX = await import('xlsx')
  const rows: (string | number)[][] = [
    ['견적서'],
    [],
    ['고객명', header.client_name, '', '견적번호', header.estimate_number],
    ['전시회', header.exhibition_name || '-', '', '작성일', formatDate(header.created_at)],
    ['전시장', header.venue || '-', '', '유효기간', formatDate(header.valid_until)],
    ['부스면적', header.booth_size || '-', '', '결제조건', header.payment_terms || '-'],
    [],
    ['구분', '항목', '상세내용', '수량', '단위', '공급가'],
  ]

  orderLineItems(lineItems).forEach((item) => {
    rows.push([item.category, item.name, item.size || '-', item.quantity, item.unit, item.quoted_amount])
  })

  rows.push([])
  rows.push(['', '', '', '', '공급가', summary.preDiscountSupply])
  if (summary.discountAmount > 0) rows.push(['', '', '', '', '할인', -summary.discountAmount])
  rows.push(['', '', '', '', 'VAT (10%)', summary.vatAmount])
  rows.push(['', '', '', '', '최종 견적금액', summary.finalTotalAmount])

  if (header.included_scope) { rows.push([]); rows.push(['포함 사항', header.included_scope]) }
  if (header.excluded_scope) rows.push(['불포함 사항', header.excluded_scope])
  if (header.customer_notes) { rows.push([]); rows.push(['비고', header.customer_notes]) }

  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  worksheet['!cols'] = [
    { wch: 14 }, { wch: 26 }, { wch: 18 }, { wch: 8 }, { wch: 8 }, { wch: 16 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '견적서')
  XLSX.writeFile(workbook, `견적서_${header.estimate_number}_${header.client_name}.xlsx`)
}
