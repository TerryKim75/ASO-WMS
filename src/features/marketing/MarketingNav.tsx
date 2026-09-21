import { useId, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Megaphone, ChevronDown } from 'lucide-react'

import { marketingLinks } from './navigation'
export default function MarketingNav({onNavigate}: {onNavigate?: () => void}) {
  const submenuId = useId()
  const active = useLocation().pathname.startsWith('/marketing')
  const [open, setOpen] = useState(true)
  return <li className="my-2 border-y border-slate-700 py-2">
    <button aria-expanded={open} aria-controls={submenuId} onClick={() => setOpen(!open)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold ${active ? 'text-violet-300' : 'text-slate-300'} hover:bg-slate-700`}>
      <Megaphone size={18}/>마케팅<ChevronDown size={15} className={`ml-auto ${open ? '' : '-rotate-90'}`}/>
    </button>
    {open && <ul id={submenuId} className="ml-5 pl-3 border-l border-slate-700 space-y-1 mt-1">{marketingLinks.map(item => <li key={item.to}><NavLink to={item.to} end={item.exact} onClick={onNavigate} className={({isActive}) => `block px-3 py-2 text-sm rounded-lg ${isActive ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>{item.label}</NavLink></li>)}</ul>}
  </li>
}
