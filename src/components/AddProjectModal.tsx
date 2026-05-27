import { useState } from 'react'
import { X, Plus, Trash2, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { ProjectStatus, ConstructionStaff } from '../types'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

const STATUSES: ProjectStatus[] = ['제안중', '계약완료', '시공진행', '완료', '취소']
const MANAGERS = ['김태환', '고연호', '김종혜']

const emptyStaff = (): ConstructionStaff => ({ name: '', phone: '', email: '' })

export default function AddProjectModal({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    name: '',
    exhibition: '',
    organizer: '',
    exhibitor: '',
    status: '영업중' as ProjectStatus,
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    manager: '',
    shipping_date: '',
    return_date: '',
    construction_date: '',
    demolition_date: '',
    notes: '',
  })
  const [staff, setStaff] = useState<ConstructionStaff[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addStaff = () => setStaff([...staff, emptyStaff()])
  const removeStaff = (i: number) => setStaff(staff.filter((_, idx) => idx !== i))
  const updateStaff = (i: number, field: keyof ConstructionStaff, value: string) => {
    const updated = [...staff]
    updated[i] = { ...updated[i], [field]: value }
    setStaff(updated)
  }

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('프로젝트명을 입력해주세요.'); return }
    setLoading(true)
    setError('')

    try {
      const validStaff = staff.filter((s) => s.name.trim())
      const { error: projError } = await supabase.from('wms_projects').insert({
        name: form.name.trim(),
        exhibition: form.exhibition.trim() || null,
        organizer: form.organizer.trim() || null,
        exhibitor: form.exhibitor.trim() || null,
        status: form.status,
        start_date: form.start_date || null,
        start_time: form.start_time || null,
        end_date: form.end_date || null,
        end_time: form.end_time || null,
        manager: form.manager || null,
        construction_staff: validStaff.length > 0 ? validStaff : null,
        shipping_date: form.shipping_date || null,
        return_date: form.return_date || null,
        construction_date: form.construction_date || null,
        demolition_date: form.demolition_date || null,
        notes: form.notes.trim() || null,
      })
      if (projError) throw projError
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message || JSON.stringify(err)
      setError(msg || '프로젝트 추가 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent'
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800">프로젝트 추가</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
            )}

            {/* 기본 정보 */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">기본 정보</p>

              <div>
                <label className={labelClass}>프로젝트명 <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="예: 2025 서울 국제 전시회" className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>전시회</label>
                  <input type="text" value={form.exhibition} onChange={(e) => setForm({ ...form, exhibition: e.target.value })}
                    placeholder="전시회명" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>기획사</label>
                  <input type="text" value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })}
                    placeholder="기획사명" className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>참가사</label>
                <input type="text" value={form.exhibitor} onChange={(e) => setForm({ ...form, exhibitor: e.target.value })}
                  placeholder="참가사명" className={inputClass} />
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* 진행현황 + 담당 */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">진행 정보</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>진행현황</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
                    className={inputClass}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>담당</label>
                  <select value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })}
                    className={inputClass}>
                    <option value="">담당자 선택</option>
                    {MANAGERS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* 전시일정 */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">전시 일정</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>시작일</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>시작 시간</label>
                  <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>종료일</label>
                  <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>종료 시간</label>
                  <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className={inputClass} />
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* 출고/입고 예정일 */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">출고 / 입고 예정일</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>출고예정일</label>
                  <input type="date" value={form.shipping_date} onChange={(e) => setForm({ ...form, shipping_date: e.target.value })}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>입고예정일</label>
                  <input type="date" value={form.return_date} onChange={(e) => setForm({ ...form, return_date: e.target.value })}
                    className={inputClass} />
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* 시공 / 철거 일정 */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">시공 / 철거 일정</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>시공일</label>
                  <input type="date" value={form.construction_date} onChange={(e) => setForm({ ...form, construction_date: e.target.value })}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>철거일</label>
                  <input type="date" value={form.demolition_date} onChange={(e) => setForm({ ...form, demolition_date: e.target.value })}
                    className={inputClass} />
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* 시공인력 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">시공인력</p>
                <button type="button" onClick={addStaff}
                  className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors">
                  <UserPlus size={13} />
                  인력 추가
                </button>
              </div>

              {staff.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-lg py-6 text-center">
                  <p className="text-sm text-slate-400">시공인력을 추가하려면 위 버튼을 클릭하세요</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {staff.map((s, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500">인력 {i + 1}</span>
                        <button type="button" onClick={() => removeStaff(i)}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">이름 <span className="text-red-400">*</span></label>
                          <input type="text" value={s.name} onChange={(e) => updateStaff(i, 'name', e.target.value)}
                            placeholder="홍길동"
                            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">전화번호</label>
                          <input type="tel" value={s.phone} onChange={(e) => updateStaff(i, 'phone', e.target.value)}
                            placeholder="010-0000-0000"
                            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">이메일</label>
                          <input type="email" value={s.email} onChange={(e) => updateStaff(i, 'email', e.target.value)}
                            placeholder="hong@email.com"
                            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addStaff}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-500 border border-dashed border-slate-300 rounded-lg hover:border-violet-400 hover:text-violet-600 transition-colors">
                    <Plus size={14} />
                    인력 추가
                  </button>
                </div>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* 비고 */}
            <div>
              <label className={labelClass}>비고</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="추가 메모 사항" rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t bg-slate-50 flex-shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
              취소
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50">
              {loading ? '저장 중...' : '프로젝트 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
