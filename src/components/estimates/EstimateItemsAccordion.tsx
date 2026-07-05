import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import type { EstimateCategory, EstimateItem } from '../../types'
import EstimateItemRow from './EstimateItemRow'
import { calculateItemQuotedTotal } from '../../lib/estimateCalculations'
import { formatKRW } from '../../lib/format'

export const ESTIMATE_CATEGORIES: EstimateCategory[] = [
  '시스템 자재', '마감재', '바닥', '그래픽', '전기/조명', '가구/비품', '운송',
  '인건비', '전시장비용', '디자인', '관리비', '기타',
]

interface Props {
  items: EstimateItem[]
  onChangeItem: (id: string, patch: Partial<EstimateItem>) => void
  onAddCustomItem: (category: EstimateCategory) => void
  onRemoveItem: (id: string) => void
  onSaveItemToMaster: (id: string) => void
}

export default function EstimateItemsAccordion({
  items, onChangeItem, onAddCustomItem, onRemoveItem, onSaveItemToMaster,
}: Props) {
  const [expanded, setExpanded] = useState<Set<EstimateCategory>>(new Set(ESTIMATE_CATEGORIES.slice(0, 1)))

  const toggle = (category: EstimateCategory) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  return (
    <div className="space-y-2">
      {ESTIMATE_CATEGORIES.map((category) => {
        const categoryItems = items.filter((i) => i.category === category)
        const isExpanded = expanded.has(category)
        const selectedCount = categoryItems.filter((i) => i.quantity > 0).length
        const categoryQuoted = categoryItems.reduce((sum, i) => {
          if (i.quantity <= 0) return sum
          return sum + calculateItemQuotedTotal(i.quoted_unit_price, i.quantity)
        }, 0)

        return (
          <div key={category} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <button
              onClick={() => toggle(category)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
            >
              <span className="text-slate-400 flex-shrink-0">
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-slate-800 text-sm">{category}</span>
                <span className="text-xs text-slate-400 ml-2">
                  {categoryItems.length}개 품목{selectedCount > 0 && ` · ${selectedCount}개 선택`}
                </span>
              </div>
              {categoryQuoted > 0 && (
                <span className="text-sm font-semibold text-violet-700">{formatKRW(categoryQuoted)}</span>
              )}
            </button>

            {isExpanded && (
              <div className="border-t border-slate-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-2 py-2 font-semibold text-slate-500 text-xs">항목명</th>
                        <th className="text-left px-2 py-2 font-semibold text-slate-500 text-xs">사이즈</th>
                        <th className="text-center px-2 py-2 font-semibold text-slate-500 text-xs">단위</th>
                        <th className="text-right px-2 py-2 font-semibold text-slate-500 text-xs">실행단가</th>
                        <th className="text-center px-2 py-2 font-semibold text-slate-500 text-xs">수량</th>
                        <th className="text-right px-2 py-2 font-semibold text-slate-500 text-xs">견적단가</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-500 text-xs">실행가</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-500 text-xs">판매가</th>
                        <th className="text-center px-2 py-2 font-semibold text-slate-500 text-xs">이윤율</th>
                        <th className="text-center px-2 py-2 font-semibold text-slate-500 text-xs">고객노출</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categoryItems.map((item) => (
                        <EstimateItemRow
                          key={item.id}
                          item={item}
                          onChange={(patch) => onChangeItem(item.id, patch)}
                          onRemove={item.is_custom ? () => onRemoveItem(item.id) : undefined}
                          onSaveToMaster={item.is_custom ? () => onSaveItemToMaster(item.id) : undefined}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2.5 border-t border-slate-100">
                  <button
                    onClick={() => onAddCustomItem(category)}
                    className="flex items-center gap-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus size={13} />커스텀 품목 추가
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
