import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PO_STATUSES, type PurchaseOrder } from './ViewPurchaseOrderModal'

/** 목록의 관리 → 수정: 발주 금액과 상태만 빠르게 수정 */
export default function EditPoSummaryModal({
  po, onClose, onSaved,
}: { po: PurchaseOrder; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(po.total_amount.toLocaleString())
  const [status, setStatus] = useState(po.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const total = Number(amount.replace(/[^0-9]/g, '')) || 0
    const { error: err } = await supabase.from('purchase_orders').update({ total_amount: total, status }).eq('id', po.id)
    setSaving(false)
    if (err) { setError('저장 중 오류가 발생했습니다.'); return }
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-800 rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold text-white">발주서 수정</h2>
            <p className="text-xs text-slate-400 mt-0.5">{po.vendors?.name || '-'} · {po.order_number}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">금액 (원)</label>
            <input value={amount} inputMode="numeric"
              onChange={(e) => {
                const n = Number(e.target.value.replace(/[^0-9]/g, ''))
                setAmount(e.target.value.trim() === '' ? '' : n.toLocaleString())
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <p className="text-xs text-slate-400 mt-1">견적서를 첨부하면 견적서 총계로 자동 입력됩니다.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">상태</label>
            <div className="flex gap-2">
              {PO_STATUSES.map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${status === s ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-300 hover:border-violet-400'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
            취소
          </button>
          <div className="flex-1" />
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50">
            <Save size={14} />{saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
