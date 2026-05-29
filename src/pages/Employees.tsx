import { useState, useEffect, useCallback } from 'react'
import { Plus, Phone, Mail, Edit2, Trash2, X, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Employee {
  id: string
  name: string
  name_en?: string
  position?: string
  role?: string
  email?: string
  phone?: string
  status: string
  created_at: string
}

const ROLE_OPTIONS = ['PM', '디자이너', '하이브리드', '관리', '대표', '엔지니어', '시공']
const POSITION_OPTIONS = ['대표', '이사', '부장', '차장', '과장', '대리', '주임', '사원', '실장']
const STATUS_OPTIONS = ['재직', '퇴사']

const ROLE_COLORS: Record<string, string> = {
  PM: 'bg-violet-100 text-violet-700',
  디자이너: 'bg-pink-100 text-pink-700',
  하이브리드: 'bg-blue-100 text-blue-700',
  관리: 'bg-slate-100 text-slate-600',
  대표: 'bg-amber-100 text-amber-700',
  엔지니어: 'bg-green-100 text-green-700',
  시공: 'bg-orange-100 text-orange-700',
}

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-teal-500',
]

function getAvatarColor(name: string) {
  let hash = 0
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function isKoreanName(name: string) {
  return /[가-힣]/.test(name)
}

const emptyForm = { name: '', name_en: '', position: '', role: '', email: '', phone: '', status: '재직' }

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'전체' | '재직' | '퇴사'>('재직')

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('employees').select('*').order('created_at')
    setEmployees((data || []) as Employee[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setShowModal(true)
  }

  function openEdit(emp: Employee) {
    setEditing(emp)
    setForm({
      name: emp.name, name_en: emp.name_en || '',
      position: emp.position || '', role: emp.role || '',
      email: emp.email || '', phone: emp.phone || '', status: emp.status,
    })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('이름을 입력해주세요.'); return }
    setSaving(true)
    setError('')
    const payload = {
      name: form.name.trim(), name_en: form.name_en.trim() || null,
      position: form.position || null, role: form.role || null,
      email: form.email.trim() || null, phone: form.phone.trim() || null,
      status: form.status,
    }
    if (editing) {
      const { error: e } = await supabase.from('employees').update(payload).eq('id', editing.id)
      if (e) { setError(e.message); setSaving(false); return }
    } else {
      const { error: e } = await supabase.from('employees').insert(payload)
      if (e) { setError(e.message); setSaving(false); return }
    }
    setSaving(false)
    setShowModal(false)
    fetchEmployees()
  }

  async function handleDelete(emp: Employee) {
    if (!window.confirm(`${emp.name} 직원을 삭제하시겠습니까?`)) return
    await supabase.from('employees').delete().eq('id', emp.id)
    fetchEmployees()
  }

  const RANK_ORDER: Record<string, number> = { '대표': 0, '실장': 1, '과장': 2, '부장': 3 }
  const filtered = employees
    .filter((e) => filter === '전체' || e.status === filter)
    .sort((a, b) => {
      const ra = RANK_ORDER[a.position ?? ''] ?? 99
      const rb = RANK_ORDER[b.position ?? ''] ?? 99
      return ra - rb
    })
  const activeCount = employees.filter((e) => e.status === '재직').length

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">직원정보</h1>
          <p className="text-slate-500 text-sm mt-0.5">아소시스템 재직 직원 {activeCount}명</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-3 py-2 md:px-4 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors shadow-sm">
          <Plus size={16} /><span className="hidden sm:inline">직원 추가</span><span className="sm:hidden">추가</span>
        </button>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2">
        {(['재직', '전체', '퇴사'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-lg transition-colors ${
              filter === f ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-300'
            }`}>
            {f}
            <span className="ml-1.5 text-xs opacity-70">
              ({f === '전체' ? employees.length : employees.filter((e) => e.status === f).length})
            </span>
          </button>
        ))}
      </div>

      {/* 직원 카드 목록 */}
      {loading ? (
        <div className="text-center py-20 text-slate-400">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">직원 정보가 없습니다.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((emp) => (
            <div key={emp.id}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
                emp.status === '퇴사' ? 'border-slate-200 opacity-60' : 'border-slate-200'
              }`}>
              {/* 카드 상단 */}
              <div className="px-5 pt-5 pb-4 flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 ${getAvatarColor(emp.name)}`}>
                  {(isKoreanName(emp.name) ? emp.name : (emp.name_en || emp.name)).charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      {isKoreanName(emp.name) ? (
                        <>
                          <p className="font-bold text-slate-800 text-base leading-tight">{emp.name}</p>
                          {emp.name_en && <p className="text-xs text-slate-400 mt-0.5">{emp.name_en}</p>}
                        </>
                      ) : (
                        <p className="font-bold text-slate-800 text-base leading-tight">{emp.name_en || emp.name}</p>
                      )}
                    </div>
                    {emp.status === '퇴사' && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0">퇴사</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {emp.position && (
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{emp.position}</span>
                    )}
                    {emp.role && (
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${ROLE_COLORS[emp.role] || 'bg-slate-100 text-slate-600'}`}>
                        {emp.role}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 연락처 */}
              <div className="px-5 pb-4 space-y-1.5 border-t border-slate-50 pt-3">
                {emp.email ? (
                  <a href={`mailto:${emp.email}`}
                    className="flex items-center gap-2 text-xs text-slate-500 hover:text-violet-600 transition-colors">
                    <Mail size={12} className="shrink-0" /><span className="truncate">{emp.email}</span>
                  </a>
                ) : <p className="flex items-center gap-2 text-xs text-slate-300"><Mail size={12} />-</p>}
                {emp.phone ? (
                  <a href={`tel:${emp.phone}`}
                    className="flex items-center gap-2 text-xs text-slate-500 hover:text-violet-600 transition-colors">
                    <Phone size={12} className="shrink-0" />{emp.phone}
                  </a>
                ) : <p className="flex items-center gap-2 text-xs text-slate-300"><Phone size={12} />-</p>}
              </div>

              {/* 액션 버튼 */}
              <div className="flex border-t border-slate-100">
                <button onClick={() => openEdit(emp)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                  <Edit2 size={12} />수정
                </button>
                <div className="w-px bg-slate-100" />
                <button onClick={() => handleDelete(emp)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={12} />삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-800">{editing ? '직원 정보 수정' : '직원 추가'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">이름 <span className="text-red-500">*</span></label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="홍길동"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">영문이름</label>
                  <input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                    placeholder="Hong Gil-dong"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">직급</label>
                  <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="">선택</option>
                    {POSITION_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">담당업무</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="">선택</option>
                    {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="example@gencos.co.kr"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">전화번호</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">상태</label>
                <div className="flex gap-3">
                  {STATUS_OPTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => setForm({ ...form, status: s })}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
                        form.status === s ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-300 hover:border-violet-400'
                      }`}>
                      {form.status === s && <Check size={13} />}{s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t bg-slate-50 flex-shrink-0">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
                취소
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50">
                {saving ? '저장 중...' : (editing ? '수정' : '추가')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
