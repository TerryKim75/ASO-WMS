import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Edit2, Check, X, Phone, Mail, Users,
  FileText, Paperclip, Search, Building2, ChevronDown, ChevronRight,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { WmsProject, ProjectStatus, Item, InventoryTransaction } from '../types'
import { STATUS_COLORS } from './Projects'
import TransactionModal from '../components/TransactionModal'
import PurchaseOrderModal from '../components/PurchaseOrderModal'

const STATUSES: ProjectStatus[] = ['제안중', '계약완료', '시공진행', '완료', '취소']

function formatDatetime(date?: string, time?: string) {
  if (!date) return null
  const [y, m, d] = date.split('-')
  const str = `${y}.${m}.${d}`
  return time ? `${str} ${time.slice(0, 5)}` : str
}

interface Vendor {
  id: string; name: string; category?: string
  contact_name?: string; phone?: string; email?: string
}

interface PurchaseOrder {
  id: string; vendor_id: string; order_number: string; order_date: string
  delivery_date?: string; total_amount: number; status: string
  file_url?: string; notes?: string
  vendors?: { name: string; contact_name?: string; phone?: string }
}

// 자재별 집계
interface ItemSummary {
  item: Item
  totalOut: number
  totalReturn: number
  totalLoss: number
  unreturned: number
  transactions: InventoryTransaction[]
}

const typeBadge: Record<string, string> = {
  입고: 'bg-green-100 text-green-700',
  출고: 'bg-red-100 text-red-700',
  반입: 'bg-blue-100 text-blue-700',
  손실: 'bg-orange-100 text-orange-700',
}

