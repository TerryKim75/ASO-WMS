import { describe, it, expect } from 'vitest'
import {
  calculateItemExecutionTotal,
  calculateItemQuotedAmount,
  calculateEstimateExecutionTotal,
  calculateOverheadAmount,
  calculateRiskAmount,
  calculateDiscountAmount,
  calculateFinalSupplyAmount,
  calculateVatAmount,
  calculateFinalTotalAmount,
  calculateExpectedProfit,
  calculateFinalProfitRate,
  validateMinimumProfitRate,
  calculateEstimateTotals,
} from './estimateCalculations'

describe('calculateItemExecutionTotal', () => {
  it('multiplies unit cost by quantity', () => {
    expect(calculateItemExecutionTotal(50000, 3)).toBe(150000)
  })
})

describe('calculateItemQuotedAmount', () => {
  it('applies margin-based pricing (판매가 = 실행가 / (1 - 이윤율))', () => {
    // 명세서 예시: 실행가 1,000,000원, 목표이윤율 40% → 판매가 1,666,667원
    expect(calculateItemQuotedAmount(1_000_000, 0.4)).toBeCloseTo(1_666_666.67, 1)
  })

  it('returns 0 when margin rate is 100% or more (guard)', () => {
    expect(calculateItemQuotedAmount(1_000_000, 1)).toBe(0)
  })
})

describe('client-type worked examples (명세서 22)', () => {
  it('기획사용: 실행가 10,000,000 @ 37% → 판매가 ~15,873,016, 예상이익 ~5,873,016', () => {
    const executionTotal = 10_000_000
    const marginRate = 0.37
    const quoted = calculateItemQuotedAmount(executionTotal, marginRate)
    expect(quoted).toBeCloseTo(15_873_015.87, 1)
    expect(calculateExpectedProfit(quoted, executionTotal)).toBeCloseTo(5_873_015.87, 1)
    expect(calculateFinalProfitRate(calculateExpectedProfit(quoted, executionTotal), quoted)).toBeCloseTo(0.37, 5)
  })

  it('참가사용: 실행가 10,000,000 @ 45% → 판매가 ~18,181,818, 예상이익 ~8,181,818', () => {
    const executionTotal = 10_000_000
    const marginRate = 0.45
    const quoted = calculateItemQuotedAmount(executionTotal, marginRate)
    expect(quoted).toBeCloseTo(18_181_818.18, 1)
    expect(calculateExpectedProfit(quoted, executionTotal)).toBeCloseTo(8_181_818.18, 1)
    expect(calculateFinalProfitRate(calculateExpectedProfit(quoted, executionTotal), quoted)).toBeCloseTo(0.45, 5)
  })
})

describe('calculateEstimateExecutionTotal', () => {
  it('sums execution_total only for rows with quantity > 0', () => {
    const items = [
      { execution_total: 100_000, quantity: 2 },
      { execution_total: 999_999, quantity: 0 }, // excluded even if execution_total is nonzero
      { execution_total: 50_000, quantity: 1 },
    ]
    expect(calculateEstimateExecutionTotal(items)).toBe(150_000)
  })
})

describe('overhead / risk / discount chain', () => {
  it('computes overhead as a rate of execution total', () => {
    expect(calculateOverheadAmount(10_000_000, 0.05)).toBe(500_000)
  })

  it('sums selected risk rates and applies to execution total', () => {
    // 일정촉박 +3%, 야간설치 +3% => 6%
    expect(calculateRiskAmount(10_000_000, [0.03, 0.03])).toBe(600_000)
  })

  it('clamps rate-based discount within [0, preDiscountSupply]', () => {
    expect(calculateDiscountAmount(1_000_000, 'rate', 0.1)).toBe(100_000)
    expect(calculateDiscountAmount(1_000_000, 'fixed', 5_000_000)).toBe(1_000_000)
    expect(calculateDiscountAmount(1_000_000, 'fixed', -1000)).toBe(0)
  })

  it('computes VAT and final total', () => {
    expect(calculateFinalSupplyAmount(1_000_000, 100_000)).toBe(900_000)
    expect(calculateVatAmount(900_000, 0.1)).toBe(90_000)
    expect(calculateFinalTotalAmount(900_000, 90_000)).toBe(990_000)
  })

  it('guards divide-by-zero in final profit rate', () => {
    expect(calculateFinalProfitRate(0, 0)).toBe(0)
  })
})

describe('validateMinimumProfitRate', () => {
  const 기획사용정책 = { default_margin_rate: 0.37, min_margin_rate: 0.35, max_margin_rate: 0.4 }

  it('flags below-minimum margin (기획사용 < 35%)', () => {
    const result = validateMinimumProfitRate(0.3, 기획사용정책)
    expect(result.isBelowMinimum).toBe(true)
    expect(result.status).toBe('below')
  })

  it('marks in-range margin correctly', () => {
    const result = validateMinimumProfitRate(0.37, 기획사용정책)
    expect(result.isBelowMinimum).toBe(false)
    expect(result.status).toBe('in-range')
  })

  it('marks above-target margin correctly', () => {
    const result = validateMinimumProfitRate(0.45, 기획사용정책)
    expect(result.isBelowMinimum).toBe(false)
    expect(result.status).toBe('above')
  })
})

describe('calculateEstimateTotals (orchestrator)', () => {
  const 참가사용정책 = { default_margin_rate: 0.45, min_margin_rate: 0.4, max_margin_rate: 0.5 }

  it('runs the full chain and flags a discount that pushes margin below minimum', () => {
    const totals = calculateEstimateTotals({
      items: [{ execution_unit_cost: 100_000, quantity: 10, margin_rate: 0.45 }], // execution total 1,000,000
      overheadRate: 0.05,
      selectedRiskRates: [],
      discountType: 'rate',
      discountValue: 0.3, // large discount, should push margin below 40% minimum
      vatRate: 0.1,
      overallPolicy: 참가사용정책,
    })

    // quotedTotal = 1,000,000 / (1-0.45) = 1,818,181.82; + overhead(50,000) = preDiscountSupply
    expect(totals.executionTotal).toBe(1_000_000)
    expect(totals.quotedTotal).toBeCloseTo(1_818_181.82, 1)
    expect(totals.overheadAmount).toBe(50_000)
    expect(totals.preDiscountSupply).toBeCloseTo(1_868_181.82, 1)
    expect(totals.discountAmount).toBeCloseTo(560_454.55, 1)
    expect(totals.finalSupplyAmount).toBeCloseTo(1_307_727.27, 1)
    expect(totals.margin.isBelowMinimum).toBe(true)
    expect(totals.margin.status).toBe('below')
  })

  it('stays in-range with no discount', () => {
    const totals = calculateEstimateTotals({
      items: [{ execution_unit_cost: 1_000_000, quantity: 1, margin_rate: 0.45 }],
      overheadRate: 0,
      selectedRiskRates: [],
      discountType: 'rate',
      discountValue: 0,
      vatRate: 0.1,
      overallPolicy: 참가사용정책,
    })

    expect(totals.finalProfitRate).toBeCloseTo(0.45, 5)
    expect(totals.margin.status).toBe('in-range')
  })
})
