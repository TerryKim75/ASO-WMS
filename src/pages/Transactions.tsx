import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronRight, Search, Package, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCategories } from '../contexts/CategoriesContext'
import type { InventoryTransaction, TransactionType, WmsProject, Item } from '../types'
import { STATUS_COLORS } from './Projects'

const typeBadge: Record<TransactionType, string> = {
  입고: 'bg-green-100 text-green-700',
  출고: 'bg-red-100 text-red-700',
  반입: 'bg-blue-100 text-blue-700',
  손실: 'bg-orange-100 text-orange-700',
  팩킹: 'bg-slate-100 text-slate-600',
  파손: 'bg-amber-100 text-amber-700',
  분실: 'bg-rose-100 text-rose-700',
  재고조정: 'bg-purple-100 text-purple-700',
  폐기: 'bg-gray-100 text-gray-600',
}

type DeliveryStatus = '준비중' | '출고' | '입고완료'

const DELIVERY_STATUS: Record<DeliveryStatus, string> = {
  '준비중': 'bg-slate-100 text-slate-600 border border-slate-200',
  '출고': 'bg-orange-100 text-orange-700 border border-orange-200',
  '입고완료': 'bg-green-100 text-green-700 border border-green-200',
}

function getDeliveryStatus(totalOut: number, totalReturn: number, totalLoss: number): DeliveryStatus {
  if (totalOut === 0) return '준비중'
  if (totalOut - totalReturn - totalLoss <= 0) return '입고완료'
  return '출고'
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('-')
  return `${y}.${m}.${d}`
}

interface ProjectGroup {
  projectId: string
  project: WmsProject
  transactions: InventoryTransaction[]
  totalOut: number
  totalReturn: number
  totalLoss: number
  totalIn: number
}

