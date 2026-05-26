import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Item, TransactionType, WmsProject } from '../types'

interface Props {
  item: Item
  onClose: () => void
  onSuccess: () => void
  defaultProjectId?: string
  mode?: 'stock' | 'project'
}

// stock mode: 신규추가(입고) / 판매(출고) / 손실
const STOCK_TYPES: { label: string; value: TransactionType; color: string }[] = [
  { label: '신규추가', value: '입고', color: 'bg-green-100 text-green-800 border-green-300' },
  { label: '판매', value: '출고', color: 'bg-red-100 text-red-800 border-red-300' },
  { label: '손실', value: '손실', color: 'bg-orange-100 text-orange-800 border-orange-300' },
]

// project mode: 출고 / 반입 / 손실
const PROJECT_TYPES: { label: string; value: TransactionType; color: string }[] = [
  { label: '출고', value: '출고', color: 'bg-red-100 text-red-800 border-red-300' },
  { label: '반입', value: '반입', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { label: '손실', value: '손실', color: 'bg-orange-100 text-orange-800 border-orange-300' },
]

export default function TransactionModal({ item, onClose, onSuccess, defaultProjectId, mode = 'project' }: Props) {
  const types = mode === 'stock' ? STOCK_TYPES : PROJECT_TYPES
  const defaultType = types[0].value

  const [form, setForm] = useState({
    transaction_type: defaultType,
    quantity: '',
    project_id: defaultProjectId || '',
    transaction_date: (() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })(),
    notes: '',
  })
  const [projects, setProjects] = useState<WmsProject[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode !== 'stock') {
      supabase
        .from('wms_projects')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data }) => { if (data) setProjects(data) })
    }
  }, [mode])

  const showProjectSelect = mode === 'project'

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    const qty = parseInt(form.quantity)
    if (!qty || qty <= 0) { setError('수량을 올바르게 입력해주세요.'); return }
    setLoading(true)
    setError('')

    try {
      const { error: txError } = await supabase.from('inventory_transactions').insert({
        item_id: item.id,
        transaction_type: form.transaction_type,
        quantity: qty,
        project_id: form.project_id || null,
        transaction_date: form.transaction_date,
        notes: form.notes.trim() || null,
      })
      if (txError) throw txError
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || '처리 중 오류가 발생했습니다.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {mode === 'stock' ? '재고 변경' : '입출고 등록'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{item.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">구분</label>
            <div className={`grid gap-2 ${types.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
              {types.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setForm({ ...form, transaction_type: type.value })}
                  className={`py-2.5 text-sm font-medium rounded-lg border-2 transition-all ${
                    form.transaction_type === type.value
                      ? `border-current ${type.color}`
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              수량 <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="0"
                min="1"
                autoFocus
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              <span className="text-sm text-slate-500 w-10">{item.unit}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">날짜</label>
            <input
              type="date"
              value={form.transaction_date}
              onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {showProjectSelect && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">프로젝트</label>
              <select
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                <option value="">프로젝트 선택 (선택사항)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.exhibitor ? ` (${p.exhibitor})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">비고</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="메모 입력 (선택)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              취소
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50">
              {loading ? '저장 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
