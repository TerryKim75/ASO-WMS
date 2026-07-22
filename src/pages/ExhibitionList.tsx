import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Edit2, Trash2, X, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { ExhibitionListItem, WmsProject } from '../types'

const emptyForm = () => ({
  name: '', venue: '', city: '', country: '', start_date: '', end_date: '',
  organizer: '', official_contractor: '', participants: '', notes: '',
})

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent'
const labelCls = 'block text-xs font-medium text-slate-600 mb-1'

function formatDate(d?: string) {
  return d ? d.replace(/-/g, '.') : '-'
}

function ExhibitionFormModal({
  exhibition,
  onClose,
  onSuccess,
}: {
  exhibition: ExhibitionListItem | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState(exhibition ? {
    name: exhibition.name,
    venue: exhibition.venue || '',
    city: exhibition.city || '',
    country: exhibition.country || '',
    start_date: exhibition.start_date || '',
    end_date: exhibition.end_date || '',
    organizer: exhibition.organizer || '',
    official_contractor: exhibition.official_contractor || '',
    participants: exhibition.participants || '',
    notes: exhibition.notes || '',
  } : emptyForm())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('전시회명을 입력해주세요.'); return }
    setLoading(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        venue: form.venue.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        organizer: form.organizer.trim() || null,
        official_contractor: form.official_contractor.trim() || null,
        participants: form.participants.trim() || null,
        notes: form.notes.trim() || null,
      }
      if (exhibition) {
        const { error: err } = await supabase.from('exhibition_list').update(payload).eq('id', exhibition.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('exhibition_list').insert(payload)
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800">{exhibition ? '전시회 수정' : '전시회 추가'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>전시회명 <span className="text-red-500">*</span></label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 2026 서울 모터쇼" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>국가</label>
              <input type="text" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="대한민국" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>도시</label>
              <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="서울" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>전시장</label>
              <input type="text" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })}
                placeholder="코엑스, 킨텍스..." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>시작일</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>종료일</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>주최사</label>
              <input type="text" value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })}
                placeholder="주최사명" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>공식 시공사</label>
              <input type="text" value={form.official_contractor} onChange={(e) => setForm({ ...form, official_contractor: e.target.value })}
                placeholder="공식 지정 시공사명" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>참가업체 수</label>
              <input type="text" value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })}
                placeholder="예: 500개사" className={inputCls} />
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
            <Save size={14} />{loading ? '저장 중...' : (exhibition ? '수정 저장' : '추가')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ExhibitionDetailModal({
  exhibition,
  projects,
  onClose,
}: {
  exhibition: ExhibitionListItem
  projects: WmsProject[]
  onClose: () => void
}) {
  const navigate = useNavigate()
  const related = projects.filter((p) => p.exhibition === exhibition.name)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800">{exhibition.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <dl className="space-y-2.5 text-sm">
            {([
              ['전시장', exhibition.venue],
              ['위치', [exhibition.city, exhibition.country].filter(Boolean).join(', ') || undefined],
              ['기간', (exhibition.start_date || exhibition.end_date) ? `${formatDate(exhibition.start_date)} ~ ${formatDate(exhibition.end_date)}` : undefined],
              ['주최사', exhibition.organizer], ['공식 시공사', exhibition.official_contractor],
              ['참가업체 수', exhibition.participants],
            ] as const).map(([label, val]) => val && (
              <div key={label} className="flex gap-3">
                <dt className="text-xs font-medium text-slate-400 w-24 flex-shrink-0 pt-0.5">{label}</dt>
                <dd className="text-slate-800 flex-1 break-all">{val}</dd>
              </div>
            ))}
            {exhibition.notes && (
              <div className="flex gap-3">
                <dt className="text-xs font-medium text-slate-400 w-24 flex-shrink-0 pt-0.5">비고</dt>
                <dd className="text-slate-600 flex-1 whitespace-pre-wrap">{exhibition.notes}</dd>
              </div>
            )}
          </dl>

          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">관련 프로젝트 ({related.length})</p>
            {related.length === 0 ? (
              <p className="text-sm text-slate-400">등록된 프로젝트가 없습니다.</p>
            ) : (
              <div className="space-y-1.5">
                {related.map((p) => (
                  <button key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                      p.status === '취소'
                        ? 'border-slate-100 text-slate-400 line-through'
                        : 'border-slate-200 text-slate-700 hover:bg-violet-50 hover:border-violet-200'
                    }`}>
                    {p.name}
                    {p.exhibitor && <span className="text-slate-400 font-normal"> · {p.exhibitor}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ExhibitionList() {
  const [exhibitions, setExhibitions] = useState<ExhibitionListItem[]>([])
  const [projects, setProjects] = useState<WmsProject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingExhibition, setEditingExhibition] = useState<ExhibitionListItem | null>(null)
  const [detailExhibition, setDetailExhibition] = useState<ExhibitionListItem | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: exhibitionData }, { data: projectData }] = await Promise.all([
      supabase.from('exhibition_list').select('*').order('start_date', { ascending: false }),
      supabase.from('wms_projects').select('*'),
    ])
    setExhibitions(exhibitionData || [])
    setProjects(projectData || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (ex: ExhibitionListItem) => {
    if (!confirm(`'${ex.name}'을(를) 삭제하시겠습니까?`)) return
    await supabase.from('exhibition_list').delete().eq('id', ex.id)
    fetchData()
  }

  const projectCount = (name: string) => projects.filter((p) => p.exhibition === name).length

  const filtered = exhibitions.filter((ex) => {
    const q = search.toLowerCase()
    return !q || ex.name.toLowerCase().includes(q) ||
      (ex.city || '').toLowerCase().includes(q) ||
      (ex.country || '').toLowerCase().includes(q)
  })

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">전시목록</h1>
          <p className="text-slate-500 text-sm mt-0.5">전시회 마스터 정보 관리</p>
        </div>
        <button onClick={() => { setEditingExhibition(null); setShowForm(true) }}
          className="flex items-center gap-2 px-3 py-2 md:px-4 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors shadow-sm">
          <Plus size={16} /><span className="hidden sm:inline">전시회 추가</span><span className="sm:hidden">추가</span>
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="전시회명, 도시, 국가 검색..."
          className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
      </div>

      {/* 모바일 카드 */}
      <div className="md:hidden bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            {search ? '검색 결과가 없습니다.' : '등록된 전시회가 없습니다.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((ex) => (
              <div key={ex.id} className="p-4" onClick={() => setDetailExhibition(ex)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-slate-800">{ex.name}</span>
                    <p className="text-xs text-slate-500 mt-1">
                      {[ex.city, ex.country].filter(Boolean).join(', ') || '-'}
                    </p>
                    {(ex.start_date || ex.end_date) && (
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(ex.start_date)} ~ {formatDate(ex.end_date)}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1.5">관련 프로젝트 {projectCount(ex.name)}건</p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setEditingExhibition(ex); setShowForm(true) }}
                      className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => handleDelete(ex)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">총 {filtered.length}개 전시회</div>
        )}
      </div>

      {/* 데스크탑 테이블 */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">전시회명</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">위치</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">전시장</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">기간</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">주최사</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-600">관련 프로젝트</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                  {search ? '검색 결과가 없습니다.' : '등록된 전시회가 없습니다.'}
                </td></tr>
              ) : (
                filtered.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <button onClick={() => setDetailExhibition(ex)} className="font-semibold text-slate-800 hover:text-violet-600 text-left">{ex.name}</button>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      {[ex.city, ex.country].filter(Boolean).join(', ') || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      {ex.venue || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs whitespace-nowrap">
                      {(ex.start_date || ex.end_date) ? `${formatDate(ex.start_date)} ~ ${formatDate(ex.end_date)}` : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      {ex.organizer || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button onClick={() => setDetailExhibition(ex)}
                        className="text-xs font-medium text-violet-600 hover:text-violet-700">
                        {projectCount(ex.name)}건
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setEditingExhibition(ex); setShowForm(true) }}
                          className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(ex)}
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
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">총 {filtered.length}개 전시회</div>
        )}
      </div>

      {showForm && (
        <ExhibitionFormModal exhibition={editingExhibition} onClose={() => setShowForm(false)} onSuccess={fetchData} />
      )}
      {detailExhibition && (
        <ExhibitionDetailModal exhibition={detailExhibition} projects={projects} onClose={() => setDetailExhibition(null)} />
      )}
    </div>
  )
}
