import { AlertTriangle } from 'lucide-react'
import type { EstimateTotals } from '../../lib/estimateCalculations'
import { formatKRW, formatPercent } from '../../lib/format'

interface Props {
  totals: EstimateTotals
  overheadLabel: string
}

const MARGIN_STATUS_STYLE: Record<EstimateTotals['margin']['status'], { text: string; bg: string; badge: string }> = {
  below:    { text: 'text-red-700',   bg: 'bg-red-50 border-red-200',       badge: 'bg-red-100 text-red-700' },
  'in-range': { text: 'text-green-700', bg: 'bg-green-50 border-green-200',   badge: 'bg-green-100 text-green-700' },
  above:    { text: 'text-blue-700',  bg: 'bg-blue-50 border-blue-200',     badge: 'bg-blue-100 text-blue-700' },
}

function Tile({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="px-4 py-3 border-r border-slate-100 last:border-r-0">
      <p className="text-xs text-slate-500 whitespace-nowrap">{label}</p>
      <p className={`mt-0.5 whitespace-nowrap ${emphasize ? 'text-lg font-bold text-slate-800' : 'font-semibold text-slate-700'}`}>
        {value}
      </p>
    </div>
  )
}

export default function EstimateSummaryPanel({ totals, overheadLabel }: Props) {
  const marginStyle = MARGIN_STATUS_STYLE[totals.margin.status]
  const statusLabel = totals.margin.status === 'below' ? '경고' : totals.margin.status === 'above' ? '목표 초과' : '정상'

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 md:px-5 pt-4 md:pt-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">견적 요약</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 divide-y sm:divide-y-0 divide-slate-100">
        <Tile label="실행가 합계" value={formatKRW(totals.executionTotal)} />
        <Tile label={overheadLabel || '간접비'} value={formatKRW(totals.overheadAmount)} />
        <Tile label="리스크 비용" value={formatKRW(totals.riskAmount)} />
        <Tile label="할인 전 공급가" value={formatKRW(totals.preDiscountSupply)} />
        <Tile label="할인금액" value={`-${formatKRW(totals.discountAmount)}`} />
        <Tile label="할인 후 공급가" value={formatKRW(totals.finalSupplyAmount)} emphasize />
        <Tile label="VAT (10%)" value={formatKRW(totals.vatAmount)} />
        <Tile label="최종 견적금액" value={formatKRW(totals.finalTotalAmount)} emphasize />
        <Tile label="예상이익" value={formatKRW(totals.expectedProfit)} />
      </div>

      <div className={`m-4 md:m-5 mt-2 p-4 rounded-lg border ${marginStyle.bg}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">최종 이윤율</span>
            <span className={`text-2xl font-bold ${marginStyle.text}`}>{formatPercent(totals.finalProfitRate)}</span>
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${marginStyle.badge}`}>{statusLabel}</span>
          </div>
          <p className="text-xs text-slate-400">
            목표 {formatPercent(totals.margin.targetRate)} · 최소 {formatPercent(totals.margin.minRate)} · 상한 {formatPercent(totals.margin.maxRate)}
          </p>
        </div>
        {totals.margin.isBelowMinimum && (
          <div className="flex items-start gap-1.5 mt-2 text-red-700 text-xs font-medium">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
            <span>현재 견적은 최소 목표 이윤율보다 낮습니다. 관리자 승인이 필요합니다.</span>
          </div>
        )}
      </div>
    </div>
  )
}
