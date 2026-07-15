import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchEstimateFull, fetchPricingPolicies, type EstimateFull } from './estimateActions'
import { calculateEstimateTotals, type EstimateTotals, type MarginPolicy } from './estimateCalculations'
import type { PricingPolicy } from '../types'

export function useEstimateWithTotals(id: string | undefined) {
  const [full, setFull] = useState<EstimateFull | null>(null)
  const [pricingPolicies, setPricingPolicies] = useState<PricingPolicy[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [data, policies] = await Promise.all([fetchEstimateFull(id), fetchPricingPolicies()])
      setFull(data)
      setPricingPolicies(policies)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const overallPolicy: MarginPolicy = useMemo(() => {
    if (!full) return { default_margin_rate: 0, min_margin_rate: 0, max_margin_rate: 1 }
    const p = pricingPolicies.find((p) => p.client_type === full.estimate.client_type && p.category === 'OVERALL')
    return p || { default_margin_rate: 0, min_margin_rate: 0, max_margin_rate: 1 }
  }, [pricingPolicies, full])

  const overheadRate = full?.adjustments.find((a) => a.adjustment_type === 'overhead')?.value ?? 0
  const overheadLabel = full?.adjustments.find((a) => a.adjustment_type === 'overhead')?.label || '제작관리비'
  const discountAdj = full?.adjustments.find((a) => a.adjustment_type === 'discount')
  const companyProfitAdj = full?.adjustments.find((a) => a.adjustment_type === 'company_profit')

  const totals: EstimateTotals | null = useMemo(() => {
    if (!full) return null
    return calculateEstimateTotals({
      items: full.items.map((i) => ({
        execution_unit_cost: i.execution_unit_cost, quantity: i.quantity, quoted_unit_price: i.quoted_unit_price,
      })),
      overheadRate,
      selectedRiskRates: full.risks.map((r) => r.rate),
      companyProfitType: companyProfitAdj?.value_type || 'rate',
      companyProfitValue: companyProfitAdj?.value || 0,
      discountType: discountAdj?.value_type || 'rate',
      discountValue: discountAdj?.value || 0,
      vatRate: full.estimate.vat_rate,
      overallPolicy,
    })
  }, [full, overheadRate, discountAdj, companyProfitAdj, overallPolicy])

  return { full, totals, overheadLabel, loading, reload: load }
}
