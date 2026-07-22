import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Save, Trash2, Pencil, Check, ArrowLeft, GripVertical, List, Link2, Download, Upload } from 'lucide-react'
import {
  fetchItemMasterForAdmin, upsertItemMasterRows, deleteItemMasterRow, replaceAllItemMaster,
  type ItemMasterDraft,
} from '../lib/estimateActions'
import { deriveMarginRate } from '../lib/estimateCalculations'
import { exportItemMasterToExcel, parseItemMasterExcelFile, ItemMasterImportError } from '../lib/itemMasterExcel'
import { ESTIMATE_CATEGORIES } from '../components/estimates/EstimateItemsAccordion'
import { ESTIMATE_UNITS } from '../components/estimates/EstimateItemRow'
import { formatKRW, formatPercent } from '../lib/format'
import type { ClientType, EstimateCategory, ItemMaster } from '../types'

const NEW_CATEGORY_OPTION = '__new_category__'
const NEW_UNIT_OPTION = '__new_unit__'
const CLIENT_TYPES: ClientType[] = ['기획사용', '참가사용']

// 목록에 없는(사용자가 직접 입력한) 분류는 프리셋 뒤로 정렬한다.
function categoryOrderIndex(category: string): number {
  const idx = ESTIMATE_CATEGORIES.indexOf(category as EstimateCategory)
  return idx === -1 ? ESTIMATE_CATEGORIES.length : idx
}

const otherClientType = (ct: ClientType): ClientType => (ct === '참가사용' ? '기획사용' : '참가사용')

// 분류/품목명/상세내용/단위/실행단가는 기획사용·참가사용 짝 사이에 동기화되는 "공통 항목".
// 견적단가(quoted_unit_price)만 각자 별도로 입력한다.
const SHARED_FIELDS: (keyof ItemMaster)[] = ['category', 'name', 'size', 'unit', 'default_execution_unit_cost']

function emptyRow(clientType: ClientType, category: string): ItemMaster {
  return {
    id: crypto.randomUUID(),
    client_type: clientType,
    category,
    name: '',
    size: '',
    unit: '개',
    default_execution_unit_cost: 0,
    quoted_unit_price: 0,
    sort_order: 999,
    is_active: true,
    created_at: '',
  }
}

function buildDraftsFromParsedRows(parsed: {
  client_type: ClientType; category: string; name: string; size: string; unit: string
  default_execution_unit_cost: number; quoted_unit_price: number
}[]): ItemMasterDraft[] {
  const sortCounters = new Map<string, number>()
  const withIds = parsed.map((p) => {
    const groupKey = `${p.client_type}|${p.category}`
    const order = sortCounters.get(groupKey) ?? 0
    sortCounters.set(groupKey, order + 1)
    return { ...p, id: crypto.randomUUID(), sort_order: order }
  })

  const idByKey = new Map<string, string>()
  withIds.forEach((p) => {
    idByKey.set(`${p.client_type}::${p.category}|${p.name}|${p.size}`, p.id)
  })

  return withIds.map((p) => ({
    id: p.id,
    client_type: p.client_type,
    category: p.category,
    name: p.name,
    size: p.size || undefined,
    unit: p.unit,
    default_execution_unit_cost: p.default_execution_unit_cost,
    quoted_unit_price: p.quoted_unit_price,
    sort_order: p.sort_order,
    is_active: true,
    paired_item_id: idByKey.get(`${otherClientType(p.client_type)}::${p.category}|${p.name}|${p.size}`),
  }))
}

const inputCls =
  'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400'

