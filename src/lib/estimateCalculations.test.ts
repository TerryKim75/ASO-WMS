import { describe, it, expect } from 'vitest'
import {
  calculateItemExecutionTotal,
  calculateItemQuotedAmount,
  calculateItemQuotedTotal,
  deriveMarginRate,
  calculateEstimateExecutionTotal,
  calculateEstimateQuotedTotal,
  calculateOverheadAmount,
  calculateRiskAmount,
  calculateCompanyProfitAmount,
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

describe('calculateItemQuotedTotal / deriveMarginRate (견적단가 직접입력 모델)', () => {
  it('multiplies the master-defined quoted unit price by quantity directly (no margin formula)', () => {
    expect(calculateItemQuotedTotal(15_000, 4)).toBe(60_000)
  })

  it('derives margin rate backward from execution vs quoted totals', () => {
    // 실행가 60,000 / 견적가 100,000 → 이윤율 40%
    expect(deriveMarginRate(60_000, 100_000)).toBeCloseTo(0.4, 5)
  })

  it('guards divide-by-zero when quoted total is 0', () => {
    expect(deriveMarginRate(0, 0)).toBe(0)
  })
})

describe('calculateEstimateQuotedTotal', () => {
  it('sums quoted_unit_price * quantity only for rows with quantity > 0', () => {
    const items = [
      { quantity: 2, quoted_unit_price: 10_000 },
      { quantity: 0, quoted_unit_price: 999_999 }, // excluded
      { quantity: 1, quoted_unit_price: 5_000 },
    ]
    expect(calculateEstimateQuotedTotal(items)).toBe(25_000)
  })
})

describe('overhead / risk / company profit / discount chain', () => {
  it('computes overhead(제작관리비) as a rate of 공급가(quoted total), not 실행가', () => {
    expect(calculateOverheadAmount(10_000_000, 0.05)).toBe(500_000)
  })

  it('sums selected risk rates and applies to execution total', () => {
    // 일정촉박 +3%, 야간설치 +3% => 6%
    expect(calculateRiskAmount(10_000_000, [0.03, 0.03])).toBe(600_000)
  })

  it('computes company profit(기업이윤) as a rate or fixed amount, floored at 0', () => {
    expect(calculateCompanyProfitAmount(10_000_000, 'rate', 0.02)).toBe(200_000)
    expect(calculateCompanyProfitAmount(10_000_000, 'fixed', 300_000)).toBe(300_000)
    expect(calculateCompanyProfitAmount(10_000_000, 'fixed', -1000)).toBe(0)
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
      // 실행단가 100,000 x 10 = 실행가 1,000,000 / 견적단가 181,818.18 x 10 ≒ 견적가 1,818,181.82 (이윤율 45%에 해당하는 값)
      items: [{ execution_unit_cost: 100_000, quantity: 10, quoted_unit_price: 181_818.18 }],
      overheadRate: 0.05, // 공급가(견적가) 기준
      selectedRiskRates: [],
      companyProfitType: 'rate',
      companyProfitValue: 0,
      discountType: 'rate',
      discountValue: 0.3, // large discount, should push margin below 40% minimum
      vatRate: 0.1,
      overallPolicy: 참가사용정책,
    })

    expect(totals.executionTotal).toBe(1_000_000)
    expect(totals.quotedTotal).toBeCloseTo(1_818_181.8, 0)
    expect(totals.overheadAmount).toBeCloseTo(90_909.09, 1) // 견적가(공급가) 기준 5%
    expect(totals.companyProfitAmount).toBe(0)
    expect(totals.preDiscountSupply).toBeCloseTo(1_909_090.9, 0)
    expect(totals.discountAmount).toBeCloseTo(572_727.27, 1)
    expect(totals.finalSupplyAmount).toBeCloseTo(1_336_363.6, 0)
    expect(totals.margin.isBelowMinimum).toBe(true)
    expect(totals.margin.status).toBe('below')
  })

  it('stays in-range with no discount', () => {
    const totals = calculateEstimateTotals({
      // 견적단가를 실행단가의 (1/0.55)배로 잡으면 이윤율 45%가 된다
      items: [{ execution_unit_cost: 1_000_000, quantity: 1, quoted_unit_price: 1_000_000 / 0.55 }],
      overheadRate: 0,
      selectedRiskRates: [],
      companyProfitType: 'rate',
      companyProfitValue: 0,
      discountType: 'rate',
      discountValue: 0,
      vatRate: 0.1,
      overallPolicy: 참가사용정책,
    })

    expect(totals.finalProfitRate).toBeCloseTo(0.45, 5)
    expect(totals.margin.status).toBe('in-range')
  })

  it('directly applies quoted unit price without any margin-rate formula', () => {
    // 실행단가 5,000 x 2 = 10,000 / 견적단가 8,000 x 2 = 16,000 (마진 공식과 무관하게 그대로 적용)
    const totals = calculateEstimateTotals({
      items: [{ execution_unit_cost: 5_000, quantity: 2, quoted_unit_price: 8_000 }],
      overheadRate: 0,
      selectedRiskRates: [],
      companyProfitType: 'rate',
      companyProfitValue: 0,
      discountType: 'rate',
      discountValue: 0,
      vatRate: 0.1,
      overallPolicy: 참가사용정책,
    })

    expect(totals.executionTotal).toBe(10_000)
    expect(totals.quotedTotal).toBe(16_000)
    expect(totals.finalSupplyAmount).toBe(16_000)
  })

  it('adds company profit (기업이윤) on top of the supply amount before discount', () => {
    // 견적가 1,000,000 + 기업이윤 정액 200,000 = 할인전공급가 1,200,000
    const totals = calculateEstimateTotals({
      items: [{ execution_unit_cost: 500_000, quantity: 1, quoted_unit_price: 1_000_000 }],
      overheadRate: 0,
      selectedRiskRates: [],
      companyProfitType: 'fixed',
      companyProfitValue: 200_000,
      discountType: 'rate',
      discountValue: 0,
      vatRate: 0.1,
      overallPolicy: 참가사용정책,
    })

    expect(totals.companyProfitAmount).toBe(200_000)
    expect(totals.preDiscountSupply).toBe(1_200_000)
    expect(totals.finalSupplyAmount).toBe(1_200_000)
    expect(totals.expectedProfit).toBe(700_000) // 1,200,000 - 500,000
  })
})
