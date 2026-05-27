import { useState, useEffect, useRef } from 'react'
import { format, addDays, subDays, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO } from 'date-fns'
import { ko as koLocale } from 'date-fns/locale'
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Save,
  ClipboardList, CheckCircle, PenLine, X, Users, UserCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const MEMBERS = ['김태환', '고연호', '김종혜']
const STORAGE_KEY = 'aso_report_user'

type Tab = 'daily' | 'weekly'

interface MeetingRow {
  localId: number
  id?: string
  meeting_time: string
  meeting_company: string
  meeting_content: string
}

interface ListEntry {
  id: string
  type: Tab
  dateKey: string
  title: string
  preview: string
  meetingCount: number
  updatedAt: string
  openDate: Date
}

function fmtTitle(type: Tab, dateKey: string): string {
  try {
    if (type === 'daily') {
      return format(parseISO(dateKey), 'yyyy년 M월 d일 (EEE)', { locale: koLocale })
    } else {
      const start = parseISO(dateKey)
      const end = endOfWeek(start, { weekStartsOn: 1 })
      return `${format(start, 'yyyy년 M월 d일')} ~ ${format(end, 'M월 d일')} 주간`
    }
  } catch { return dateKey }
}

// ─── 이름 선택 모달 ───────────────────────────────────────────────
function NameSelectModal({ onSelect }: { onSelect: (name: string) => void }) {
  const [custom, setCustom] = useState('')
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UserCircle size={20} className="text-violet-500" />
          <h3 className="font-bold text-slate-800">이름 선택</h3>
        </div>
        <div className="space-y-2">
          {MEMBERS.map((name) => (
            <button key={name} onClick={() => onSelect(name)}
              className="w-full px-4 py-2.5 text-sm font-medium text-left rounded-lg border border-slate-200 hover:border-violet-400 hover:bg-violet-50 transition-colors">
              {name}
            </button>
          ))}
        </div>
        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-400 mb-2">직접 입력</p>
          <div className="flex gap-2">
            <input value={custom} onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && custom.trim() && onSelect(custom.trim())}
              placeholder="이름 입력" maxLength={20}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <button onClick={() => custom.trim() && onSelect(custom.trim())}
              className="px-3 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700">확인</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────
