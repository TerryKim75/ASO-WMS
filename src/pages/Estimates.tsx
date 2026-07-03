import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, AlertTriangle } from 'lucide-react'
import { fetchEstimateList } from '../lib/estimateActions'
import type { Estimate, EstimateStatus, ClientType } from '../types'

export const ESTIMATE_STATUS_COLORS: Record<EstimateStatus, string> = {
  작성중:   'bg-slate-100 text-slate-600 border border-slate-200',
  발송완료: 'bg-sky-100 text-sky-700 border border-sky-200',
  계약완료: 'bg-green-100 text-green-700 border border-green-200',
  취소:     'bg-red-100 text-red-600 border border-red-200',
}

export const CLIENT_TYPE_COLORS: Record<ClientType, string> = {
  기획사용: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  참가사용: 'bg-amber-100 text-amber-700 border border-amber-200',
}

const STATUS_FILTER_ORDER: (EstimateStatus | 'all')[] = ['all', '작성중', '발송완료', '계약완료', '취소']

function formatDate(date?: string) {
  if (!date) return '-'
  return date.split('T')[0].replace(/-/g, '.')
}

export default function Estimates() {
  const navigate = useNavigate()
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<EstimateStatus | 'all'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setEstimates(await fetchEstimateList())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = estimates.filter((e) => statusFilter === 'all' || e.status === statusFilter)

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">견적서</h1>
          <p className="text-slate-500 text-sm mt-0.5">고객 유형별 실행가 기준 견적 관리</p>
        </div>
        <button
          onClick={() => navigate('/estimates/new')}
          className="flex items-center gap-2 px-3 py-2 md:px-4 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
        >
          <Plus size={16} /><span className="hidden sm:inline">견적서 작성</span><span className="sm:hidden">작성</span>
        </button>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTER_ORDER.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-lg transition-colors ${
              statusFilter === status
                ? 'bg-violet-600 text-white'
                : 'bg-white text-slate-600 border border-slate-300'
            }`}
          >
            {status === 'all' ? '전체' : status}
            {status !== 'all' && (
              <span className="ml-1 text-xs opacity-70">({estimates.filter((e) => e.status === status).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* 모바일 카드 */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400 text-sm">견적서가 없습니다.</div>
        ) : (
          filtered.map((estimate) => (
            <div key={estimate.id}
              onClick={() => navigate(`/estimates/${estimate.id}`)}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm active:bg-violet-50 transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800">{estimate.client_name}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${CLIENT_TYPE_COLORS[estimate.client_type]}`}>
                      {estimate.client_type}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${ESTIMATE_STATUS_COLORS[estimate.status]}`}>
                      {estimate.status}
                    </span>
                    {estimate.review_required && (
                      <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 border border-red-200">
                        <AlertTriangle size={11} />승인필요
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-slate-500">
                    <span>{estimate.estimate_number}</span>
                    {estimate.exhibition_name && <span>· {estimate.exhibition_name}</span>}
                    {estimate.pm && <span className="text-slate-600 font-medium">· {estimate.pm}</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{formatDate(estimate.created_at)}</p>
                </div>
                <ChevronRight size={18} className="text-slate-300 flex-shrink-0" />
              </div>
            </div>
          ))
        )}
        {!loading && filtered.length > 0 && (
          <p className="text-xs text-slate-400 text-center pb-2">총 {filtered.length}건</p>
        )}
      </div>

      {/* 데스크탑 테이블 */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">견적번호</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">고객유형</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">고객명</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">전시회</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">담당PM</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">작성일</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">유효기간</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-600">상태</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">견적서가 없습니다.</td></tr>
              ) : (
                filtered.map((estimate) => (
                  <tr key={estimate.id} onClick={() => navigate(`/estimates/${estimate.id}`)}
                    className="hover:bg-violet-50 transition-colors cursor-pointer group">
                    <td className="px-5 py-3.5 font-medium text-slate-800 whitespace-nowrap">{estimate.estimate_number}</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${CLIENT_TYPE_COLORS[estimate.client_type]}`}>
                        {estimate.client_type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 font-medium whitespace-nowrap">{estimate.client_name}</td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      {estimate.exhibition_name || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      {estimate.pm || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">{formatDate(estimate.created_at)}</td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">{formatDate(estimate.valid_until)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${ESTIMATE_STATUS_COLORS[estimate.status]}`}>
                          {estimate.status}
                        </span>
                        {estimate.review_required && (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 border border-red-200">
                            <AlertTriangle size={11} />승인필요
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <ChevronRight size={16} className="text-slate-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">총 {filtered.length}건</div>
        )}
      </div>
    </div>
  )
}
