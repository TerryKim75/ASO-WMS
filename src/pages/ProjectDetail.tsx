import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Edit2, Check, X, Phone, Mail, Users,
  FileText, Paperclip, Search, Building2,
  Trash2, Send, Pencil, Download, Printer,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { WmsProject, ProjectStatus, Item, InventoryTransaction, ProjectBid } from '../types'
import { STATUS_COLORS } from './Projects'
import PurchaseOrderModal from '../components/PurchaseOrderModal'
import AddProjectModal from '../components/AddProjectModal'

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
  totalPacking: number
  totalOut: number
  totalReturn: number
  totalDamaged: number
  totalLost: number
  totalLegacyLoss: number
  unreturned: number
  transactions: InventoryTransaction[]
}

type ItemQty = { packing: number; out: number; inp: number; damaged: number; lost: number; notes: string }
const emptyItemQty = (): ItemQty => ({ packing: 0, out: 0, inp: 0, damaged: 0, lost: 0, notes: '' })

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

function BulkTransactionModal({
  items, projectId, onClose, onSuccess,
}: { items: Item[]; projectId: string; onClose: () => void; onSuccess: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [search, setSearch] = useState('')
  const [quantities, setQuantities] = useState<Record<string, ItemQty>>({})
  const [loading, setLoading] = useState(false)
  const [initLoading, setInitLoading] = useState(true)

  // Preload existing transactions for this project
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('inventory_transactions')
          .select('item_id, transaction_type, quantity, notes')
          .eq('project_id', projectId)
        if (data && data.length > 0) {
          const map: Record<string, ItemQty> = {}
          data.forEach((tx) => {
            if (!map[tx.item_id]) map[tx.item_id] = emptyItemQty()
            const n = tx.notes || ''
            if (tx.transaction_type === '팩킹') { map[tx.item_id].packing += tx.quantity; if (n) map[tx.item_id].notes = n }
            else if (tx.transaction_type === '출고') { map[tx.item_id].out += tx.quantity; if (n) map[tx.item_id].notes = n }
            else if (tx.transaction_type === '반입') { map[tx.item_id].inp += tx.quantity; if (n) map[tx.item_id].notes = n }
            else if (tx.transaction_type === '파손') { map[tx.item_id].damaged += tx.quantity; if (n) map[tx.item_id].notes = n }
            else if (tx.transaction_type === '분실') { map[tx.item_id].lost += tx.quantity; if (n) map[tx.item_id].notes = n }
          })
          setQuantities(map)
        }
      } finally {
        setInitLoading(false)
      }
    }
    load()
  }, [projectId])

  const updateQty = (itemId: string, field: keyof Omit<ItemQty, 'notes'>, value: number) => {
    setQuantities((prev) => {
      const existing = prev[itemId] || emptyItemQty()
      return { ...prev, [itemId]: { ...existing, [field]: Math.max(0, value) } }
    })
  }

  const updateNotes = (itemId: string, notes: string) => {
    setQuantities((prev) => {
      const existing = prev[itemId] || emptyItemQty()
      return { ...prev, [itemId]: { ...existing, notes } }
    })
  }

  const handleSubmit = async () => {
    const rows: { item_id: string; transaction_type: string; quantity: number; notes: string | null }[] = []
    Object.entries(quantities).forEach(([itemId, q]) => {
      const n = q.notes.trim() || null
      if (q.packing > 0) rows.push({ item_id: itemId, transaction_type: '팩킹', quantity: q.packing, notes: n })
      if (q.out > 0) rows.push({ item_id: itemId, transaction_type: '출고', quantity: q.out, notes: n })
      if (q.inp > 0) rows.push({ item_id: itemId, transaction_type: '반입', quantity: q.inp, notes: n })
      if (q.damaged > 0) rows.push({ item_id: itemId, transaction_type: '파손', quantity: q.damaged, notes: n })
      if (q.lost > 0) rows.push({ item_id: itemId, transaction_type: '분실', quantity: q.lost, notes: n })
    })
    if (rows.length === 0) { alert('수량을 1개 이상 입력해주세요.'); return }
    setLoading(true)
    const itemIds = [...new Set(rows.map((r) => r.item_id))]
    // 기존 데이터 백업 (insert 실패 시 복원용)
    const { data: backup } = await supabase.from('inventory_transactions')
      .select('item_id, transaction_type, quantity, notes, transaction_date')
      .eq('project_id', projectId)
      .in('item_id', itemIds)
    try {
      const { error: delErr } = await supabase.from('inventory_transactions').delete()
        .eq('project_id', projectId)
        .in('item_id', itemIds)
      if (delErr) throw delErr
      const { error: insErr } = await supabase.from('inventory_transactions').insert(
        rows.map((r) => ({ ...r, project_id: projectId, transaction_date: date }))
      )
      if (insErr) {
        // insert 실패 시 백업 복원
        if (backup && backup.length > 0) {
          await supabase.from('inventory_transactions').insert(
            backup.map((r) => ({ ...r, project_id: projectId }))
          )
        }
        throw insErr
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || String(err)
      alert(`저장 실패: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const filtered = items.filter((it) =>
    it.name.toLowerCase().includes(search.toLowerCase()) ||
    it.category.toLowerCase().includes(search.toLowerCase())
  )

  const totalEntries = Object.values(quantities).filter(
    (q) => q.packing > 0 || q.out > 0 || q.inp > 0 || q.damaged > 0 || q.lost > 0
  ).length

  const inputCls = 'w-full text-center border border-slate-300 rounded-lg px-1 py-1.5 text-sm focus:outline-none focus:ring-1'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-slate-800 text-lg">입출고 내역 작성 및 수정</h3>
            {totalEntries > 0 && (
              <span className="text-xs font-medium text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
                {totalEntries}개 자재 입력됨
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {/* 날짜 / 검색 */}
        <div className="px-6 py-3 border-b flex-shrink-0 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600 whitespace-nowrap">날짜</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div className="relative ml-auto">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="자재 검색..."
              className="pl-7 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm w-40 focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
        </div>

        {/* 자재 테이블 */}
        <div className="overflow-y-auto flex-1">
          {initLoading ? (
            <div className="py-16 text-center text-slate-400 text-sm">기존 내역 불러오는 중...</div>
          ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 text-xs">카테고리</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 text-xs">자재명</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 text-xs w-20">팩킹</th>
                <th className="text-center px-2 py-3 font-semibold text-red-700 text-xs w-20">출고</th>
                <th className="text-center px-2 py-3 font-semibold text-blue-700 text-xs w-20">반입</th>
                <th className="text-center px-2 py-3 font-semibold text-amber-700 text-xs w-20">파손</th>
                <th className="text-center px-2 py-3 font-semibold text-rose-700 text-xs w-20">분실</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 text-xs">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => {
                const q = quantities[item.id] || emptyItemQty()
                const hasAny = q.packing > 0 || q.out > 0 || q.inp > 0 || q.damaged > 0 || q.lost > 0
                return (
                  <tr key={item.id} className={`transition-colors ${hasAny ? 'bg-violet-50/40' : 'hover:bg-slate-50/60'}`}>
                    <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{item.category}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800 text-sm">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.unit}</p>
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={0} value={q.packing || ''}
                        onChange={(e) => updateQty(item.id, 'packing', Number(e.target.value))}
                        placeholder="0" className={`${inputCls} focus:ring-slate-400`} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={0} value={q.out || ''}
                        onChange={(e) => updateQty(item.id, 'out', Number(e.target.value))}
                        placeholder="0" className={`${inputCls} focus:ring-red-400`} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={0} value={q.inp || ''}
                        onChange={(e) => updateQty(item.id, 'inp', Number(e.target.value))}
                        placeholder="0" className={`${inputCls} focus:ring-blue-400`} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={0} value={q.damaged || ''}
                        onChange={(e) => updateQty(item.id, 'damaged', Number(e.target.value))}
                        placeholder="0" className={`${inputCls} focus:ring-amber-400`} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={0} value={q.lost || ''}
                        onChange={(e) => updateQty(item.id, 'lost', Number(e.target.value))}
                        placeholder="0" className={`${inputCls} focus:ring-rose-400`} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={q.notes}
                        onChange={(e) => updateNotes(item.id, e.target.value)}
                        placeholder="메모"
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t bg-slate-50 flex-shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">취소</button>
          <button onClick={handleSubmit} disabled={loading || initLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50">
            {loading ? '저장 중...' : '등록 및 수정'}
          </button>
        </div>
      </div>
    </div>
  )
}


const PO_STATUSES = ['발주중', '납품완료', '취소']

function EditPurchaseOrderModal({
  po, onClose, onSuccess,
}: { po: PurchaseOrder; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    order_date: po.order_date,
    delivery_date: po.delivery_date || '',
    status: po.status,
    notes: po.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const ic = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('purchase_orders').update({
      order_date: form.order_date,
      delivery_date: form.delivery_date || null,
      status: form.status,
      notes: form.notes.trim() || null,
    }).eq('id', po.id)
    setSaving(false)
    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-bold text-slate-800">발주서 수정</h3>
            <p className="text-xs text-slate-400 mt-0.5">{po.order_number}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">상태</label>
            <div className="flex gap-2">
              {PO_STATUSES.map((s) => (
                <button key={s} type="button" onClick={() => setForm({ ...form, status: s })}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${form.status === s ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-300 hover:border-violet-400'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">발주일</label>
              <input type="date" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} className={ic} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">납기일</label>
              <input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} className={ic} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">비고</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={`${ic} resize-none`} />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t bg-slate-50">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg">취소</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NoticeModal({
  project,
  onClose,
  onSend,
}: {
  project: WmsProject
  onClose: () => void
  onSend: (content: string) => Promise<void>
}) {
  const [workerCount, setWorkerCount] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [extraContent, setExtraContent] = useState('')

  useEffect(() => {
    supabase
      .from('construction_workers')
      .select('id', { count: 'exact', head: true })
      .not('phone', 'is', null)
      .then(({ count }) => setWorkerCount(count ?? 0))
  }, [])

  const dateRange = project.start_date
    ? `${project.start_date.replace(/-/g, '.')}${project.end_date ? ` ~ ${project.end_date.replace(/-/g, '.')}` : ''}`
    : null

  const autoLines = [
    '[아소시스템] 시공 입찰 공고',
    '',
    `프로젝트: ${project.name}`,
    project.exhibition ? `전시: ${project.exhibition}` : null,
    dateRange ? `전시일정: ${dateRange}` : null,
    project.construction_date ? `시공일: ${project.construction_date.replace(/-/g, '.')}` : null,
    project.demolition_date ? `철거일: ${project.demolition_date.replace(/-/g, '.')}` : null,
    project.notes ? `내용: ${project.notes}` : null,
  ].filter(Boolean).join('\n')

  const fullMessage = extraContent.trim()
    ? `${autoLines}\n\n${extraContent.trim()}\n\n시공 참여를 원하시면 아래 버튼을 눌러 가격을 제안해 주세요.`
    : `${autoLines}\n\n시공 참여를 원하시면 아래 버튼을 눌러 가격을 제안해 주세요.`

  const handleSend = async () => {
    setSending(true)
    await onSend(fullMessage)
    setSending(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">입찰공고 작성</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              발송 대상:{' '}
              {workerCount === null ? '확인 중...' : (
                <span className="text-violet-600 font-semibold">시공인력 {workerCount}명</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">기본 공고 내용 (자동)</p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-1.5">
              {[
                { label: '프로젝트', value: project.name },
                project.exhibition ? { label: '전시', value: project.exhibition } : null,
                dateRange ? { label: '전시일정', value: dateRange } : null,
                project.construction_date ? { label: '시공일', value: project.construction_date.replace(/-/g, '.') } : null,
                project.demolition_date ? { label: '철거일', value: project.demolition_date.replace(/-/g, '.') } : null,
                project.notes ? { label: '내용', value: project.notes } : null,
              ].filter(Boolean).map((item) => item && (
                <div key={item.label} className="flex gap-2 text-sm">
                  <span className="text-slate-400 w-16 flex-shrink-0 text-xs pt-0.5">{item.label}</span>
                  <span className="text-slate-700">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              추가 안내사항
              <span className="ml-1.5 text-xs font-normal text-slate-400">작업 범위, 준비물, 특이사항 등</span>
            </label>
            <textarea
              value={extraContent}
              onChange={(e) => setExtraContent(e.target.value)}
              rows={5}
              placeholder={`예시:\n- 작업 면적: 약 300㎡\n- 필요 인원: 4~6명\n- 준비물: 전동공구 지참\n- 현장 주차 가능`}
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none leading-relaxed"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">카카오 메시지 미리보기</p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center text-xs font-bold text-white">A</div>
                <span className="text-xs font-semibold text-slate-700">아소시스템</span>
              </div>
              <div className="bg-white rounded-lg px-3 py-2.5 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed shadow-sm border border-yellow-100">
                {fullMessage}
              </div>
              <div className="mt-2">
                <div className="bg-yellow-400 text-white text-xs font-semibold text-center py-2 rounded-lg">
                  입찰 참여하기 →
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t bg-slate-50 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
            취소
          </button>
          <button onClick={handleSend} disabled={sending}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50">
            {sending ? '발송 중...' : `발송하기${workerCount ? ` (${workerCount}명)` : ''}`}
          </button>
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
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [allItems, setAllItems] = useState<Item[]>([])
  const [selectingVendor, setSelectingVendor] = useState(false)
  const [orderVendor, setOrderVendor] = useState<Vendor | null>(null)
  const [uploadingPoId, setUploadingPoId] = useState<string | null>(null)
  const [uploadingFile, setUploadingFile] = useState<'design' | 'drawing' | null>(null)
  const [txSearch, setTxSearch] = useState('')
  const [bids, setBids] = useState<ProjectBid[]>([])
  const [showEditProject, setShowEditProject] = useState(false)
  const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null)
  const [showNoticeModal, setShowNoticeModal] = useState(false)
  const [sendingNotice, setSendingNotice] = useState(false)
  const [noticeResult, setNoticeResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingQty, setEditingQty] = useState<ItemQty>(emptyItemQty())

  const handleSendNotice = async (messageContent: string) => {
    if (!id) return
    setSendingNotice(true)
    setNoticeResult(null)
    setShowNoticeModal(false)
    try {
      const { data, error } = await supabase.functions.invoke('send-kakao-notice', {
        body: { projectId: id, messageContent },
      })
      if (error) throw error
      setNoticeResult({ ok: true, msg: `${data.sentCount}명에게 발송 완료` })
    } catch (err) {
      setNoticeResult({ ok: false, msg: `발송 실패: ${String(err)}` })
    } finally {
      setSendingNotice(false)
    }
  }

  const handleDeletePo = async (poId: string) => {
    if (!window.confirm('발주서를 삭제하시겠습니까?')) return
    await supabase.from('purchase_orders').delete().eq('id', poId)
    fetchProjectData()
  }

  const handleBidStatus = async (bidId: string, status: '낙찰' | '거절') => {
    await supabase.from('project_bids').update({ status }).eq('id', bidId)
    const { data } = await supabase
      .from('project_bids')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
    setBids((data || []) as ProjectBid[])
  }

  const handleDeleteItemTx = async (itemId: string, itemName: string) => {
    if (!window.confirm(`${itemName}의 모든 입출고 내역을 삭제하시겠습니까?`)) return
    await supabase.from('inventory_transactions').delete()
      .eq('item_id', itemId)
      .eq('project_id', id!)
    fetchProjectData()
  }

  const handleInlineSave = async (itemId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const n = editingQty.notes.trim() || null
    const rows: { item_id: string; project_id: string; transaction_type: string; quantity: number; transaction_date: string; notes: string | null }[] = []
    if (editingQty.packing > 0) rows.push({ item_id: itemId, project_id: id!, transaction_type: '팩킹', quantity: editingQty.packing, transaction_date: today, notes: n })
    if (editingQty.out > 0) rows.push({ item_id: itemId, project_id: id!, transaction_type: '출고', quantity: editingQty.out, transaction_date: today, notes: n })
    if (editingQty.inp > 0) rows.push({ item_id: itemId, project_id: id!, transaction_type: '반입', quantity: editingQty.inp, transaction_date: today, notes: n })
    if (editingQty.damaged > 0) rows.push({ item_id: itemId, project_id: id!, transaction_type: '파손', quantity: editingQty.damaged, transaction_date: today, notes: n })
    if (editingQty.lost > 0) rows.push({ item_id: itemId, project_id: id!, transaction_type: '분실', quantity: editingQty.lost, transaction_date: today, notes: n })
    // 기존 데이터 백업
    const { data: backup } = await supabase.from('inventory_transactions')
      .select('item_id, transaction_type, quantity, notes, transaction_date')
      .eq('item_id', itemId)
      .eq('project_id', id!)
    const { error: delErr } = await supabase.from('inventory_transactions').delete()
      .eq('item_id', itemId)
      .eq('project_id', id!)
    if (delErr) { alert('저장 중 오류가 발생했습니다.'); return }
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from('inventory_transactions').insert(rows)
      if (insErr) {
        // insert 실패 시 백업 복원
        if (backup && backup.length > 0) {
          await supabase.from('inventory_transactions').insert(
            backup.map((r) => ({ ...r, project_id: id! }))
          )
        }
        alert(`저장 실패: ${insErr.message}`)
        fetchProjectData()
        return
      }
    }
    setEditingItemId(null)
    fetchProjectData()
  }

  const fetchProjectData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [projectRes, txRes, posRes, vendorsRes, itemsRes, bidsRes] = await Promise.all([
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
        supabase.from('project_bids').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      ])
      if (projectRes.data) { setProject(projectRes.data); setNewStatus(projectRes.data.status) }
      setTransactions((txRes.data || []) as InventoryTransaction[])
      setPurchaseOrders((posRes.data || []) as PurchaseOrder[])
      setVendors((vendorsRes.data || []) as Vendor[])
      setAllItems((itemsRes.data || []) as Item[])
      setBids((bidsRes.data || []) as ProjectBid[])
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

  const handleProjectFileUpload = async (field: 'design' | 'drawing', file: File) => {
    if (!id) return
    setUploadingFile(field)
    try {
      const ext = file.name.split('.').pop()
      const path = `${id}/${field}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('project-files').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(path)
      const column = field === 'design' ? 'design_file_url' : 'drawing_file_url'
      await supabase.from('wms_projects').update({ [column]: urlData.publicUrl }).eq('id', id)
      fetchProjectData()
    } finally {
      setUploadingFile(null)
    }
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
        map.set(item.id, { item, totalPacking: 0, totalOut: 0, totalReturn: 0, totalDamaged: 0, totalLost: 0, totalLegacyLoss: 0, unreturned: 0, transactions: [] })
      }
      const s = map.get(item.id)!
      s.transactions.push(tx)
      if (tx.transaction_type === '팩킹') s.totalPacking += tx.quantity
      if (tx.transaction_type === '출고') s.totalOut += tx.quantity
      if (tx.transaction_type === '반입') s.totalReturn += tx.quantity
      if (tx.transaction_type === '파손') s.totalDamaged += tx.quantity
      if (tx.transaction_type === '분실') s.totalLost += tx.quantity
      if (tx.transaction_type === '손실') s.totalLegacyLoss += tx.quantity
    })
    return [...map.values()]
      .map((s) => ({ ...s, unreturned: s.totalOut - s.totalReturn - s.totalDamaged - s.totalLost - s.totalLegacyLoss }))
      .sort((a, b) => {
        const catCmp = a.item.category.localeCompare(b.item.category, 'ko')
        if (catCmp !== 0) return catCmp
        return a.item.name.localeCompare(b.item.name, 'ko')
      })
  }, [transactions])

  const filteredSummaries = useMemo(() => {
    if (!txSearch.trim()) return itemSummaries
    const q = txSearch.toLowerCase()
    return itemSummaries.filter((s) =>
      s.item.name.toLowerCase().includes(q) || s.item.category.toLowerCase().includes(q)
    )
  }, [itemSummaries, txSearch])

  const handlePrintPacking = () => {
    const packingItems = filteredSummaries.filter((s) => s.totalPacking > 0)
    if (packingItems.length === 0) { alert('팩킹 수량이 입력된 자재가 없습니다.'); return }
    const dateStr = new Date().toLocaleDateString('ko-KR')
    const rows = packingItems.map((s, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${s.item.category}</td>
        <td>${s.item.name}</td>
        <td style="text-align:center">${s.item.unit}</td>
        <td style="text-align:center;font-weight:bold">${s.totalPacking.toLocaleString()}</td>
        <td></td>
      </tr>
    `).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>팩킹 리스트</title>
    <style>
      body{font-family:'Malgun Gothic',sans-serif;padding:20px;font-size:13px}
      h2{margin-bottom:4px;font-size:16px}
      .sub{color:#666;font-size:11px;margin-bottom:14px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #cbd5e1;padding:7px 10px;font-size:12px}
      th{background:#f1f5f9;font-weight:600;text-align:left}
      @media print{body{padding:10px}}
    </style></head><body>
    <h2>팩킹 리스트</h2>
    <div class="sub">${project?.name || ''} | ${dateStr}</div>
    <table><thead><tr>
      <th style="width:36px;text-align:center">No.</th>
      <th>카테고리</th>
      <th>자재명</th>
      <th style="width:50px;text-align:center">단위</th>
      <th style="width:72px;text-align:center">팩킹수량</th>
      <th style="width:80px">확인</th>
    </tr></thead><tbody>${rows}</tbody></table>
    </body></html>`
    const win = window.open('', '_blank')
    if (!win) { alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.'); return }
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 300)
  }

  if (loading) return <div className="p-4 md:p-6 text-center text-slate-400 py-20">불러오는 중...</div>
  if (!project) return (
    <div className="p-4 md:p-6 text-center text-slate-400 py-20">
      프로젝트를 찾을 수 없습니다.
      <button onClick={() => navigate('/projects')} className="block mx-auto mt-4 text-violet-600">목록으로</button>
    </div>
  )

  const totalPacking = itemSummaries.reduce((a, s) => a + s.totalPacking, 0)
  const totalOut = itemSummaries.reduce((a, s) => a + s.totalOut, 0)
  const totalReturn = itemSummaries.reduce((a, s) => a + s.totalReturn, 0)
  const totalDamagedLost = itemSummaries.reduce((a, s) => a + s.totalDamaged + s.totalLost + s.totalLegacyLoss, 0)
  const totalUnreturned = itemSummaries.reduce((a, s) => a + s.unreturned, 0)
  const startDt = formatDatetime(project.start_date, project.start_time)
  const endDt = formatDatetime(project.end_date, project.end_time)

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <button onClick={() => navigate('/projects')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft size={16} />프로젝트 목록
      </button>

      {/* 프로젝트 헤더 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">{project.name}</h1>
            <div className="mt-3 md:mt-4 grid grid-cols-2 lg:grid-cols-3 gap-x-6 md:gap-x-8 gap-y-2 text-sm">
              {project.exhibition && <div><span className="text-slate-400 text-xs">전시회</span><p className="text-slate-700 font-medium text-sm">{project.exhibition}</p></div>}
              {project.organizer && <div><span className="text-slate-400 text-xs">기획사</span><p className="text-slate-700 font-medium text-sm">{project.organizer}</p></div>}
              {project.exhibitor && <div><span className="text-slate-400 text-xs">참가사</span><p className="text-slate-700 font-medium text-sm">{project.exhibitor}</p></div>}
              {project.manager && <div><span className="text-slate-400 text-xs">담당</span><p className="text-slate-700 font-medium text-sm">{project.manager}</p></div>}
              {(startDt || endDt) && (
                <div className="col-span-2">
                  <span className="text-slate-400 text-xs">전시일정</span>
                  <p className="text-slate-700 font-medium text-sm">{startDt}{startDt && endDt && ' ~ '}{endDt}</p>
                </div>
              )}
              {project.shipping_date && (
                <div>
                  <span className="text-slate-400 text-xs">출고예정일</span>
                  <p className="text-slate-700 font-medium text-sm">{project.shipping_date.replace(/-/g, '.')}</p>
                </div>
              )}
              {project.return_date && (
                <div>
                  <span className="text-slate-400 text-xs">입고예정일</span>
                  <p className="text-slate-700 font-medium text-sm">{project.return_date.replace(/-/g, '.')}</p>
                </div>
              )}
              {project.construction_date && (
                <div>
                  <span className="text-slate-400 text-xs">시공일</span>
                  <p className="text-slate-700 font-medium text-sm">{project.construction_date.replace(/-/g, '.')}</p>
                </div>
              )}
              {project.demolition_date && (
                <div>
                  <span className="text-slate-400 text-xs">철거일</span>
                  <p className="text-slate-700 font-medium text-sm">{project.demolition_date.replace(/-/g, '.')}</p>
                </div>
              )}
            </div>
            {project.notes && <p className="text-sm text-slate-500 mt-3 bg-slate-50 px-3 py-2 rounded-lg">{project.notes}</p>}
          </div>

          {/* 진행현황 + 수정 버튼 */}
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 flex-shrink-0">
            {editingStatus ? (
              <>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as ProjectStatus)}
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="flex gap-1">
                  <button onClick={handleStatusUpdate} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Check size={16} /></button>
                  <button onClick={() => { setEditingStatus(false); setNewStatus(project.status) }} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg"><X size={16} /></button>
                </div>
              </>
            ) : (
              <>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${STATUS_COLORS[project.status] || 'bg-slate-100 text-slate-600'}`}>
                  {project.status}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setEditingStatus(true)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg" title="상태 변경"><Edit2 size={14} /></button>
                  <button onClick={() => setShowEditProject(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-violet-100 hover:text-violet-700 rounded-lg transition-colors">
                    <Edit2 size={12} /><span className="hidden sm:inline">프로젝트 </span>수정
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 첨부파일 */}
        <div className="mt-4 md:mt-5 pt-4 md:pt-5 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <Paperclip size={14} className="text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">첨부파일</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-20">시공디자인</span>
              {project.design_file_url ? (
                <div className="flex items-center gap-1.5">
                  <a href={project.design_file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-200 transition-colors">
                    <Download size={11} />보기
                  </a>
                  <label className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer transition-colors">
                    <Pencil size={11} />교체
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.dwg" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProjectFileUpload('design', f) }} />
                  </label>
                </div>
              ) : (
                <label className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${uploadingFile === 'design' ? 'text-slate-400 bg-slate-50 border-slate-200' : 'text-slate-600 bg-slate-50 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 border-slate-200'}`}>
                  <Paperclip size={11} />{uploadingFile === 'design' ? '업로드 중...' : '파일 첨부'}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.dwg" className="hidden" disabled={uploadingFile === 'design'}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProjectFileUpload('design', f) }} />
                </label>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-20">도면</span>
              {project.drawing_file_url ? (
                <div className="flex items-center gap-1.5">
                  <a href={project.drawing_file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-200 transition-colors">
                    <Download size={11} />보기
                  </a>
                  <label className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer transition-colors">
                    <Pencil size={11} />교체
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.dwg" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProjectFileUpload('drawing', f) }} />
                  </label>
                </div>
              ) : (
                <label className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${uploadingFile === 'drawing' ? 'text-slate-400 bg-slate-50 border-slate-200' : 'text-slate-600 bg-slate-50 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 border-slate-200'}`}>
                  <Paperclip size={11} />{uploadingFile === 'drawing' ? '업로드 중...' : '파일 첨부'}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.dwg" className="hidden" disabled={uploadingFile === 'drawing'}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProjectFileUpload('drawing', f) }} />
                </label>
              )}
            </div>
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
        <div className="grid grid-cols-5 gap-2 md:gap-4 mt-4 md:mt-6 pt-4 md:pt-6 border-t border-slate-100">
          <div className="text-center">
            <p className="text-xl md:text-2xl font-bold text-slate-600">{totalPacking.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-0.5 md:mt-1">팩킹</p>
          </div>
          <div className="text-center">
            <p className="text-xl md:text-2xl font-bold text-red-600">{totalOut.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-0.5 md:mt-1">출고</p>
          </div>
          <div className="text-center">
            <p className="text-xl md:text-2xl font-bold text-blue-600">{totalReturn.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-0.5 md:mt-1">반입</p>
          </div>
          <div className="text-center">
            <p className="text-xl md:text-2xl font-bold text-orange-600">{totalDamagedLost.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-0.5 md:mt-1">파손/분실</p>
          </div>
          <div className="text-center">
            <p className={`text-xl md:text-2xl font-bold ${totalUnreturned > 0 ? 'text-red-600' : 'text-slate-400'}`}>
              {totalUnreturned.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 md:mt-1">미반입</p>
          </div>
        </div>
      </div>

      {/* ─── 입출고 내역 ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 md:px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-800">입출고 내역</h2>
            {itemSummaries.length > 0 && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {itemSummaries.length}개 자재
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {itemSummaries.some((s) => s.totalPacking > 0) && (
              <button
                onClick={handlePrintPacking}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Printer size={13} /><span className="hidden sm:inline">팩킹 리스트 출력</span><span className="sm:hidden">출력</span>
              </button>
            )}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="자재명·카테고리"
                className="pl-7 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs w-32 md:w-40 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
            >
              <Plus size={13} /><span className="hidden sm:inline">입출고 내역 작성 및 수정</span><span className="sm:hidden">작성·수정</span>
            </button>
          </div>
        </div>

        {/* 모바일 카드 */}
        <div className="sm:hidden">
          {filteredSummaries.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-400 text-sm">
              {txSearch ? '검색 결과가 없습니다.' : '등록된 내역이 없습니다.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredSummaries.map((summary) => (
                <div key={summary.item.id} className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{summary.item.name}</p>
                      <p className="text-xs text-slate-400">{summary.item.category} · {summary.item.unit}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => {
                          setEditingItemId(summary.item.id)
                          setEditingQty({
                            packing: summary.totalPacking, out: summary.totalOut, inp: summary.totalReturn,
                            damaged: summary.totalDamaged, lost: summary.totalLost + summary.totalLegacyLoss,
                            notes: summary.transactions.find((t) => t.notes)?.notes || '',
                          })
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors"
                      >
                        <Edit2 size={11} />수정
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 text-center">
                    {[
                      { label: '팩킹', value: summary.totalPacking, color: 'text-slate-700' },
                      { label: '출고', value: summary.totalOut, color: 'text-red-600' },
                      { label: '반입', value: summary.totalReturn, color: 'text-blue-600' },
                      { label: '파손/분실', value: summary.totalDamaged + summary.totalLost + summary.totalLegacyLoss, color: 'text-amber-600' },
                      { label: '미반입', value: summary.unreturned, color: summary.unreturned > 0 ? 'text-orange-600' : 'text-slate-300' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-slate-50 rounded-lg py-1.5">
                        <p className={`text-sm font-bold ${color}`}>{value > 0 ? value : '-'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  {summary.transactions.find((t) => t.notes)?.notes && (
                    <p className="text-xs text-slate-400 mt-2">{summary.transactions.find((t) => t.notes)?.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 데스크탑 테이블 */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">카테고리</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">자재명</th>
                <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs">팩킹</th>
                <th className="text-center px-3 py-3 font-semibold text-red-700 text-xs">출고</th>
                <th className="text-center px-3 py-3 font-semibold text-blue-700 text-xs">반입</th>
                <th className="text-center px-3 py-3 font-semibold text-amber-700 text-xs">파손</th>
                <th className="text-center px-3 py-3 font-semibold text-rose-700 text-xs">분실</th>
                <th className="text-center px-3 py-3 font-semibold text-orange-600 text-xs">미반입</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">비고</th>
                <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs w-24">수정</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-slate-400 text-sm">
                    {txSearch ? '검색 결과가 없습니다.' : '등록된 내역이 없습니다. 입출고 내역 작성 및 수정 버튼으로 추가하세요.'}
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((summary) => {
                  const isEditing = editingItemId === summary.item.id
                  const hasUnreturned = summary.unreturned > 0

                  if (isEditing) {
                    const inputCls = 'w-full text-center border border-slate-300 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400'
                    return (
                      <tr key={summary.item.id} className="border-b border-slate-100 bg-violet-50/60">
                        <td className="px-4 py-2 text-xs text-slate-500">{summary.item.category}</td>
                        <td className="px-4 py-2">
                          <p className="font-medium text-slate-800">{summary.item.name}</p>
                          <p className="text-xs text-slate-400">{summary.item.unit}</p>
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min={0} value={editingQty.packing || ''} placeholder="0"
                            onChange={(e) => setEditingQty({ ...editingQty, packing: Math.max(0, Number(e.target.value)) })}
                            className={inputCls} />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min={0} value={editingQty.out || ''} placeholder="0"
                            onChange={(e) => setEditingQty({ ...editingQty, out: Math.max(0, Number(e.target.value)) })}
                            className={inputCls} />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min={0} value={editingQty.inp || ''} placeholder="0"
                            onChange={(e) => setEditingQty({ ...editingQty, inp: Math.max(0, Number(e.target.value)) })}
                            className={inputCls} />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min={0} value={editingQty.damaged || ''} placeholder="0"
                            onChange={(e) => setEditingQty({ ...editingQty, damaged: Math.max(0, Number(e.target.value)) })}
                            className={inputCls} />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min={0} value={editingQty.lost || ''} placeholder="0"
                            onChange={(e) => setEditingQty({ ...editingQty, lost: Math.max(0, Number(e.target.value)) })}
                            className={inputCls} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          {(() => {
                            const unret = editingQty.out - editingQty.inp - editingQty.damaged - editingQty.lost
                            return (
                              <span className={`text-xs font-semibold ${unret > 0 ? 'text-orange-600' : 'text-slate-300'}`}>
                                {unret > 0 ? unret : '-'}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" value={editingQty.notes} placeholder="메모"
                            onChange={(e) => setEditingQty({ ...editingQty, notes: e.target.value })}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400" />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleInlineSave(summary.item.id)}
                              className="px-2 py-1 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded transition-colors">
                              저장
                            </button>
                            <button onClick={() => setEditingItemId(null)}
                              className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors">
                              취소
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr
                      key={summary.item.id}
                      className={`border-b border-slate-100 transition-colors ${hasUnreturned ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-4 py-3 text-xs text-slate-500">{summary.item.category}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800">{summary.item.name}</span>
                        <p className="text-xs text-slate-400">{summary.item.unit}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-semibold text-sm ${summary.totalPacking > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                          {summary.totalPacking > 0 ? summary.totalPacking.toLocaleString() : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-semibold text-sm ${summary.totalOut > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                          {summary.totalOut > 0 ? summary.totalOut.toLocaleString() : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-semibold text-sm ${summary.totalReturn > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
                          {summary.totalReturn > 0 ? summary.totalReturn.toLocaleString() : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-semibold text-sm ${summary.totalDamaged > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                          {summary.totalDamaged > 0 ? summary.totalDamaged.toLocaleString() : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-semibold text-sm ${summary.totalLost > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                          {(summary.totalLost + summary.totalLegacyLoss) > 0 ? (summary.totalLost + summary.totalLegacyLoss).toLocaleString() : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-semibold text-sm ${summary.unreturned > 0 ? 'text-orange-600' : 'text-slate-300'}`}>
                          {summary.unreturned > 0 ? summary.unreturned.toLocaleString() : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[140px] truncate">
                        {summary.transactions.find((t) => t.notes)?.notes || (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setEditingItemId(summary.item.id)
                              setEditingQty({
                                packing: summary.totalPacking,
                                out: summary.totalOut,
                                inp: summary.totalReturn,
                                damaged: summary.totalDamaged,
                                lost: summary.totalLost + summary.totalLegacyLoss,
                                notes: summary.transactions.find((t) => t.notes)?.notes || '',
                              })
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors"
                          >
                            <Edit2 size={11} />수정
                          </button>
                          <button
                            onClick={() => handleDeleteItemTx(summary.item.id, summary.item.name)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={12} />
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
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchaseOrders.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400 text-sm">등록된 발주서가 없습니다.</td></tr>
              ) : purchaseOrders.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50 transition-colors group">
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
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingPo(po)}
                        className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDeletePo(po.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 시공 입찰 현황 ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Send size={15} className="text-violet-500" />
            <h2 className="font-semibold text-slate-800">시공 입찰 현황</h2>
            {bids.length > 0 && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{bids.length}건</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {noticeResult && (
              <span className={`text-xs px-2.5 py-1 rounded-full ${noticeResult.ok ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                {noticeResult.msg}
              </span>
            )}
            <button
              onClick={() => setShowNoticeModal(true)}
              disabled={sendingNotice}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <Send size={12} />{sendingNotice ? '발송 중...' : '입찰공고 작성'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs">제안자</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">연락처</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs">제안금액</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">메모</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs">상태</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-28">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bids.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">
                    아직 입찰 제안이 없습니다.
                  </td>
                </tr>
              ) : bids.map((bid) => (
                <tr key={bid.id} className={`transition-colors ${
                  bid.status === '낙찰' ? 'bg-green-50/50' :
                  bid.status === '거절' ? 'opacity-40' :
                  'hover:bg-slate-50'
                }`}>
                  <td className="px-5 py-3 font-medium text-slate-800">{bid.bidder_name}</td>
                  <td className="px-4 py-3">
                    <a href={`tel:${bid.bidder_phone}`}
                      className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-violet-600 transition-colors">
                      <Phone size={12} />{bid.bidder_phone}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {bid.proposed_price.toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 max-w-[200px] truncate">
                    {bid.note || <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${
                      bid.status === '낙찰' ? 'bg-green-100 text-green-700 border-green-200' :
                      bid.status === '거절' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                      'bg-amber-100 text-amber-700 border-amber-200'
                    }`}>{bid.status}</span>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 프로젝트 수정 모달 */}
      {showEditProject && project && (
        <AddProjectModal
          project={project}
          onClose={() => setShowEditProject(false)}
          onSuccess={() => { setShowEditProject(false); fetchProjectData() }}
        />
      )}

      {/* 발주서 수정 모달 */}
      {editingPo && (
        <EditPurchaseOrderModal
          po={editingPo}
          onClose={() => setEditingPo(null)}
          onSuccess={fetchProjectData}
        />
      )}

      {/* 입찰 공고 작성 모달 */}
      {showNoticeModal && project && (
        <NoticeModal
          project={project}
          onClose={() => setShowNoticeModal(false)}
          onSend={handleSendNotice}
        />
      )}

      {/* 자재 일괄 입출고 등록 */}
      {showBulkModal && id && (
        <BulkTransactionModal
          items={allItems}
          projectId={id}
          onSuccess={fetchProjectData}
          onClose={() => setShowBulkModal(false)}
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
