import { Trash2, Save } from 'lucide-react'
import type { EstimateItem, EstimateUnit } from '../../types'
import { calculateItemExecutionTotal, calculateItemQuotedTotal, deriveMarginRate } from '../../lib/estimateCalculations'
import { formatKRW, formatPercent } from '../../lib/format'

const ESTIMATE_UNITS: EstimateUnit[] = ['개', '회배', '식', '세트', '회', '장', '미터', '대', '시간', 'KW', '모듈']

interface Props {
  item: EstimateItem
  onChange: (patch: Partial<EstimateItem>) => void
  onRemove?: () => void
  onSaveToMaster?: () => void
}

const inputCls =
  'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400'

export default function EstimateItemRow({ item, onChange, onRemove, onSaveToMaster }: Props) {
  const executionTotal = calculateItemExecutionTotal(item.execution_unit_cost, item.quantity)
  const quotedTotal = calculateItemQuotedTotal(item.quoted_unit_price, item.quantity)
  const marginRate = deriveMarginRate(executionTotal, quotedTotal)

  return (
    <tr className={item.quantity > 0 ? 'bg-white' : 'bg-slate-50/50'}>
      <td className="px-2 py-1.5 min-w-[240px]">
        <input value={item.name} onChange={(e) => onChange({ name: e.target.value })}
          placeholder="항목명" className={inputCls} />
        {item.is_custom && <span className="text-[10px] text-violet-500 font-medium ml-0.5">추가옵션</span>}
      </td>
      <td className="px-2 py-1.5 min-w-[130px]">
        <input value={item.size || ''} onChange={(e) => onChange({ size: e.target.value })}
          placeholder="상세내용" className={inputCls} />
      </td>
      <td className="px-2 py-1.5 min-w-[84px]">
        <select value={item.unit} onChange={(e) => onChange({ unit: e.target.value as EstimateUnit })}
          className={`${inputCls} text-center`}>
          {ESTIMATE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5 min-w-[130px]">
        <input type="number" min="0" value={item.execution_unit_cost}
          onChange={(e) => onChange({ execution_unit_cost: Number(e.target.value) || 0 })}
          className={`${inputCls} text-right`} />
      </td>
      <td className="px-2 py-1.5 min-w-[90px]">
        <input type="number" min="0" value={item.quantity}
          onChange={(e) => onChange({ quantity: Number(e.target.value) || 0 })}
          className={`${inputCls} text-center font-semibold`} />
      </td>
      <td className="px-2 py-1.5 min-w-[130px]">
        <input type="number" min="0" value={item.quoted_unit_price}
          onChange={(e) => onChange({ quoted_unit_price: Number(e.target.value) || 0 })}
          className={`${inputCls} text-right`} />
      </td>
      <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap min-w-[130px]">
        {formatKRW(executionTotal)}
      </td>
      <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap min-w-[130px]">
        {formatKRW(quotedTotal)}
      </td>
      <td className={`px-2 py-2 text-center text-xs font-medium whitespace-nowrap ${
        quotedTotal === 0 ? 'text-slate-300' : marginRate < 0 ? 'text-red-600' : 'text-green-700'
      }`}>
        {quotedTotal === 0 ? '-' : formatPercent(marginRate)}
      </td>
      <td className="px-2 py-1.5 text-center w-16">
        <input type="checkbox" checked={item.show_to_client}
          onChange={(e) => onChange({ show_to_client: e.target.checked })}
          className="w-4 h-4 accent-violet-600" title="고객 견적서에 표시" />
      </td>
      <td className="px-2 py-1.5 text-center w-16">
        <div className="flex items-center justify-center gap-1.5">
          {onSaveToMaster && (
            <button onClick={onSaveToMaster} title="견적단가에 저장" className="text-slate-300 hover:text-violet-500 transition-colors">
              <Save size={13} />
            </button>
          )}
          {onRemove && (
            <button onClick={onRemove} title="항목 삭제" className="text-slate-300 hover:text-red-400 transition-colors">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
