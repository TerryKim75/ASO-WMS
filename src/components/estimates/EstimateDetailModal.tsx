import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Edit2, AlertTriangle } from 'lucide-react'
import { setEstimateReviewRequired, setEstimateStatus } from '../../lib/estimateActions'
import { useEstimateWithTotals } from '../../lib/useEstimateWithTotals'
import { toCustomerLineItems, toCustomerSummary } from '../../lib/estimateCustomerView'
import InternalExecutionTable from './InternalExecutionTable'
import CustomerEstimateView from './CustomerEstimateView'
import EstimateSummaryPanel from './EstimateSummaryPanel'
import { ESTIMATE_STATUS_COLORS, CLIENT_TYPE_COLORS } from '../../pages/Estimates'
import type { EstimateStatus } from '../../types'

type ViewMode = 'internal' | 'customer'

interface Props {
  id: string
  onClose: () => void
}

export default function EstimateDetailModal({ id, onClose }: Props) {
  const navigate = useNavigate()
  const { full, totals, overheadLabel, loading, reload } = useEstimateWithTotals(id)
  const [view, setView] = useState<ViewMode>('internal')

  const handleToggleReview = async () => {
    if (!full) return
    await setEstimateReviewRequired(full.estimate.id, !full.estimate.review_required)
    reload()
  }

  const handleStatusChange = async (status: EstimateStatus) => {
    if (!full) return
    await setEstimateStatus(full.estimate.id, status)
    reload()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-50 rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {loading || !full || !totals ? (
          <div className="p-16 text-center text-slate-400">불러오는 중...</div>
        ) : (
          <>
            {/* 헤더 */}
            <div className="flex items-start justify-between gap-3 flex-wrap px-5 md:px-6 pt-5 pb-4 border-b border-slate-200 bg-white rounded-t-xl flex-shrink-0">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg md:text-xl font-bold text-slate-800">{full.estimate.client_name}</h2>
                  <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${CLIENT_TYPE_COLORS[full.estimate.client_type]}`}>
                    {full.estimate.client_type}
                  </span>
                  <select value={full.estimate.status} onChange={(e) => handleStatusChange(e.target.value as EstimateStatus)}
                    className={`px-2.5 py-0.5 text-xs font-medium rounded-full border-0 cursor-pointer ${ESTIMATE_STATUS_COLORS[full.estimate.status]}`}>
                    <option value="작성중">작성중</option>
                    <option value="발송완료">발송완료</option>
                    <option value="계약완료">계약완료</option>
                    <option value="취소">취소</option>
                  </select>
                  <button onClick={handleToggleReview}
                    className={`flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full border transition-colors ${
                      full.estimate.review_required
                        ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                    }`}>
                    <AlertTriangle size={11} />{full.estimate.review_required ? '승인필요' : '승인완료'}
                  </button>
                </div>
                <p className="text-slate-500 text-sm mt-0.5">
                  {full.estimate.estimate_number} {full.estimate.exhibition_name && `· ${full.estimate.exhibition_name}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => navigate(`/estimates/${id}/edit`)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors shadow-sm">
                  <Edit2 size={15} />수정
                </button>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-5 md:p-6 space-y-4">
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
                <div className="space-y-4">
                  <InternalExecutionTable items={full.items} />
                  <EstimateSummaryPanel totals={totals} overheadLabel={overheadLabel} />
                </div>
              ) : (
                <CustomerEstimateView
                  header={{
                    estimate_number: full.estimate.estimate_number,
                    client_name: full.estimate.client_name,
                    exhibition_name: full.estimate.exhibition_name,
                    venue: full.estimate.venue,
                    booth_size: full.estimate.booth_size,
                    created_at: full.estimate.created_at,
                    valid_until: full.estimate.valid_until,
                    included_scope: full.estimate.included_scope,
                    excluded_scope: full.estimate.excluded_scope,
                    payment_terms: full.estimate.payment_terms,
                    customer_notes: full.estimate.customer_notes,
                  }}
                  lineItems={toCustomerLineItems(full.items)}
                  summary={toCustomerSummary(totals)}
                  printDisabled={full.estimate.review_required}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
