import { useState, useEffect } from 'react'
import { X, Trash2, Plus, Tag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCategories, CATEGORY_COLORS } from '../contexts/CategoriesContext'

interface Props {
  onClose: () => void
}

const COLOR_OPTIONS = Object.keys(CATEGORY_COLORS) as (keyof typeof CATEGORY_COLORS)[]

const COLOR_LABELS: Record<string, string> = {
  blue: '파란색', green: '초록색', orange: '주황색', yellow: '노란색', red: '빨간색',
  purple: '보라색', pink: '분홍색', cyan: '하늘색', teal: '청록색', indigo: '남색',
  violet: '보라', rose: '장미색', amber: '황금색', slate: '회색',
}

export default function CategoryManageModal({ onClose }: Props) {
  const { categories, refreshCategories } = useCategories()
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('blue')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('items')
      .select('category')
      .then(({ data }) => {
        const counts: Record<string, number> = {}
        ;(data || []).forEach((item) => {
          counts[item.category] = (counts[item.category] || 0) + 1
        })
        setItemCounts(counts)
      })
  }, [categories])

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) { setError('카테고리명을 입력해주세요.'); return }
    if (categories.some((c) => c.name === name)) { setError('이미 존재하는 카테고리입니다.'); return }
    setAdding(true)
    setError('')
    const { error: err } = await supabase.from('categories').insert({ name, color: newColor })
    if (err) { setError(err.message); setAdding(false); return }
    setNewName('')
    setNewColor('blue')
    refreshCategories()
    setAdding(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if ((itemCounts[name] || 0) > 0) return
    if (!confirm(`'${name}' 카테고리를 삭제하시겠습니까?`)) return
    setDeletingId(id)
    await supabase.from('categories').delete().eq('id', id)
    refreshCategories()
    setDeletingId(null)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <Tag size={18} className="text-violet-600" />
            <h2 className="text-lg font-bold text-slate-800">카테고리 관리</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Existing Categories */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">등록된 카테고리</p>
            <div className="space-y-2">
              {categories.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">카테고리가 없습니다.</p>
              ) : (
                categories.map((cat) => {
                  const style = CATEGORY_COLORS[cat.color]
                  const count = itemCounts[cat.name] || 0
                  const inUse = count > 0
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${style?.dot || 'bg-slate-400'}`} />
                        <span className="text-sm font-medium text-slate-800">{cat.name}</span>
                        {inUse && (
                          <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                            {count}개 자재
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(cat.id, cat.name)}
                        disabled={inUse || deletingId === cat.id}
                        title={inUse ? '자재가 있어 삭제할 수 없습니다' : '삭제'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          inUse
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                        }`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Add New Category */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">새 카테고리 추가</p>
            <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">카테고리명</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="예: 전기자재"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">색상 선택</label>
                <div className="grid grid-cols-7 gap-2">
                  {COLOR_OPTIONS.map((color) => {
                    const style = CATEGORY_COLORS[color]
                    return (
                      <button
                        key={color}
                        type="button"
                        title={COLOR_LABELS[color]}
                        onClick={() => setNewColor(color)}
                        className={`w-8 h-8 rounded-full transition-all ${style.swatch} ${
                          newColor === color
                            ? 'ring-2 ring-offset-2 ring-slate-400 scale-110'
                            : 'hover:scale-105 opacity-80 hover:opacity-100'
                        }`}
                      />
                    )
                  })}
                </div>
                <p className="text-xs text-slate-400 mt-1.5">선택: {COLOR_LABELS[newColor]}</p>
              </div>

              <button
                onClick={handleAdd}
                disabled={adding || !newName.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <Plus size={15} />
                {adding ? '추가 중...' : '카테고리 추가'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 border-t flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
