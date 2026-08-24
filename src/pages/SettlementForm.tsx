import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2, FileText, Printer } from 'lucide-react'
import { fetchContract } from '../lib/contractActions'
import { fetchEstimateFull } from '../lib/estimateActions'
import { fetchSettlementByContractId, saveSettlement, type SettlementItemDraft } from '../lib/settlementActions'
import { ESTIMATE_CATEGORIES } from '../components/estimates/EstimateItemsAccordion'
import { ASO_COMPANY_INFO } from '../lib/companyInfo'
import { formatKRW, formatPercent } from '../lib/format'
import type { Contract, EstimateCategory } from '../types'

interface Row extends SettlementItemDraft {
  key: string
}

function toRow(draft: SettlementItemDraft): Row {
  return { ...draft, key: crypto.randomUUID() }
}

// 견적서(내부용 실행가표)와 동일한 분류 순서로 정렬한다 — 프리셋 분류 순서 뒤에
// 프리셋에 없는 분류(추가 비용 항목 등)를 처음 등장한 순서대로 붙인다.
function sortRowsByCategoryOrder(rows: Row[]): Row[] {
  const seenOrder = Array.from(new Set(rows.map((r) => r.category)))
  const categories = [
    ...ESTIMATE_CATEGORIES,
    ...seenOrder.filter((c) => !ESTIMATE_CATEGORIES.includes(c as EstimateCategory)),
  ]
  const byCategory = new Map<string, Row[]>()
  for (const row of rows) {
    const list = byCategory.get(row.category) ?? []
    list.push(row)
    byCategory.set(row.category, list)
  }
  return categories.flatMap((c) => byCategory.get(c) ?? [])
}

const emptyExtraRow = (): Row => toRow({
  estimate_item_id: undefined,
  category: '', name: '', size: '', unit: 'EA', quantity: 1,
  planned_unit_cost: 0, actual_unit_cost: 0, actual_amount: 0,
  is_extra: true, memo: '',
})

