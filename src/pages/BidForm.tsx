import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface ProjectInfo {
  name: string
  exhibition?: string
  start_date?: string
  end_date?: string
  notes?: string
}

export default function BidForm() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', proposed_price: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchProject() {
      if (!projectId) { setLoading(false); return }
      const { data } = await supabase
        .from('wms_projects')
        .select('name, exhibition, start_date, end_date, notes')
        .eq('id', projectId)
        .single()
      setProject(data)
      setLoading(false)
    }
    fetchProject()
  }, [projectId])

  async function handleSubmit() {
    if (!form.name.trim()) { setError('이름을 입력해주세요.'); return }
    if (!form.phone.trim()) { setError('연락처를 입력해주세요.'); return }
    const price = Number(form.proposed_price)
    if (!price || price <= 0) { setError('제안 금액을 입력해주세요.'); return }
    setSaving(true)
    setError('')
    const { error: e } = await supabase.from('project_bids').insert({
      project_id: projectId,
      bidder_name: form.name.trim(),
      bidder_phone: form.phone.trim(),
      proposed_price: price,
      note: form.note.trim() || null,
    })
    setSaving(false)
    if (e) { setError('제출에 실패했습니다. 다시 시도해주세요.'); return }
    setSubmitted(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400">로딩 중...</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Check size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">제안이 접수되었습니다</h2>
          <p className="text-slate-500 text-sm">담당자 검토 후 연락드리겠습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 w-full max-w-md">
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">A</span>
            </div>
            <span className="text-sm font-semibold text-slate-600">아소시스템</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800">시공 입찰 참여</h1>
          {project ? (
            <div className="mt-3 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 space-y-1">
              <p className="font-semibold text-violet-900">{project.name}</p>
              {project.exhibition && (
                <p className="text-xs text-violet-700">{project.exhibition}</p>
              )}
              {project.start_date && (
                <p className="text-xs text-violet-600">
                  {project.start_date.replace(/-/g, '.')}
                  {project.end_date && ` ~ ${project.end_date.replace(/-/g, '.')}`}
                </p>
              )}
              {project.notes && (
                <p className="text-xs text-slate-500 pt-1 border-t border-violet-100">{project.notes}</p>
              )}
            </div>
          ) : (
            <div className="mt-3 bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-sm text-slate-400">프로젝트 정보를 불러올 수 없습니다.</p>
            </div>
          )}
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="홍길동"
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              연락처 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="010-0000-0000"
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              제안 금액 (원) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={form.proposed_price}
              onChange={(e) => setForm({ ...form, proposed_price: e.target.value })}
              placeholder="500000"
              min={0}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">메모</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="참여 가능 일정, 특이사항 등"
              rows={3}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-3 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors disabled:opacity-50 mt-2"
          >
            {saving ? '제출 중...' : '입찰 제안하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
