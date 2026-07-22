import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, FolderKanban } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { WmsProject } from '../types'
import { STATUS_COLORS } from './Projects'
import ScheduleCalendar from '../components/dashboard/ScheduleCalendar'

export default function Dashboard() {
  const navigate = useNavigate()
  const [activeProjects, setActiveProjects] = useState<WmsProject[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('wms_projects')
        .select('*')
        .in('status', ['제안중', '계약완료', '시공진행', '완료'])
        .order('start_date', { ascending: true })
      setActiveProjects(data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-800">대시보드</h1>
        <p className="text-slate-500 text-sm mt-0.5">ASO System 프로젝트 관리 현황</p>
      </div>

      {/* ─── 진행중인 프로젝트 ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban size={16} className="text-violet-500" />
            <h2 className="text-base font-semibold text-slate-800">진행중인 프로젝트</h2>
            {activeProjects.length > 0 && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{activeProjects.length}건</span>
            )}
          </div>
          <button onClick={() => navigate('/projects')} className="text-xs text-violet-600 hover:text-violet-700 font-medium">전체보기</button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : activeProjects.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">진행중인 프로젝트가 없습니다.</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {activeProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-violet-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`flex-shrink-0 px-2.5 py-0.5 text-xs font-medium rounded-full border ${STATUS_COLORS[project.status] || 'bg-slate-100 text-slate-600'}`}>
                    {project.status}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{project.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {[project.exhibition, project.organizer, project.manager].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                  {project.start_date && (
                    <span className="text-xs text-slate-400">{project.start_date.replace(/-/g, '.')}</span>
                  )}
                  <ChevronRight size={14} className="text-slate-300" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── 일정 캘린더 ─── */}
      <ScheduleCalendar projects={activeProjects} loading={loading} />
    </div>
  )
}