export default function SettlementForm() {
  const { contractId } = useParams<{ contractId: string }>()
  const navigate = useNavigate()
  const [contract, setContract] = useState<Contract | null>(null)
  const [estimateId, setEstimateId] = useState<string | undefined>(undefined)
  const [rows, setRows] = useState<Row[]>([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    if (!contractId) return
    setLoading(true)
    try {
      const c = await fetchContract(contractId)
      setContract(c)
      setEstimateId(c.estimate_id)

      const existing = await fetchSettlementByContractId(contractId)
      if (existing) {
        setNotes(existing.settlement.notes)
        setRows(sortRowsByCategoryOrder(existing.items.map((item) => toRow({
          estimate_item_id: item.estimate_item_id,
          category: item.category, name: item.name, size: item.size, unit: item.unit,
          quantity: item.quantity, planned_unit_cost: item.planned_unit_cost,
          actual_unit_cost: item.actual_unit_cost, actual_amount: item.actual_amount,
          is_extra: item.is_extra, memo: item.memo,
        }))))
      } else if (c.estimate_id) {
        const full = await fetchEstimateFull(c.estimate_id)
        // 실제 진행된(수량이 있는) 품목만 정산 대상으로 가져온다 — 견적에만 있고
        // 실제로는 쓰이지 않은 품목까지 정산서에 끌려오지 않도록 한다.
        const usedItems = full.items.filter((item) => item.quantity > 0)
        setRows(sortRowsByCategoryOrder(usedItems.map((item) => toRow({
          estimate_item_id: item.id,
          category: item.category, name: item.name, size: item.size || '', unit: item.unit,
          quantity: item.quantity, planned_unit_cost: item.execution_unit_cost,
          actual_unit_cost: item.execution_unit_cost, actual_amount: item.execution_unit_cost * item.quantity,
          is_extra: false, memo: '',
        }))))
      } else {
        setRows([])
      }
    } finally {
      setLoading(false)
    }
  }, [contractId])

  useEffect(() => { load() }, [load])

  const updateRow = (key: string, patch: Partial<SettlementItemDraft>) => {
    setRows((prev) => prev.map((r) => {
      if (r.key !== key) return r
      const next = { ...r, ...patch }
      if (patch.quantity !== undefined || patch.actual_unit_cost !== undefined) {
        next.actual_amount = next.quantity * next.actual_unit_cost
      }
      return next
    }))
    setSaved(false)
  }

  const addExtraRow = () => { setRows((prev) => [...prev, emptyExtraRow()]); setSaved(false) }
  const removeRow = (key: string) => { setRows((prev) => prev.filter((r) => r.key !== key)); setSaved(false) }

  const actualTotalCost = rows.reduce((sum, r) => sum + r.actual_amount, 0)
  const revenue = contract?.total_amount || 0
  const actualProfit = revenue - actualTotalCost
  const actualProfitRate = revenue !== 0 ? actualProfit / revenue : 0

  const handlePrint = () => {
    if (!contract) return
    const itemRows = rows.map((row, i) => `
      <tr>
        <td style="border:1px solid #ddd;padding:7px 8px;text-align:center">${i + 1}</td>
        <td style="border:1px solid #ddd;padding:7px 8px">${row.category}</td>
        <td style="border:1px solid #ddd;padding:7px 8px">${row.name}</td>
        <td style="border:1px solid #ddd;padding:7px 8px;text-align:center">${row.quantity.toLocaleString()}</td>
        <td style="border:1px solid #ddd;padding:7px 8px;text-align:center">${row.unit}</td>
        <td style="border:1px solid #ddd;padding:7px 8px;text-align:right">${row.is_extra ? '-' : row.planned_unit_cost.toLocaleString()}</td>
        <td style="border:1px solid #ddd;padding:7px 8px;text-align:right">${row.actual_unit_cost.toLocaleString()}</td>
        <td style="border:1px solid #ddd;padding:7px 8px;text-align:right;font-weight:600">${row.actual_amount.toLocaleString()}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>최종정산서 - ${contract.contract_number}</title>
<style>
  @page { margin: 18mm; }
  body { font-family: 'Malgun Gothic', sans-serif; font-size: 13px; color: #1e293b; }
  .header { text-align: center; margin-bottom: 24px; }
  .title { font-size: 26px; font-weight: 700; letter-spacing: 8px; border-bottom: 3px solid #1e293b; padding-bottom: 10px; margin-bottom: 18px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 40px; margin-bottom: 20px; }
  .info-row { display: flex; gap: 8px; padding: 4px 0; border-bottom: 1px dashed #e2e8f0; }
  .info-label { color: #64748b; min-width: 72px; font-size: 12px; }
  .info-value { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  thead th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
  .summary-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; text-align: center; }
  .summary-label { font-size: 11px; color: #94a3b8; }
  .summary-value { font-size: 15px; font-weight: 700; margin-top: 4px; }
  .profit-negative { color: #dc2626; }
  .profit-positive { color: #6d28d9; }
  .notes-section { margin-top: 16px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; min-height: 50px; }
  .notes-label { font-size: 11px; color: #94a3b8; margin-bottom: 4px; }
  .footer { margin-top: 40px; text-align: right; color: #94a3b8; font-size: 11px; }
</style>
</head>
<body>
<div class="header">
  <div class="title">최 &nbsp; 종 &nbsp; 정 &nbsp; 산 &nbsp; 서</div>
</div>
<div class="info-grid">
  <div>
    <div class="info-row"><span class="info-label">고객사</span><span class="info-value">${contract.client_name}</span></div>
    <div class="info-row"><span class="info-label">전시회</span><span class="info-value">${contract.exhibition_name || '-'}</span></div>
  </div>
  <div>
    <div class="info-row"><span class="info-label">계약번호</span><span class="info-value">${contract.contract_number}</span></div>
    <div class="info-row"><span class="info-label">계약일</span><span class="info-value">${contract.contract_date ? contract.contract_date.replace(/-/g, '.') : '-'}</span></div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:32px">No.</th>
      <th style="width:80px">분류</th>
      <th>품목명</th>
      <th style="width:50px">수량</th>
      <th style="width:44px">단위</th>
      <th style="width:90px">계획단가</th>
      <th style="width:90px">실제단가</th>
      <th style="width:100px">실제금액</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows || '<tr><td colspan="8" style="border:1px solid #ddd;padding:20px;text-align:center;color:#94a3b8">품목 없음</td></tr>'}
  </tbody>
</table>

<div class="summary">
  <div class="summary-box"><div class="summary-label">계약금액 (매출)</div><div class="summary-value">${revenue.toLocaleString()}원</div></div>
  <div class="summary-box"><div class="summary-label">실제 총 비용</div><div class="summary-value">${actualTotalCost.toLocaleString()}원</div></div>
  <div class="summary-box"><div class="summary-label">실제 수익</div><div class="summary-value ${actualProfit < 0 ? 'profit-negative' : ''}">${actualProfit.toLocaleString()}원</div></div>
  <div class="summary-box"><div class="summary-label">실제 수익률</div><div class="summary-value ${actualProfitRate < 0 ? 'profit-negative' : 'profit-positive'}">${(actualProfitRate * 100).toFixed(1)}%</div></div>
</div>

${notes ? `<div class="notes-section"><div class="notes-label">비고</div>${notes}</div>` : ''}

<div class="footer">발행일: ${new Date().toLocaleDateString('ko-KR')} &nbsp;|&nbsp; ${ASO_COMPANY_INFO.name}</div>
</body>
</html>`

    const w = window.open('', '_blank', 'width=900,height=1000')
    if (!w) return
    w.document.write(html)
    w.document.close()
    setTimeout(() => { w.print() }, 400)
  }

  const handleSave = async () => {
    if (!contractId) return
    setSaving(true)
    try {
      await saveSettlement(
        contractId,
        estimateId,
        notes,
        rows.map(({ key: _key, ...draft }) => draft)
      )
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-4 md:p-6 text-center text-slate-400 py-20">불러오는 중...</div>
  }

  if (!contract) {
    return <div className="p-4 md:p-6 text-center text-slate-400 py-20">계약서를 찾을 수 없습니다.</div>
  }

  const inputCls = 'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400'

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={() => navigate('/contracts')}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-2">
            <ArrowLeft size={13} />목록으로
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">최종 정산서</h1>
          <p className="text-slate-500 text-sm mt-0.5">{contract.client_name} · {contract.contract_number}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors">
            <Printer size={15} />인쇄 / PDF저장
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors shadow-sm disabled:opacity-50">
            <Save size={15} />{saving ? '저장 중...' : saved ? '저장됨' : '저장'}
          </button>
        </div>
      </div>

      {estimateId && (
        <Link to={`/estimates/${estimateId}`}
          className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:underline">
          <FileText size={14} />연동된 견적서 보기
        </Link>
      )}

      {/* 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400">계약금액 (매출)</p>
          <p className="text-lg font-bold text-slate-800 mt-1">{formatKRW(revenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400">실제 총 비용</p>
          <p className="text-lg font-bold text-slate-800 mt-1">{formatKRW(actualTotalCost)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400">실제 수익</p>
          <p className={`text-lg font-bold mt-1 ${actualProfit < 0 ? 'text-red-600' : 'text-slate-800'}`}>{formatKRW(actualProfit)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400">실제 수익률</p>
          <p className={`text-lg font-bold mt-1 ${actualProfitRate < 0 ? 'text-red-600' : 'text-violet-700'}`}>{formatPercent(actualProfitRate)}</p>
        </div>
      </div>

      {/* 품목별 실제 비용 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">품목별 실제 비용</h2>
          <button onClick={addExtraRow}
            className="flex items-center gap-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={13} />추가 비용 항목
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs">분류</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs">품목명</th>
                <th className="text-center px-2 py-2.5 font-semibold text-slate-600 text-xs w-16">수량</th>
                <th className="text-center px-2 py-2.5 font-semibold text-slate-600 text-xs w-16">단위</th>
                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 text-xs w-28">계획단가</th>
                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 text-xs w-28">실제단가</th>
                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 text-xs w-28">실제금액</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400 text-sm">
                  연동된 견적서가 없습니다. 추가 비용 항목으로 직접 입력해주세요.
                </td></tr>
              ) : rows.map((row) => (
                <tr key={row.key} className={row.is_extra ? 'bg-amber-50/40' : ''}>
                  {row.is_extra ? (
                    <>
                      <td className="px-2 py-1.5">
                        <input value={row.category} onChange={(e) => updateRow(row.key, { category: e.target.value })}
                          placeholder="분류" className={inputCls} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={row.name} onChange={(e) => updateRow(row.key, { name: e.target.value })}
                          placeholder="품목명" className={inputCls} />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-slate-600">{row.category}</td>
                      <td className="px-3 py-2 min-w-[140px] font-medium text-slate-800">{row.name}</td>
                    </>
                  )}
                  <td className="px-2 py-1.5">
                    <input type="number" value={row.quantity} min="0"
                      onChange={(e) => updateRow(row.key, { quantity: Number(e.target.value) || 0 })}
                      className={`${inputCls} text-center`} />
                  </td>
                  <td className="px-2 py-1.5">
                    {row.is_extra ? (
                      <input value={row.unit} onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                        className={`${inputCls} text-center`} />
                    ) : (
                      <span className="block text-center text-slate-500">{row.unit}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400 whitespace-nowrap">
                    {row.is_extra ? '-' : formatKRW(row.planned_unit_cost)}
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" value={row.actual_unit_cost} min="0"
                      onChange={(e) => updateRow(row.key, { actual_unit_cost: Number(e.target.value) || 0 })}
                      className={`${inputCls} text-right`} />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">
                    {formatKRW(row.actual_amount)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {row.is_extra && (
                      <button onClick={() => removeRow(row.key)} className="text-slate-300 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={6} className="px-3 py-3 text-right font-bold text-slate-700">실제 총 비용 합계</td>
                  <td className="px-3 py-3 text-right font-bold text-violet-700 whitespace-nowrap">{formatKRW(actualTotalCost)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 비고 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <label className="block text-xs font-medium text-slate-600 mb-1">비고</label>
        <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false) }} rows={3}
          placeholder="정산 관련 참고사항을 입력하세요"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
      </div>
    </div>
  )
}
