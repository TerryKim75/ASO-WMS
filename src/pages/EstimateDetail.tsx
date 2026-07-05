import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Edit2, AlertTriangle, ArrowLeft } from 'lucide-react'
import {
  fetchEstimateFull, fetchPricingPolicies, setEstimateReviewRequired, setEstimateStatus, type EstimateFull,
} from '../lib/estimateActions'
import { calculateEstimateTotals, type MarginPolicy } from '../lib/estimateCalculations'
import { toCustomerLineItems, toCustomerSummary } from '../lib/estimateCustomerView'
import InternalExecutionTable from '../components/estimates/InternalExecutionTable'
import CustomerEstimateView from '../components/estimates/CustomerEstimateView'
import EstimateSummaryPanel from '../components/estimates/EstimateSummaryPanel'
import { ESTIMATE_STATUS_COLORS, CLIENT_TYPE_COLORS } from './Estimates'
import type { EstimateStatus, PricingPolicy } from '../types'

type ViewMode = 'internal' | 'customer'

export default function EstimateDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [full, setFull] = useState<EstimateFull | null>(null)
  const [pricingPolicies, setPricingPolicies] = useState<PricingPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('internal')

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

  const handleToggleReview = async () => {
    if (!full) return
    await setEstimateReviewRequired(full.estimate.id, !full.estimate.review_required)
    load()
  }

  const handleStatusChange = async (status: EstimateStatus) => {
    if (!full) return
    await setEstimateStatus(full.estimate.id, status)
    load()
  }

  const overallPolicy: MarginPolicy = useMemo(() => {
    if (!full) return { default_margin_rate: 0, min_margin_rate: 0, max_margin_rate: 1 }
    const p = pricingPolicies.find((p) => p.client_type === full.estimate.client_type && p.category === 'OVERALL')
    return p || { default_margin_rate: 0, min_margin_rate: 0, max_margin_rate: 1 }
  }, [pricingPolicies, full])

  const overheadRate = full?.adjustments.find((a) => a.adjustment_type === 'overhead')?.value ?? 0
  const overheadLabel = full?.adjustments.find((a) => a.adjustment_type === 'overhead')?.label || '간접비'
  const discountAdj = full?.adjustments.find((a) => a.adjustment_type === 'discount')

  const totals = useMemo(() => {
    if (!full) return null
    return calculateEstimateTotals({
      items: full.items.map((i) => ({
        execution_unit_cost: i.execution_unit_cost, quantity: i.quantity, quoted_unit_price: i.quoted_unit_price,
      })),
      overheadRate,
      selectedRiskRates: full.risks.map((r) => r.rate),
      discountType: discountAdj?.value_type || 'rate',
      discountValue: discountAdj?.value || 0,
      vatRate: full.estimate.vat_rate,
      overallPolicy,
    })
  }, [full, overheadRate, discountAdj, overallPolicy])

  if (loading || !full || !totals) {
    return <div className="p-4 md:p-6 text-center text-slate-400 py-20">불러오는 중...</div>
  }

  const { estimate, items } = full

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <button onClick={() => navigate('/estimates')}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-2">
            <ArrowLeft size={13} />목록으로
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">{estimate.client_name}</h1>
            <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${CLIENT_TYPE_COLORS[estimate.client_type]}`}>
              {estimate.client_type}
            </span>
            <select value={estimate.status} onChange={(e) => handleStatusChange(e.target.value as EstimateStatus)}
              className={`px-2.5 py-0.5 text-xs font-medium rounded-full border-0 cursor-pointer ${ESTIMATE_STATUS_COLORS[estimate.status]}`}>
              <option value="작성중">작성중</option>
              <option value="발송완료">발송완료</option>
              <option value="계약완료">계약완료</option>
              <option value="취소">취소</option>
            </select>
            <button onClick={handleToggleReview}
              className={`flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full border transition-colors ${
                estimate.review_required
                  ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
              }`}>
              <AlertTriangle size={11} />{estimate.review_required ? '승인필요' : '승인완료'}
            </button>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            {estimate.estimate_number} {estimate.exhibition_name && `· ${estimate.exhibition_name}`}
          </p>
        </div>
        <button onClick={() => navigate(`/estimates/${id}/edit`)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors shadow-sm">
          <Edit2 size={15} />수정
        </button>
      </div>

      {/* 뷰 전환 탭 */}
      <div className="flex gap-2">
        <button onClick={() => setView('internal')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            view === 'internal' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-300'
          }`}>
          내부용 실행가표
        </button>
        <button onClick={() => setView('customer')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            view === 'customer' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-300'
          }`}>
          고객 제출용 견적서
        </button>
      </div>

      {view === 'internal' ? (
        <div className="space-y-4 md:space-y-5">
          <InternalExecutionTable items={items} />
          <EstimateSummaryPanel totals={totals} overheadLabel={overheadLabel} />
        </div>
      ) : (
        <CustomerEstimateView
          header={{
            estimate_number: estimate.estimate_number,
            client_name: estimate.client_name,
            exhibition_name: estimate.exhibition_name,
            venue: estimate.venue,
            booth_size: estimate.booth_size,
            created_at: estimate.created_at,
            valid_until: estimate.valid_until,
            included_scope: estimate.included_scope,
            excluded_scope: estimate.excluded_scope,
            payment_terms: estimate.payment_terms,
            customer_notes: estimate.customer_notes,
          }}
          lineItems={toCustomerLineItems(items)}
          summary={toCustomerSummary(totals)}
          printDisabled={estimate.review_required}
        />
      )}
    </div>
  )
}
