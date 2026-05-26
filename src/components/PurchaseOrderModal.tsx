import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Printer, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { WmsProject } from '../types'

interface Vendor {
  id: string
  name: string
  category?: string
  contact_name?: string
  phone?: string
  email?: string
}

interface OrderItem {
  name: string
  quantity: number
  unit: string
  unit_price: number
  amount: number
}

interface Props {
  vendor: Vendor
  onClose: () => void
  defaultProjectId?: string
}

const emptyItem = (): OrderItem => ({ name: '', quantity: 1, unit: 'EA', unit_price: 0, amount: 0 })

function generateOrderNumber() {
  const now = new Date()
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const r = String(Math.floor(Math.random() * 900) + 100)
  return `PO-${d}-${r}`
}

function formatKRW(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function PurchaseOrderModal({ vendor, onClose, defaultProjectId }: Props) {
  const [projects, setProjects] = useState<WmsProject[]>([])
  const [form, setForm] = useState({
    order_number: generateOrderNumber(),
    order_date: todayStr(),
    delivery_date: '',
    project_id: defaultProjectId || '',
    notes: '',
  })
  const [items, setItems] = useState<OrderItem[]>([emptyItem()])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('wms_projects').select('id, name, exhibitor, status').order('created_at', { ascending: false }).then(({ data }) => {
      setProjects((data || []) as WmsProject[])
    })
  }, [])

  const updateItem = (i: number, field: keyof OrderItem, raw: string) => {
    const updated = [...items]
    const val = field === 'name' || field === 'unit' ? raw : Number(raw) || 0
    updated[i] = { ...updated[i], [field]: val }
    if (field === 'quantity' || field === 'unit_price') {
      updated[i].amount = updated[i].quantity * updated[i].unit_price
    }
    setItems(updated)
  }

  const addItem = () => setItems([...items, emptyItem()])
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i))

  const total = items.reduce((s, item) => s + item.amount, 0)

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('purchase_orders').insert({
      vendor_id: vendor.id,
      order_number: form.order_number,
      order_date: form.order_date,
      delivery_date: form.delivery_date || null,
      project_id: form.project_id || null,
      items: items.filter((it) => it.name.trim()),
      total_amount: total,
      notes: form.notes.trim() || null,
      status: '발주중',
    })
    setSaved(true)
    setSaving(false)
  }

  const handlePrint = () => {
    const selectedProject = projects.find((p) => p.id === form.project_id)
    const itemRows = items
      .filter((it) => it.name.trim())
      .map((it, i) => `
        <tr>
          <td style="border:1px solid #ddd;padding:8px 10px;text-align:center">${i + 1}</td>
          <td style="border:1px solid #ddd;padding:8px 10px">${it.name}</td>
          <td style="border:1px solid #ddd;padding:8px 10px;text-align:center">${it.quantity.toLocaleString()}</td>
          <td style="border:1px solid #ddd;padding:8px 10px;text-align:center">${it.unit}</td>
          <td style="border:1px solid #ddd;padding:8px 10px;text-align:right">${it.unit_price.toLocaleString()}</td>
          <td style="border:1px solid #ddd;padding:8px 10px;text-align:right;font-weight:600">${it.amount.toLocaleString()}</td>
        </tr>`).join('')

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>발주서 - ${form.order_number}</title>
<style>
  @page { margin: 20mm; }
  body { font-family: 'Malgun Gothic', sans-serif; font-size: 13px; color: #1e293b; }
  .header { text-align: center; margin-bottom: 24px; }
  .title { font-size: 28px; font-weight: 700; letter-spacing: 8px; border-bottom: 3px solid #1e293b; padding-bottom: 10px; margin-bottom: 18px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 40px; margin-bottom: 24px; }
  .info-row { display: flex; gap: 8px; padding: 4px 0; border-bottom: 1px dashed #e2e8f0; }
  .info-label { color: #64748b; min-width: 64px; font-size: 12px; }
  .info-value { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  thead th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 9px 10px; font-size: 12px; }
  .total-row { text-align: right; font-size: 16px; font-weight: 700; margin: 12px 0; padding: 12px 16px; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 6px; }
  .notes-section { margin-top: 16px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; min-height: 60px; }
  .notes-label { font-size: 11px; color: #94a3b8; margin-bottom: 4px; }
  .footer { margin-top: 40px; text-align: right; color: #94a3b8; font-size: 11px; }
</style>
</head>
<body>
<div class="header">
  <div class="title">발 &nbsp; 주 &nbsp; 서</div>
</div>
<div class="info-grid">
  <div>
    <div class="info-row"><span class="info-label">발주처</span><span class="info-value">${vendor.name}</span></div>
    <div class="info-row"><span class="info-label">담당자</span><span class="info-value">${vendor.contact_name || '-'}</span></div>
    <div class="info-row"><span class="info-label">연락처</span><span class="info-value">${vendor.phone || '-'}</span></div>
    ${selectedProject ? `<div class="info-row"><span class="info-label">프로젝트</span><span class="info-value">${selectedProject.name}</span></div>` : ''}
  </div>
  <div>
    <div class="info-row"><span class="info-label">발주번호</span><span class="info-value">${form.order_number}</span></div>
    <div class="info-row"><span class="info-label">발주일</span><span class="info-value">${form.order_date.replace(/-/g, '.')}</span></div>
    <div class="info-row"><span class="info-label">납기일</span><span class="info-value">${form.delivery_date ? form.delivery_date.replace(/-/g, '.') : '-'}</span></div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:40px">No.</th>
      <th>품목명</th>
      <th style="width:70px">수량</th>
      <th style="width:60px">단위</th>
      <th style="width:110px">단가</th>
      <th style="width:120px">금액</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows || '<tr><td colspan="6" style="border:1px solid #ddd;padding:20px;text-align:center;color:#94a3b8">품목 없음</td></tr>'}
  </tbody>
</table>

<div class="total-row">합 계 &nbsp;&nbsp; ${formatKRW(total)}</div>

${form.notes ? `<div class="notes-section"><div class="notes-label">비고</div>${form.notes}</div>` : ''}

<div class="footer">발행일: ${form.order_date.replace(/-/g, '.')} &nbsp;|&nbsp; ASO System</div>
</body>
</html>`

    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) return
    w.document.write(html)
    w.document.close()
    setTimeout(() => { w.print() }, 400)
  }

  const inputCls = 'border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0 bg-slate-800 rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold text-white">발주서 작성</h2>
            <p className="text-xs text-slate-400 mt-0.5">{vendor.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">발주처 정보</p>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-slate-800 text-base">{vendor.name}</p>
                {vendor.contact_name && <p className="text-slate-600">담당: {vendor.contact_name}</p>}
                {vendor.phone && <p className="text-slate-600">연락처: {vendor.phone}</p>}
                {vendor.category && <p className="text-slate-500 text-xs">{vendor.category}</p>}
              </div>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">발주번호</label>
                  <input value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })}
                    className={`${inputCls} w-full`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">발주일</label>
                  <input type="date" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })}
                    className={`${inputCls} w-full`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">납기일</label>
                  <input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
                    className={`${inputCls} w-full`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">프로젝트</label>
                  <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                    className={`${inputCls} w-full`}>
                    <option value="">선택 안함</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 품목 목록 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">품목 목록</p>
              <button onClick={addItem}
                className="flex items-center gap-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors">
                <Plus size={13} />품목 추가
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600 w-8">No.</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">품목명</th>
                    <th className="text-center px-2 py-2.5 font-semibold text-slate-600 w-20">수량</th>
                    <th className="text-center px-2 py-2.5 font-semibold text-slate-600 w-16">단위</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-slate-600 w-28">단가 (원)</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-slate-600 w-28">금액 (원)</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        <input value={item.name} onChange={(e) => updateItem(i, 'name', e.target.value)}
                          placeholder="품목명 입력"
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                          min="1"
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-violet-400" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={item.unit} onChange={(e) => updateItem(i, 'unit', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-violet-400" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" value={item.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)}
                          min="0"
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-violet-400" />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">
                        {item.amount.toLocaleString()}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {items.length > 1 && (
                          <button onClick={() => removeItem(i)} className="text-slate-300 hover:text-red-400 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td colSpan={5} className="px-3 py-3 text-right font-bold text-slate-700">합 계</td>
                    <td className="px-3 py-3 text-right font-bold text-lg text-violet-700">{formatKRW(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 비고 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">비고</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="추가 전달 사항을 입력하세요" rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none" />
          </div>

          {saved && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
              발주서가 저장되었습니다.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-xl flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
            닫기
          </button>
          <div className="flex-1" />
          <button onClick={handleSave} disabled={saving || saved}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50">
            <Save size={14} />
            {saved ? '저장됨' : saving ? '저장 중...' : '저장'}
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors shadow-sm">
            <Printer size={14} />
            인쇄 / 미리보기
          </button>
        </div>
      </div>
    </div>
  )
}
