import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCategories } from '../contexts/CategoriesContext'

interface ItemFrequency {
  itemId: string
  itemName: string
  itemCategory: string
  itemUnit: string
  projectCount: number
  txCount: number
  totalQty: number
}

type SortKey = 'projectCount' | 'totalQty' | 'txCount'

export default function MaterialFrequency() {
  const { categories, getCategoryStyle } = useCategories()
  const [data, setData] = useState<ItemFrequency[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('전체')
  const [sortKey, setSortKey] = useState<SortKey>('projectCount')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: txs } = await supabase
      .from('inventory_transactions')
      .select('item_id, project_id, quantity, items(name, category, unit)')
      .eq('transaction_type', '출고')
      .limit(10000)

    if (!txs) { setLoading(false); return }

    const freqMap = new Map<string, { name: string; category: string; unit: string; txCount: number; totalQty: number }>()
    const projectSets = new Map<string, Set<string>>()

    txs.forEach((tx) => {
      const item = tx.items as unknown as { name: string; category: string; unit: string } | null
      if (!item) return
      if (!freqMap.has(tx.item_id)) {
        freqMap.set(tx.item_id, { name: item.name, category: item.category, unit: item.unit, txCount: 0, totalQty: 0 })
        projectSets.set(tx.item_id, new Set())
      }
      const entry = freqMap.get(tx.item_id)!
      entry.txCount++
      entry.totalQty += tx.quantity
      if (tx.project_id) projectSets.get(tx.item_id)!.add(tx.project_id)
    })

    const result: ItemFrequency[] = [...freqMap.entries()].map(([itemId, e]) => ({
      itemId,
      itemName: e.name,
      itemCategory: e.category,
      itemUnit: e.unit,
      txCount: e.txCount,
      totalQty: e.totalQty,
      projectCount: projectSets.get(itemId)?.size ?? 0,
    }))

    setData(result)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return data
      .filter((d) => {
        const matchCat = selectedCategory === '전체' || d.itemCategory === selectedCategory
        const matchSearch = !q || d.itemName.toLowerCase().includes(q) || d.itemCategory.toLowerCase().includes(q)
        return matchCat && matchSearch
      })
      .sort((a, b) => b[sortKey] - a[sortKey])
  }, [data, search, selectedCategory, sortKey])

  const maxVal = Math.max(...filtered.map((d) => d[sortKey]), 1)

  const sortLabel: Record<SortKey, string> = {
    projectCount: '프로젝트 수',
    totalQty: '총 출고량',
    txCount: '출고 건수',
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-800">자재사용빈도</h1>
        <p className="text-slate-500 text-sm mt-0.5">프로젝트별 자재 출고 빈도 현황</p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory('전체')}
          className={`px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-medium rounded-lg border transition-colors ${
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
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-medium rounded-lg border transition-colors ${
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

      {/* Search + Sort */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="자재명 검색..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          />
        </div>
        <div className="flex gap-1 bg-white border border-slate-300 rounded-lg p-1">
          {(['projectCount', 'totalQty', 'txCount'] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                sortKey === k
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {sortLabel[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Legend row */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>자재명</span>
          <div className="flex items-center gap-6">
            <span>프로젝트 수</span>
            <span>총 출고량</span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm">
            {search || selectedCategory !== '전체' ? '검색 결과가 없습니다.' : '출고 내역이 없습니다.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((item, idx) => {
              const style = getCategoryStyle(item.itemCategory)
              const ratio = (item[sortKey] / maxVal) * 100

              const barColor =
                ratio >= 75 ? 'bg-violet-500' :
                ratio >= 50 ? 'bg-violet-400' :
                ratio >= 25 ? 'bg-violet-300' :
                'bg-violet-200'

              return (
                <div key={item.itemId} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  {/* Rank */}
                  <div className="flex-shrink-0 w-6 text-xs font-bold text-slate-300 text-right">{idx + 1}</div>

                  {/* Category badge + Name */}
                  <div className="flex-shrink-0 w-44 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full border flex-shrink-0 ${style.badge}`}>
                        {item.itemCategory}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.itemName}</p>
                  </div>

                  {/* Bar */}
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                    <span className="flex-shrink-0 text-sm font-bold text-violet-700 w-10 text-right">
                      {item[sortKey].toLocaleString()}
                      <span className="text-xs text-slate-400 font-normal ml-0.5">
                        {sortKey === 'projectCount' ? '건' : sortKey === 'totalQty' ? item.itemUnit : '회'}
                      </span>
                    </span>
                  </div>

                  {/* Side stats */}
                  <div className="flex-shrink-0 hidden md:flex items-center gap-4 text-right">
                    {sortKey !== 'projectCount' && (
                      <div>
                        <p className="text-xs text-slate-400">프로젝트</p>
                        <p className="text-sm font-semibold text-slate-700">{item.projectCount}건</p>
                      </div>
                    )}
                    {sortKey !== 'totalQty' && (
                      <div>
                        <p className="text-xs text-slate-400">총 출고</p>
                        <p className="text-sm font-semibold text-slate-700">{item.totalQty.toLocaleString()} {item.itemUnit}</p>
                      </div>
                    )}
                    {sortKey !== 'txCount' && (
                      <div>
                        <p className="text-xs text-slate-400">출고 건수</p>
                        <p className="text-sm font-semibold text-slate-700">{item.txCount}회</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            총 {filtered.length}개 자재 · 정렬 기준: {sortLabel[sortKey]}
          </div>
        )}
      </div>
    </div>
  )
}
