import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface BidWithProject {
  id: string
  project_id: string
  bidder_name: string
  bidder_phone: string
  proposed_price: number
  note?: string
  status: '대기' | '낙찰' | '거절'
  created_at: string
  wms_projects?: { name: string; start_date?: string }
}

const STATUS_STYLE = {
  대기: 'bg-amber-100 text-amber-700 border-amber-200',
  낙찰: 'bg-green-100 text-green-700 border-green-200',
  거절: 'bg-slate-100 text-slate-500 border-slate-200',
}

export default function Bids() {
  const navigate = useNavigate()
  const [bids, setBids] = useState<BidWithProject[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'전체' | '대기' | '낙찰' | '거절'>('전체')

  const fetchBids = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('project_bids')
      .select('*, wms_projects(name, start_date)')
      .order('created_at', { ascending: false })
    setBids((data || []) as BidWithProject[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchBids() }, [fetchBids])

  const handleBidStatus = async (bidId: string, status: '낙찰' | '거절') => {
    await supabase.from('project_bids').update({ status }).eq('id', bidId)
    fetchBids()
  }

  const filtered = filter === '전체' ? bids : bids.filter((b) => b.status === filter)
  const counts = {
    전체: bids.length,
    대기: bids.filter((b) => b.status === '대기').length,
    낙찰: bids.filter((b) => b.status === '낙찰').length,
    거절: bids.filter((b) => b.status === '거절').length,
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">시공 입찰</h1>
          <p className="text-slate-500 text-sm mt-0.5">시공인력 입찰 제안 현황</p>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2 flex-wrap">
        {(['전체', '대기', '낙찰', '거절'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-lg transition-colors ${
              filter === f ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:border-slate-400'
            }`}>
            {f}
            <span className="ml-1.5 text-xs opacity-70">({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* 모바일 카드 */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400 text-sm">입찰 제안이 없습니다.</div>
        ) : (
          filtered.map((bid) => (
            <div key={bid.id} className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm ${bid.status === '거절' ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <button onClick={() => navigate(`/projects/${bid.project_id}`)}
                    className="flex items-center gap-1 font-semibold text-violet-700 text-sm">
                    {bid.wms_projects?.name || '-'}<ChevronRight size={12} className="opacity-50" />
                  </button>
                  {bid.wms_projects?.start_date && (
                    <p className="text-xs text-slate-400 mt-0.5">{bid.wms_projects.start_date.replace(/-/g, '.')}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <p className="font-medium text-slate-800 text-sm">{bid.bidder_name}</p>
                    <a href={`tel:${bid.bidder_phone}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-600">
                      <Phone size={11} />{bid.bidder_phone}
                    </a>
                  </div>
                  {bid.note && <p className="text-xs text-slate-400 mt-1 truncate">{bid.note}</p>}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="font-bold text-slate-800">{bid.proposed_price.toLocaleString()}원</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full border ${STATUS_STYLE[bid.status]}`}>
                    {bid.status}
                  </span>
                </div>
              </div>
              {bid.status === '대기' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                  <button onClick={() => handleBidStatus(bid.id, '낙찰')}
                    className="flex-1 py-2 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors">
                    낙찰
                  </button>
                  <button onClick={() => handleBidStatus(bid.id, '거절')}
                    className="flex-1 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors">
                    거절
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 데스크탑 테이블 */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400">입찰 제안이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs">프로젝트</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">제안자</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">연락처</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs">제안금액</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">메모</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs">상태</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-28">처리</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((bid) => (
                  <tr key={bid.id} className={`transition-colors ${
                    bid.status === '낙찰' ? 'bg-green-50/40' :
                    bid.status === '거절' ? 'opacity-40' :
                    'hover:bg-slate-50'
                  }`}>
                    <td className="px-5 py-3">
                      <button onClick={() => navigate(`/projects/${bid.project_id}`)}
                        className="flex items-center gap-1 text-sm font-medium text-violet-700 hover:text-violet-900 transition-colors">
                        {bid.wms_projects?.name || '-'}
                        <ChevronRight size={12} className="opacity-50" />
                      </button>
                      {bid.wms_projects?.start_date && (
                        <p className="text-xs text-slate-400 mt-0.5">{bid.wms_projects.start_date.replace(/-/g, '.')}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{bid.bidder_name}</td>
                    <td className="px-4 py-3">
                      <a href={`tel:${bid.bidder_phone}`}
                        className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-violet-600 transition-colors">
                        <Phone size={12} />{bid.bidder_phone}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{bid.proposed_price.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-sm text-slate-500 max-w-[180px] truncate">
                      {bid.note || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${STATUS_STYLE[bid.status]}`}>{bid.status}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {bid.status === '대기' && (
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => handleBidStatus(bid.id, '낙찰')}
                            className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors">
                            낙찰
                          </button>
                          <button onClick={() => handleBidStatus(bid.id, '거절')}
                            className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors">
                            거절
                          </button>
                        </div>
                      )}
                    </td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
