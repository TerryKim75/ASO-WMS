import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, Mail } from 'lucide-react'
import { fetchContractList } from '../lib/contractActions'
import { formatKRW } from '../lib/format'
import type { Contract, ContractStatus } from '../types'

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  작성중:     'bg-slate-100 text-slate-600 border border-slate-200',
  발송완료:   'bg-sky-100 text-sky-700 border border-sky-200',
  서명완료:   'bg-indigo-100 text-indigo-700 border border-indigo-200',
  계산서요청: 'bg-amber-100 text-amber-700 border border-amber-200',
  완료:       'bg-green-100 text-green-700 border border-green-200',
  취소:       'bg-red-100 text-red-600 border border-red-200',
}

const STATUS_FILTER_ORDER: (ContractStatus | 'all')[] = [
  'all', '작성중', '발송완료', '서명완료', '계산서요청', '완료', '취소',
]

function formatDate(date?: string) {
  if (!date) return '-'
  return date.split('T')[0].replace(/-/g, '.')
}

export default function Contracts() {
  const navigate = useNavigate()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setContracts(await fetchContractList())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = contracts.filter((c) => statusFilter === 'all' || c.status === statusFilter)

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">계약서</h1>
          <p className="text-slate-500 text-sm mt-0.5">견적서를 불러와 계약 정보를 정리하고 계산서 발행을 요청합니다</p>
        </div>
        <button
          onClick={() => navigate('/contracts/new')}
          className="flex items-center gap-2 px-3 py-2 md:px-4 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
        >
          <Plus size={16} /><span className="hidden sm:inline">계약서 작성</span><span className="sm:hidden">작성</span>
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
              <span className="ml-1 text-xs opacity-70">({contracts.filter((c) => c.status === status).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* 모바일 카드 */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400 text-sm">계약서가 없습니다.</div>
        ) : (
          filtered.map((contract) => (
            <div key={contract.id}
              onClick={() => navigate(`/contracts/${contract.id}/edit`)}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm active:bg-violet-50 transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800">{contract.client_name}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${CONTRACT_STATUS_COLORS[contract.status]}`}>
                      {contract.status}
                    </span>
                    {contract.invoice_requested_at && (
                      <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        <Mail size={11} />계산서 요청됨
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-slate-500">
                    <span>{contract.contract_number}</span>
                    {contract.exhibition_name && <span>· {contract.exhibition_name}</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{formatDate(contract.contract_date || contract.created_at)}</p>
                </div>
                <ChevronRight size={18} className="text-slate-300 flex-shrink-0" />
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-right">
                <p className="text-xs text-slate-400">계약금액</p>
                <p className="text-sm font-bold text-slate-800">{formatKRW(contract.total_amount)}</p>
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
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">기본정보</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">계약일</th>
                <th className="text-right px-4 py-3.5 font-semibold text-slate-600 whitespace-nowrap">계약금액</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-600">상태</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">계약서가 없습니다.</td></tr>
              ) : (
                filtered.map((contract) => (
                  <tr key={contract.id} onClick={() => navigate(`/contracts/${contract.id}/edit`)}
                    className="hover:bg-violet-50 transition-colors cursor-pointer group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800 whitespace-nowrap">{contract.client_name}</span>
                        {contract.invoice_requested_at && (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <Mail size={11} />계산서 요청됨
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-xs text-slate-400">
                        <span>{contract.contract_number}</span>
                        {contract.exhibition_name && <span>· {contract.exhibition_name}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{formatDate(contract.contract_date)}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-800 whitespace-nowrap">{formatKRW(contract.total_amount)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${CONTRACT_STATUS_COLORS[contract.status]}`}>
                        {contract.status}
                      </span>
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
