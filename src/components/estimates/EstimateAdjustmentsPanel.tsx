import type { RiskOption } from '../../types'
import type { DiscountValueType } from '../../lib/estimateCalculations'

interface Props {
  overheadRate: number
  overheadLabel: string
  onOverheadRateChange: (rate: number) => void
  onOverheadLabelChange: (label: string) => void
  riskOptions: RiskOption[]
  selectedRiskIds: Set<string>
  onToggleRisk: (id: string) => void
  companyProfitType: DiscountValueType
  companyProfitValue: number
  onCompanyProfitTypeChange: (type: DiscountValueType) => void
  onCompanyProfitValueChange: (value: number) => void
  discountType: DiscountValueType
  discountValue: number
  onDiscountTypeChange: (type: DiscountValueType) => void
  onDiscountValueChange: (value: number) => void
}

const inputCls =
  'border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent'

export default function EstimateAdjustmentsPanel({
  overheadRate, overheadLabel, onOverheadRateChange, onOverheadLabelChange,
  riskOptions, selectedRiskIds, onToggleRisk,
  companyProfitType, companyProfitValue, onCompanyProfitTypeChange, onCompanyProfitValueChange,
  discountType, discountValue, onDiscountTypeChange, onDiscountValueChange,
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5 space-y-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">간접비 · 리스크 · 기업이윤 · 할인</p>

      {/* 간접비 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">간접비 명칭</label>
          <input value={overheadLabel} onChange={(e) => onOverheadLabelChange(e.target.value)}
            placeholder="제작관리비" className={`${inputCls} w-full`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">간접비율 (%, 공급가 기준)</label>
          <input type="number" min="0" max="100" step="0.5" value={Math.round(overheadRate * 1000) / 10}
            onChange={(e) => onOverheadRateChange((Number(e.target.value) || 0) / 100)}
            className={`${inputCls} w-full`} />
        </div>
      </div>

      {/* 리스크 체크박스 */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">리스크 요인 (실행가합계 기준 가산)</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {riskOptions.map((risk) => (
            <label key={risk.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                selectedRiskIds.has(risk.id)
                  ? 'bg-violet-50 border-violet-300 text-violet-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <input type="checkbox" checked={selectedRiskIds.has(risk.id)} onChange={() => onToggleRisk(risk.id)}
                className="w-3.5 h-3.5 accent-violet-600" />
              {risk.name} <span className="text-slate-400">+{Math.round(risk.default_rate * 100)}%</span>
            </label>
          ))}
        </div>
      </div>

      {/* 기업이윤 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">기업이윤 방식</label>
          <select value={companyProfitType} onChange={(e) => onCompanyProfitTypeChange(e.target.value as DiscountValueType)}
            className={`${inputCls} w-full`}>
            <option value="rate">비율(%, 공급가 기준)</option>
            <option value="fixed">금액(원)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {companyProfitType === 'rate' ? '기업이윤율 (%)' : '기업이윤 금액 (원)'}
          </label>
          <input type="number" min="0"
            value={companyProfitType === 'rate' ? Math.round(companyProfitValue * 1000) / 10 : companyProfitValue}
            onChange={(e) => {
              const raw = Number(e.target.value) || 0
              onCompanyProfitValueChange(companyProfitType === 'rate' ? raw / 100 : raw)
            }}
            className={`${inputCls} w-full`} />
        </div>
      </div>

      {/* 할인 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">할인 방식</label>
          <select value={discountType} onChange={(e) => onDiscountTypeChange(e.target.value as DiscountValueType)}
            className={`${inputCls} w-full`}>
            <option value="rate">할인율(%)</option>
            <option value="fixed">할인금액(원)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {discountType === 'rate' ? '할인율 (%)' : '할인금액 (원)'}
          </label>
          <input type="number" min="0"
            value={discountType === 'rate' ? Math.round(discountValue * 1000) / 10 : discountValue}
            onChange={(e) => {
              const raw = Number(e.target.value) || 0
              onDiscountValueChange(discountType === 'rate' ? raw / 100 : raw)
            }}
            className={`${inputCls} w-full`} />
        </div>
      </div>
    </div>
  )
}
