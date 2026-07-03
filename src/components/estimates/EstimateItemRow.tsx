import { Trash2, Save } from 'lucide-react'
import type { EstimateItem } from '../../types'
import { calculateItemExecutionTotal, calculateItemQuotedAmount } from '../../lib/estimateCalculations'
import { formatKRW } from '../../lib/format'

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
  const quotedAmount = calculateItemQuotedAmount(executionTotal, item.margin_rate)

  return (
    <tr className={item.quantity > 0 ? 'bg-white' : 'bg-slate-50/50'}>
      <td className="px-2 py-1.5 min-w-[160px]">
        <input value={item.name} onChange={(e) => onChange({ name: e.target.value })}
          placeholder="항목명" className={inputCls} />
        {item.is_custom && <span className="text-[10px] text-violet-500 font-medium ml-0.5">추가옵션</span>}
      </td>
      <td className="px-2 py-1.5 min-w-[140px]">
        <input value={item.description || ''} onChange={(e) => onChange({ description: e.target.value })}
          placeholder="설명" className={inputCls} />
      </td>
      <td className="px-2 py-1.5 w-16">
        <input value={item.unit} onChange={(e) => onChange({ unit: e.target.value })}
          className={`${inputCls} text-center`} />
      </td>
      <td className="px-2 py-1.5 w-28">
        <input type="number" min="0" value={item.execution_unit_cost}
          onChange={(e) => onChange({ execution_unit_cost: Number(e.target.value) || 0 })}
          className={`${inputCls} text-right`} />
      </td>
      <td className="px-2 py-1.5 w-20">
        <input type="number" min="0" value={item.quantity}
          onChange={(e) => onChange({ quantity: Number(e.target.value) || 0 })}
          className={`${inputCls} text-center font-semibold`} />
      </td>
      <td className="px-2 py-1.5 w-24">
        <input type="number" min="0" max="99" step="0.1" value={Math.round(item.margin_rate * 1000) / 10}
          onChange={(e) => onChange({ margin_rate: (Number(e.target.value) || 0) / 100 })}
          className={`${inputCls} text-center`} />
      </td>
      <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap w-32">
        {formatKRW(executionTotal)}
      </td>
      <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap w-32">
        {formatKRW(quotedAmount)}
      </td>
      <td className="px-2 py-1.5 text-center w-16">
        <input type="checkbox" checked={item.show_to_client}
          onChange={(e) => onChange({ show_to_client: e.target.checked })}
          className="w-4 h-4 accent-violet-600" title="고객 견적서에 표시" />
      </td>
      <td className="px-2 py-1.5 text-center w-16">
        <div className="flex items-center justify-center gap-1.5">
          {onSaveToMaster && (
            <button onClick={onSaveToMaster} title="품목마스터에 저장" className="text-slate-300 hover:text-violet-500 transition-colors">
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

