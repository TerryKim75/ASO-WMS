import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { CategoryDef } from '../types'

export const CATEGORY_COLORS: Record<string, {
  badge: string
  tab: string
  dot: string
  card: string
  swatch: string
}> = {
  blue:   { badge: 'bg-blue-100 text-blue-700 border-blue-300',     tab: 'bg-blue-100 text-blue-700 border-blue-300',     dot: 'bg-blue-500',   card: 'bg-blue-100 text-blue-800 border-blue-200',   swatch: 'bg-blue-500' },
  green:  { badge: 'bg-green-100 text-green-700 border-green-300',   tab: 'bg-green-100 text-green-700 border-green-300',   dot: 'bg-green-500',  card: 'bg-green-100 text-green-800 border-green-200',  swatch: 'bg-green-500' },
  orange: { badge: 'bg-orange-100 text-orange-700 border-orange-300', tab: 'bg-orange-100 text-orange-700 border-orange-300', dot: 'bg-orange-500', card: 'bg-orange-100 text-orange-800 border-orange-200', swatch: 'bg-orange-500' },
  yellow: { badge: 'bg-yellow-100 text-yellow-700 border-yellow-300', tab: 'bg-yellow-100 text-yellow-700 border-yellow-300', dot: 'bg-yellow-500', card: 'bg-yellow-100 text-yellow-800 border-yellow-200', swatch: 'bg-yellow-500' },
  red:    { badge: 'bg-red-100 text-red-700 border-red-300',         tab: 'bg-red-100 text-red-700 border-red-300',         dot: 'bg-red-500',    card: 'bg-red-100 text-red-800 border-red-200',         swatch: 'bg-red-500' },
  purple: { badge: 'bg-purple-100 text-purple-700 border-purple-300', tab: 'bg-purple-100 text-purple-700 border-purple-300', dot: 'bg-purple-500', card: 'bg-purple-100 text-purple-800 border-purple-200', swatch: 'bg-purple-500' },
  pink:   { badge: 'bg-pink-100 text-pink-700 border-pink-300',      tab: 'bg-pink-100 text-pink-700 border-pink-300',      dot: 'bg-pink-500',   card: 'bg-pink-100 text-pink-800 border-pink-200',      swatch: 'bg-pink-500' },
  cyan:   { badge: 'bg-cyan-100 text-cyan-700 border-cyan-300',      tab: 'bg-cyan-100 text-cyan-700 border-cyan-300',      dot: 'bg-cyan-500',   card: 'bg-cyan-100 text-cyan-800 border-cyan-200',      swatch: 'bg-cyan-500' },
  teal:   { badge: 'bg-teal-100 text-teal-700 border-teal-300',      tab: 'bg-teal-100 text-teal-700 border-teal-300',      dot: 'bg-teal-500',   card: 'bg-teal-100 text-teal-800 border-teal-200',      swatch: 'bg-teal-500' },
  indigo: { badge: 'bg-indigo-100 text-indigo-700 border-indigo-300', tab: 'bg-indigo-100 text-indigo-700 border-indigo-300', dot: 'bg-indigo-500', card: 'bg-indigo-100 text-indigo-800 border-indigo-200', swatch: 'bg-indigo-500' },
  violet: { badge: 'bg-violet-100 text-violet-700 border-violet-300', tab: 'bg-violet-100 text-violet-700 border-violet-300', dot: 'bg-violet-500', card: 'bg-violet-100 text-violet-800 border-violet-200', swatch: 'bg-violet-500' },
  rose:   { badge: 'bg-rose-100 text-rose-700 border-rose-300',      tab: 'bg-rose-100 text-rose-700 border-rose-300',      dot: 'bg-rose-500',   card: 'bg-rose-100 text-rose-800 border-rose-200',      swatch: 'bg-rose-500' },
  amber:  { badge: 'bg-amber-100 text-amber-700 border-amber-300',   tab: 'bg-amber-100 text-amber-700 border-amber-300',   dot: 'bg-amber-500',  card: 'bg-amber-100 text-amber-800 border-amber-200',   swatch: 'bg-amber-500' },
  slate:  { badge: 'bg-slate-100 text-slate-700 border-slate-300',   tab: 'bg-slate-100 text-slate-700 border-slate-300',   dot: 'bg-slate-500',  card: 'bg-slate-100 text-slate-800 border-slate-200',   swatch: 'bg-slate-500' },
}

const FALLBACK = {
  badge: 'bg-slate-100 text-slate-600 border-slate-300',
  tab:   'bg-slate-100 text-slate-600 border-slate-300',
  dot:   'bg-slate-400',
  card:  'bg-slate-100 text-slate-800 border-slate-200',
  swatch: 'bg-slate-400',
}

interface CategoriesContextValue {
  categories: CategoryDef[]
  loading: boolean
  refreshCategories: () => void
  getCategoryStyle: (name: string) => typeof FALLBACK
}

const CategoriesContext = createContext<CategoriesContextValue>({
  categories: [],
  loading: true,
  refreshCategories: () => {},
  getCategoryStyle: () => FALLBACK,
})

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<CategoryDef[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('created_at')
    setCategories(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const getCategoryStyle = useCallback((name: string) => {
    const cat = categories.find((c) => c.name === name)
    if (!cat) return FALLBACK
    return CATEGORY_COLORS[cat.color] || FALLBACK
  }, [categories])

  return (
    <CategoriesContext.Provider value={{ categories, loading, refreshCategories: fetchCategories, getCategoryStyle }}>
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories() {
  return useContext(CategoriesContext)
}
