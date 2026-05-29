import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Phone, Mail, Edit2, Trash2, X, Save, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PurchaseOrderModal from '../components/PurchaseOrderModal'

export interface Vendor {
  id: string
  name: string
  category?: string
  contact_name?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  created_at: string
}

const emptyForm = () => ({
  name: '', category: '', contact_name: '', phone: '', email: '', address: '', notes: '',
})

function VendorFormModal({
  vendor,
  onClose,
  onSuccess,
}: {
  vendor: Vendor | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState(vendor ? {
    name: vendor.name,
    category: vendor.category || '',
    contact_name: vendor.contact_name || '',
    phone: vendor.phone || '',
    email: vendor.email || '',
    address: vendor.address || '',
    notes: vendor.notes || '',
  } : emptyForm())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('거래처명을 입력해주세요.'); return }
    setLoading(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || null,
        contact_name: form.contact_name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      }
      if (vendor) {
        const { error: err } = await supabase.from('vendors').update(payload).eq('id', vendor.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('vendors').insert(payload)
        if (err) throw err
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent'
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800">{vendor ? '거래처 수정' : '거래처 추가'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>거래처명 <span className="text-red-500">*</span></label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="거래처명" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>분류</label>
              <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="예: 바닥, 목공, 전기..." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>담당자</label>
              <input type="text" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                placeholder="홍길동 과장" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>전화번호</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="010-0000-0000" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>이메일</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="example@email.com" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>주소</label>
              <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="주소 입력" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>비고</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="메모" rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none" />
            </div>
          </div>
        </form>
        <div className="flex gap-3 px-6 py-4 border-t bg-slate-50 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
            취소
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50">
            <Save size={14} />{loading ? '저장 중...' : (vendor ? '수정 저장' : '추가')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [orderVendor, setOrderVendor] = useState<Vendor | null>(null)

  const fetchVendors = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('vendors').select('*').order('name')
    setVendors(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchVendors() }, [fetchVendors])

  const handleDelete = async (v: Vendor) => {
    if (!confirm(`'${v.name}'을(를) 삭제하시겠습니까?`)) return
    await supabase.from('vendors').delete().eq('id', v.id)
    fetchVendors()
  }

  const categories = [...new Set(vendors.map((v) => v.category).filter(Boolean))] as string[]

  const filtered = vendors.filter((v) => {
    const q = search.toLowerCase()
    const matchSearch = !q || v.name.toLowerCase().includes(q) ||
      (v.contact_name || '').toLowerCase().includes(q) ||
      (v.category || '').toLowerCase().includes(q)
    const matchCat = !categoryFilter || v.category === categoryFilter
    return matchSearch && matchCat
  })

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">발주처</h1>
          <p className="text-slate-500 text-sm mt-0.5">거래처 목록 및 발주서 관리</p>
        </div>
        <button onClick={() => { setEditingVendor(null); setShowForm(true) }}
          className="flex items-center gap-2 px-3 py-2 md:px-4 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors shadow-sm">
          <Plus size={16} /><span className="hidden sm:inline">거래처 추가</span><span className="sm:hidden">추가</span>
        </button>
      </div>

      {/* 검색 + 분류 필터 */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="거래처명, 담당자, 분류 검색..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setCategoryFilter('')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${!categoryFilter ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-300'}`}>
            전체
          </button>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${categoryFilter === cat ? 'bg-violet-100 text-violet-700 border-violet-300' : 'bg-white text-slate-600 border-slate-300'}`}>
              {cat}
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
            {search || categoryFilter ? '검색 결과가 없습니다.' : '등록된 거래처가 없습니다.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((v) => (
              <div key={v.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">{v.name}</span>
                      {v.category && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">{v.category}</span>
                      )}
                    </div>
                    {v.contact_name && <p className="text-xs text-slate-500 mt-1">{v.contact_name}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                      {v.phone && (
                        <a href={`tel:${v.phone}`} className="flex items-center gap-1 text-sm text-slate-600 hover:text-violet-600">
                          <Phone size={12} className="text-slate-400" />{v.phone}
                        </a>
                      )}
                      {v.email && (
                        <a href={`mailto:${v.email}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-600 truncate max-w-[180px]">
                          <Mail size={11} className="text-slate-400 flex-shrink-0" />{v.email}
                        </a>
                      )}
                    </div>
                    {v.notes && <p className="text-xs text-slate-400 mt-1.5">{v.notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => { setEditingVendor(v); setShowForm(true) }}
                        className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => handleDelete(v)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <button onClick={() => setOrderVendor(v)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors whitespace-nowrap">
                      <FileText size={11} />발주서
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">총 {filtered.length}개 거래처</div>
        )}
      </div>

      {/* 데스크탑 테이블 */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">거래처명</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">분류</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">담당자</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">전화번호</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">이메일</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">비고</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-600">발주서</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                  {search || categoryFilter ? '검색 결과가 없습니다.' : '등록된 거래처가 없습니다.'}
                </td></tr>
              ) : (
                filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{v.name}</p>
                      {v.address && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{v.address}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      {v.category ? (
                        <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">{v.category}</span>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                      {v.contact_name || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {v.phone ? (
                        <a href={`tel:${v.phone}`} className="flex items-center gap-1.5 text-slate-600 hover:text-violet-600 transition-colors whitespace-nowrap">
                          <Phone size={12} className="text-slate-400" />{v.phone}
                        </a>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {v.email ? (
                        <a href={`mailto:${v.email}`} className="flex items-center gap-1.5 text-slate-600 hover:text-violet-600 transition-colors truncate max-w-[180px]">
                          <Mail size={12} className="text-slate-400 flex-shrink-0" />{v.email}
                        </a>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 max-w-[120px] truncate">
                      {v.notes || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button onClick={() => setOrderVendor(v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors mx-auto whitespace-nowrap">
                        <FileText size={12} />발주서 작성
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setEditingVendor(v); setShowForm(true) }}
                          className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(v)}
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
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            총 {filtered.length}개 거래처
          </div>
        )}
      </div>

      {showForm && (
        <VendorFormModal vendor={editingVendor} onClose={() => setShowForm(false)} onSuccess={fetchVendors} />
      )}
      {orderVendor && (
        <PurchaseOrderModal vendor={orderVendor} onClose={() => setOrderVendor(null)} />
      )}
    </div>
  )
}