function VendorSelectDialog({
  vendors, onSelect, onClose,
}: { vendors: Vendor[]; onSelect: (v: Vendor) => void; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const filtered = vendors.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    (v.category || '').toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <h3 className="font-bold text-slate-800">거래처 선택</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-4 flex-shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="거래처 검색..." autoFocus
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-3 pb-4 space-y-1">
          {filtered.length === 0
            ? <p className="text-center text-slate-400 text-sm py-6">검색 결과가 없습니다.</p>
            : filtered.map((v) => (
              <button key={v.id} onClick={() => onSelect(v)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-violet-50 transition-colors border border-transparent hover:border-violet-200">
                <p className="font-medium text-slate-800 text-sm">{v.name}</p>
                {v.category && <p className="text-xs text-slate-400 mt-0.5">{v.category}</p>}
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}

function ItemPickModal({
  items, onSelect, onClose,
}: { items: Item[]; onSelect: (item: Item) => void; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const filtered = items.filter((it) =>
    it.name.toLowerCase().includes(search.toLowerCase()) ||
    it.category.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col max-h-[75vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <h3 className="font-bold text-slate-800">자재 선택</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-3 flex-shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="자재명·카테고리 검색..." autoFocus
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-3 pb-3 space-y-1">
          {filtered.length === 0
            ? <p className="text-center text-slate-400 text-sm py-6">검색 결과가 없습니다.</p>
            : filtered.map((it) => (
              <button key={it.id} onClick={() => onSelect(it)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-violet-50 transition-colors border border-transparent hover:border-violet-200 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800 text-sm">{it.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{it.category} · {it.unit}</p>
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project, setProject] = useState<WmsProject | null>(null)
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [editingStatus, setEditingStatus] = useState(false)
  const [newStatus, setNewStatus] = useState<ProjectStatus>('제안중')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [showItemPicker, setShowItemPicker] = useState(false)
  const [allItems, setAllItems] = useState<Item[]>([])
  const [selectingVendor, setSelectingVendor] = useState(false)
  const [orderVendor, setOrderVendor] = useState<Vendor | null>(null)
  const [uploadingPoId, setUploadingPoId] = useState<string | null>(null)
  const [txSearch, setTxSearch] = useState('')

  const fetchProjectData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [projectRes, txRes, posRes, vendorsRes, itemsRes] = await Promise.all([
        supabase.from('wms_projects').select('*').eq('id', id).single(),
        supabase
          .from('inventory_transactions')
          .select('*, items(id, name, category, unit, description, created_at)')
          .eq('project_id', id)
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('purchase_orders')
          .select('*, vendors(name, contact_name, phone)')
          .eq('project_id', id)
          .order('order_date', { ascending: false }),
        supabase.from('vendors').select('id, name, category, contact_name, phone, email').order('name'),
        supabase.from('items').select('*').order('category').order('name'),
      ])
      if (projectRes.data) { setProject(projectRes.data); setNewStatus(projectRes.data.status) }
      setTransactions((txRes.data || []) as InventoryTransaction[])
      setPurchaseOrders((posRes.data || []) as PurchaseOrder[])
      setVendors((vendorsRes.data || []) as Vendor[])
      setAllItems((itemsRes.data || []) as Item[])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchProjectData() }, [fetchProjectData])

  const handleStatusUpdate = async () => {
    if (!project || !id) return
    const { error } = await supabase.from('wms_projects').update({ status: newStatus }).eq('id', id)
    if (!error) { setProject({ ...project, status: newStatus }); setEditingStatus(false) }
  }

  const handleFileUpload = async (poId: string, file: File) => {
    setUploadingPoId(poId)
    try {
      const ext = file.name.split('.').pop()
      const path = `${poId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('purchase-order-files').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('purchase-order-files').getPublicUrl(path)
      await supabase.from('purchase_orders').update({ file_url: urlData.publicUrl }).eq('id', poId)
      fetchProjectData()
    } finally {
      setUploadingPoId(null)
    }
  }

  // 자재별 집계
  const itemSummaries = useMemo<ItemSummary[]>(() => {
    const map = new Map<string, ItemSummary>()
    transactions.forEach((tx) => {
      const item = tx.items as Item | undefined
      if (!item) return
      if (!map.has(item.id)) {
        map.set(item.id, { item, totalOut: 0, totalReturn: 0, totalLoss: 0, unreturned: 0, transactions: [] })
      }
      const s = map.get(item.id)!
      s.transactions.push(tx)
      if (tx.transaction_type === '출고') s.totalOut += tx.quantity
      if (tx.transaction_type === '반입') s.totalReturn += tx.quantity
      if (tx.transaction_type === '손실') s.totalLoss += tx.quantity
    })
    return [...map.values()]
      .map((s) => ({ ...s, unreturned: s.totalOut - s.totalReturn - s.totalLoss }))
      .sort((a, b) => b.totalOut - a.totalOut)
  }, [transactions])

  const filteredSummaries = useMemo(() => {
    if (!txSearch.trim()) return itemSummaries
    const q = txSearch.toLowerCase()
    return itemSummaries.filter((s) =>
      s.item.name.toLowerCase().includes(q) || s.item.category.toLowerCase().includes(q)
    )
  }, [itemSummaries, txSearch])

  const toggleItem = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  if (loading) return <div className="p-6 text-center text-slate-400 py-20">불러오는 중...</div>
  if (!project) return (
    <div className="p-6 text-center text-slate-400 py-20">
      프로젝트를 찾을 수 없습니다.
      <button onClick={() => navigate('/projects')} className="block mx-auto mt-4 text-violet-600">목록으로</button>
    </div>
  )

  const totalOut = itemSummaries.reduce((a, s) => a + s.totalOut, 0)
  const totalReturn = itemSummaries.reduce((a, s) => a + s.totalReturn, 0)
  const totalLoss = itemSummaries.reduce((a, s) => a + s.totalLoss, 0)
  const totalUnreturned = totalOut - totalReturn - totalLoss
  const startDt = formatDatetime(project.start_date, project.start_time)
  const endDt = formatDatetime(project.end_date, project.end_time)

  return (
    <div className="p-6 space-y-6">
      <button onClick={() => navigate('/projects')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft size={16} />프로젝트 목록
      </button>

      {/* 프로젝트 헤더 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-800">{project.name}</h1>
            <div className="mt-4 grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 text-sm">
              {project.exhibition && <div><span className="text-slate-400 text-xs">전시회</span><p className="text-slate-700 font-medium">{project.exhibition}</p></div>}
              {project.organizer && <div><span className="text-slate-400 text-xs">기획사</span><p className="text-slate-700 font-medium">{project.organizer}</p></div>}
              {project.exhibitor && <div><span className="text-slate-400 text-xs">참가사</span><p className="text-slate-700 font-medium">{project.exhibitor}</p></div>}
              {project.manager && <div><span className="text-slate-400 text-xs">담당</span><p className="text-slate-700 font-medium">{project.manager}</p></div>}
              {(startDt || endDt) && (
                <div className="col-span-2">
                  <span className="text-slate-400 text-xs">전시일정</span>
                  <p className="text-slate-700 font-medium">{startDt}{startDt && endDt && ' ~ '}{endDt}</p>
                </div>
              )}
            </div>
            {project.notes && <p className="text-sm text-slate-500 mt-3 bg-slate-50 px-3 py-2 rounded-lg">{project.notes}</p>}
          </div>

          {/* 진행현황 편집 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {editingStatus ? (
              <>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as ProjectStatus)}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={handleStatusUpdate} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Check size={16} /></button>
                <button onClick={() => { setEditingStatus(false); setNewStatus(project.status) }} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg"><X size={16} /></button>
              </>
            ) : (
              <>
                <span className={`px-3 py-1 text-sm font-medium rounded-full border ${STATUS_COLORS[project.status] || 'bg-slate-100 text-slate-600'}`}>
                  {project.status}
                </span>
                <button onClick={() => setEditingStatus(true)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><Edit2 size={14} /></button>
              </>
            )}
          </div>
        </div>

        {/* 시공인력 */}
        {project.construction_staff && project.construction_staff.length > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">시공인력</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {project.construction_staff.map((s, i) => (
                <div key={i} className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
                  <p className="font-semibold text-slate-800 text-sm">{s.name}</p>
                  {s.phone && <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-600 mt-1 transition-colors"><Phone size={11} />{s.phone}</a>}
                  {s.email && <a href={`mailto:${s.email}`} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-600 mt-0.5 transition-colors"><Mail size={11} />{s.email}</a>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 요약 수치 */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{totalOut.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">총 출고</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{totalReturn.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">총 반입</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">{totalLoss.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">총 손실</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${totalUnreturned > 0 ? 'text-red-600' : 'text-slate-400'}`}>
              {totalUnreturned.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">미반입</p>
          </div>
        </div>
      </div>

      {/* ─── 입출고 내역 (통합) ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-800">입출고 내역</h2>
            {itemSummaries.length > 0 && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {itemSummaries.length}개 자재
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* 검색 */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="자재명·카테고리"
                className="pl-7 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs w-40 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <button
              onClick={() => setShowItemPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
            >
              <Plus size={13} />자재 등록
            </button>
          </div>
        </div>

        {/* 테이블 헤더 */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-8 px-3 py-3" />
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">카테고리</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">자재명</th>
                <th className="text-center px-4 py-3 font-semibold text-red-700 text-xs">출고</th>
                <th className="text-center px-4 py-3 font-semibold text-blue-700 text-xs">반입</th>
                <th className="text-center px-4 py-3 font-semibold text-orange-700 text-xs">손실</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs">미반입</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">비고</th>
                <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs w-16">등록</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-400 text-sm">
                    {txSearch ? '검색 결과가 없습니다.' : '등록된 자재가 없습니다. 자재 등록 버튼으로 추가하세요.'}
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((summary) => {
                  const isExpanded = expandedItems.has(summary.item.id)
                  const hasUnreturned = summary.unreturned > 0

                  return (
                    <>
                      {/* 자재 요약 행 */}
                      <tr
                        key={summary.item.id}
                        className={`border-b border-slate-100 transition-colors ${hasUnreturned ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}
                      >
                        {/* 펼치기 토글 */}
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => toggleItem(summary.item.id)}
                            className="text-slate-400 hover:text-violet-600 transition-colors"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{summary.item.category}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">{summary.item.name}</span>
                            {hasUnreturned && <AlertCircle size={13} className="text-red-400 flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-slate-400">{summary.item.unit}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold ${summary.totalOut > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                            {summary.totalOut.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold ${summary.totalReturn > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
                            {summary.totalReturn.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold ${summary.totalLoss > 0 ? 'text-orange-600' : 'text-slate-300'}`}>
                            {summary.totalLoss.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold text-base ${hasUnreturned ? 'text-red-600' : 'text-slate-400'}`}>
                            {summary.unreturned.toLocaleString()}
                          </span>
                        </td>
                        {/* 비고: 가장 최근 tx notes */}
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[140px] truncate">
                          {summary.transactions.find((t) => t.notes)?.notes || (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => setSelectedItem(summary.item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors"
                          >
                            <Plus size={11} />등록
                          </button>
                        </td>
                      </tr>

                      {/* 세부 내역 (펼침) */}
                      {isExpanded && summary.transactions.map((tx) => (
                        <tr key={tx.id} className="bg-slate-50/50 border-b border-slate-50 text-xs">
                          <td className="px-3 py-2" />
                          <td className="px-4 py-2 text-slate-400">
                            {tx.transaction_date.replace(/-/g, '.')}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${typeBadge[tx.transaction_type]}`}>
                              {tx.transaction_type}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center text-slate-600 font-medium" colSpan={1}>
                            {tx.transaction_type === '출고' ? (
                              <span className="text-red-600">{tx.quantity.toLocaleString()}</span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-2 text-center text-slate-600 font-medium">
                            {tx.transaction_type === '반입' ? (
                              <span className="text-blue-600">{tx.quantity.toLocaleString()}</span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-2 text-center text-slate-600 font-medium">
                            {tx.transaction_type === '손실' ? (
                              <span className="text-orange-600">{tx.quantity.toLocaleString()}</span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-2 text-center text-slate-400">-</td>
                          <td className="px-4 py-2 text-slate-500 max-w-[140px] truncate" colSpan={2}>
                            {tx.notes || <span className="text-slate-300">-</span>}
                          </td>
                        </tr>
                      ))}
                    </>
                  )
                })
              )}
            </tbody>

            {/* 합계 행 */}
            {filteredSummaries.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-200">
                  <td colSpan={3} className="px-4 py-3 text-xs font-bold text-slate-600 text-right">합계</td>
                  <td className="px-4 py-3 text-center font-bold text-red-600">
                    {filteredSummaries.reduce((a, s) => a + s.totalOut, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-blue-600">
                    {filteredSummaries.reduce((a, s) => a + s.totalReturn, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-orange-600">
                    {filteredSummaries.reduce((a, s) => a + s.totalLoss, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-red-600">
                    {filteredSummaries.reduce((a, s) => a + s.unreturned, 0).toLocaleString()}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ─── 발주서 ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-slate-400" />
            <h2 className="font-semibold text-slate-800">발주서</h2>
            {purchaseOrders.length > 0 && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{purchaseOrders.length}건</span>
            )}
          </div>
          <button onClick={() => setSelectingVendor(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors">
            <Plus size={13} />발주서 작성
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs">거래처</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">발주번호</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">발주일</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs">금액</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs">상태</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs">첨부파일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchaseOrders.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400 text-sm">등록된 발주서가 없습니다.</td></tr>
              ) : purchaseOrders.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {po.vendors?.name || '-'}
                    {po.vendors?.contact_name && <span className="text-xs text-slate-400 ml-1.5">({po.vendors.contact_name})</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{po.order_number}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{po.order_date.replace(/-/g, '.')}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{po.total_amount.toLocaleString()}원</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">{po.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {po.file_url ? (
                      <div className="flex items-center justify-center gap-3">
                        <a href={po.file_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors">
                          <FileText size={13} />보기
                        </a>
                        <label className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer">
                          <Paperclip size={12} />교체
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(po.id, f) }} />
                        </label>
                      </div>
                    ) : (
                      <label className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg cursor-pointer transition-colors ${uploadingPoId === po.id ? 'text-slate-400 bg-slate-50' : 'text-slate-600 bg-slate-100 hover:bg-violet-100 hover:text-violet-700'}`}>
                        <Paperclip size={12} />
                        {uploadingPoId === po.id ? '업로드 중...' : '파일 첨부'}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={uploadingPoId === po.id}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(po.id, f) }} />
                      </label>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 자재 선택 피커 */}
      {showItemPicker && (
        <ItemPickModal
          items={allItems}
          onSelect={(item) => { setShowItemPicker(false); setSelectedItem(item) }}
          onClose={() => setShowItemPicker(false)}
        />
      )}

      {/* 자재 등록 모달 */}
      {selectedItem && (
        <TransactionModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSuccess={fetchProjectData}
          defaultProjectId={id}
          mode="project"
        />
      )}

      {selectingVendor && (
        <VendorSelectDialog
          vendors={vendors}
          onSelect={(v) => { setSelectingVendor(false); setOrderVendor(v) }}
          onClose={() => setSelectingVendor(false)}
        />
      )}
      {orderVendor && (
        <PurchaseOrderModal
          vendor={orderVendor}
          defaultProjectId={id}
          onClose={() => { setOrderVendor(null); fetchProjectData() }}
        />
      )}
    </div>
  )
}
