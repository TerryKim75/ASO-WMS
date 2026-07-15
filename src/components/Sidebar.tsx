import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  FolderKanban,
  Hammer,
  Building2,
  ChevronRight,
  ClipboardList,
  Users,
  Gavel,
  FileText,
  FileSignature,
} from 'lucide-react'
import { useCategories, CATEGORY_COLORS } from '../contexts/CategoriesContext'

const navItems = [
  { to: '/', label: '대시보드', icon: LayoutDashboard, exact: true },
  { to: '/inventory', label: '재고현황', icon: Package },
  { to: '/transactions', label: '입출고내역', icon: ArrowLeftRight },
  { to: '/projects', label: '프로젝트', icon: FolderKanban },
  { to: '/estimates', label: '견적서', icon: FileText },
  { to: '/contracts', label: '계약서', icon: FileSignature },
  { to: '/staff', label: '시공인력', icon: Hammer },
  { to: '/vendors', label: '발주처', icon: Building2 },
  { to: '/work-report', label: '업무보고서', icon: ClipboardList },
  { to: '/bids', label: '시공입찰', icon: Gavel },
  { to: '/employees', label: '직원정보', icon: Users },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { categories } = useCategories()

  return (
    <aside className="w-64 min-h-screen bg-slate-800 text-white flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="ASO System"
            className="w-10 h-10 object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
            }}
          />
          <div>
            <h1 className="text-base font-bold text-white leading-tight">ASO System</h1>
            <p className="text-xs text-violet-300 font-medium">PMS 프로젝트관리</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
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

        {/* Category Shortcuts */}
        {categories.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
              자재 카테고리
            </p>
            <ul className="space-y-1">
              {categories.map((cat) => {
                const dotClass = CATEGORY_COLORS[cat.color]?.dot || 'bg-slate-400'
                return (
                  <li key={cat.id}>
                    <button
                      onClick={() => navigate(`/inventory?category=${encodeURIComponent(cat.name)}`)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
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

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">ASO System PMS v1.0</p>
      </div>
    </aside>
  )
}
