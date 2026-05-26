import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { WmsProject, ProjectStatus } from '../types'
import AddProjectModal from '../components/AddProjectModal'

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  제안중:   'bg-sky-100 text-sky-700 border border-sky-200',
  계약완료: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  시공진행: 'bg-green-100 text-green-700 border border-green-200',
  완료:     'bg-blue-100 text-blue-700 border border-blue-200',
  취소:     'bg-slate-100 text-slate-600 border border-slate-200',
}

const STATUS_FILTER_ORDER: (ProjectStatus | 'all')[] = ['all', '제안중', '계약완료', '시공진행', '완료', '취소']

function formatDatetime(date?: string, time?: string) {
  if (!date) return '-'
  const parts = date.split('-')
  if (parts.length < 3) return date
  const d = `${parts[0]}.${parts[1]}.${parts[2]}`
  return time ? `${d} ${time.slice(0, 5)}` : d
}

interface ProjectStats {
  project_id: string
  total_out: number
  total_return: number
  total_loss: number
}

export default function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<WmsProject[]>([])
  const [projectStats, setProjectStats] = useState<Record<string, ProjectStats>>({})
  const [loading, setLoading] = useState(true)
  const [showAddProject, setShowAddProject] = useState(false)
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const { data: projectsData } = await supabase
        .from('wms_projects')
        .select('*')
        .order('created_at', { ascending: false })

      const { data: txData } = await supabase
        .from('inventory_transactions')
        .select('project_id, transaction_type, quantity')
        .not('project_id', 'is', null)

      const statsMap: Record<string, ProjectStats> = {}
      ;(txData || []).forEach((tx) => {
        if (!tx.project_id) return
        if (!statsMap[tx.project_id])
          statsMap[tx.project_id] = { project_id: tx.project_id, total_out: 0, total_return: 0, total_loss: 0 }
        if (tx.transaction_type === '출고') statsMap[tx.project_id].total_out += tx.quantity
        if (tx.transaction_type === '반입') statsMap[tx.project_id].total_return += tx.quantity
        if (tx.transaction_type === '손실') statsMap[tx.project_id].total_loss += tx.quantity
      })

      setProjects(projectsData || [])
      setProjectStats(statsMap)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const filtered = projects.filter((p) => statusFilter === 'all' || p.status === statusFilter)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">프로젝트</h1>
          <p className="text-slate-500 text-sm mt-1">프로젝트별 출고/반입 현황 관리</p>
        </div>
        <button
          onClick={() => setShowAddProject(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          프로젝트 추가
        </button>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTER_ORDER.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === status
                ? 'bg-violet-600 text-white'
                : 'bg-white text-slate-600 border border-slate-300 hover:border-slate-400'
            }`}
          >
            {status === 'all' ? '전체' : status}
            {status !== 'all' && (
              <span className="ml-1.5 text-xs opacity-70">({projects.filter((p) => p.status === status).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Projects Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">프로젝트명</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">전시회</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">기획사</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">참가사</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">담당</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600">전시일정</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-600">진행현황</th>
                <th className="text-center px-4 py-3.5 font-semibold text-red-700">출고</th>
                <th className="text-center px-4 py-3.5 font-semibold text-blue-700">반입</th>
                <th className="text-center px-4 py-3.5 font-semibold text-orange-700">손실</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-600">미반입</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={12} className="px-5 py-12 text-center text-slate-400">불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} className="px-5 py-12 text-center text-slate-400">프로젝트가 없습니다.</td></tr>
              ) : (
                filtered.map((project) => {
                  const stats = projectStats[project.id]
                  const totalOut = stats?.total_out || 0
                  const totalReturn = stats?.total_return || 0
                  const totalLoss = stats?.total_loss || 0
                  const unreturned = totalOut - totalReturn - totalLoss
                  const statusClass = STATUS_COLORS[project.status] || 'bg-slate-100 text-slate-600'

                  return (
                    <tr key={project.id} onClick={() => navigate(`/projects/${project.id}`)}
                      className="hover:bg-violet-50 transition-colors cursor-pointer">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800">{project.name}</p>
                        {project.notes && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[160px]">{project.notes}</p>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                        {project.exhibition || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                        {project.organizer || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                        {project.exhibitor || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 font-medium whitespace-nowrap">
                        {project.manager || <span className="text-slate-300 font-normal">-</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 text-xs whitespace-nowrap">
                        {project.start_date ? (
                          <div>
                            <p>{formatDatetime(project.start_date, project.start_time)}</p>
                            {project.end_date && <p className="text-slate-400">~ {formatDatetime(project.end_date, project.end_time)}</p>}
                          </div>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${statusClass}`}>
                          {project.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center text-red-700 font-medium">{totalOut.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-center text-blue-700 font-medium">{totalReturn.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-center text-orange-700 font-medium">{totalLoss.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`font-semibold ${unreturned > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          {unreturned.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <ChevronRight size={16} className="text-slate-400 mx-auto" />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">총 {filtered.length}개 프로젝트</div>
        )}
      </div>

      {showAddProject && <AddProjectModal onClose={() => setShowAddProject(false)} onSuccess={fetchProjects} />}
    </div>
  )
}
