export type DiscountValueType = 'rate' | 'fixed'

export function calculateItemExecutionTotal(executionUnitCost: number, quantity: number): number {
  return executionUnitCost * quantity
}

export function calculateItemQuotedAmount(executionTotal: number, marginRate: number): number {
  if (marginRate >= 1) return 0
  return executionTotal / (1 - marginRate)
}

export function calculateEstimateExecutionTotal(
  items: { execution_total: number; quantity: number }[]
): number {
  return items.reduce((sum, i) => (i.quantity > 0 ? sum + i.execution_total : sum), 0)
}

// 항목별 판매가(quoted_amount)의 합 — 할인전공급가의 기반이 되는 값.
// 실행가합계가 아니라 이 값을 기준으로 삼아야 항목별 이윤율이 최종 견적금액에 반영된다.
export function calculateEstimateQuotedTotal(
  items: { execution_total: number; quantity: number; margin_rate: number }[]
): number {
  return items.reduce(
    (sum, i) => (i.quantity > 0 ? sum + calculateItemQuotedAmount(i.execution_total, i.margin_rate) : sum),
    0
  )
}

export function calculateOverheadAmount(executionTotal: number, overheadRate: number): number {
  return executionTotal * overheadRate
}

export function calculateRiskAmount(executionTotal: number, selectedRiskRates: number[]): number {
  const totalRiskRate = selectedRiskRates.reduce((sum, r) => sum + r, 0)
  return executionTotal * totalRiskRate
}

export function calculatePreDiscountSupplyAmount(
  quotedTotal: number,
  overheadAmount: number,
  riskAmount: number
): number {
  return quotedTotal + overheadAmount + riskAmount
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
  items: { execution_unit_cost: number; quantity: number; margin_rate: number }[]
  overheadRate: number
  selectedRiskRates: number[]
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
    margin_rate: i.margin_rate,
  }))
  const executionTotal = calculateEstimateExecutionTotal(itemsWithTotals)
  const quotedTotal = calculateEstimateQuotedTotal(itemsWithTotals)
  const overheadAmount = calculateOverheadAmount(executionTotal, input.overheadRate)
  const riskAmount = calculateRiskAmount(executionTotal, input.selectedRiskRates)
  const preDiscountSupply = calculatePreDiscountSupplyAmount(quotedTotal, overheadAmount, riskAmount)
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
