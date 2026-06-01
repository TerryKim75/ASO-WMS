import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Menu, X,
  LayoutDashboard, Package, ArrowLeftRight, FolderKanban,
  Hammer, Building2, ChevronRight, ClipboardList, Users, Gavel, BarChart2,
} from 'lucide-react'
import Sidebar from './Sidebar'
import { useCategories, CATEGORY_COLORS } from '../contexts/CategoriesContext'

const navItems = [
  { to: '/', label: '대시보드', icon: LayoutDashboard, exact: true },
  { to: '/inventory', label: '재고현황', icon: Package },
  { to: '/material-frequency', label: '자재사용빈도', icon: BarChart2 },
  { to: '/transactions', label: '입출고내역', icon: ArrowLeftRight },
  { to: '/projects', label: '프로젝트', icon: FolderKanban },
  { to: '/staff', label: '시공인력', icon: Hammer },
  { to: '/vendors', label: '발주처', icon: Building2 },
  { to: '/work-report', label: '업무보고서', icon: ClipboardList },
  { to: '/bids', label: '시공입찰', icon: Gavel },
  { to: '/employees', label: '직원정보', icon: Users },
]

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { categories } = useCategories()

  // 페이지 이동 시 드로어 자동 닫기
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const close = () => setMobileOpen(false)

  const currentPage = navItems.find((item) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to)
  )?.label ?? 'ASO System'

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Desktop Sidebar - 모바일에서 숨김 */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          {/* 배경 오버레이 */}
          <div className="absolute inset-0 bg-black/50" onClick={close} />

          {/* 드로어 패널 */}
          <div className="absolute left-0 top-0 h-full w-72 bg-slate-800 text-white flex flex-col z-50 shadow-2xl">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="ASO"
                  className="w-8 h-8 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div>
                  <p className="text-sm font-bold text-white leading-tight">ASO System</p>
                  <p className="text-xs text-violet-300 font-medium">PMS 프로젝트관리</p>
                </div>
              </div>
              <button
                onClick={close}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* 내비게이션 */}
            <nav className="flex-1 p-4 overflow-y-auto">
              <ul className="space-y-1">
                {navItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.exact}
                      onClick={close}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-violet-600 text-white'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`
                      }
                    >
                      <item.icon size={18} />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>

              {/* 카테고리 바로가기 */}
              {categories.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
                    자재 카테고리
                  </p>
                  <ul className="space-y-1">
                    {categories.map((cat) => {
                      const dotClass = CATEGORY_COLORS[cat.color]?.dot || 'bg-slate-400'
                      return (
                        <li key={cat.id}>
                          <button
                            onClick={() => {
                              navigate(`/inventory?category=${encodeURIComponent(cat.name)}`)
                              close()
                            }}
                            className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                              {cat.name}
                            </div>
                            <ChevronRight size={14} className="opacity-50" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </nav>

            {/* 푸터 */}
            <div className="p-4 border-t border-slate-700">
              <p className="text-xs text-slate-500 text-center">ASO System PMS v1.0</p>
            </div>
          </div>
        </div>
      )}

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 모바일 상단 헤더 */}
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between shadow-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="ASO"
              className="w-6 h-6 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <span className="text-sm font-bold text-slate-800">{currentPage}</span>
          </div>
          {/* 오른쪽 여백 균형용 */}
          <div className="w-10" />
        </header>

        <main className="flex-1 overflow-auto">
          <div className="md:min-w-[960px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
