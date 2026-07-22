import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday } from 'date-fns'
import { ko } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import type { WmsProject } from '../types'
import { STATUS_COLORS } from './Projects'

type ScheduleType = '전시' | '시공' | '철거'

interface ScheduleEvent {
  id: string
  project: WmsProject
  type: ScheduleType
  startDate: string
  endDate: string
}

const TYPE_STYLE: Record<ScheduleType, { bar: string; dot: string; label: string }> = {
  전시: { bar: 'bg-blue-500 text-white', dot: 'bg-blue-500', label: '전시일정' },
  시공: { bar: 'bg-amber-500 text-white', dot: 'bg-amber-500', label: '시공일정' },
  철거: { bar: 'bg-rose-500 text-white', dot: 'bg-rose-500', label: '철거일정' },
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function buildWeeks(month: Date): (Date | null)[][] {
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const startWd = startOfMonth(month).getDay()
  const weeks: (Date | null)[][] = []
  let week: (Date | null)[] = Array(startWd).fill(null)
  for (const d of days) {
    week.push(d)
    if (week.length === 7) { weeks.push([...week]); week = [] }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  return weeks
}

interface WeekBar extends ScheduleEvent {
  startCol: number
  endCol: number
  span: number
  lane: number
  continuesBefore: boolean
  continuesAfter: boolean
}

function getWeekEvents(week: (Date | null)[], events: ScheduleEvent[]): WeekBar[] {
  const validDays = week.filter(Boolean) as Date[]
  if (!validDays.length) return []
  const weekStart = validDays[0]
  const weekEnd = validDays[validDays.length - 1]

  const bars = events
    .filter((ev) => {
      const s = parseDate(ev.startDate)
      const e = parseDate(ev.endDate)
      return s <= weekEnd && e >= weekStart
    })
    .map((ev) => {
      const s = parseDate(ev.startDate)
      const e = parseDate(ev.endDate)
      const continuesBefore = s < weekStart
      const continuesAfter = e > weekEnd
      const clampedStart = continuesBefore ? weekStart : s
      const clampedEnd = continuesAfter ? weekEnd : e

      let startCol = week.findIndex((d) => d && isSameDay(d, clampedStart))
      if (startCol === -1) startCol = week.findIndex((d) => d !== null)
      let endCol = -1
      for (let i = 6; i >= 0; i--) {
        if (week[i] && isSameDay(week[i]!, clampedEnd)) { endCol = i; break }
      }
      if (endCol === -1) { endCol = 6; while (endCol > 0 && !week[endCol]) endCol-- }

      return { ...ev, startCol, endCol, continuesBefore, continuesAfter, lane: 0, span: 0 }
    })
    .sort((a, b) =>
      a.startCol !== b.startCol ? a.startCol - b.startCol : (b.endCol - b.startCol) - (a.endCol - a.startCol)
    )

  const laneEnds: number[] = []
  for (const bar of bars) {
    let lane = laneEnds.findIndex((end) => end < bar.startCol)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = bar.endCol
    bar.lane = lane
  }

  return bars.map((b) => ({ ...b, span: b.endCol - b.startCol + 1 }))
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const VISIBLE_LANES = 3

export default function Calendar() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<WmsProject[]>([])
  const [loading, setLoading] = useState(true)
  const [calMonth, setCalMonth] = useState(new Date())
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('wms_projects').select('*').neq('status', '취소')
      setProjects(data || [])
      setLoading(false)
    })()
  }, [])

  const events = useMemo<ScheduleEvent[]>(() => {
    const list: ScheduleEvent[] = []
    projects.forEach((p) => {
      if (p.start_date) {
        list.push({ id: `${p.id}-전시`, project: p, type: '전시', startDate: p.start_date, endDate: p.end_date || p.start_date })
      }
      if (p.construction_date) {
        list.push({ id: `${p.id}-시공`, project: p, type: '시공', startDate: p.construction_date, endDate: p.construction_date })
      }
      if (p.demolition_date) {
        list.push({ id: `${p.id}-철거`, project: p, type: '철거', startDate: p.demolition_date, endDate: p.demolition_date })
      }
    })
    return list
  }, [projects])

  const weeks = useMemo(() => buildWeeks(calMonth), [calMonth])

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null
  const selectedEvents = selectedProject ? events.filter((e) => e.project.id === selectedProjectId) : []

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">캘린더</h1>
          <p className="text-slate-500 text-sm mt-0.5">프로젝트별 전시일정 · 시공일정 · 철거일정을 한눈에 확인</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-violet-600" />
            <h2 className="font-semibold text-slate-800 text-sm">일정 캘린더</h2>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-1 py-1">
            <button onClick={() => setCalMonth((m) => subMonths(m, 1))} className="p-1.5 rounded hover:bg-white text-slate-500 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-700 w-28 text-center">
              {format(calMonth, 'yyyy년 M월', { locale: ko })}
            </span>
            <button onClick={() => setCalMonth((m) => addMonths(m, 1))} className="p-1.5 rounded hover:bg-white text-slate-500 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            {(Object.keys(TYPE_STYLE) as ScheduleType[]).map((t) => (
              <span key={t} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full inline-block ${TYPE_STYLE[t].dot}`} />
                {TYPE_STYLE[t].label}
              </span>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : (
          <div className="p-3">
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map((d, i) => (
                <div key={d} className={`text-center text-xs font-semibold py-1 ${
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-400'
                }`}>
                  {d}
                </div>
              ))}
            </div>

            <div className="space-y-0.5">
              {weeks.map((week, wi) => {
                const weekEvents = getWeekEvents(week, events)
                const maxLane = weekEvents.length ? Math.max(...weekEvents.map((e) => e.lane)) : -1
                const visibleEvents = weekEvents.filter((e) => e.lane < VISIBLE_LANES)
                const overflow = weekEvents.filter((e) => e.lane >= VISIBLE_LANES).length
                const rowH = Math.min(maxLane + 1, VISIBLE_LANES)

                return (
                  <div key={wi} className="border-b border-slate-50 last:border-0 pb-0.5">
                    <div className="grid grid-cols-7">
                      {week.map((day, di) => {
                        const cur = day && isSameMonth(day, calMonth)
                        const tod = day && isToday(day)
                        return (
                          <div key={di} className="flex justify-center py-0.5">
                            {day && (
                              <span className={`w-6 h-6 flex items-center justify-center text-xs rounded-full font-medium ${
                                tod ? 'bg-violet-600 text-white' : cur ? 'text-slate-700' : 'text-slate-300'
                              }`}>
                                {format(day, 'd')}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {weekEvents.length > 0 && (
                      <div className="grid grid-cols-7 px-0.5" style={{ gridAutoRows: '20px', rowGap: '4px', minHeight: rowH * 24 }}>
                        {visibleEvents.map((ev) => {
                          const lbl = [ev.project.exhibition, ev.project.name].filter(Boolean).join(' · ') || ev.project.name
                          return (
                            <button
                              key={ev.id}
                              onClick={() => setSelectedProjectId((prev) => (prev === ev.project.id ? null : ev.project.id))}
                              title={`[${TYPE_STYLE[ev.type].label}] ${lbl}\n${ev.startDate}${ev.endDate !== ev.startDate ? ` ~ ${ev.endDate}` : ''}`}
                              style={{
                                gridColumnStart: ev.startCol + 1,
                                gridColumnEnd: `span ${ev.span}`,
                                gridRow: ev.lane + 1,
                                minHeight: '22px',
                              }}
                              className={`text-[10px] leading-none px-1.5 flex items-center truncate hover:opacity-80 active:opacity-60 transition-opacity cursor-pointer ${TYPE_STYLE[ev.type].bar}
                                ${ev.continuesBefore ? 'rounded-r-full' : 'rounded-l-full'}
                                ${ev.continuesAfter ? '' : 'rounded-r-full'}
                              `}
                            >
                              {!ev.continuesBefore && <span className="truncate">{lbl}</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {overflow > 0 && (
                      <p className="text-[10px] text-slate-400 px-2 pb-0.5">+{overflow}건 더보기</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 선택한 프로젝트 세부내역 펼침 */}
      {selectedProject && (
        <div className="bg-white rounded-xl border border-violet-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <CalendarDays size={16} className="text-violet-600 flex-shrink-0" />
              <h2 className="font-semibold text-slate-800 text-sm truncate">{selectedProject.name}</h2>
              <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full border ${STATUS_COLORS[selectedProject.status] || 'bg-slate-100 text-slate-600'}`}>
                {selectedProject.status}
              </span>
            </div>
            <button onClick={() => setSelectedProjectId(null)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
              <X size={15} />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div><span className="text-slate-400 block mb-0.5">전시회</span><span className="text-slate-700 font-medium">{selectedProject.exhibition || '-'}</span></div>
              <div><span className="text-slate-400 block mb-0.5">기획사</span><span className="text-slate-700 font-medium">{selectedProject.organizer || '-'}</span></div>
              <div><span className="text-slate-400 block mb-0.5">참가사</span><span className="text-slate-700 font-medium">{selectedProject.exhibitor || '-'}</span></div>
              <div><span className="text-slate-400 block mb-0.5">담당</span><span className="text-slate-700 font-medium">{selectedProject.manager || '-'}</span></div>
            </div>

            <div className="space-y-1.5">
              {selectedEvents.map((ev) => (
                <div key={ev.id} className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_STYLE[ev.type].dot}`} />
                  <span className="text-slate-500 w-16 flex-shrink-0">{TYPE_STYLE[ev.type].label}</span>
                  <span className="text-slate-700 font-medium">
                    {ev.startDate.replace(/-/g, '.')}
                    {ev.endDate !== ev.startDate && ` ~ ${ev.endDate.replace(/-/g, '.')}`}
                  </span>
                </div>
              ))}
              {selectedEvents.length === 0 && <p className="text-xs text-slate-400">등록된 일정이 없습니다.</p>}
            </div>

            <button
              onClick={() => navigate(`/projects/${selectedProject.id}`)}
              className="text-xs font-medium text-violet-600 hover:text-violet-700"
            >
              프로젝트 상세보기 →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
