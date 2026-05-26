import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="min-w-[960px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
