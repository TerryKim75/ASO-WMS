import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Phone, Mail, Edit2, Trash2, X, Save, Upload, FileText, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Client, WmsProject } from '../types'

const emptyForm = () => ({
  name: '', industry: '', manager: '', contact_name: '', phone: '', email: '',
  invoice_email: '', address: '', notes: '',
})

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent'
const labelCls = 'block text-xs font-medium text-slate-600 mb-1'

function ClientFormModal({
  client,
  onClose,
  onSuccess,
}: {
  client: Client | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState(client ? {
    name: client.name,
    industry: client.industry || '',
    manager: client.manager || '',
    contact_name: client.contact_name || '',
    phone: client.phone || '',
    email: client.email || '',
    invoice_email: client.invoice_email || '',
    address: client.address || '',
    notes: client.notes || '',
  } : emptyForm())
  const [existingFileUrl, setExistingFileUrl] = useState(client?.business_reg_url || '')
  const [newFile, setNewFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('고객사명을 입력해주세요.'); return }
    setLoading(true)
    setError('')
    try {
      let businessRegUrl = existingFileUrl
      if (newFile) {
        const ext = newFile.name.split('.').pop()
        const path = `${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('client-files').upload(path, newFile, { upsert: true })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('client-files').getPublicUrl(path)
        businessRegUrl = urlData.publicUrl
      }
      const payload = {
        name: form.name.trim(),
        industry: form.industry.trim() || null,
        manager: form.manager.trim() || null,
        contact_name: form.contact_name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        invoice_email: form.invoice_email.trim() || null,
        address: form.address.trim() || null,
        business_reg_url: businessRegUrl || null,
        notes: form.notes.trim() || null,
      }
      if (client) {
        const { error: err } = await supabase.from('clients').update(payload).eq('id', client.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('clients').insert(payload)
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
          <h2 className="text-lg font-bold text-slate-800">{client ? '고객사 수정' : '고객사 추가'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>고객사명 <span className="text-red-500">*</span></label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="(주)예시전시" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>산업분류</label>
              <input type="text" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}
                placeholder="제조업, IT, 바이오..." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>담당PM</label>
              <input type="text" value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })}
                placeholder="담당자명" className={inputCls} />
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
              <label className={labelCls}>담당자 이메일</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="example@email.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>계산서 이메일</label>
              <input type="email" value={form.invoice_email} onChange={(e) => setForm({ ...form, invoice_email: e.target.value })}
                placeholder="invoice@company.com" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>주소</label>
              <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="주소 입력" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>사업자등록증</label>
              {existingFileUrl && !newFile && (
                <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-2">
                  <FileText size={13} className="text-slate-400 flex-shrink-0" />
                  <a href={existingFileUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-violet-600 hover:underline flex-1 truncate">
                    <ExternalLink size={11} />파일 보기
                  </a>
                  <button type="button" onClick={() => setExistingFileUrl('')} className="text-slate-400 hover:text-red-500 flex-shrink-0"><X size={13} /></button>
                </div>
              )}
              {newFile && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-2">
                  <FileText size={13} className="flex-shrink-0" />
                  <span className="truncate flex-1">{newFile.name}</span>
                  <button type="button" onClick={() => setNewFile(null)} className="text-slate-400 hover:text-red-500 flex-shrink-0"><X size={13} /></button>
                </div>
              )}
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 w-full border border-dashed border-slate-300 rounded-lg px-3 py-2.5 text-xs text-slate-500 hover:border-violet-400 hover:text-violet-600 transition-colors">
                <Upload size={13} />파일 선택 (PDF, 이미지)
              </button>
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setNewFile(f) }} />
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
            <Save size={14} />{loading ? '저장 중...' : (client ? '수정 저장' : '추가')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ClientDetailModal({
  client,
  projects,
  onClose,
}: {
  client: Client
  projects: WmsProject[]
  onClose: () => void
}) {
  const navigate = useNavigate()
  const related = projects.filter((p) => p.organizer === client.name || p.exhibitor === client.name)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800">{client.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <dl className="space-y-2.5 text-sm">
            {([
              ['담당PM', client.manager], ['담당자', client.contact_name], ['전화번호', client.phone],
              ['담당자 이메일', client.email], ['계산서 이메일', client.invoice_email],
              ['주소', client.address], ['산업분류', client.industry],
            ] as const).map(([label, val]) => val && (
              <div key={label} className="flex gap-3">
                <dt className="text-xs font-medium text-slate-400 w-24 flex-shrink-0 pt-0.5">{label}</dt>
                <dd className="text-slate-800 flex-1 break-all">{val}</dd>
              </div>
            ))}
            {client.business_reg_url && (
              <div className="flex gap-3">
                <dt className="text-xs font-medium text-slate-400 w-24 flex-shrink-0 pt-0.5">사업자등록증</dt>
                <dd className="flex-1">
                  <a href={client.business_reg_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-violet-600 hover:underline text-sm">
                    <ExternalLink size={12} />파일 보기
                  </a>
                </dd>
              </div>
            )}
            {client.notes && (
              <div className="flex gap-3">
                <dt className="text-xs font-medium text-slate-400 w-24 flex-shrink-0 pt-0.5">비고</dt>
                <dd className="text-slate-600 flex-1 whitespace-pre-wrap">{client.notes}</dd>
              </div>
            )}
          </dl>

          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">관련 프로젝트 ({related.length})</p>
            {related.length === 0 ? (
              <p className="text-sm text-slate-400">참여한 프로젝트가 없습니다.</p>
            ) : (
              <div className="space-y-1.5">
                {related.map((p) => (
                  <button key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                      p.status === '취소'
                        ? 'border-slate-100 text-slate-400 line-through'
                        : 'border-slate-200 text-slate-700 hover:bg-violet-50 hover:border-violet-200'
                    }`}>
                    {p.exhibition || p.name}
                    {p.start_date && <span className="text-slate-400 font-normal"> · {p.start_date.replace(/-/g, '.')}</span>}
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

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<WmsProject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [detailClient, setDetailClient] = useState<Client | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: clientData }, { data: projectData }] = await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('wms_projects').select('*'),
    ])
    setClients(clientData || [])
    setProjects(projectData || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (c: Client) => {
    if (!confirm(`'${c.name}'을(를) 삭제하시겠습니까?`)) return
    await supabase.from('clients').delete().eq('id', c.id)
    fetchData()
  }

  const projectCount = (name: string) => projects.filter((p) => p.organizer === name || p.exhibitor === name).length

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) ||
      (c.contact_name || '').toLowerCase().includes(q) ||
      (c.industry || '').toLowerCase().includes(q)
  })

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">고객관리</h1>
          <p className="text-slate-500 text-sm mt-0.5">참가사 · 기획사 등 고객사 목록 관리</p>
        </div>
        <button onClick={() => { setEditingClient(null); setShowForm(true) }}
          className="flex items-center gap-2 px-3 py-2 md:px-4 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors shadow-sm">
          <Plus size={16} /><span className="hidden sm:inline">고객사 추가</span><span className="sm:hidden">추가</span>
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="고객사명, 담당자, 산업분류 검색..."
          className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
      </div>

      {/* 모바일 카드 */}
      <div className="md:hidden bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            {search ? '검색 결과가 없습니다.' : '등록된 고객사가 없습니다.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <div key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0" onClick={() => setDetailClient(c)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">{c.name}</span>
                      {c.industry && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">{c.industry}</span>
                      )}
                    </div>
                    {c.contact_name && <p className="text-xs text-slate-500 mt-1">{c.contact_name}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-sm text-slate-600 hover:text-violet-600">
                          <Phone size={12} className="text-slate-400" />{c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-600 truncate max-w-[180px]">
                          <Mail size={11} className="text-slate-400 flex-shrink-0" />{c.email}
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">관련 프로젝트 {projectCount(c.name)}건</p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={() => { setEditingClient(c); setShowForm(true) }}
                      className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => handleDelete(c)}
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
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">총 {filtered.length}개 고객사</div>
        )}
      </div>

      {/* 데스크탑 테이블 */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">고객사명</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">산업분류</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">담당PM</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">담당자</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">전화번호</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">이메일</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-600">관련 프로젝트</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                  {search ? '검색 결과가 없습니다.' : '등록된 고객사가 없습니다.'}
                </td></tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <button onClick={() => setDetailClient(c)} className="font-semibold text-slate-800 hover:text-violet-600 text-left">{c.name}</button>
                      {c.address && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{c.address}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      {c.industry ? (
                        <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">{c.industry}</span>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                      {c.manager || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                      {c.contact_name || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-slate-600 hover:text-violet-600 transition-colors whitespace-nowrap">
                          <Phone size={12} className="text-slate-400" />{c.phone}
                        </a>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-slate-600 hover:text-violet-600 transition-colors truncate max-w-[180px]">
                          <Mail size={12} className="text-slate-400 flex-shrink-0" />{c.email}
                        </a>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button onClick={() => setDetailClient(c)}
                        className="text-xs font-medium text-violet-600 hover:text-violet-700">
                        {projectCount(c.name)}건
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setEditingClient(c); setShowForm(true) }}
                          className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(c)}
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
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">총 {filtered.length}개 고객사</div>
        )}
      </div>

      {showForm && (
        <ClientFormModal client={editingClient} onClose={() => setShowForm(false)} onSuccess={fetchData} />
      )}
      {detailClient && (
        <ClientDetailModal client={detailClient} projects={projects} onClose={() => setDetailClient(null)} />
      )}
    </div>
  )
}
