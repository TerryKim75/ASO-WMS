import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, X, ImageOff, Settings2, RefreshCw, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCategories } from '../contexts/CategoriesContext'
import type { ItemWithStock, InventoryTransaction, TransactionType } from '../types'
import AddItemModal from '../components/AddItemModal'
import CategoryManageModal from '../components/CategoryManageModal'

function stockColor(stock: number) {
  if (stock <= 0) return 'text-red-600 font-bold'
  if (stock <= 10) return 'text-yellow-600 font-semibold'
  return 'text-green-700 font-semibold'
}

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

const typeLabel: Record<TransactionType, string> = {
  입고: '신규입고',
  출고: '출고',
  반입: '반입',
  손실: '손실',
  팩킹: '팩킹',
  파손: '파손',
  분실: '분실',
  재고조정: '재고조정',
  폐기: '폐기',
}

function formatDateLabel(dateStr: string): string {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yestStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  const [y, m, d] = dateStr.split('-')
  const formatted = `${y}.${m}.${d}`
  if (dateStr === todayStr) return `오늘 (${formatted})`
  if (dateStr === yestStr) return `어제 (${formatted})`
  return formatted
}

interface HistoryTx extends InventoryTransaction {
  itemName?: string
  itemCategory?: string
  itemUnit?: string
  projectName?: string
}