export default function EstimatePriceList() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ItemMaster[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [clientTypeFilter, setClientTypeFilter] = useState<ClientType>('참가사용')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set())
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  // 값이 프리셋과 우연히 일치해도(예: 신규 단위 "개당" 입력 중 "개"만 쳤을 때) 드롭다운으로
  // 되돌아가지 않도록, 프리셋/직접입력 모드를 값에서 매번 유추하지 않고 별도 상태로 고정한다.
  const [customCategoryIds, setCustomCategoryIds] = useState<Set<string>>(new Set())
  const [customUnitIds, setCustomUnitIds] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchItemMasterForAdmin()
      setRows(data)
      setSavedIds(new Set(data.map((r) => r.id)))
      setCustomCategoryIds(new Set(data.filter((r) => !ESTIMATE_CATEGORIES.includes(r.category as EstimateCategory)).map((r) => r.id)))
      setCustomUnitIds(new Set(data.filter((r) => !ESTIMATE_UNITS.includes(r.unit)).map((r) => r.id)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const clientTypeRows = useMemo(
    () => rows.filter((r) => r.client_type === clientTypeFilter),
    [rows, clientTypeFilter]
  )

  const filtered = useMemo(() => {
    return clientTypeRows
      .filter((r) => {
        if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
        if (search.trim() && !r.name.toLowerCase().includes(search.trim().toLowerCase())) return false
        return true
      })
      .sort((a, b) => {
        const catDiff = categoryOrderIndex(a.category) - categoryOrderIndex(b.category)
        if (catDiff !== 0) return catDiff
        return a.sort_order - b.sort_order
      })
  }, [clientTypeRows, categoryFilter, search])

  const customCategories = useMemo(() => {
    return Array.from(new Set(clientTypeRows.map((r) => r.category))).filter(
      (c) => !ESTIMATE_CATEGORIES.includes(c as EstimateCategory)
    )
  }, [clientTypeRows])

  const handleAddRow = () => {
    const category = categoryFilter === 'all' ? ESTIMATE_CATEGORIES[0] : categoryFilter
    const primary = emptyRow(clientTypeFilter, category)
    const secondary = emptyRow(otherClientType(clientTypeFilter), category)
    primary.paired_item_id = secondary.id
    secondary.paired_item_id = primary.id
    setRows((prev) => [primary, secondary, ...prev])
    setEditingIds((prev) => new Set(prev).add(primary.id).add(secondary.id))
  }

  const handleChangeRow = (id: string, patch: Partial<ItemMaster>) => {
    setRows((prev) => {
      const target = prev.find((r) => r.id === id)
      const sharedPatch = Object.fromEntries(
        Object.entries(patch).filter(([k]) => SHARED_FIELDS.includes(k as keyof ItemMaster))
      )
      const hasSharedChange = Object.keys(sharedPatch).length > 0
      return prev.map((r) => {
        if (r.id === id) return { ...r, ...patch }
        if (hasSharedChange && target?.paired_item_id && r.id === target.paired_item_id) return { ...r, ...sharedPatch }
        return r
      })
    })
  }

  const handleToggleEdit = (id: string) => {
    setEditingIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 같은 분류 안에서만 순서 변경을 허용한다 (다른 분류 위에 놓으면 무시).
  const handleDropRow = (targetId: string) => {
    const sourceId = draggedId
    setDraggedId(null)
    setDragOverId(null)
    if (!sourceId || sourceId === targetId) return

    const dragged = rows.find((r) => r.id === sourceId)
    const target = rows.find((r) => r.id === targetId)
    if (!dragged || !target || dragged.category !== target.category) return

    const categoryItems = rows
      .filter((r) => r.category === dragged.category)
      .sort((a, b) => a.sort_order - b.sort_order)
    const fromIndex = categoryItems.findIndex((r) => r.id === sourceId)
    const toIndex = categoryItems.findIndex((r) => r.id === targetId)
    categoryItems.splice(fromIndex, 1)
    categoryItems.splice(toIndex, 0, dragged)

    const newSortOrder = new Map(categoryItems.map((r, i) => [r.id, i]))
    setRows((prev) => prev.map((r) => (newSortOrder.has(r.id) ? { ...r, sort_order: newSortOrder.get(r.id)! } : r)))
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
    setRows((prev) => prev
      .filter((r) => r.id !== id)
      .map((r) => (r.paired_item_id === id ? { ...r, paired_item_id: undefined } : r))
    )
    setEditingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleSave = async () => {
    if (rows.some((r) => !r.name.trim())) { alert('항목명이 비어 있는 행이 있습니다.'); return }
    if (rows.some((r) => !r.category.trim())) { alert('분류가 비어 있는 행이 있습니다. (새 분류명을 입력해주세요)'); return }
    setSaving(true)
    try {
      const drafts: ItemMasterDraft[] = rows.map((r) => ({
        id: r.id,
        client_type: r.client_type,
        category: r.category,
        name: r.name.trim(),
        size: r.size || undefined,
        description: r.description,
        unit: r.unit,
        default_execution_unit_cost: r.default_execution_unit_cost,
        quoted_unit_price: r.quoted_unit_price,
        sort_order: r.sort_order,
        is_active: r.is_active,
        paired_item_id: r.paired_item_id,
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

  const handleExportExcel = () => {
    void exportItemMasterToExcel(rows)
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!window.confirm('기존데이타가 삭제되고, 업로드 데이타로 교체됩니다. 진행하시겠습니까?')) return

    setUploading(true)
    try {
      const parsed = await parseItemMasterExcelFile(file)
      const drafts = buildDraftsFromParsedRows(parsed)
      await replaceAllItemMaster(drafts)
      await load()
      setEditingIds(new Set())
      alert(`업로드 완료 — 총 ${drafts.length}개 품목으로 교체되었습니다.`)
    } catch (err) {
      console.error(err)
      const message = err instanceof ItemMasterImportError ? err.message : '업로드에 실패했습니다.'
      alert(message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={() => navigate('/estimates')}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-2">
            <ArrowLeft size={13} />견적서로 돌아가기
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">견적단가</h1>
          <p className="text-slate-500 text-sm mt-0.5">분류별 실행단가·견적단가 관리 — 견적서 작성 시 자동 적용됩니다</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelected} />
          <button onClick={handleUploadClick} disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50">
            <Upload size={15} />{uploading ? '업로드 중...' : '엑셀 업로드'}
          </button>
          <button onClick={handleExportExcel}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
            <Download size={15} />엑셀 다운로드
          </button>
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

      <div className="flex gap-2">
        {CLIENT_TYPES.map((ct) => (
          <button key={ct} onClick={() => { setClientTypeFilter(ct); setCategoryFilter('all') }}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              clientTypeFilter === ct ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-300'
            }`}>
            {ct} <span className="ml-1 text-xs opacity-70">({rows.filter((r) => r.client_type === ct).length})</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 -mt-2">
        <Link2 size={11} className="inline mr-1 -mt-0.5" />
        품목을 추가하면 반대쪽 고객유형에도 동일한 품목이 자동으로 생기며, 견적단가만 각자 별도로 입력하면 됩니다.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-lg transition-colors ${
              categoryFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-300'
            }`}>
            전체 <span className="ml-1 text-xs opacity-70">({clientTypeRows.length})</span>
          </button>
          {ESTIMATE_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-lg transition-colors ${
                categoryFilter === c ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-300'
              }`}>
              {c} <span className="ml-1 text-xs opacity-70">({clientTypeRows.filter((r) => r.category === c).length})</span>
            </button>
          ))}
          {customCategories.map((c) => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-lg transition-colors border-dashed border-2 ${
                categoryFilter === c ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-300'
              }`}>
              {c} <span className="ml-1 text-xs opacity-70">({clientTypeRows.filter((r) => r.category === c).length})</span>
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
                <th className="w-6" />
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
                <tr><td colSpan={9} className="px-3 py-12 text-center text-slate-400">불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-12 text-center text-slate-400">등록된 품목이 없습니다.</td></tr>
              ) : (
                filtered.map((row) => {
                  const marginRate = deriveMarginRate(row.default_execution_unit_cost, row.quoted_unit_price)
                  const isEditing = editingIds.has(row.id)
                  const marginCls = row.quoted_unit_price === 0 ? 'text-slate-300' : marginRate < 0 ? 'text-red-600' : 'text-green-700'
                  const isPaired = Boolean(row.paired_item_id)

                  if (!isEditing) {
                    return (
                      <tr key={row.id}
                        draggable
                        onDragStart={() => setDraggedId(row.id)}
                        onDragOver={(e) => { e.preventDefault(); if (dragOverId !== row.id) setDragOverId(row.id) }}
                        onDragLeave={() => setDragOverId((prev) => (prev === row.id ? null : prev))}
                        onDrop={(e) => { e.preventDefault(); handleDropRow(row.id) }}
                        onDragEnd={() => { setDraggedId(null); setDragOverId(null) }}
                        className={`cursor-grab active:cursor-grabbing hover:bg-slate-50 ${
                          dragOverId === row.id ? 'border-t-2 border-violet-500' : ''
                        } ${draggedId === row.id ? 'opacity-40' : ''}`}
                      >
                        <td className="px-1 py-2 text-slate-300 w-6"><GripVertical size={14} /></td>
                        <td className="px-2 py-2 text-slate-600">{row.category}</td>
                        <td className="px-2 py-2 min-w-[160px] font-medium text-slate-800">
                          {row.name}
                          {isPaired && <Link2 size={11} className="inline ml-1 text-violet-300" />}
                        </td>
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
                      <td className="px-1 py-1.5" />
                      <td className="px-2 py-1.5">
                        {!customCategoryIds.has(row.id) ? (
                          <select value={row.category}
                            onChange={(e) => {
                              if (e.target.value === NEW_CATEGORY_OPTION) {
                                setCustomCategoryIds((prev) => new Set(prev).add(row.id))
                                handleChangeRow(row.id, { category: '' })
                                return
                              }
                              handleChangeRow(row.id, { category: e.target.value })
                            }}
                            className={inputCls}>
                            {ESTIMATE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            <option value={NEW_CATEGORY_OPTION}>+ 새 분류 직접 입력</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input value={row.category} onChange={(e) => handleChangeRow(row.id, { category: e.target.value })}
                              placeholder="새 분류명" autoFocus className={inputCls} />
                            <button type="button" onClick={() => {
                              setCustomCategoryIds((prev) => { const next = new Set(prev); next.delete(row.id); return next })
                              handleChangeRow(row.id, { category: ESTIMATE_CATEGORIES[0] })
                            }}
                              title="목록에서 선택" className="flex-shrink-0 text-slate-300 hover:text-violet-500 transition-colors">
                              <List size={14} />
                            </button>
                          </div>
                        )}
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
                        {!customUnitIds.has(row.id) ? (
                          <select value={row.unit}
                            onChange={(e) => {
                              if (e.target.value === NEW_UNIT_OPTION) {
                                setCustomUnitIds((prev) => new Set(prev).add(row.id))
                                handleChangeRow(row.id, { unit: '' })
                                return
                              }
                              handleChangeRow(row.id, { unit: e.target.value })
                            }}
                            className={`${inputCls} text-center`}>
                            {ESTIMATE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                            <option value={NEW_UNIT_OPTION}>+ 새 단위 직접 입력</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input value={row.unit} onChange={(e) => handleChangeRow(row.id, { unit: e.target.value })}
                              placeholder="새 단위" autoFocus className={inputCls} />
                            <button type="button" onClick={() => {
                              setCustomUnitIds((prev) => { const next = new Set(prev); next.delete(row.id); return next })
                              handleChangeRow(row.id, { unit: ESTIMATE_UNITS[0] })
                            }}
                              title="목록에서 선택" className="flex-shrink-0 text-slate-300 hover:text-violet-500 transition-colors">
                              <List size={14} />
                            </button>
                          </div>
                        )}
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
