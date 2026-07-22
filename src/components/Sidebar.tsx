import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Landmark,
  Package,
  ArrowLeftRight,
  FolderKanban,
  Hammer,
  Building2,
  Contact,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  Users,
  Gavel,
  FileText,
  FileSignature,
} from 'lucide-react'
import { useCategories, CATEGORY_COLORS } from '../contexts/CategoriesContext'

const navItems = [
  { to: '/', label: '대시보드', icon: LayoutDashboard, exact: true },
  { to: '/projects', label: '프로젝트', icon: FolderKanban },
  { to: '/exhibition-list', label: '전시목록', icon: Landmark },
  { to: '/estimates', label: '견적서', icon: FileText },
  { to: '/contracts', label: '계약서', icon: FileSignature },
  { to: '/vendors', label: '발주처', icon: Building2 },
  { to: '/clients', label: '고객관리', icon: Contact },
  { to: '/work-report', label: '업무보고서', icon: ClipboardList },
  { to: '/bids', label: '시공입찰', icon: Gavel },
  { to: '/staff', label: '시공인력', icon: Hammer },
  { to: '/inventory', label: '재고현황', icon: Package },
  { to: '/transactions', label: '입출고내역', icon: ArrowLeftRight },
]

const employeesItem = { to: '/employees', label: '직원정보', icon: Users, exact: false }

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { categories } = useCategories()
  const [categoriesOpen, setCategoriesOpen] = useState(location.pathname.startsWith('/inventory'))

  const renderNavItem = (item: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }) => {
    const isInventory = item.to === '/inventory'
    const showCategories = isInventory && categories.length > 0

    return (
      <li key={item.to}>
        <div className="flex items-center gap-0.5">
          <NavLink
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
          {showCategories && (
            <button
              onClick={() => setCategoriesOpen((v) => !v)}
              className="p-2 text-slate-400 hover:text-white transition-colors flex-shrink-0"
              title="자재 카테고리"
            >
              <ChevronDown size={14} className={`transition-transform ${categoriesOpen ? '' : '-rotate-90'}`} />
            </button>
          )}
        </div>

        {showCategories && categoriesOpen && (
          <ul className="mt-1 ml-5 pl-3 border-l border-slate-700 space-y-0.5">
            {categories.map((cat) => {
              const dotClass = CATEGORY_COLORS[cat.color]?.dot || 'bg-slate-400'
              return (
                <li key={cat.id}>
                  <button
                    onClick={() => navigate(`/inventory?category=${encodeURIComponent(cat.name)}`)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                      {cat.name}
                    </div>
                    <ChevronRight size={12} className="opacity-50" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </li>
    )
  }

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
          {navItems.map((item) => renderNavItem(item))}
        </ul>

        <ul className="space-y-1 mt-6 pt-4 border-t border-slate-700">
          {renderNavItem(employeesItem)}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">ASO System PMS v1.0</p>
      </div>
    </aside>
  )
}