export default function WorkReport() {
  const [userName, setUserName] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || '')
  const [showNameSelect, setShowNameSelect] = useState(!localStorage.getItem(STORAGE_KEY))
  const [entries, setEntries] = useState<ListEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ tab: Tab; date: Date } | null>(null)
  const [viewingUser, setViewingUser] = useState('')
  const [viewMode, setViewMode] = useState<'mine' | 'team'>('mine')

  useEffect(() => {
    if (userName) setViewingUser(userName)
  }, [userName])

  useEffect(() => {
    if (viewingUser) loadList(viewingUser)
  }, [viewingUser])

  function handleSelectName(name: string) {
    localStorage.setItem(STORAGE_KEY, name)
    setUserName(name)
    setViewingUser(name)
    setShowNameSelect(false)
  }

  async function loadList(uname: string) {
    setLoading(true)
    const [{ data: daily }, { data: weekly }] = await Promise.all([
      supabase.from('daily_reports').select('id,report_date,work_content,updated_at')
        .eq('user_name', uname).order('report_date', { ascending: false }),
      supabase.from('weekly_reports').select('id,week_start,week_end,this_week,updated_at')
        .eq('user_name', uname).order('week_start', { ascending: false }),
    ])
    const dailyList = (daily ?? []) as any[]
    const weeklyList = (weekly ?? []) as any[]

    let meetingCounts: Record<string, number> = {}
    if (dailyList.length > 0) {
      const { data: mtgs } = await supabase.from('daily_report_meetings').select('report_id')
        .in('report_id', dailyList.map((r) => r.id))
      ;(mtgs ?? []).forEach((m: any) => {
        meetingCounts[m.report_id] = (meetingCounts[m.report_id] ?? 0) + 1
      })
    }

    const all: ListEntry[] = [
      ...dailyList.map((r: any) => ({
        id: r.id, type: 'daily' as Tab, dateKey: r.report_date,
        title: fmtTitle('daily', r.report_date),
        preview: r.work_content?.trim().slice(0, 120) || '',
        meetingCount: meetingCounts[r.id] ?? 0,
        updatedAt: r.updated_at,
        openDate: parseISO(r.report_date),
      })),
      ...weeklyList.map((r: any) => ({
        id: r.id, type: 'weekly' as Tab, dateKey: r.week_start,
        title: fmtTitle('weekly', r.week_start),
        preview: r.this_week?.trim().slice(0, 120) || '',
        meetingCount: 0,
        updatedAt: r.updated_at,
        openDate: parseISO(r.week_start),
      })),
    ].sort((a, b) => b.dateKey.localeCompare(a.dateKey))

    setEntries(all)
    setLoading(false)
  }

  async function deleteEntry(entry: ListEntry, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('이 보고서를 삭제하시겠습니까?')) return
    if (entry.type === 'daily') {
      await supabase.from('daily_report_meetings').delete().eq('report_id', entry.id)
      await supabase.from('daily_reports').delete().eq('id', entry.id)
    } else {
      await supabase.from('weekly_reports').delete().eq('id', entry.id)
    }
    setEntries((prev) => prev.filter((x) => x.id !== entry.id))
  }

  const isOwnView = viewingUser === userName

  return (
    <div className="flex flex-col h-full">
      {showNameSelect && <NameSelectModal onSelect={handleSelectName} />}

      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
            <ClipboardList size={20} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">업무보고서</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isOwnView ? userName : `${viewingUser} · 열람 중`}
            </p>
          </div>
        </div>

        {/* 직원 선택 */}
        {viewMode !== 'team' && (
          <div className="flex items-center gap-2">
            <select value={viewingUser} onChange={(e) => setViewingUser(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
              {MEMBERS.map((m) => (
                <option key={m} value={m}>{m}{m === userName ? ' (나)' : ''}</option>
              ))}
            </select>
            <button onClick={() => setShowNameSelect(true)}
              className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
              <UserCircle size={16} />
            </button>
          </div>
        )}

        {/* 팀 한눈에 보기 */}
        <button onClick={() => { setViewMode((m) => m === 'team' ? 'mine' : 'team'); setModal(null) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
            viewMode === 'team'
              ? 'bg-violet-600 text-white border-violet-600'
              : 'bg-white text-slate-600 border-slate-300 hover:border-violet-400 hover:text-violet-600'
          }`}>
          <Users size={14} />
          {viewMode === 'team' ? '내 보고서' : '팀 한눈에 보기'}
        </button>

        {isOwnView && viewMode !== 'team' && (
          <button onClick={() => setModal({ tab: 'daily', date: new Date() })}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors">
            <PenLine size={15} />업무보고서 작성
          </button>
        )}
      </div>

      {/* Body */}
      {viewMode === 'team' ? (
        <TeamOverview members={MEMBERS} currentUser={userName} />
      ) : (
        <div className="flex-1 overflow-auto px-6 py-5">
          {loading ? (
            <div className="text-center py-20 text-slate-400 text-sm">불러오는 중...</div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-28">
              <ClipboardList size={44} className="text-slate-200 mb-3" />
              <p className="text-slate-400 text-sm mb-4">작성된 보고서가 없습니다.</p>
              {isOwnView && (
                <button onClick={() => setModal({ tab: 'daily', date: new Date() })}
                  className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700">
                  첫 보고서 작성하기
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-w-4xl mx-auto">
              {entries.map((entry, i) => (
                <div key={entry.id}
                  onClick={() => setModal({ tab: entry.type, date: entry.openDate })}
                  className={`flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-violet-50 transition-colors group ${
                    i < entries.length - 1 ? 'border-b border-slate-100' : ''
                  }`}>
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold mt-0.5 ${
                    entry.type === 'daily' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {entry.type === 'daily' ? '일일' : '주간'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800 group-hover:text-violet-700">{entry.title}</span>
                      {entry.meetingCount > 0 && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                          미팅 {entry.meetingCount}
                        </span>
                      )}
                    </div>
                    {entry.preview
                      ? <p className="text-xs text-slate-400 truncate">{entry.preview}</p>
                      : <p className="text-xs text-slate-300 italic">내용 없음</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-400">{format(new Date(entry.updatedAt), 'M/d HH:mm')}</span>
                    {isOwnView && (
                      <button onClick={(e) => deleteEntry(entry, e)}
                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modal && (
        <ReportWriteModal
          initialTab={modal.tab}
          initialDate={modal.date}
          targetUser={viewingUser}
          readOnly={!isOwnView}
          onClose={() => setModal(null)}
          onSaved={() => loadList(viewingUser)}
        />
      )}
    </div>
  )
}

// ─── 작성/편집 모달 ───────────────────────────────────────────────
function ReportWriteModal({ initialTab, initialDate, targetUser, readOnly, onClose, onSaved }: {
  initialTab: Tab; initialDate: Date; targetUser: string; readOnly: boolean
  onClose: () => void; onSaved: () => void
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [date, setDate] = useState(initialDate)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const [dailyId, setDailyId] = useState<string | null>(null)
  const [workContent, setWorkContent] = useState('')
  const [tomorrowPlan, setTomorrowPlan] = useState('')
  const [dailyNotes, setDailyNotes] = useState('')
  const [meetings, setMeetings] = useState<MeetingRow[]>([])
  const meetingCount = useRef(0)

  const [weeklyId, setWeeklyId] = useState<string | null>(null)
  const [thisWeek, setThisWeek] = useState('')
  const [nextWeekPlan, setNextWeekPlan] = useState('')
  const [weeklyNotes, setWeeklyNotes] = useState('')

  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 })
  const dateStr = format(date, 'yyyy-MM-dd')
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

  useEffect(() => { tab === 'daily' ? loadDaily() : loadWeekly() }, [dateStr, weekStartStr, tab, targetUser])

  const saveRef = useRef<() => void>(() => {})
  useEffect(() => { saveRef.current = tab === 'daily' ? saveDaily : saveWeekly })
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (!readOnly && (e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveRef.current() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [readOnly])

  async function loadDaily() {
    setLoading(true); setSavedAt(null)
    const { data } = await supabase.from('daily_reports').select('*')
      .eq('user_name', targetUser).eq('report_date', dateStr).maybeSingle()
    if (data) {
      setDailyId(data.id); setWorkContent(data.work_content ?? '')
      setTomorrowPlan(data.tomorrow_plan ?? ''); setDailyNotes(data.notes ?? '')
      setSavedAt(data.updated_at)
      const { data: mtgs } = await supabase.from('daily_report_meetings').select('*')
        .eq('report_id', data.id).order('sort_order')
      meetingCount.current = 0
      setMeetings((mtgs ?? []).map((m: any) => ({
        localId: meetingCount.current++, id: m.id,
        meeting_time: m.meeting_time ?? '', meeting_company: m.meeting_company ?? '',
        meeting_content: m.meeting_content ?? '',
      })))
    } else {
      setDailyId(null); setWorkContent(''); setTomorrowPlan(''); setDailyNotes('')
      setMeetings([]); meetingCount.current = 0
    }
    setLoading(false)
  }

  async function loadWeekly() {
    setLoading(true); setSavedAt(null)
    const { data } = await supabase.from('weekly_reports').select('*')
      .eq('user_name', targetUser).eq('week_start', weekStartStr).maybeSingle()
    if (data) {
      setWeeklyId(data.id); setThisWeek(data.this_week ?? '')
      setNextWeekPlan(data.next_week_plan ?? ''); setWeeklyNotes(data.notes ?? '')
      setSavedAt(data.updated_at)
    } else {
      setWeeklyId(null); setThisWeek(''); setNextWeekPlan(''); setWeeklyNotes('')
    }
    setLoading(false)
  }

  async function saveDaily() {
    if (saving || readOnly) return
    setSaving(true)
    const now = new Date().toISOString()
    const payload = {
      user_name: targetUser, report_date: dateStr,
      work_content: workContent, tomorrow_plan: tomorrowPlan, notes: dailyNotes, updated_at: now,
    }
    let id = dailyId
    if (id) {
      await supabase.from('daily_reports').update(payload).eq('id', id)
    } else {
      const { data } = await supabase.from('daily_reports').insert(payload).select().single()
      id = data?.id ?? null; setDailyId(id)
    }
    if (id) {
      await supabase.from('daily_report_meetings').delete().eq('report_id', id)
      const valid = meetings.filter((m) => m.meeting_company.trim())
      if (valid.length > 0) {
        await supabase.from('daily_report_meetings').insert(
          valid.map((m, i) => ({
            report_id: id, sort_order: i, meeting_time: m.meeting_time,
            meeting_company: m.meeting_company, meeting_content: m.meeting_content,
          }))
        )
      }
    }
    setSavedAt(now); setSaving(false); onSaved()
  }

  async function saveWeekly() {
    if (saving || readOnly) return
    setSaving(true)
    const now = new Date().toISOString()
    const payload = {
      user_name: targetUser, week_start: weekStartStr, week_end: weekEndStr,
      this_week: thisWeek, next_week_plan: nextWeekPlan, notes: weeklyNotes, updated_at: now,
    }
    if (weeklyId) {
      await supabase.from('weekly_reports').update(payload).eq('id', weeklyId)
    } else {
      const { data } = await supabase.from('weekly_reports').insert(payload).select().single()
      setWeeklyId(data?.id ?? null)
    }
    setSavedAt(now); setSaving(false); onSaved()
  }

  function addMeeting() { setMeetings((m) => [...m, { localId: meetingCount.current++, meeting_time: '', meeting_company: '', meeting_content: '' }]) }
  function removeMeeting(id: number) { setMeetings((m) => m.filter((x) => x.localId !== id)) }
  function updateMeeting(id: number, field: keyof Omit<MeetingRow, 'localId' | 'id'>, val: string) {
    setMeetings((m) => m.map((x) => x.localId === id ? { ...x, [field]: val } : x))
  }

  const dateLabel = tab === 'daily'
    ? format(date, 'yyyy년 M월 d일 (EEE)', { locale: koLocale })
    : `${format(weekStart, 'yyyy년 M월 d일')} ~ ${format(weekEnd, 'M월 d일')}`

  const ta = (extra = '') =>
    `w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y ${readOnly ? 'bg-slate-50 text-slate-600 cursor-default' : ''} ${extra}`

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Modal header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3 shrink-0 flex-wrap">
          {readOnly && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1.5 shrink-0">
              {targetUser} · 열람 중
            </span>
          )}

          {/* 탭 */}
          <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
            {(['daily', 'weekly'] as Tab[]).map((tabKey) => (
              <button key={tabKey} onClick={() => setTab(tabKey)}
                className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  tab === tabKey ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {tabKey === 'daily' ? '일일보고서' : '주간보고서'}
              </button>
            ))}
          </div>

          {/* 날짜 이동 */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1 py-0.5">
            <button onClick={() => setDate((d) => tab === 'daily' ? subDays(d, 1) : subWeeks(d, 1))}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-semibold text-slate-700 px-2 min-w-[200px] text-center">{dateLabel}</span>
            <button onClick={() => setDate((d) => tab === 'daily' ? addDays(d, 1) : addWeeks(d, 1))}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
          <button onClick={() => setDate(new Date())} className="text-xs font-medium text-violet-600 hover:underline px-1">오늘</button>

          <div className="ml-auto flex items-center gap-3">
            {savedAt && !readOnly && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle size={13} />{format(new Date(savedAt), 'HH:mm')} 저장됨
              </span>
            )}
            {!readOnly && (
              <button onClick={tab === 'daily' ? saveDaily : saveWeekly} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-60 transition-colors">
                <Save size={14} />{saving ? '저장 중...' : '저장'}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">불러오는 중...</div>
        ) : (
          <div className="flex-1 overflow-auto px-6 py-5">
            <div className="space-y-4">
              {tab === 'daily' ? (
                <>
                  <ReportCard title="업무 내용" required={!readOnly}>
                    <textarea value={workContent} onChange={(e) => !readOnly && setWorkContent(e.target.value)}
                      readOnly={readOnly} placeholder={readOnly ? '(내용 없음)' : '오늘 진행한 업무 내용을 작성하세요'} rows={5} className={ta()} />
                  </ReportCard>

                  <ReportCard title="미팅 일정"
                    action={!readOnly ? (
                      <button onClick={addMeeting}
                        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-violet-400 text-violet-600 hover:bg-violet-50 transition-colors">
                        <Plus size={12} /> 미팅 추가
                      </button>
                    ) : undefined}>
                    {meetings.length === 0 ? (
                      readOnly ? (
                        <p className="text-sm text-slate-400 py-4 text-center">미팅 일정 없음</p>
                      ) : (
                        <button onClick={addMeeting}
                          className="w-full flex flex-col items-center justify-center py-7 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg hover:border-violet-400 hover:text-violet-500 transition-colors">
                          <Plus size={18} className="mb-1" />미팅 일정이 없습니다. 클릭하여 추가
                        </button>
                      )
                    ) : (
                      <div className="space-y-3">
                        {meetings.map((m) => (
                          <div key={m.localId} className={`rounded-lg border ${readOnly ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white'} p-3 space-y-2`}>
                            <div className="flex items-center gap-2">
                              <input type="time" value={m.meeting_time} readOnly={readOnly}
                                onChange={(e) => updateMeeting(m.localId, 'meeting_time', e.target.value)}
                                className={`border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 w-28 ${readOnly ? 'bg-slate-50' : ''}`} />
                              <input value={m.meeting_company} readOnly={readOnly}
                                onChange={(e) => updateMeeting(m.localId, 'meeting_company', e.target.value)}
                                placeholder="업체명"
                                className={`flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${readOnly ? 'bg-slate-50' : ''}`} />
                              {!readOnly && (
                                <button onClick={() => removeMeeting(m.localId)} className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                            <textarea value={m.meeting_content} readOnly={readOnly}
                              onChange={(e) => updateMeeting(m.localId, 'meeting_content', e.target.value)}
                              placeholder="미팅 내용" rows={3}
                              className={`w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y ${readOnly ? 'bg-slate-50 text-slate-600' : ''}`} />
                          </div>
                        ))}
                      </div>
                    )}
                  </ReportCard>

                  <ReportCard title="내일 계획">
                    <textarea value={tomorrowPlan} onChange={(e) => !readOnly && setTomorrowPlan(e.target.value)}
                      readOnly={readOnly} placeholder={readOnly ? '(내용 없음)' : '내일 예정된 업무를 작성하세요'} rows={3} className={ta()} />
                  </ReportCard>

                  <ReportCard title="특이사항">
                    <textarea value={dailyNotes} onChange={(e) => !readOnly && setDailyNotes(e.target.value)}
                      readOnly={readOnly} placeholder={readOnly ? '(내용 없음)' : '특이사항이 있으면 작성하세요'} rows={2} className={ta()} />
                  </ReportCard>
                </>
              ) : (
                <>
                  <ReportCard title="이번주 업무 내용" required={!readOnly}>
                    <textarea value={thisWeek} onChange={(e) => !readOnly && setThisWeek(e.target.value)}
                      readOnly={readOnly} placeholder={readOnly ? '(내용 없음)' : '이번 주 진행한 업무를 작성하세요'} rows={7} className={ta()} />
                  </ReportCard>

                  <ReportCard title="다음주 계획">
                    <textarea value={nextWeekPlan} onChange={(e) => !readOnly && setNextWeekPlan(e.target.value)}
                      readOnly={readOnly} placeholder={readOnly ? '(내용 없음)' : '다음 주 예정된 업무를 작성하세요'} rows={4} className={ta()} />
                  </ReportCard>

                  <ReportCard title="특이사항">
                    <textarea value={weeklyNotes} onChange={(e) => !readOnly && setWeeklyNotes(e.target.value)}
                      readOnly={readOnly} placeholder={readOnly ? '(내용 없음)' : '특이사항이 있으면 작성하세요'} rows={2} className={ta()} />
                  </ReportCard>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 팀 한눈에 보기 ───────────────────────────────────────────────
function TeamOverview({ members, currentUser }: { members: string[]; currentUser: string }) {
  const [tab, setTab] = useState<Tab>('daily')
  const [date, setDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [dailyMap, setDailyMap] = useState<Record<string, any>>({})
  const [meetingsMap, setMeetingsMap] = useState<Record<string, any[]>>({})
  const [weeklyMap, setWeeklyMap] = useState<Record<string, any>>({})

  const dateStr = format(date, 'yyyy-MM-dd')
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 })
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')

  useEffect(() => { load() }, [tab, dateStr, weekStartStr])

  async function load() {
    setLoading(true)
    if (tab === 'daily') {
      const { data } = await supabase.from('daily_reports').select('*')
        .in('user_name', members).eq('report_date', dateStr)
      const dm: Record<string, any> = {}
      ;(data ?? []).forEach((r: any) => { dm[r.user_name] = r })
      setDailyMap(dm)
      const ids = (data ?? []).map((r: any) => r.id)
      if (ids.length > 0) {
        const { data: mtgs } = await supabase.from('daily_report_meetings').select('*')
          .in('report_id', ids).order('sort_order')
        const mm: Record<string, any[]> = {}
        ;(mtgs ?? []).forEach((m: any) => {
          if (!mm[m.report_id]) mm[m.report_id] = []
          mm[m.report_id].push(m)
        })
        setMeetingsMap(mm)
      } else { setMeetingsMap({}) }
    } else {
      const { data } = await supabase.from('weekly_reports').select('*')
        .in('user_name', members).eq('week_start', weekStartStr)
      const wm: Record<string, any> = {}
      ;(data ?? []).forEach((r: any) => { wm[r.user_name] = r })
      setWeeklyMap(wm)
    }
    setLoading(false)
  }

  const dateLabel = tab === 'daily'
    ? format(date, 'yyyy년 M월 d일 (EEE)', { locale: koLocale })
    : `${format(weekStart, 'yyyy년 M월 d일')} ~ ${format(weekEnd, 'M월 d일')}`

  const submitted = members.filter((n) => tab === 'daily' ? !!dailyMap[n] : !!weeklyMap[n])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3 flex-wrap shrink-0">
        <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
          {(['daily', 'weekly'] as Tab[]).map((tabKey) => (
            <button key={tabKey} onClick={() => setTab(tabKey)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === tabKey ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {tabKey === 'daily' ? '일일' : '주간'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1 py-0.5">
          <button onClick={() => setDate((d) => tab === 'daily' ? subDays(d, 1) : subWeeks(d, 1))}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors">
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm font-semibold text-slate-700 px-2 min-w-[200px] text-center">{dateLabel}</span>
          <button onClick={() => setDate((d) => tab === 'daily' ? addDays(d, 1) : addWeeks(d, 1))}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
        <button onClick={() => setDate(new Date())} className="text-xs font-medium text-violet-600 hover:underline px-1">오늘</button>
        <span className="ml-auto text-xs text-slate-400">제출 {submitted.length} / {members.length}명</span>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5">
        {loading ? (
          <div className="text-center py-20 text-slate-400 text-sm">불러오는 중...</div>
        ) : submitted.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-sm">제출된 보고서가 없습니다.</div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            {members.filter((n) => tab === 'daily' ? !!dailyMap[n] : !!weeklyMap[n]).map((name) => {
              const daily = dailyMap[name]
              const weekly = weeklyMap[name]
              const mtgs = daily ? (meetingsMap[daily.id] ?? []) : []
              return (
                <div key={name} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50">
                    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-violet-700">{name.charAt(0)}</span>
                    </div>
                    <span className="font-semibold text-slate-900 text-sm">{name}</span>
                    {name === currentUser && <span className="text-xs text-violet-500">(나)</span>}
                    <span className="ml-auto text-xs text-slate-400">
                      {tab === 'daily' && daily?.updated_at && format(new Date(daily.updated_at), 'HH:mm') + ' 제출'}
                      {tab === 'weekly' && weekly?.updated_at && format(new Date(weekly.updated_at), 'M/d HH:mm') + ' 제출'}
                    </span>
                  </div>
                  <div className="px-5 py-4 space-y-4 divide-y divide-slate-50">
                    {tab === 'daily' && daily ? (
                      <>
                        {daily.work_content && (
                          <div className="pb-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">업무 내용</p>
                            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{daily.work_content}</p>
                          </div>
                        )}
                        {mtgs.length > 0 && (
                          <div className="pt-3 pb-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">미팅 일정</p>
                            <div className="space-y-2">
                              {mtgs.map((m: any, i: number) => (
                                <div key={i} className="text-sm bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                                  <div className="flex items-center gap-2">
                                    {m.meeting_time && <span className="text-xs text-slate-400 shrink-0">{m.meeting_time}</span>}
                                    <span className="font-medium text-slate-800">{m.meeting_company}</span>
                                  </div>
                                  {m.meeting_content && <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{m.meeting_content}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {daily.tomorrow_plan && (
                          <div className="pt-3 pb-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">내일 계획</p>
                            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{daily.tomorrow_plan}</p>
                          </div>
                        )}
                        {daily.notes && (
                          <div className="pt-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">특이사항</p>
                            <p className="text-sm text-slate-600 whitespace-pre-wrap">{daily.notes}</p>
                          </div>
                        )}
                      </>
                    ) : tab === 'weekly' && weekly ? (
                      <>
                        {weekly.this_week && (
                          <div className="pb-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">이번주 업무 내용</p>
                            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{weekly.this_week}</p>
                          </div>
                        )}
                        {weekly.next_week_plan && (
                          <div className="pt-3 pb-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">다음주 계획</p>
                            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{weekly.next_week_plan}</p>
                          </div>
                        )}
                        {weekly.notes && (
                          <div className="pt-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">특이사항</p>
                            <p className="text-sm text-slate-600 whitespace-pre-wrap">{weekly.notes}</p>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function ReportCard({ title, required, action, children }: {
  title: string; required?: boolean; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-700">
          {title}
          {required && <span className="text-red-400 ml-1.5 font-normal text-xs">필수</span>}
        </h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}