function StockEditModal({ item, onClose, onSuccess }: {
  item: ItemWithStock
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    total_in: item.total_in,
    total_out: item.total_out,
    total_loss: item.total_loss,
  })
  const [saving, setSaving] = useState(false)
  // 프로젝트 연결 최솟값 (이 이하로는 편집 불가)
  const [projMin, setProjMin] = useState({ out: 0, loss: 0, loaded: false })
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const load = async () => {
      const [outRes, lossRes] = await Promise.all([
        supabase.from('inventory_transactions')
          .select('quantity')
          .eq('item_id', item.id)
          .eq('transaction_type', '출고')
          .not('project_id', 'is', null),
        supabase.from('inventory_transactions')
          .select('quantity')
          .eq('item_id', item.id)
          .in('transaction_type', ['파손', '분실'])
          .not('project_id', 'is', null),
      ])
      const projOut = (outRes.data || []).reduce((s: number, t: { quantity: number }) => s + t.quantity, 0)
      const projLoss = (lossRes.data || []).reduce((s: number, t: { quantity: number }) => s + t.quantity, 0)
      setProjMin({ out: projOut, loss: projLoss, loaded: true })
      // 현재 폼 값이 최솟값보다 작으면 최솟값으로 맞춤
      setForm((prev) => ({
        ...prev,
        total_out: Math.max(prev.total_out, projOut),
        total_loss: Math.max(prev.total_loss, projLoss),
      }))
    }
    load()
  }, [item.id])

  const deltaIn = form.total_in - item.total_in
  const deltaOut = form.total_out - item.total_out
  const deltaLoss = form.total_loss - item.total_loss
  const hasChanges = deltaIn !== 0 || deltaOut !== 0 || deltaLoss !== 0
  const newStock = form.total_in - form.total_out + item.total_return - form.total_loss

  const handleSave = async () => {
    if (!hasChanges) { onClose(); return }
    if (form.total_out < projMin.out) {
      alert(`출고는 프로젝트 연결 수량(${projMin.out})보다 작게 설정할 수 없습니다.`)
      return
    }
    if (form.total_loss < projMin.loss) {
      alert(`손실은 프로젝트 연결 수량(${projMin.loss})보다 작게 설정할 수 없습니다.`)
      return
    }
    const ok = window.confirm('수량을 수정하겠습니까?')
    if (!ok) return
    setSaving(true)
    try {
      if (deltaIn !== 0) {
        await supabase.from('inventory_transactions').delete()
          .eq('item_id', item.id).eq('transaction_type', '입고').is('project_id', null)
        if (form.total_in > 0) {
          const { error } = await supabase.from('inventory_transactions').insert({
            item_id: item.id, transaction_type: '입고', quantity: form.total_in,
            transaction_date: today, notes: '수동 조정',
          })
          if (error) throw error
        }
      }

      if (deltaOut !== 0) {
        await supabase.from('inventory_transactions').delete()
          .eq('item_id', item.id).eq('transaction_type', '출고').is('project_id', null)
        const nonProjOut = form.total_out - projMin.out
        if (nonProjOut > 0) {
          const { error } = await supabase.from('inventory_transactions').insert({
            item_id: item.id, transaction_type: '출고', quantity: nonProjOut,
            transaction_date: today, notes: '수동 조정',
          })
          if (error) throw error
        }
      }

      if (deltaLoss !== 0) {
        await supabase.from('inventory_transactions').delete()
          .eq('item_id', item.id).eq('transaction_type', '손실').is('project_id', null)
        const nonProjLoss = form.total_loss - projMin.loss
        if (nonProjLoss > 0) {
          const { error } = await supabase.from('inventory_transactions').insert({
            item_id: item.id, transaction_type: '손실', quantity: nonProjLoss,
            transaction_date: today, notes: '수동 조정',
          })
          if (error) throw error
        }
      }

      onSuccess()
      onClose()
    } catch (err) {
      alert('저장 실패: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const ic = 'w-full text-right border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-slate-50 disabled:text-slate-400'
  const previewColor = newStock <= 0 ? 'text-red-600' : newStock <= 10 ? 'text-yellow-600' : 'text-green-700'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-bold text-slate-800">재고 수량 수정</h3>
            <p className="text-xs text-slate-400 mt-0.5">{item.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* 총재고 미리보기 */}
          <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">수정 후 총재고</p>
            <p className={`text-3xl font-bold ${previewColor}`}>{newStock.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">{item.unit}</p>
          </div>

          {/* 수정 필드 */}
          <div className="space-y-3">
            {/* 입고 */}
            <div className="flex items-center gap-4">
              <div className="w-28 flex-shrink-0">
                <p className="text-sm font-semibold text-green-700">입고</p>
                <p className="text-xs text-slate-400">현재 {item.total_in.toLocaleString()}</p>
              </div>
              <input type="number" min={0} value={form.total_in}
                onChange={(e) => setForm({ ...form, total_in: Math.max(0, Number(e.target.value)) })}
                className={ic} />
            </div>

            {/* 출고 */}
            <div className="flex items-center gap-4">
              <div className="w-28 flex-shrink-0">
                <p className="text-sm font-semibold text-red-600">출고</p>
                <p className="text-xs text-slate-400">현재 {item.total_out.toLocaleString()}</p>
                {projMin.loaded && projMin.out > 0 && (
                  <p className="text-xs text-orange-500">프로젝트 {projMin.out} (최소)</p>
                )}
              </div>
              <input type="number" min={projMin.out} value={form.total_out}
                onChange={(e) => setForm({ ...form, total_out: Math.max(projMin.out, Number(e.target.value)) })}
                className={ic} />
            </div>

            {/* 손실 */}
            <div className="flex items-center gap-4">
              <div className="w-28 flex-shrink-0">
                <p className="text-sm font-semibold text-orange-600">손실</p>
                <p className="text-xs text-slate-400">현재 {item.total_loss.toLocaleString()}</p>
                {projMin.loaded && projMin.loss > 0 && (
                  <p className="text-xs text-orange-500">프로젝트 {projMin.loss} (최소)</p>
                )}
              </div>
              <input type="number" min={projMin.loss} value={form.total_loss}
                onChange={(e) => setForm({ ...form, total_loss: Math.max(projMin.loss, Number(e.target.value)) })}
                className={ic} />
            </div>
          </div>

          {/* 변경 사항 요약 */}
          {hasChanges && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs space-y-1">
              <p className="font-semibold text-amber-800 mb-1.5">변경 사항</p>
              {deltaIn !== 0 && (
                <p className="text-amber-700">입고: {item.total_in.toLocaleString()} → {form.total_in.toLocaleString()}
                  <span className={`ml-1.5 font-bold ${deltaIn > 0 ? 'text-green-600' : 'text-red-600'}`}>({deltaIn > 0 ? '+' : ''}{deltaIn})</span>
                </p>
              )}
              {deltaOut !== 0 && (
                <p className="text-amber-700">출고: {item.total_out.toLocaleString()} → {form.total_out.toLocaleString()}
                  <span className={`ml-1.5 font-bold ${deltaOut > 0 ? 'text-red-600' : 'text-green-600'}`}>({deltaOut > 0 ? '+' : ''}{deltaOut})</span>
                </p>
              )}
              {deltaLoss !== 0 && (
                <p className="text-amber-700">손실: {item.total_loss.toLocaleString()} → {form.total_loss.toLocaleString()}
                  <span className={`ml-1.5 font-bold ${deltaLoss > 0 ? 'text-red-600' : 'text-green-600'}`}>({deltaLoss > 0 ? '+' : ''}{deltaLoss})</span>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t bg-slate-50">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">취소</button>
          <button onClick={handleSave} disabled={saving || !hasChanges || !projMin.loaded}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50">
            {saving ? '저장 중...' : !projMin.loaded ? '로딩 중...' : '수정 완료'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { categories, getCategoryStyle } = useCategories()
  const [items, setItems] = useState<ItemWithStock[]>([])
  const [history, setHistory] = useState<HistoryTx[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>(() => searchParams.get('category') || '전체')
  const [showAddItem, setShowAddItem] = useState(false)
  const [showCategoryManage, setShowCategoryManage] = useState(false)
  const [editingStockItem, setEditingStockItem] = useState<ItemWithStock | null>(null)
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [historyLoaded, setHistoryLoaded] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const [itemsRes, txRes, historyRes] = await Promise.all([
        supabase.from('items').select('*').order('category').order('name'),
        supabase.from('inventory_transactions').select('item_id, transaction_type, quantity'),
        supabase
          .from('inventory_transactions')
          .select('*, items(name, category, unit), wms_projects(name)')
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(500),
      ])

      const allItems = itemsRes.data || []
      const txs = txRes.data || []

      // 재고 합계
      const stockMap: Record<string, { in: number; out: number; ret: number; loss: number; adj: number; discard: number }> = {}
      txs.forEach((tx) => {
        if (!stockMap[tx.item_id]) stockMap[tx.item_id] = { in: 0, out: 0, ret: 0, loss: 0, adj: 0, discard: 0 }
        if (tx.transaction_type === '입고') stockMap[tx.item_id].in += tx.quantity
        if (tx.transaction_type === '출고') stockMap[tx.item_id].out += tx.quantity
        if (tx.transaction_type === '반입') stockMap[tx.item_id].ret += tx.quantity
        if (tx.transaction_type === '손실') stockMap[tx.item_id].loss += tx.quantity
        if (tx.transaction_type === '파손') stockMap[tx.item_id].loss += tx.quantity
        if (tx.transaction_type === '분실') stockMap[tx.item_id].loss += tx.quantity
        if (tx.transaction_type === '재고조정') stockMap[tx.item_id].adj += tx.quantity
        if (tx.transaction_type === '폐기') stockMap[tx.item_id].discard += tx.quantity
        // 팩킹 does not affect stock
      })

      const withStock: ItemWithStock[] = allItems.map((item) => {
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
      setItems(withStock)

      // 히스토리 평탄화
      const historyFlat: HistoryTx[] = (historyRes.data || []).map((tx) => {
        const item = tx.items as { name: string; category: string; unit: string } | null
        const proj = tx.wms_projects as { name: string } | null
        return {
          ...tx,
          itemName: item?.name,
          itemCategory: item?.category,
          itemUnit: item?.unit,
          projectName: proj?.name,
        }
      })
      setHistory(historyFlat)

      // 기본으로 최근 날짜 2개 펼치기
      const dates = [...new Set(historyFlat.map((h) => h.transaction_date))].slice(0, 2)
      setExpandedDates(new Set(dates))
      setHistoryLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  useEffect(() => {
    const cat = searchParams.get('category')
    if (cat) setSelectedCategory(cat)
  }, [searchParams])

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat)
    if (cat === '전체') searchParams.delete('category')
    else searchParams.set('category', cat)
    setSearchParams(searchParams)
  }

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const filtered = items.filter((item) => {
    const matchCategory = selectedCategory === '전체' || item.category === selectedCategory
    const matchSearch = search === '' || item.name.toLowerCase().includes(search.toLowerCase())
    return matchCategory && matchSearch
  })

  // 히스토리: 날짜별 그룹핑
  const historyByDate = useMemo(() => {
    const q = historySearch.toLowerCase()
    const filtered = q
      ? history.filter(
          (tx) =>
            (tx.itemName || '').toLowerCase().includes(q) ||
            (tx.itemCategory || '').toLowerCase().includes(q) ||
            (tx.projectName || '').toLowerCase().includes(q)
        )
      : history

    const groups: { date: string; txs: HistoryTx[] }[] = []
    const seen = new Map<string, HistoryTx[]>()

    filtered.forEach((tx) => {
      const date = tx.transaction_date
      if (!seen.has(date)) {
        seen.set(date, [])
        groups.push({ date, txs: seen.get(date)! })
      }
      seen.get(date)!.push(tx)
    })

    return groups
  }, [history, historySearch])

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">재고현황</h1>
          <p className="text-slate-500 text-sm mt-1">전체 자재 재고 현황</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCategoryManage(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Settings2 size={15} />카테고리 관리
          </button>
          <button
            onClick={() => setShowAddItem(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
          >
            <Plus size={16} />자재 추가
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => handleCategoryChange('전체')}
          className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
            selectedCategory === '전체'
              ? 'bg-violet-600 text-white border-violet-600'
              : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
          }`}
        >
          전체
        </button>
        {categories.map((cat) => {
          const style = getCategoryStyle(cat.name)
          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.name)}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                selectedCategory === cat.name
                  ? style.tab
                  : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
              }`}
            >
              {cat.name}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="자재명 검색..."
          className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
        />
      </div>

      {/* 재고 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-center px-4 py-3.5 font-semibold text-slate-600 w-16">이미지</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">자재명</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">카테고리</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-600">단위</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-700 bg-slate-100">총재고</th>
                <th className="text-center px-4 py-3.5 font-semibold text-red-700">출고</th>
                <th className="text-center px-4 py-3.5 font-semibold text-green-700">입고</th>
                <th className="text-center px-4 py-3.5 font-semibold text-orange-700">손실</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-600 w-20">변경</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                  {search ? '검색 결과가 없습니다.' : '자재가 없습니다. 자재를 추가해주세요.'}
                </td></tr>
              ) : (
                filtered.map((item) => {
                  const style = getCategoryStyle(item.category)
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-center">
                        {item.image_url ? (
                          <button
                            onClick={() => setPreviewImage({ url: item.image_url!, name: item.name })}
                            className="inline-block w-10 h-10 rounded-lg overflow-hidden border border-slate-200 hover:border-violet-400 hover:shadow-md transition-all"
                          >
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                          </button>
                        ) : (
                          <div className="inline-flex w-10 h-10 rounded-lg border border-dashed border-slate-200 items-center justify-center text-slate-300">
                            <ImageOff size={14} />
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="font-medium text-slate-800">{item.name}</p>
                          {item.description && <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${style.badge}`}>
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-600">{item.unit}</td>
                      <td className="px-4 py-3.5 text-center bg-slate-50">
                        <span className={`text-base ${stockColor(item.current_stock)}`}>
                          {item.current_stock.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center text-red-600">{item.total_out.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-center text-green-700">{item.total_in.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-center text-orange-600">{item.total_loss.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => setEditingStockItem(item)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors"
                        >
                          <RefreshCw size={11} />변경
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            총 {filtered.length}개 자재
          </div>
        )}
      </div>

      {/* 변경 내역 히스토리 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-slate-400" />
            <h2 className="font-semibold text-slate-800">변경 내역</h2>
            {historyLoaded && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {history.length}건
              </span>
            )}
          </div>
          <div className="relative w-56">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="자재명·카테고리·프로젝트"
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
        </div>

        {!historyLoaded ? (
          <div className="py-10 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : historyByDate.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            {historySearch ? '검색 결과가 없습니다.' : '변경 내역이 없습니다.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {historyByDate.map(({ date, txs }) => {
              const isOpen = expandedDates.has(date)
              return (
                <div key={date}>
                  {/* 날짜 헤더 */}
                  <button
                    onClick={() => toggleDate(date)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                      <span className="text-sm font-semibold text-slate-700">{formatDateLabel(date)}</span>
                      <span className="text-xs text-slate-400">{txs.length}건</span>
                    </div>
                    {/* 날짜 요약 뱃지 */}
                    <div className="flex items-center gap-2">
                      {(['입고', '출고', '반입', '손실'] as TransactionType[]).map((t) => {
                        const count = txs.filter((tx) => tx.transaction_type === t).length
                        if (!count) return null
                        return (
                          <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadge[t]}`}>
                            {typeLabel[t]} {count}
                          </span>
                        )
                      })}
                    </div>
                  </button>

                  {/* 날짜 내 거래 목록 */}
                  {isOpen && (
                    <div className="border-t border-slate-50">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-50">
                          {txs.map((tx) => {
                            const catStyle = tx.itemCategory ? getCategoryStyle(tx.itemCategory) : null
                            return (
                              <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                <td className="pl-12 pr-4 py-2.5 font-medium text-slate-800 w-52">
                                  {tx.itemName || '-'}
                                </td>
                                <td className="px-3 py-2.5">
                                  {tx.itemCategory && catStyle && (
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${catStyle.badge}`}>
                                      {tx.itemCategory}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${typeBadge[tx.transaction_type]}`}>
                                    {typeLabel[tx.transaction_type]}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 font-semibold text-slate-800 text-right">
                                  <span className={
                                    tx.transaction_type === '입고' || tx.transaction_type === '반입'
                                      ? 'text-green-700'
                                      : 'text-red-600'
                                  }>
                                    {tx.transaction_type === '입고' || tx.transaction_type === '반입' ? '+' : '-'}
                                    {tx.quantity.toLocaleString()}
                                  </span>
                                  <span className="text-xs text-slate-400 font-normal ml-1">{tx.itemUnit}</span>
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-400">
                                  {tx.projectName && (
                                    <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full">
                                      {tx.projectName}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-xs text-slate-400 text-right max-w-[160px] truncate">
                                  {tx.notes || ''}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAddItem && <AddItemModal onClose={() => setShowAddItem(false)} onSuccess={fetchItems} />}
      {showCategoryManage && <CategoryManageModal onClose={() => setShowCategoryManage(false)} />}
      {editingStockItem && (
        <StockEditModal
          item={editingStockItem}
          onClose={() => setEditingStockItem(null)}
          onSuccess={fetchItems}
        />
      )}

      {previewImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPreviewImage(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b">
              <p className="font-semibold text-slate-800 text-sm">{previewImage.name}</p>
              <button onClick={() => setPreviewImage(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 bg-slate-50 flex items-center justify-center min-h-64">
              <img src={previewImage.url} alt={previewImage.name} className="max-h-[70vh] max-w-full object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
