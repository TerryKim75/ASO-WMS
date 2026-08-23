import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export interface PurchaseOrder {
  id: string; vendor_id: string; order_number: string; order_date: string
  delivery_date?: string; project_id?: string; total_amount: number; status: string
  file_url?: string; notes?: string
  vendors?: { name: string; contact_name?: string; phone?: string }
  wms_projects?: { name: string } | null
}

export const PO_STATUSES = ['발주중', '납품완료', '취소']

export default function EditPurchaseOrderModal({
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
