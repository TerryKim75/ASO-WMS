import type { EstimateItem } from '../../types'
import { ESTIMATE_CATEGORIES } from './EstimateItemsAccordion'
import { calculateItemExecutionTotal, calculateItemQuotedTotal, deriveMarginRate } from '../../lib/estimateCalculations'
import { formatKRW, formatPercent } from '../../lib/format'

interface Props {
  items: EstimateItem[]
}

export default function InternalExecutionTable({ items }: Props) {
  const selected = items.filter((i) => i.quantity > 0)

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">내부용 실행가표</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs">카테고리</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs">항목명</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs">사이즈</th>
              <th className="text-center px-2 py-2.5 font-semibold text-slate-600 text-xs">수량</th>
              <th className="text-center px-2 py-2.5 font-semibold text-slate-600 text-xs">단위</th>
              <th className="text-right px-3 py-2.5 font-semibold text-slate-600 text-xs">실행단가</th>
              <th className="text-right px-3 py-2.5 font-semibold text-slate-600 text-xs">실행가</th>
              <th className="text-right px-3 py-2.5 font-semibold text-slate-600 text-xs">견적단가</th>
              <th className="text-right px-3 py-2.5 font-semibold text-slate-600 text-xs">판매가</th>
              <th className="text-center px-2 py-2.5 font-semibold text-slate-600 text-xs">이윤율</th>
              <th className="text-right px-3 py-2.5 font-semibold text-slate-600 text-xs">예상이익</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs">공급처</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs">메모</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {selected.length === 0 ? (
              <tr><td colSpan={13} className="px-3 py-10 text-center text-slate-400">선택된 품목이 없습니다.</td></tr>
            ) : (
              ESTIMATE_CATEGORIES.flatMap((category) => {
                const categoryItems = selected.filter((i) => i.category === category)
                return categoryItems.map((item) => {
                  const executionTotal = calculateItemExecutionTotal(item.execution_unit_cost, item.quantity)
                  const quotedTotal = calculateItemQuotedTotal(item.quoted_unit_price, item.quantity)
                  const marginRate = deriveMarginRate(executionTotal, quotedTotal)
                  const profit = quotedTotal - executionTotal
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">{item.category}</td>
                      <td className="px-3 py-2 text-slate-800 font-medium whitespace-nowrap">{item.name}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{item.size || '-'}</td>
                      <td className="px-2 py-2 text-center">{item.quantity.toLocaleString()}</td>
                      <td className="px-2 py-2 text-center text-slate-500">{item.unit}</td>
                      <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">{formatKRW(item.execution_unit_cost)}</td>
                      <td className="px-3 py-2 text-right text-slate-700 whitespace-nowrap">{formatKRW(executionTotal)}</td>
                      <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">{formatKRW(item.quoted_unit_price)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">{formatKRW(quotedTotal)}</td>
                      <td className={`px-2 py-2 text-center font-medium ${marginRate < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                        {formatPercent(marginRate)}
                      </td>
                      <td className="px-3 py-2 text-right text-green-700 whitespace-nowrap">{formatKRW(profit)}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{item.supplier || '-'}</td>
                      <td className="px-3 py-2 text-slate-500 max-w-[160px] truncate">{item.memo || '-'}</td>
                    </tr>
                  )
                })
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
