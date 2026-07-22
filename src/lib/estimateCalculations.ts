export type DiscountValueType = 'rate' | 'fixed'

export function calculateItemExecutionTotal(executionUnitCost: number, quantity: number): number {
  return executionUnitCost * quantity
}

// 목표이윤율 기반 판매가 (참고용으로 유지 — 현재 UI 흐름에서는 견적단가를 직접 입력받으므로
// 사용되지 않지만, 이윤율만으로 가격을 산정해야 하는 향후 케이스를 위해 남겨둔다).
export function calculateItemQuotedAmount(executionTotal: number, marginRate: number): number {
  if (marginRate >= 1) return 0
  return executionTotal / (1 - marginRate)
}

// 품목마스터에 등록된 견적단가(단가) × 수량 — 견적서 작성 시 판매가는 이 값을 직접 사용한다.
export function calculateItemQuotedTotal(quotedUnitPrice: number, quantity: number): number {
  return quotedUnitPrice * quantity
}

// 실행가 대비 견적단가로부터 역산한 이윤율 — 입력값이 아니라 표시/검증용 파생값이다.
export function deriveMarginRate(executionTotal: number, quotedTotal: number): number {
  if (quotedTotal === 0) return 0
  return (quotedTotal - executionTotal) / quotedTotal
}

export function calculateEstimateExecutionTotal(
  items: { execution_total: number; quantity: number }[]
): number {
  return items.reduce((sum, i) => (i.quantity > 0 ? sum + i.execution_total : sum), 0)
}

// 항목별 판매가(견적단가 × 수량)의 합 — 할인전공급가의 기반이 되는 값.
// 실행가합계가 아니라 이 값을 기준으로 삼아야 항목별 견적단가가 최종 견적금액에 반영된다.
export function calculateEstimateQuotedTotal(
  items: { quantity: number; quoted_unit_price: number }[]
): number {
  return items.reduce(
    (sum, i) => (i.quantity > 0 ? sum + calculateItemQuotedTotal(i.quoted_unit_price, i.quantity) : sum),
    0
  )
}

// 제작관리비(간접비) — 실행가가 아니라 공급가(항목별 판매가 합계) 기준으로 계산한다.
export function calculateOverheadAmount(quotedTotal: number, overheadRate: number): number {
  return quotedTotal * overheadRate
}

export function calculateRiskAmount(executionTotal: number, selectedRiskRates: number[]): number {
  const totalRiskRate = selectedRiskRates.reduce((sum, r) => sum + r, 0)
  return executionTotal * totalRiskRate
}

// 공과잡비 — 제작관리비(공급가 기준)와 별개로, 실행가 총합 기준으로 자동 계산되는 관리비 항목(기본 5%).
export function calculatePublicDuesAmount(executionTotal: number, publicDuesRate: number): number {
  return executionTotal * publicDuesRate
}

// 기업이윤 — 조정 항목 중 마지막에 추가로 입력하는 금액/비율. 공급가 기준으로 계산하며
// 할인전공급가에 간접비/리스크비용과 함께 더해진다.
export function calculateCompanyProfitAmount(
  quotedTotal: number,
  valueType: DiscountValueType,
  value: number
): number {
  const amount = valueType === 'rate' ? quotedTotal * value : value
  return Math.max(amount, 0)
}

export function calculatePreDiscountSupplyAmount(
  quotedTotal: number,
  overheadAmount: number,
  riskAmount: number,
  companyProfitAmount: number,
  publicDuesAmount: number
): number {
  return quotedTotal + overheadAmount + riskAmount + companyProfitAmount + publicDuesAmount
}

export function calculateDiscountAmount(
  preDiscountSupply: number,
  valueType: DiscountValueType,
  value: number
): number {
  const amount = valueType === 'rate' ? preDiscountSupply * value : value
  return Math.min(Math.max(amount, 0), preDiscountSupply)
}

export function calculateFinalSupplyAmount(preDiscountSupply: number, discountAmount: number): number {
  return preDiscountSupply - discountAmount
}

export function calculateVatAmount(finalSupplyAmount: number, vatRate: number): number {
  return finalSupplyAmount * vatRate
}