export default function Transactions() {
  const navigate = useNavigate()
  const { getCategoryStyle } = useCategories()
  const [projects, setProjects] = useState<WmsProject[]>([])
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TransactionType | ''>('')
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryStatus | ''>('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [projectsRes, txRes] = await Promise.all([
        supabase
          .from('wms_projects')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('inventory_transactions')
          .select('*, items(id, name, category, unit, description, created_at), wms_projects(id, name, exhibitor, status)')
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(2000),
      ])
      setProjects((projectsRes.data || []) as WmsProject[])
      setTransactions((txRes.data || []) as InventoryTransaction[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // 첫 로드시 상위 3개 프로젝트 자동 펼침
  useEffect(() => {
    if (projects.length > 0 && expanded.size === 0) {
      setExpanded(new Set(projects.slice(0, 3).map((p) => p.id)))
    }
  }, [projects]) // eslint-disable-line react-hooks/exhaustive-deps

  // 트랜잭션을 프로젝트별로 집계
  const groups = useMemo<ProjectGroup[]>(() => {
    const txMap = new Map<string, InventoryTransaction[]>()
    transactions.forEach((tx) => {
      if (!tx.project_id) return
      if (typeFilter && tx.transaction_type !== typeFilter) return
      if (!txMap.has(tx.project_id)) txMap.set(tx.project_id, [])
      txMap.get(tx.project_id)!.push(tx)
    })

    const result: ProjectGroup[] = projects.map((project) => {
      const txs = txMap.get(project.id) || []
      let totalOut = 0, totalReturn = 0, totalLoss = 0, totalIn = 0
      txs.forEach((tx) => {
        if (tx.transaction_type === '출고') totalOut += tx.quantity
        if (tx.transaction_type === '반입') totalReturn += tx.quantity
        if (tx.transaction_type === '손실') totalLoss += tx.quantity
        if (tx.transaction_type === '입고') totalIn += tx.quantity
      })
      return { projectId: project.id, project, transactions: txs, totalOut, totalReturn, totalLoss, totalIn }
    })

    return result
  }, [projects, transactions, typeFilter])

  // 검색 + 진행현황 필터
  const filteredGroups = useMemo(() => {
    let result = groups
    if (deliveryFilter) {
      result = result.filter((g) => getDeliveryStatus(g.totalOut, g.totalReturn, g.totalLoss) === deliveryFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((g) => {
        const nameMatch = g.project.name.toLowerCase().includes(q)
        const exhibitorMatch = (g.project.exhibitor || '').toLowerCase().includes(q)
        const itemMatch = g.transactions.some((tx) =>
          ((tx.items as Item | undefined)?.name || '').toLowerCase().includes(q)
        )
        return nameMatch || exhibitorMatch || itemMatch
      })
    }
    return result
  }, [groups, search, deliveryFilter])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => setExpanded(new Set(filteredGroups.map((g) => g.projectId)))
  const collapseAll = () => setExpanded(new Set())

  const statusCounts = useMemo(() => {
    const counts: Record<DeliveryStatus, number> = { '준비중': 0, '출고': 0, '입고완료': 0 }
    groups.forEach((g) => { counts[getDeliveryStatus(g.totalOut, g.totalReturn, g.totalLoss)]++ })
    return counts
  }, [groups])

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-800">입출고 내역</h1>
        <p className="text-slate-500 text-sm mt-0.5">프로젝트별 자재 입출고 현황</p>
      </div>

      {/* 진행현황 필터 카드 */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {(['준비중', '출고', '입고완료'] as DeliveryStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setDeliveryFilter(deliveryFilter === s ? '' : s)}
            className={`rounded-xl border-2 p-3 md:p-4 text-center transition-all ${
              deliveryFilter === s
                ? s === '준비중' ? 'bg-slate-100 border-slate-400'
                  : s === '출고' ? 'bg-orange-50 border-orange-400'
                  : 'bg-green-50 border-green-400'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <p className={`text-xl md:text-2xl font-bold ${
              s === '준비중' ? 'text-slate-600' : s === '출고' ? 'text-orange-600' : 'text-green-600'
            }`}>
              {statusCounts[s]}
            </p>
            <p className="text-xs font-medium text-slate-500 mt-0.5 md:mt-1">{s}</p>
          </button>
        ))}
      </div>

      {/* 검색 + 타입 필터 */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="프로젝트명·참가사·자재명 검색..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['', '입고', '출고', '반입', '손실'] as const).map((t) => (
            <button
              key={t || 'all'}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                typeFilter === t
                  ? t === '' ? 'bg-slate-700 text-white border-slate-700'
                    : t === '입고' ? 'bg-green-600 text-white border-green-600'
                    : t === '출고' ? 'bg-red-600 text-white border-red-600'
                    : t === '반입' ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-slate-600 border-slate-300'
              }`}
            >
              {t || '전체'}
            </button>
          ))}
        </div>
      </div>

      {/* 전체/접기 컨트롤 */}
      {filteredGroups.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{filteredGroups.length}</span>개 프로젝트
            {typeFilter && (
              <span className="ml-2 text-xs text-slate-400">· {typeFilter} 필터 적용</span>
            )}
          </p>
          <div className="flex gap-2">
            <button onClick={expandAll} className="text-xs text-violet-600 hover:text-violet-700 font-medium">전체 펼치기</button>
            <span className="text-slate-300">|</span>
            <button onClick={collapseAll} className="text-xs text-slate-500 hover:text-slate-700 font-medium">전체 접기</button>
          </div>
        </div>
      )}

      {/* 프로젝트 목록 */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">불러오는 중...</div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          {search || deliveryFilter ? '검색 결과가 없습니다.' : '등록된 프로젝트가 없습니다.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredGroups.map((group) => {
            const isExpanded = expanded.has(group.projectId)
            const deliveryStatus = getDeliveryStatus(group.totalOut, group.totalReturn, group.totalLoss)
            const unreturned = group.totalOut - group.totalReturn - group.totalLoss

            return (
              <div key={group.projectId} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                {/* 프로젝트 헤더 행 */}
                <button
                  onClick={() => toggleExpand(group.projectId)}
                  className="w-full flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3.5 md:py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <span className="text-slate-400 flex-shrink-0">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm md:text-base">{group.project.name}</span>
                      {group.project.exhibitor && (
                        <span className="text-xs text-slate-400 hidden sm:inline">· {group.project.exhibitor}</span>
                      )}
                    </div>
                    {(group.project.start_date || group.project.end_date) && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {group.project.start_date && formatDate(group.project.start_date)}
                        {group.project.start_date && group.project.end_date && ' ~ '}
                        {group.project.end_date && formatDate(group.project.end_date)}
                      </p>
                    )}
                  </div>

                  {/* 배지 & 수치 */}
                  <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                    {group.project.status && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border hidden sm:inline-flex ${STATUS_COLORS[group.project.status] || 'bg-slate-100 text-slate-500'}`}>
                        {group.project.status}
                      </span>
                    )}
                    <span className={`text-xs font-semibold px-2 py-0.5 md:px-2.5 md:py-1 rounded-full ${DELIVERY_STATUS[deliveryStatus]}`}>
                      {deliveryStatus}
                    </span>
                    <div className="hidden lg:flex items-center gap-4 text-sm border-l border-slate-100 pl-4 ml-1">
                      <div className="text-center">
                        <p className="text-xs text-slate-400">출고</p>
                        <p className={`font-semibold ${group.totalOut > 0 ? 'text-red-600' : 'text-slate-300'}`}>{group.totalOut.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">반입</p>
                        <p className={`font-semibold ${group.totalReturn > 0 ? 'text-blue-600' : 'text-slate-300'}`}>{group.totalReturn.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">미반입</p>
                        <p className={`font-semibold ${unreturned > 0 ? 'text-orange-600' : 'text-slate-300'}`}>{unreturned.toLocaleString()}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {group.transactions.length > 0 ? `${group.transactions.length}건` : '내역없음'}
                    </span>
                  </div>
                </button>

                {/* 펼쳐진 내역 */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {/* 서브 헤더 */}
                    <div className="px-4 md:px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 md:gap-4 text-xs text-slate-500 flex-wrap">
                        {group.totalOut > 0 && (
                          <span>출고 <strong className="text-red-600">{group.totalOut.toLocaleString()}</strong></span>
                        )}
                        {group.totalReturn > 0 && (
                          <span>반입 <strong className="text-blue-600">{group.totalReturn.toLocaleString()}</strong></span>
                        )}
                        {group.totalLoss > 0 && (
                          <span>손실 <strong className="text-orange-600">{group.totalLoss.toLocaleString()}</strong></span>
                        )}
                        {unreturned > 0 && (
                          <span>미반입 <strong className="text-orange-600">{unreturned.toLocaleString()}</strong></span>
                        )}
                      </div>
                      <button
                        onClick={() => navigate(`/projects/${group.projectId}`)}
                        className="text-xs text-violet-600 hover:text-violet-700 font-medium flex-shrink-0"
                      >
                        상세 →
                      </button>
                    </div>

                    {group.transactions.length === 0 ? (
                      <div className="py-8 text-center">
                        <Package size={28} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-400">아직 입출고 내역이 없습니다.</p>
                        <button
                          onClick={() => navigate(`/projects/${group.projectId}`)}
                          className="mt-2 inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium"
                        >
                          <Plus size={12} />프로젝트에서 자재 등록
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* 모바일 카드 */}
                        <div className="sm:hidden divide-y divide-slate-50">
                          {group.transactions.map((tx) => {
                            const item = tx.items as Item | undefined
                            return (
                              <div key={tx.id} className="px-4 py-3 flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${typeBadge[tx.transaction_type]}`}>
                                      {tx.transaction_type}
                                    </span>
                                    <span className="font-medium text-slate-800 text-sm truncate">{item?.name || '-'}</span>
                                  </div>
                                  {tx.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{tx.notes}</p>}
                                </div>
                                <div className="flex-shrink-0 text-right">
                                  <p className="font-semibold text-slate-800 text-sm">{tx.quantity.toLocaleString()}<span className="text-xs text-slate-400 font-normal ml-0.5">{item?.unit}</span></p>
                                  <p className="text-xs text-slate-400">{formatDate(tx.transaction_date)}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* 데스크탑 테이블 */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-100">
                                <th className="text-left px-5 py-2.5 font-semibold text-slate-500 text-xs">날짜</th>
                                <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs">자재명</th>
                                <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs">카테고리</th>
                                <th className="text-center px-4 py-2.5 font-semibold text-slate-500 text-xs">구분</th>
                                <th className="text-center px-4 py-2.5 font-semibold text-slate-500 text-xs">수량</th>
                                <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs">비고</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {group.transactions.map((tx) => {
                                const item = tx.items as Item | undefined
                                const catStyle = item?.category ? getCategoryStyle(item.category) : null
                                return (
                                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-5 py-2.5 text-slate-500 whitespace-nowrap text-xs">
                                      {formatDate(tx.transaction_date)}
                                    </td>
                                    <td className="px-4 py-2.5 font-medium text-slate-800">{item?.name || '-'}</td>
                                    <td className="px-4 py-2.5">
                                      {item?.category && catStyle && (
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${catStyle.badge}`}>
                                          {item.category}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${typeBadge[tx.transaction_type]}`}>
                                        {tx.transaction_type}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-center font-semibold text-slate-800">
                                      {tx.quantity.toLocaleString()}
                                      <span className="text-xs text-slate-400 font-normal ml-1">{item?.unit}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-500 text-xs">
                                      {tx.notes || <span className="text-slate-300">-</span>}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
