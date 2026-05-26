import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Phone, Mail, Edit2, Trash2, X, Save, MapPin, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'

export interface Worker {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  level?: string
  specialty?: string
  notes?: string
  created_at: string
}

const LEVELS = ['보조', '일반', '숙련', '전문']

const LEVEL_COLORS: Record<string, string> = {
  보조:  'bg-slate-100 text-slate-600 border-slate-200',
  일반:  'bg-blue-100 text-blue-700 border-blue-200',
  숙련:  'bg-green-100 text-green-700 border-green-200',
  전문:  'bg-violet-100 text-violet-700 border-violet-200',
}

const emptyForm = () => ({
  name: '', phone: '', email: '', address: '', level: '', specialty: '', notes: '',
})

function WorkerModal({
  worker,
  onClose,
  onSuccess,
}: {
  worker: Worker | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState(worker ? {
    name: worker.name,
    phone: worker.phone || '',
    email: worker.email || '',
    address: worker.address || '',
    level: worker.level || '',
    specialty: worker.specialty || '',
    notes: worker.notes || '',
  } : emptyForm())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!worker

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('이름을 입력해주세요.'); return }
    setLoading(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        level: form.level || null,
        specialty: form.specialty.trim() || null,
        notes: form.notes.trim() || null,
      }
      if (isEdit) {
        const { error: err } = await supabase.from('construction_workers').update(payload).eq('id', worker.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('construction_workers').insert(payload)
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

  const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent'
  const labelClass = 'block text-xs font-medium text-slate-600 mb-1'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800">{isEdit ? '인력 정보 수정' : '인력 추가'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className={labelClass}>이름 <span className="text-red-500">*</span></label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="홍길동" className={inputClass} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelClass}>시공레벨</label>
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className={inputClass}>
                <option value="">선택 안함</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>연락처</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="010-0000-0000" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>이메일</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="hong@email.com" className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>주소</label>
            <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="서울시 강남구..." className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>특기사항</label>
            <input type="text" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              placeholder="예: 전기, 배관, 도장, 목공..." className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>비고</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="추가 메모 사항" rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none" />
          </div>
        </form>

        <div className="flex gap-3 px-6 py-4 border-t bg-slate-50 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
            취소
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50">
            <Save size={14} />
            {loading ? '저장 중...' : (isEdit ? '수정 저장' : '추가')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ConstructionStaff() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)

  const fetchWorkers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('construction_workers').select('*').order('name')
    setWorkers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchWorkers() }, [fetchWorkers])

  const handleDelete = async (worker: Worker) => {
    if (!confirm(`'${worker.name}'을(를) 삭제하시겠습니까?`)) return
    await supabase.from('construction_workers').delete().eq('id', worker.id)
    fetchWorkers()
  }

  const openAdd = () => { setEditingWorker(null); setShowModal(true) }
  const openEdit = (w: Worker) => { setEditingWorker(w); setShowModal(true) }

  const filtered = workers.filter((w) => {
    const matchSearch = !search || w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.specialty || '').toLowerCase().includes(search.toLowerCase())
    const matchLevel = !levelFilter || w.level === levelFilter
    return matchSearch && matchLevel
  })

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">시공인력</h1>
          <p className="text-slate-500 text-sm mt-1">시공인원 정보 관리</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors shadow-sm">
          <Plus size={16} />
          인력 추가
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 특기사항 검색..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setLevelFilter('')}
            className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${!levelFilter ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
            전체
          </button>
          {LEVELS.map((l) => (
            <button key={l} onClick={() => setLevelFilter(levelFilter === l ? '' : l)}
              className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${levelFilter === l ? LEVEL_COLORS[l] : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">이름</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-600">시공레벨</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">연락처</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">이메일</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">주소</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">특기사항</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">비고</th>
                <th className="px-4 py-3.5 text-center font-semibold text-slate-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                  {search || levelFilter ? '검색 결과가 없습니다.' : '등록된 인력이 없습니다. 인력을 추가해주세요.'}
                </td></tr>
              ) : (
                filtered.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{w.name}</p>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {w.level ? (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full border ${LEVEL_COLORS[w.level] || 'bg-slate-100 text-slate-600'}`}>
                          <Star size={10} />
                          {w.level}
                        </span>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {w.phone ? (
                        <a href={`tel:${w.phone}`} className="flex items-center gap-1.5 text-slate-600 hover:text-violet-600 transition-colors">
                          <Phone size={13} className="text-slate-400" />{w.phone}
                        </a>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {w.email ? (
                        <a href={`mailto:${w.email}`} className="flex items-center gap-1.5 text-slate-600 hover:text-violet-600 transition-colors truncate max-w-[160px]">
                          <Mail size={13} className="text-slate-400 flex-shrink-0" />{w.email}
                        </a>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {w.address ? (
                        <span className="flex items-center gap-1.5 text-slate-600 max-w-[160px] truncate">
                          <MapPin size={13} className="text-slate-400 flex-shrink-0" />{w.address}
                        </span>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 max-w-[140px] truncate">
                      {w.specialty || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs max-w-[140px] truncate">
                      {w.notes || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(w)}
                          className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(w)}
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
            총 {filtered.length}명
          </div>
        )}
      </div>

      {showModal && (
        <WorkerModal
          worker={editingWorker}
          onClose={() => setShowModal(false)}
          onSuccess={fetchWorkers}
        />
      )}
    </div>
  )
}