export function calculateFinalTotalAmount(finalSupplyAmount: number, vatAmount: number): number {
  return finalSupplyAmount + vatAmount
}

export function calculateExpectedProfit(finalSupplyAmount: number, executionTotal: number): number {
  return finalSupplyAmount - executionTotal
}

export function calculateFinalProfitRate(expectedProfit: number, finalSupplyAmount: number): number {
  if (finalSupplyAmount === 0) return 0
  return expectedProfit / finalSupplyAmount
}

export interface MarginPolicy {
  default_margin_rate: number
  min_margin_rate: number
  max_margin_rate: number
}

export interface MarginValidationResult {
  isBelowMinimum: boolean
  status: 'below' | 'in-range' | 'above'
  targetRate: number
  minRate: number
  maxRate: number
}

export function validateMinimumProfitRate(
  finalProfitRate: number,
  overallPolicy: MarginPolicy
): MarginValidationResult {
  const { default_margin_rate: targetRate, min_margin_rate: minRate, max_margin_rate: maxRate } = overallPolicy
  const isBelowMinimum = finalProfitRate < minRate
  const status: MarginValidationResult['status'] = isBelowMinimum
    ? 'below'
    : finalProfitRate > maxRate
      ? 'above'
      : 'in-range'
  return { isBelowMinimum, status, targetRate, minRate, maxRate }
}

export interface EstimateTotalsInput {
  items: { execution_unit_cost: number; quantity: number; quoted_unit_price: number }[]
  overheadRate: number
  selectedRiskRates: number[]
  companyProfitType: DiscountValueType
  companyProfitValue: number
  publicDuesRate: number
  discountType: DiscountValueType
  discountValue: number
  vatRate: number
  overallPolicy: MarginPolicy
}

export interface EstimateTotals {
  executionTotal: number
  quotedTotal: number
  overheadAmount: number
  riskAmount: number
  companyProfitAmount: number
  publicDuesAmount: number
  preDiscountSupply: number
  discountAmount: number
  finalSupplyAmount: number
  vatAmount: number
  finalTotalAmount: number
  expectedProfit: number
  finalProfitRate: number
  margin: MarginValidationResult
}

export function calculateEstimateTotals(input: EstimateTotalsInput): EstimateTotals {
  const itemsWithTotals = input.items.map((i) => ({
    execution_total: calculateItemExecutionTotal(i.execution_unit_cost, i.quantity),
    quantity: i.quantity,
    quoted_unit_price: i.quoted_unit_price,
  }))
  const executionTotal = calculateEstimateExecutionTotal(itemsWithTotals)
  const quotedTotal = calculateEstimateQuotedTotal(itemsWithTotals)
  const overheadAmount = calculateOverheadAmount(quotedTotal, input.overheadRate)
  const riskAmount = calculateRiskAmount(executionTotal, input.selectedRiskRates)
  const companyProfitAmount = calculateCompanyProfitAmount(quotedTotal, input.companyProfitType, input.companyProfitValue)
  const publicDuesAmount = calculatePublicDuesAmount(executionTotal, input.publicDuesRate)
  const preDiscountSupply = calculatePreDiscountSupplyAmount(quotedTotal, overheadAmount, riskAmount, companyProfitAmount, publicDuesAmount)
  const discountAmount = calculateDiscountAmount(preDiscountSupply, input.discountType, input.discountValue)
  const finalSupplyAmount = calculateFinalSupplyAmount(preDiscountSupply, discountAmount)
  const vatAmount = calculateVatAmount(finalSupplyAmount, input.vatRate)
  const finalTotalAmount = calculateFinalTotalAmount(finalSupplyAmount, vatAmount)
  const expectedProfit = calculateExpectedProfit(finalSupplyAmount, executionTotal)
  const finalProfitRate = calculateFinalProfitRate(expectedProfit, finalSupplyAmount)
  const margin = validateMinimumProfitRate(finalProfitRate, input.overallPolicy)

  return {
    executionTotal,
    quotedTotal,
    overheadAmount,
    riskAmount,
    companyProfitAmount,
    publicDuesAmount,
    preDiscountSupply,
    discountAmount,
    finalSupplyAmount,
    vatAmount,
    finalTotalAmount,
    expectedProfit,
    finalProfitRate,
    margin,
  }
}
