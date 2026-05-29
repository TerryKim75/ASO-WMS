import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, TrendingDown, ChevronRight, FolderKanban } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { InventoryTransaction, ItemWithStock, WmsProject } from '../types'
import { STATUS_COLORS } from './Projects'

const transactionTypeBadge: Record<string, string> = {
  입고: 'bg-green-100 text-green-700',
  출고: 'bg-red-100 text-red-700',
  반입: 'bg-blue-100 text-blue-700',
  손실: 'bg-orange-100 text-orange-700',
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  const parts = dateStr.split('T')[0].split('-')
  return parts.length < 3 ? dateStr : `${parts[0]}.${parts[1]}.${parts[2]}`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [recentTransactions, setRecentTransactions] = useState<InventoryTransaction[]>([])
  const [lowStockItems, setLowStockItems] = useState<ItemWithStock[]>([])
  const [allItems, setAllItems] = useState<ItemWithStock[]>([])
  const [activeProjects, setActiveProjects] = useState<WmsProject[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [itemsRes, txRes, allTxRes, projectsRes] = await Promise.all([
        supabase.from('items').select('*').order('category').order('name'),
        supabase
          .from('inventory_transactions')
          .select('*, items(name, category, unit), wms_projects(name)')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('inventory_transactions').select('item_id, transaction_type, quantity').limit(5000),
        supabase
          .from('wms_projects')
          .select('*')
          .in('status', ['계약완료', '시공진행'])
          .order('start_date', { ascending: true }),
      ])

      const items = itemsRes.data || []
      const allTx = allTxRes.data || []

      const stockMap: Record<string, { in: number; out: number; ret: number; loss: number; adj: number; discard: number }> = {}
      allTx.forEach((tx) => {
        if (!stockMap[tx.item_id]) stockMap[tx.item_id] = { in: 0, out: 0, ret: 0, loss: 0, adj: 0, discard: 0 }
        if (tx.transaction_type === '입고') stockMap[tx.item_id].in += tx.quantity
        if (tx.transaction_type === '출고') stockMap[tx.item_id].out += tx.quantity
        if (tx.transaction_type === '반입') stockMap[tx.item_id].ret += tx.quantity
        if (tx.transaction_type === '손실') stockMap[tx.item_id].loss += tx.quantity
        if (tx.transaction_type === '파손') stockMap[tx.item_id].loss += tx.quantity
        if (tx.transaction_type === '분실') stockMap[tx.item_id].loss += tx.quantity
        if (tx.transaction_type === '재고조정') stockMap[tx.item_id].adj += tx.quantity
        if (tx.transaction_type === '폐기') stockMap[tx.item_id].discard += tx.quantity
        // 팩킹은 재고에 영향 없음
      })

      const itemsWithStock: ItemWithStock[] = items.map((item) => {
        const s = stockMap[item.id] || { in: 0, out: 0, ret: 0, loss: 0, adj: 0, discard: 0 }
        return {
          ...item,
          total_in: s.in + s.adj,
          total_out: s.out,
          total_return: s.ret,
          total_loss: s.loss + s.discard,
          current_stock: s.in + s.ret + s.adj - s.out - s.loss - s.discard,
        }
      })

      setAllItems(itemsWithStock)
      setLowStockItems(itemsWithStock.filter((i) => i.current_stock <= 10).sort((a, b) => a.current_stock - b.current_stock))
      setRecentTransactions((txRes.data || []) as InventoryTransaction[])
      setActiveProjects((projectsRes.data || []) as WmsProject[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-800">대시보드</h1>
        <p className="text-slate-500 text-sm mt-0.5">ASO System 프로젝트 관리 현황</p>
      </div>

      {/* ─── 진행중인 프로젝트 ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban size={16} className="text-violet-500" />
            <h2 className="text-base font-semibold text-slate-800">진행중인 프로젝트</h2>
            {activeProjects.length > 0 && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{activeProjects.length}건</span>
            )}
          </div>
          <button onClick={() => navigate('/projects')} className="text-xs text-violet-600 hover:text-violet-700 font-medium">전체보기</button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : activeProjects.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">진행중인 프로젝트가 없습니다.</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {activeProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-violet-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`flex-shrink-0 px-2.5 py-0.5 text-xs font-medium rounded-full border ${STATUS_COLORS[project.status] || 'bg-slate-100 text-slate-600'}`}>
                    {project.status}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{project.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {[project.exhibition, project.organizer, project.manager].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                  {project.start_date && (
                    <span className="text-xs text-slate-400">{project.start_date.replace(/-/g, '.')}</span>
                  )}
                  <ChevronRight size={14} className="text-slate-300" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── 전체 자재 현황 + 막대그래프 ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-800">자재 재고 현황</h2>
            {allItems.length > 0 && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{allItems.length}종</span>
            )}
          </div>
          <button onClick={() => navigate('/inventory')} className="text-xs text-violet-600 hover:text-violet-700 font-medium">재고관리</button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : allItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">등록된 자재가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs">카테고리</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">자재명</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs">총재고</th>
                  <th className="text-center px-4 py-3 font-semibold text-red-700 text-xs">출고</th>
                  <th className="text-center px-4 py-3 font-semibold text-blue-700 text-xs">반입</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs">잔여</th>
                  <th className="px-5 py-3 font-semibold text-slate-600 text-xs w-48">출고 비율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allItems.map((item) => {
                  const outRatio = item.total_in > 0 ? Math.min((item.total_out / item.total_in) * 100, 100) : 0
                  const barColor = outRatio >= 90 ? 'bg-red-500' : outRatio >= 60 ? 'bg-orange-400' : 'bg-violet-500'
                  return (
                    <tr key={item.id}
                      onClick={() => navigate('/inventory')}
                      className="hover:bg-slate-50 cursor-pointer transition-colors">
                      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{item.category}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-400">{item.unit}</p>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-700">{item.total_in.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center font-semibold text-red-600">{item.total_out.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center font-semibold text-blue-600">{item.total_return.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${item.current_stock <= 0 ? 'text-red-600' : item.current_stock <= 10 ? 'text-orange-500' : 'text-slate-700'}`}>
                          {item.current_stock.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${barColor}`}
                              style={{ width: `${outRatio}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-9 text-right flex-shrink-0">
                            {outRatio > 0 ? `${Math.round(outRatio)}%` : '-'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 최근 입출고 + 재고부족 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">최근 입출고 내역</h2>
            <button onClick={() => navigate('/transactions')} className="text-xs text-violet-600 hover:text-violet-700 font-medium">전체보기</button>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">불러오는 중...</div>
          ) : recentTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">내역이 없습니다.</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentTransactions.slice(0, 8).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${transactionTypeBadge[tx.transaction_type]}`}>
                      {tx.transaction_type}
                    </span>
                    <span className="text-sm text-slate-700 truncate">
                      {(tx.items as { name: string } | undefined)?.name || '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="text-sm font-medium text-slate-800">{tx.quantity.toLocaleString()}</span>
                    <span className="text-xs text-slate-400">{formatDate(tx.transaction_date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-800">재고 부족 알림</h2>
              {lowStockItems.length > 0 && (
                <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  <AlertTriangle size={10} className="inline mr-0.5" />{lowStockItems.length}개
                </span>
              )}
            </div>
            <button onClick={() => navigate('/inventory')} className="text-xs text-violet-600 hover:text-violet-700 font-medium">재고관리</button>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">불러오는 중...</div>
          ) : lowStockItems.length === 0 ? (
            <div className="p-8 text-center">
              <TrendingDown size={32} className="mx-auto text-green-400 mb-2" />
              <p className="text-slate-400 text-sm">재고 부족 자재가 없습니다.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {lowStockItems.slice(0, 8).map((item) => (
                <div key={item.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">{item.category}</p>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    <span className={`text-lg font-bold ${item.current_stock <= 0 ? 'text-red-600' : 'text-orange-500'}`}>
                      {item.current_stock}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
