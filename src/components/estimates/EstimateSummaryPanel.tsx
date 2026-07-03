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

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={emphasize ? 'font-bold text-slate-800' : 'font-medium text-slate-700'}>{value}</span>
    </div>
  )
}

export default function EstimateSummaryPanel({ totals, overheadLabel }: Props) {
  const marginStyle = MARGIN_STATUS_STYLE[totals.margin.status]
  const statusLabel = totals.margin.status === 'below' ? '경고' : totals.margin.status === 'above' ? '목표 초과' : '정상'

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5 space-y-1 lg:sticky lg:top-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">견적 요약</p>

      <Row label="실행가 합계" value={formatKRW(totals.executionTotal)} />
      <Row label={overheadLabel || '간접비'} value={formatKRW(totals.overheadAmount)} />
      <Row label="리스크 비용" value={formatKRW(totals.riskAmount)} />
      <div className="border-t border-slate-100 my-1.5" />
      <Row label="할인 전 공급가" value={formatKRW(totals.preDiscountSupply)} />
      <Row label="할인금액" value={`-${formatKRW(totals.discountAmount)}`} />
      <Row label="할인 후 공급가" value={formatKRW(totals.finalSupplyAmount)} emphasize />
      <Row label="VAT (10%)" value={formatKRW(totals.vatAmount)} />
      <div className="border-t border-slate-100 my-1.5" />
      <Row label="최종 견적금액" value={formatKRW(totals.finalTotalAmount)} emphasize />
      <Row label="예상이익" value={formatKRW(totals.expectedProfit)} />

      <div className={`mt-3 p-3 rounded-lg border ${marginStyle.bg}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">최종 이윤율</span>
          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${marginStyle.badge}`}>{statusLabel}</span>
        </div>
        <p className={`text-2xl font-bold mt-1 ${marginStyle.text}`}>{formatPercent(totals.finalProfitRate)}</p>
        <p className="text-xs text-slate-400 mt-1">
          목표 {formatPercent(totals.margin.targetRate)} · 최소 {formatPercent(totals.margin.minRate)} · 상한 {formatPercent(totals.margin.maxRate)}
        </p>
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
