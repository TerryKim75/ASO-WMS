import { Printer } from 'lucide-react'
import type { CustomerLineItem, CustomerSummary } from '../../lib/estimateCustomerView'
import { formatKRW } from '../../lib/format'

export interface CustomerEstimateHeader {
  estimate_number: string
  client_name: string
  exhibition_name?: string
  venue?: string
  booth_size?: string
  created_at: string
  valid_until?: string
  included_scope?: string
  excluded_scope?: string
  payment_terms?: string
  customer_notes?: string
}

interface Props {
  header: CustomerEstimateHeader
  lineItems: CustomerLineItem[]
  summary: CustomerSummary
  printDisabled?: boolean
}

function formatDate(date?: string) {
  if (!date) return '-'
  return date.split('T')[0].replace(/-/g, '.')
}

function buildPrintHtml(header: CustomerEstimateHeader, lineItems: CustomerLineItem[], summary: CustomerSummary) {
  const rows = lineItems.map((item, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${item.category}</td>
      <td>${item.name}${item.description ? `<div style="color:#94a3b8;font-size:11px">${item.description}</div>` : ''}</td>
      <td style="text-align:center">${item.quantity.toLocaleString()}</td>
      <td style="text-align:center">${item.unit}</td>
      <td style="text-align:right;font-weight:600">${formatKRW(item.quoted_amount)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
  <title>견적서 - ${header.estimate_number}</title>
  <style>
    @page { margin: 20mm; }
    body { font-family: 'Malgun Gothic', sans-serif; font-size: 13px; color: #1e293b; }
    .title { font-size: 26px; font-weight: 700; letter-spacing: 6px; text-align: center; border-bottom: 3px solid #1e293b; padding-bottom: 12px; margin-bottom: 20px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 40px; margin-bottom: 20px; }
    .info-row { display: flex; gap: 8px; padding: 4px 0; border-bottom: 1px dashed #e2e8f0; }
    .info-label { color: #64748b; min-width: 72px; font-size: 12px; }
    .info-value { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 12px; }
    thead th { background: #f1f5f9; font-weight: 600; }
    .totals { margin-left: auto; width: 320px; }
    .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
    .totals-row.final { font-size: 17px; font-weight: 700; border-top: 2px solid #1e293b; margin-top: 6px; padding-top: 8px; }
    .scope-section { margin-top: 20px; }
    .scope-title { font-weight: 700; font-size: 13px; margin-bottom: 6px; }
    .scope-body { white-space: pre-wrap; font-size: 12px; color: #475569; line-height: 1.6; }
    .footer-note { margin-top: 24px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; white-space: pre-wrap; font-size: 11px; color: #64748b; line-height: 1.7; }
  </style></head><body>
  <div class="title">견 &nbsp; 적 &nbsp; 서</div>
  <div class="info-grid">
    <div>
      <div class="info-row"><span class="info-label">고객명</span><span class="info-value">${header.client_name}</span></div>
      <div class="info-row"><span class="info-label">전시회</span><span class="info-value">${header.exhibition_name || '-'}</span></div>
      <div class="info-row"><span class="info-label">전시장</span><span class="info-value">${header.venue || '-'}</span></div>
      <div class="info-row"><span class="info-label">부스면적</span><span class="info-value">${header.booth_size || '-'}</span></div>
    </div>
    <div>
      <div class="info-row"><span class="info-label">견적번호</span><span class="info-value">${header.estimate_number}</span></div>
      <div class="info-row"><span class="info-label">작성일</span><span class="info-value">${formatDate(header.created_at)}</span></div>
      <div class="info-row"><span class="info-label">유효기간</span><span class="info-value">${formatDate(header.valid_until)}</span></div>
      <div class="info-row"><span class="info-label">결제조건</span><span class="info-value">${header.payment_terms || '-'}</span></div>
    </div>
  </div>
  <table>
    <thead><tr>
      <th style="width:32px">No.</th><th style="width:100px">구분</th><th>항목</th>
      <th style="width:60px">수량</th><th style="width:50px">단위</th><th style="width:120px">공급가</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px">항목 없음</td></tr>'}</tbody>
  </table>
  <div class="totals">
    <div class="totals-row"><span>공급가</span><span>${formatKRW(summary.preDiscountSupply)}</span></div>
    ${summary.discountAmount > 0 ? `<div class="totals-row"><span>할인</span><span>-${formatKRW(summary.discountAmount)}</span></div>` : ''}
    <div class="totals-row"><span>VAT (10%)</span><span>${formatKRW(summary.vatAmount)}</span></div>
    <div class="totals-row final"><span>최종 견적금액</span><span>${formatKRW(summary.finalTotalAmount)}</span></div>
  </div>
  ${header.included_scope ? `<div class="scope-section"><div class="scope-title">포함 사항</div><div class="scope-body">${header.included_scope}</div></div>` : ''}
  ${header.excluded_scope ? `<div class="scope-section"><div class="scope-title">불포함 사항</div><div class="scope-body">${header.excluded_scope}</div></div>` : ''}
  ${header.customer_notes ? `<div class="footer-note">${header.customer_notes}</div>` : ''}
  </body></html>`
}

export default function CustomerEstimateView({ header, lineItems, summary, printDisabled }: Props) {
  const handlePrint = () => {
    const html = buildPrintHtml(header, lineItems, summary)
    const win = window.open('', '_blank', 'width=800,height=900')
    if (!win) { alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.'); return }
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 400)
  }

  const categories = Array.from(new Set(lineItems.map((i) => i.category)))

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 gap-3 flex-wrap">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">고객 제출용 견적서 미리보기</p>
        <div className="flex items-center gap-2">
          {printDisabled && (
            <span className="text-xs text-red-600 font-medium">최소 이윤율 미달 — 승인 후 출력 가능</span>
          )}
          <button onClick={handlePrint} disabled={printDisabled}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-violet-600">
            <Printer size={13} />인쇄 / PDF 저장
          </button>
        </div>
      </div>

      <div className="p-5 md:p-8 space-y-6">
        <div className="text-center border-b-4 border-slate-800 pb-3">
          <h2 className="text-2xl font-bold tracking-[0.3em] text-slate-800">견 적 서</h2>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div className="flex gap-2 py-1 border-b border-dashed border-slate-200">
            <span className="text-slate-400 w-16 flex-shrink-0">고객명</span><span className="font-semibold">{header.client_name}</span>
          </div>
          <div className="flex gap-2 py-1 border-b border-dashed border-slate-200">
            <span className="text-slate-400 w-16 flex-shrink-0">견적번호</span><span className="font-semibold">{header.estimate_number}</span>
          </div>
          <div className="flex gap-2 py-1 border-b border-dashed border-slate-200">
            <span className="text-slate-400 w-16 flex-shrink-0">전시회</span><span>{header.exhibition_name || '-'}</span>
          </div>
          <div className="flex gap-2 py-1 border-b border-dashed border-slate-200">
            <span className="text-slate-400 w-16 flex-shrink-0">작성일</span><span>{formatDate(header.created_at)}</span>
          </div>
          <div className="flex gap-2 py-1 border-b border-dashed border-slate-200">
            <span className="text-slate-400 w-16 flex-shrink-0">전시장</span><span>{header.venue || '-'}</span>
          </div>
          <div className="flex gap-2 py-1 border-b border-dashed border-slate-200">
            <span className="text-slate-400 w-16 flex-shrink-0">유효기간</span><span>{formatDate(header.valid_until)}</span>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs">구분</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs">항목</th>
                <th className="text-center px-2 py-2.5 font-semibold text-slate-600 text-xs">수량</th>
                <th className="text-center px-2 py-2.5 font-semibold text-slate-600 text-xs">단위</th>
                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 text-xs">공급가</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lineItems.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">항목이 없습니다.</td></tr>
              ) : (
                categories.flatMap((category) =>
                  lineItems.filter((i) => i.category === category).map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">{item.category}</td>
                      <td className="px-3 py-2 text-slate-800">
                        {item.name}
                        {item.description && <p className="text-xs text-slate-400">{item.description}</p>}
                      </td>
                      <td className="px-2 py-2 text-center">{item.quantity.toLocaleString()}</td>
                      <td className="px-2 py-2 text-center text-slate-500">{item.unit}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">{formatKRW(item.quoted_amount)}</td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between py-1"><span className="text-slate-500">공급가</span><span>{formatKRW(summary.preDiscountSupply)}</span></div>
            {summary.discountAmount > 0 && (
              <div className="flex justify-between py-1"><span className="text-slate-500">할인</span><span>-{formatKRW(summary.discountAmount)}</span></div>
            )}
            <div className="flex justify-between py-1"><span className="text-slate-500">VAT (10%)</span><span>{formatKRW(summary.vatAmount)}</span></div>
            <div className="flex justify-between py-2 border-t-2 border-slate-800 text-lg font-bold">
              <span>최종 견적금액</span><span>{formatKRW(summary.finalTotalAmount)}</span>
            </div>
          </div>
        </div>

        {header.included_scope && (
          <div>
            <p className="font-semibold text-sm text-slate-700 mb-1">포함 사항</p>
            <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed">{header.included_scope}</p>
          </div>
        )}
        {header.excluded_scope && (
          <div>
            <p className="font-semibold text-sm text-slate-700 mb-1">불포함 사항</p>
            <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed">{header.excluded_scope}</p>
          </div>
        )}
        {header.customer_notes && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed">{header.customer_notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
