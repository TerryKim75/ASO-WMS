import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Save, Trash2, Pencil, Check } from 'lucide-react'
import {
  fetchItemMasterForAdmin, upsertItemMasterRows, deleteItemMasterRow, type ItemMasterDraft,
} from '../lib/estimateActions'
import { deriveMarginRate } from '../lib/estimateCalculations'
import { ESTIMATE_CATEGORIES } from '../components/estimates/EstimateItemsAccordion'
import { formatKRW, formatPercent } from '../lib/format'
import type { EstimateCategory, EstimateUnit, ItemMaster } from '../types'

const ESTIMATE_UNITS: EstimateUnit[] = ['개', '회배', '식', '세트', '회', '장', '미터', '대', '시간', 'KW', '모듈']

const emptyRow = (category: EstimateCategory): ItemMaster => ({
  id: crypto.randomUUID(),
  category,
  name: '',
  size: '',
  unit: '개',
  default_execution_unit_cost: 0,
  quoted_unit_price: 0,
  sort_order: 999,
  is_active: true,
  created_at: '',
})

const inputCls =
  'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400'

export default function EstimatePriceList() {
  const [rows, setRows] = useState<ItemMaster[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<EstimateCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchItemMasterForAdmin()
      setRows(data)
      setSavedIds(new Set(data.map((r) => r.id)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    return rows
      .filter((r) => {
        if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
        if (search.trim() && !r.name.toLowerCase().includes(search.trim().toLowerCase())) return false
        return true
      })
      .sort((a, b) => a.quoted_unit_price - b.quoted_unit_price)
  }, [rows, categoryFilter, search])

  const handleAddRow = () => {
    const category = categoryFilter === 'all' ? ESTIMATE_CATEGORIES[0] : categoryFilter
    const row = emptyRow(category)
    setRows((prev) => [row, ...prev])
    setEditingIds((prev) => new Set(prev).add(row.id))
  }

  const handleChangeRow = (id: string, patch: Partial<ItemMaster>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const handleToggleEdit = (id: string) => {
    setEditingIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleRemoveRow = async (id: string) => {
    if (savedIds.has(id)) {
      if (!window.confirm('이 품목을 견적단가 목록에서 삭제할까요?')) return
      try {
        await deleteItemMasterRow(id)
      } catch {
        alert('삭제에 실패했습니다.')
        return
      }
    }
    setRows((prev) => prev.filter((r) => r.id !== id))
    setEditingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleSave = async () => {
    const invalid = rows.some((r) => !r.name.trim())
    if (invalid) { alert('항목명이 비어 있는 행이 있습니다.'); return }
    setSaving(true)
    try {
      const drafts: ItemMasterDraft[] = rows.map((r) => ({
        id: r.id,
        category: r.category,
        name: r.name.trim(),
        size: r.size || undefined,
        description: r.description,
        unit: r.unit,
        default_execution_unit_cost: r.default_execution_unit_cost,
        quoted_unit_price: r.quoted_unit_price,
        sort_order: r.sort_order,
        is_active: r.is_active,
      }))
      await upsertItemMasterRows(drafts)
      await load()
      setEditingIds(new Set())
      alert('저장되었습니다.')
    } catch (e) {
      console.error(e)
      alert('저장에 실패했습니다. (동일 분류/품목명/상세내용 조합이 중복되지 않았는지 확인해주세요)')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">견적단가</h1>
          <p className="text-slate-500 text-sm mt-0.5">분류별 실행단가·견적단가 관리 — 견적서 작성 시 자동 적용됩니다</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleAddRow}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors">
            <Plus size={15} />품목 추가
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors shadow-sm disabled:opacity-50">
            <Save size={15} />{saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-lg transition-colors ${
              categoryFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-300'
            }`}>
            전체 <span className="ml-1 text-xs opacity-70">({rows.length})</span>
          </button>
          {ESTIMATE_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-lg transition-colors ${
                categoryFilter === c ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-300'
              }`}>
              {c} <span className="ml-1 text-xs opacity-70">({rows.filter((r) => r.category === c).length})</span>
            </button>
          ))}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="품목명 검색..."
          className={`${inputCls} max-w-[200px] ml-auto`} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-2 py-2.5 font-semibold text-slate-600 text-xs w-36">분류</th>
                <th className="text-left px-2 py-2.5 font-semibold text-slate-600 text-xs">품목</th>
                <th className="text-left px-2 py-2.5 font-semibold text-slate-600 text-xs w-28">상세내용</th>
                <th className="text-center px-2 py-2.5 font-semibold text-slate-600 text-xs w-20">단위</th>
                <th className="text-right px-2 py-2.5 font-semibold text-slate-600 text-xs w-32">실행단가</th>
                <th className="text-right px-2 py-2.5 font-semibold text-slate-600 text-xs w-32">견적단가</th>
                <th className="text-center px-2 py-2.5 font-semibold text-slate-600 text-xs w-20">이윤율</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-12 text-center text-slate-400">불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-12 text-center text-slate-400">등록된 품목이 없습니다.</td></tr>
              ) : (
                filtered.map((row) => {
                  const marginRate = deriveMarginRate(row.default_execution_unit_cost, row.quoted_unit_price)
                  const isEditing = editingIds.has(row.id)
                  const marginCls = row.quoted_unit_price === 0 ? 'text-slate-300' : marginRate < 0 ? 'text-red-600' : 'text-green-700'

                  if (!isEditing) {
                    return (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-2 py-2 text-slate-600">{row.category}</td>
                        <td className="px-2 py-2 min-w-[160px] font-medium text-slate-800">{row.name}</td>
                        <td className="px-2 py-2 text-slate-500">{row.size || '-'}</td>
                        <td className="px-2 py-2 text-center text-slate-500">{row.unit}</td>
                        <td className="px-2 py-2 text-right text-slate-600 whitespace-nowrap">{formatKRW(row.default_execution_unit_cost)}</td>
                        <td className="px-2 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">{formatKRW(row.quoted_unit_price)}</td>
                        <td className={`px-2 py-2 text-center text-xs font-medium ${marginCls}`}>
                          {row.quoted_unit_price === 0 ? '-' : formatPercent(marginRate)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleToggleEdit(row.id)} title="수정" className="text-slate-300 hover:text-violet-500 transition-colors">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleRemoveRow(row.id)} title="삭제" className="text-slate-300 hover:text-red-400 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={row.id} className="bg-violet-50/40">
                      <td className="px-2 py-1.5">
                        <select value={row.category} onChange={(e) => handleChangeRow(row.id, { category: e.target.value as EstimateCategory })}
                          className={inputCls}>
                          {ESTIMATE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 min-w-[160px]">
                        <input value={row.name} onChange={(e) => handleChangeRow(row.id, { name: e.target.value })}
                          placeholder="품목명" className={inputCls} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={row.size || ''} onChange={(e) => handleChangeRow(row.id, { size: e.target.value })}
                          placeholder="상세내용" className={inputCls} />
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={row.unit} onChange={(e) => handleChangeRow(row.id, { unit: e.target.value as EstimateUnit })}
                          className={`${inputCls} text-center`}>
                          {ESTIMATE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" value={row.default_execution_unit_cost}
                          onChange={(e) => handleChangeRow(row.id, { default_execution_unit_cost: Number(e.target.value) || 0 })}
                          className={`${inputCls} text-right`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" value={row.quoted_unit_price}
                          onChange={(e) => handleChangeRow(row.id, { quoted_unit_price: Number(e.target.value) || 0 })}
                          className={`${inputCls} text-right`} />
                      </td>
                      <td className={`px-2 py-2 text-center text-xs font-medium ${marginCls}`}>
                        {row.quoted_unit_price === 0 ? '-' : formatPercent(marginRate)}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleToggleEdit(row.id)} title="수정 완료" className="text-violet-500 hover:text-violet-700 transition-colors">
                            <Check size={15} />
                          </button>
                          <button onClick={() => handleRemoveRow(row.id)} title="삭제" className="text-slate-300 hover:text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
            <span>총 {filtered.length}개 품목</span>
            <span>변경사항은 상단 "저장" 버튼을 눌러야 반영됩니다.</span>
          </div>
        )}
      </div>
    </div>
  )
}
