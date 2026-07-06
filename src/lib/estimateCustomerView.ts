import type { EstimateItem, EstimateUnit } from '../types'
import type { EstimateTotals } from './estimateCalculations'

// 고객 제출용 견적서에 들어갈 수 있는 필드만 명시적으로 나열한 타입.
// EstimateItem/EstimateTotals에 원가·이윤율 관련 필드가 추가되어도 이 타입에는 존재하지 않으므로
// 실수로 고객 화면에 노출될 수 없다.
export interface CustomerLineItem {
  id: string
  category: string
  name: string
  size?: string
  description?: string
  unit: EstimateUnit
  quantity: number
  quoted_amount: number
}

export interface CustomerSummary {
  preDiscountSupply: number
  discountAmount: number
  finalSupplyAmount: number
  vatAmount: number
  finalTotalAmount: number
}

export function toCustomerLineItems(items: EstimateItem[]): CustomerLineItem[] {
  return items
    .filter((i) => i.show_to_client && i.quantity > 0)
    .map((i) => ({
      id: i.id,
      category: i.category,
      name: i.name,
      size: i.size,
      description: i.description,
      unit: i.unit,
      quantity: i.quantity,
      quoted_amount: i.quoted_amount,
    }))
}

export function toCustomerSummary(totals: EstimateTotals): CustomerSummary {
  return {
    preDiscountSupply: totals.preDiscountSupply,
    discountAmount: totals.discountAmount,
    finalSupplyAmount: totals.finalSupplyAmount,
    vatAmount: totals.vatAmount,
    finalTotalAmount: totals.finalTotalAmount,
  }
}
