import { useState, useEffect, useCallback } from 'react'
import { Search, Edit2, Trash2, FileText, Paperclip, Plus, Building2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Vendor } from './Vendors'
import PurchaseOrderModal from '../components/PurchaseOrderModal'
import EditPurchaseOrderModal, { PO_STATUSES, type PurchaseOrder } from '../components/EditPurchaseOrderModal'

const STATUS_COLORS: Record<string, string> = {
  발주중: 'bg-blue-100 text-blue-700',
  납품완료: 'bg-green-100 text-green-700',
  취소: 'bg-slate-100 text-slate-500',
}

export default function PurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null)
  const [uploadingPoId, setUploadingPoId] = useState<string | null>(null)
  const [newOrderVendorId, setNewOrderVendorId] = useState('')
  const [orderVendor, setOrderVendor] = useState<Vendor | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: poData }, { data: vendorData }] = await Promise.all([
      supabase
        .from('purchase_orders')
        .select('*, vendors(name, contact_name, phone), wms_projects(name)')
        .order('order_date', { ascending: false }),
      supabase.from('vendors').select('id, name, category, contact_name, phone, email').order('name'),
    ])
    setOrders((poData || []) as PurchaseOrder[])
    setVendors((vendorData || []) as Vendor[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (poId: string) => {
    if (!window.confirm('발주서를 삭제하시겠습니까?')) return
    await supabase.from('purchase_orders').delete().eq('id', poId)
    fetchData()
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
      fetchData()
    } finally {
      setUploadingPoId(null)
    }
  }

  const handleStartNewOrder = () => {
    const vendor = vendors.find((v) => v.id === newOrderVendorId)
    if (vendor) setOrderVendor(vendor)
  }

  const filtered = orders.filter((po) => {
    const q = search.toLowerCase()
    const matchSearch = !q || po.order_number.toLowerCase().includes(q) ||
      (po.vendors?.name || '').toLowerCase().includes(q) ||
      (po.wms_projects?.name || '').toLowerCase().includes(q)
    const matchStatus = !statusFilter || po.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">발주서 목록</h1>
          <p className="text-slate-500 text-sm mt-0.5">거래처별로 작성된 발주서 전체 내역</p>
        </div>
      </div>

      {/* 신규 발주서 작성 (거래처 선택) */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="flex items-center gap-2 flex-1">
          <Building2 size={15} className="text-slate-400 shrink-0" />
          <select value={newOrderVendorId} onChange={(e) => setNewOrderVendorId(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="">거래처를 선택하세요</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <button onClick={handleStartNewOrder} disabled={!newOrderVendorId}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
          <Plus size={16} />발주서 작성
        </button>
      </div>

      {/* 검색 + 상태 필터 */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="발주번호, 거래처, 프로젝트 검색..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${!statusFilter ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-300'}`}>
            전체 <span className="ml-1 text-xs opacity-70">({orders.length})</span>
          </button>
          {PO_STATUSES.map((s) => (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${statusFilter === s ? 'bg-violet-100 text-violet-700 border-violet-300' : 'bg-white text-slate-600 border-slate-300'}`}>
              {s} <span className="ml-1 text-xs opacity-70">({orders.filter((o) => o.status === s).length})</span>
            </button>
          ))}
        </div>
      </div>

      {/* 모바일 카드 */}
      <div className="md:hidden bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            {search || statusFilter ? '검색 결과가 없습니다.' : '작성된 발주서가 없습니다.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((po) => (
              <div key={po.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">{po.vendors?.name || '-'}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[po.status] || 'bg-slate-100 text-slate-600'}`}>{po.status}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-mono">{po.order_number}</p>
                    {po.wms_projects?.name && (
                      <p className="text-xs text-slate-400 mt-0.5">프로젝트: {po.wms_projects.name}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                      <span>{po.order_date.replace(/-/g, '.')}</span>
                      <span className="font-semibold text-slate-800">{po.total_amount.toLocaleString()}원</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={() => setEditingPo(po)}
                      className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => handleDelete(po.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  {po.file_url ? (
                    <a href={po.file_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-violet-600">
                      <FileText size={12} />첨부파일 보기
                    </a>
                  ) : (
                    <label className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-500 bg-slate-100 rounded-lg cursor-pointer">
                      <Paperclip size={11} />
                      {uploadingPoId === po.id ? '업로드 중...' : '파일 첨부'}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={uploadingPoId === po.id}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(po.id, f) }} />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">총 {filtered.length}건</div>
        )}
      </div>

      {/* 데스크탑 테이블 */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">거래처</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">프로젝트</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">발주번호</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">발주일</th>
                <th className="text-right px-4 py-3.5 font-semibold text-slate-600">금액</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-600">상태</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-600">첨부파일</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                  {search || statusFilter ? '검색 결과가 없습니다.' : '작성된 발주서가 없습니다.'}
                </td></tr>
              ) : (
                filtered.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{po.vendors?.name || '-'}</p>
                      {po.vendors?.contact_name && <p className="text-xs text-slate-400 mt-0.5">{po.vendors.contact_name}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      {po.wms_projects?.name || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 font-mono text-xs">{po.order_number}</td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{po.order_date.replace(/-/g, '.')}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-800 whitespace-nowrap">{po.total_amount.toLocaleString()}원</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[po.status] || 'bg-slate-100 text-slate-600'}`}>{po.status}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {po.file_url ? (
                        <a href={po.file_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors">
                          <FileText size={13} />보기
                        </a>
                      ) : (
                        <label className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg cursor-pointer transition-colors ${uploadingPoId === po.id ? 'text-slate-400 bg-slate-50' : 'text-slate-600 bg-slate-100 hover:bg-violet-100 hover:text-violet-700'}`}>
                          <Paperclip size={12} />
                          {uploadingPoId === po.id ? '업로드 중...' : '파일 첨부'}
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={uploadingPoId === po.id}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(po.id, f) }} />
                        </label>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingPo(po)}
                          className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(po.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">총 {filtered.length}건</div>
        )}
      </div>

      {orderVendor && (
        <PurchaseOrderModal
          vendor={orderVendor}
          onClose={() => { setOrderVendor(null); setNewOrderVendorId(''); fetchData() }}
        />
      )}
      {editingPo && (
        <EditPurchaseOrderModal po={editingPo} onClose={() => setEditingPo(null)} onSuccess={fetchData} />
      )}
    </div>
  )
}
