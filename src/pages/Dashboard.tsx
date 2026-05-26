import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, ArrowUpCircle, ArrowDownCircle, AlertTriangle, TrendingDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCategories } from '../contexts/CategoriesContext'
import type { InventoryTransaction, ItemWithStock } from '../types'

const transactionTypeBadge: Record<string, string> = {
  입고: 'bg-green-100 text-green-700',
  출고: 'bg-red-100 text-red-700',
  반입: 'bg-blue-100 text-blue-700',
  손실: 'bg-orange-100 text-orange-700',
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  const parts = dateStr.split('T')[0].split('-')
  if (parts.length < 3) return dateStr
  return `${parts[0]}.${parts[1]}.${parts[2]}`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { categories, getCategoryStyle } = useCategories()
  const [recentTransactions, setRecentTransactions] = useState<InventoryTransaction[]>([])
  const [lowStockItems, setLowStockItems] = useState<ItemWithStock[]>([])
  const [stats, setStats] = useState({ totalItems: 0, todayTransactions: 0, activeProjects: 0, lowStockCount: 0 })
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [itemsRes, transactionsRes, projectsRes] = await Promise.all([
        supabase.from('items').select('*'),
        supabase
          .from('inventory_transactions')
          .select('*, items(name, category, unit), wms_projects(name)')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('wms_projects').select('id').eq('status', 'active'),
      ])

      const items = itemsRes.data || []
      const transactions = transactionsRes.data || []

      const counts: Record<string, number> = {}
      items.forEach((item) => { counts[item.category] = (counts[item.category] || 0) + 1 })
      setCategoryCounts(counts)

      const allTxRes = await supabase.from('inventory_transactions').select('item_id, transaction_type, quantity')
      const allTx = allTxRes.data || []
      const stockMap: Record<string, { in: number; out: number; ret: number; loss: number }> = {}

      allTx.forEach((tx) => {
        if (!stockMap[tx.item_id]) stockMap[tx.item_id] = { in: 0, out: 0, ret: 0, loss: 0 }
        if (tx.transaction_type === '입고') stockMap[tx.item_id].in += tx.quantity
        if (tx.transaction_type === '출고') stockMap[tx.item_id].out += tx.quantity
        if (tx.transaction_type === '반입') stockMap[tx.item_id].ret += tx.quantity
        if (tx.transaction_type === '손실') stockMap[tx.item_id].loss += tx.quantity
      })

      const itemsWithStock: ItemWithStock[] = items.map((item) => {
        const s = stockMap[item.id] || { in: 0, out: 0, ret: 0, loss: 0 }
        return { ...item, total_in: s.in, total_out: s.out, total_return: s.ret, total_loss: s.loss, current_stock: s.in - s.out + s.ret - s.loss }
      })

      const lowStock = itemsWithStock.filter((i) => i.current_stock <= 10).sort((a, b) => a.current_stock - b.current_stock)
      setLowStockItems(lowStock)

      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const todayCount = transactions.filter((t) => t.transaction_date === todayStr).length

      setStats({ totalItems: items.length, todayTransactions: todayCount, activeProjects: (projectsRes.data || []).length, lowStockCount: lowStock.length })
      setRecentTransactions(transactions as InventoryTransaction[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">대시보드</h1>
        <p className="text-slate-500 text-sm mt-1">ASO System 프로젝트 관리 현황</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">전체 자재</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{stats.totalItems}</p>
              <p className="text-xs text-slate-400 mt-1">종류</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
              <Package size={20} className="text-violet-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">오늘 입출고</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{stats.todayTransactions}</p>
              <p className="text-xs text-slate-400 mt-1">건</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <ArrowUpCircle size={20} className="text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">진행 프로젝트</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{stats.activeProjects}</p>
              <p className="text-xs text-slate-400 mt-1">건</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <ArrowDownCircle size={20} className="text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">재고 부족</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.lowStockCount}</p>
              <p className="text-xs text-slate-400 mt-1">10개 이하</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Category Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-800 mb-4">카테고리별 자재 현황</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {categories.map((cat) => {
            const style = getCategoryStyle(cat.name)
            return (
              <button
                key={cat.id}
                onClick={() => navigate(`/inventory?category=${encodeURIComponent(cat.name)}`)}
                className={`flex flex-col items-center p-4 rounded-lg border text-center hover:shadow-md transition-all ${style.card}`}
              >
                <span className="text-2xl font-bold">{categoryCounts[cat.name] || 0}</span>
                <span className="text-xs font-medium mt-1">{cat.name}</span>
              </button>
            )
          })}
        </div>
      </div>

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
            <h2 className="text-base font-semibold text-slate-800">재고 부족 알림</h2>
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
                    <span className={`text-lg font-bold ${item.current_stock <= 0 ? 'text-red-600' : 'text-yellow-600'}`}>
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
