import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save } from 'lucide-react'
import {
  generateEstimateNumber, fetchEstimateFull, saveEstimate, saveCustomItemToMaster,
  fetchItemMaster, fetchPricingPolicies, fetchRiskOptions,
} from '../lib/estimateActions'
import {
  calculateEstimateTotals, deriveMarginRate, type DiscountValueType, type MarginPolicy,
} from '../lib/estimateCalculations'
import EstimateItemsAccordion from '../components/estimates/EstimateItemsAccordion'
import EstimateAdjustmentsPanel from '../components/estimates/EstimateAdjustmentsPanel'
import EstimateSummaryPanel from '../components/estimates/EstimateSummaryPanel'
import type {
  ClientType, EstimateStatus, EstimateItem, ItemMaster, PricingPolicy, RiskOption,
} from '../types'

const DEFAULT_INCLUDED_SCOPE = [
  '명시된 부스 구조물 제작 및 설치', '명시된 그래픽 제작 및 설치', '명시된 조명 및 전기 작업',
  '명시된 가구 및 비품', '기본 운송 및 현장 설치', '철거 작업', '기본 프로젝트 관리',
].map((s) => `- ${s}`).join('\n')

const DEFAULT_EXCLUDED_SCOPE = [
  '주최사 또는 전시장에 직접 납부하는 비용', '추가 전기 신청비', '인터넷 신청비',
  '급배수 및 압축공기 신청비', '추가 비품', '고객 요청에 따른 현장 추가 작업',
  '디자인 확정 후 변경 비용', '그래픽 자료 지연으로 인한 긴급 출력비', '야간 작업 추가비', '주차비 및 현장 추가 비용',
].map((s) => `- ${s}`).join('\n')

const DEFAULT_CUSTOMER_NOTES = [
  '본 견적은 견적일 기준으로 산정되었으며, 자재비 및 전시장 규정 변경에 따라 변동될 수 있습니다.',
  '본 견적에 명시되지 않은 주최사 지정 비용, 전시장 신청 비용, 추가 비품 및 현장 추가 요청 사항은 별도입니다.',
  '디자인, 사양, 수량, 설치 일정 변경 시 견적 금액은 조정될 수 있습니다.',
  '본 견적의 유효기간은 발행일로부터 14일입니다.',
  '계약 확정 후 고객 사유로 인한 변경, 취소, 지연 발생 시 추가 비용이 청구될 수 있습니다.',
].join('\n')

function itemKey(category: string, name: string, size?: string) {
  return `${category}|||${name}|||${size || ''}`
}

function plusDaysStr(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface EstimateInfoState {
  estimate_number: string
  client_type: ClientType
  client_name: string
  client_contact: string
  exhibition_name: string
  venue: string
  booth_size: string
  booth_type: string
  install_date: string
  dismantle_date: string
  pm: string
  valid_until: string
  status: EstimateStatus
  notes: string
  customer_notes: string
  payment_terms: string
  included_scope: string
  excluded_scope: string
}

const emptyInfo = (): EstimateInfoState => ({
  estimate_number: '',
  client_type: '기획사용',
  client_name: '',
  client_contact: '',
  exhibition_name: '',
  venue: '',
  booth_size: '',
  booth_type: '',
  install_date: '',
  dismantle_date: '',
  pm: '',
  valid_until: plusDaysStr(14),
  status: '작성중',
  notes: '',
  customer_notes: DEFAULT_CUSTOMER_NOTES,
  payment_terms: '',
  included_scope: DEFAULT_INCLUDED_SCOPE,
  excluded_scope: DEFAULT_EXCLUDED_SCOPE,
})

const inputCls =
  'border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent'

export default function EstimateForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [info, setInfo] = useState<EstimateInfoState>(emptyInfo())
  const [items, setItems] = useState<EstimateItem[]>([])
  const [pricingPolicies, setPricingPolicies] = useState<PricingPolicy[]>([])
  const [riskOptions, setRiskOptions] = useState<RiskOption[]>([])
  const [selectedRiskIds, setSelectedRiskIds] = useState<Set<string>>(new Set())
  const [overheadRate, setOverheadRate] = useState(0.05)
  const [overheadLabel, setOverheadLabel] = useState('제작관리비')
  const [discountType, setDiscountType] = useState<DiscountValueType>('rate')
  const [discountValue, setDiscountValue] = useState(0)

  // 견적단가(품목마스터)에 등록된 실행단가/견적단가를 그대로 시드한다.
  const seedItemsFromMaster = useCallback((master: ItemMaster[]): EstimateItem[] => {
    return master.map((m) => ({
      id: crypto.randomUUID(),
      estimate_id: '',
      item_master_id: m.id,
      category: m.category,
      name: m.name,
      size: m.size,
      description: m.description,
      unit: m.unit,
      execution_unit_cost: m.default_execution_unit_cost,
      quantity: 0,
      margin_rate: deriveMarginRate(m.default_execution_unit_cost, m.quoted_unit_price),
      execution_total: 0,
      quoted_unit_price: m.quoted_unit_price,
      quoted_amount: 0,
      show_to_client: true,
      is_custom: false,
      sort_order: m.sort_order,
      created_at: '',
    }))
  }, [])

  // 고객유형 전환 시: 이미 입력한 수량은 유지하되, 실행단가/견적단가는 새 고객유형의
  // 견적단가로 교체한다. 새 고객유형에만 있는 품목은 수량 0으로 추가되고, 커스텀 항목은
  // 그대로 둔다.
  const resyncItemsForClientType = useCallback(async (clientType: ClientType) => {
    const master = await fetchItemMaster(clientType)
    const masterByKey = new Map(master.map((m) => [itemKey(m.category, m.name, m.size), m]))

    setItems((prev) => {
      const existingKeys = new Set(
        prev.filter((i) => !i.is_custom).map((i) => itemKey(i.category, i.name, i.size))
      )
      const updated = prev.map((item) => {
        if (item.is_custom) return item
        const match = masterByKey.get(itemKey(item.category, item.name, item.size))
        if (!match) return item
        return {
          ...item,
          item_master_id: match.id,
          execution_unit_cost: match.default_execution_unit_cost,
          quoted_unit_price: match.quoted_unit_price,
          margin_rate: deriveMarginRate(match.default_execution_unit_cost, match.quoted_unit_price),
        }
      })
      const missing = master.filter((m) => !existingKeys.has(itemKey(m.category, m.name, m.size)))
      const newRows = seedItemsFromMaster(missing)
      return [...updated, ...newRows]
    })
  }, [seedItemsFromMaster])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [policies, risks] = await Promise.all([fetchPricingPolicies(), fetchRiskOptions()])
        setPricingPolicies(policies)
        setRiskOptions(risks)

        if (isEdit && id) {
          const full = await fetchEstimateFull(id)
          setInfo({
            estimate_number: full.estimate.estimate_number,
            client_type: full.estimate.client_type,
            client_name: full.estimate.client_name,
            client_contact: full.estimate.client_contact || '',
            exhibition_name: full.estimate.exhibition_name || '',
            venue: full.estimate.venue || '',
            booth_size: full.estimate.booth_size || '',
            booth_type: full.estimate.booth_type || '',
            install_date: full.estimate.install_date || '',
            dismantle_date: full.estimate.dismantle_date || '',
            pm: full.estimate.pm || '',
            valid_until: full.estimate.valid_until || '',
            status: full.estimate.status,
            notes: full.estimate.notes || '',
            customer_notes: full.estimate.customer_notes || '',
            payment_terms: full.estimate.payment_terms || '',
            included_scope: full.estimate.included_scope || '',
            excluded_scope: full.estimate.excluded_scope || '',
          })
          setItems(full.items)
          const overhead = full.adjustments.find((a) => a.adjustment_type === 'overhead')
          const discount = full.adjustments.find((a) => a.adjustment_type === 'discount')
          if (overhead) { setOverheadRate(overhead.value); setOverheadLabel(overhead.label || '제작관리비') }
          if (discount) { setDiscountType(discount.value_type); setDiscountValue(discount.value) }
          setSelectedRiskIds(new Set(full.risks.map((r) => r.risk_option_id).filter(Boolean) as string[]))
        } else {
          const defaultInfo = emptyInfo()
          const [number, master] = await Promise.all([
            generateEstimateNumber(), fetchItemMaster(defaultInfo.client_type),
          ])
          setInfo((prev) => ({ ...prev, estimate_number: number }))
          setItems(seedItemsFromMaster(master))
        }
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit])

  const overallPolicy: MarginPolicy = useMemo(() => {
    const p = pricingPolicies.find((p) => p.client_type === info.client_type && p.category === 'OVERALL')
    return p || { default_margin_rate: 0, min_margin_rate: 0, max_margin_rate: 1 }
  }, [pricingPolicies, info.client_type])

  const totals = useMemo(() => {
    return calculateEstimateTotals({
      items: items.map((i) => ({
        execution_unit_cost: i.execution_unit_cost, quantity: i.quantity, quoted_unit_price: i.quoted_unit_price,
      })),
      overheadRate,
      selectedRiskRates: riskOptions.filter((r) => selectedRiskIds.has(r.id)).map((r) => r.default_rate),
      discountType,
      discountValue,
      vatRate: 0.1,
      overallPolicy,
    })
  }, [items, overheadRate, riskOptions, selectedRiskIds, discountType, discountValue, overallPolicy])

  // 고객유형별로 견적단가(품목마스터)가 분리되어 있으므로, 전환 시 수량은 유지한 채
  // 실행단가/견적단가만 새 고객유형 기준으로 다시 불러온다.
  const handleClientTypeChange = (clientType: ClientType) => {
    if (clientType === info.client_type) return
    setInfo((prev) => ({ ...prev, client_type: clientType }))
    resyncItemsForClientType(clientType)
  }

  const handleChangeItem = (itemId: string, patch: Partial<EstimateItem>) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)))
  }

  const handleAddCustomItem = (category: string) => {
    const newItem: EstimateItem = {
      id: crypto.randomUUID(),
      estimate_id: '',
      category,
      name: '',
      unit: '개',
      execution_unit_cost: 0,
      quantity: 1,
      margin_rate: 0,
      execution_total: 0,
      quoted_unit_price: 0,
      quoted_amount: 0,
      show_to_client: true,
      is_custom: true,
      sort_order: 999,
      created_at: '',
    }
    setItems((prev) => [...prev, newItem])
  }

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId))
  }

  const handleSaveItemToMaster = async (itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    if (!item || !item.name.trim()) { alert('항목명을 입력한 후 저장해주세요.'); return }
    try {
      await saveCustomItemToMaster({
        client_type: info.client_type,
        category: item.category,
        name: item.name,
        size: item.size,
        description: item.description,
        unit: item.unit,
        execution_unit_cost: item.execution_unit_cost,
        quoted_unit_price: item.quoted_unit_price,
      })
      alert('견적단가에 저장되었습니다.')
    } catch {
      alert('저장에 실패했습니다. (동일한 이름/상세내용의 품목이 이미 있을 수 있습니다)')
    }
  }

  const handleSave = async () => {
    if (!info.client_name.trim()) { alert('고객명을 입력해주세요.'); return }
    setSaving(true)
    try {
      const reviewRequired = totals.margin.isBelowMinimum
      const estimateId = await saveEstimate({
        estimate: {
          id: isEdit ? id : undefined,
          estimate_number: info.estimate_number,
          client_type: info.client_type,
          client_name: info.client_name.trim(),
          client_contact: info.client_contact || undefined,
          exhibition_name: info.exhibition_name || undefined,
          venue: info.venue || undefined,
          booth_size: info.booth_size || undefined,
          booth_type: info.booth_type || undefined,
          install_date: info.install_date || undefined,
          dismantle_date: info.dismantle_date || undefined,
          pm: info.pm || undefined,
          valid_until: info.valid_until || undefined,
          status: info.status,
          review_required: reviewRequired,
          vat_rate: 0.1,
          notes: info.notes || undefined,
          customer_notes: info.customer_notes || undefined,
          payment_terms: info.payment_terms || undefined,
          included_scope: info.included_scope || undefined,
          excluded_scope: info.excluded_scope || undefined,
          execution_total: totals.executionTotal,
          final_total_amount: totals.finalTotalAmount,
          expected_profit: totals.expectedProfit,
          final_profit_rate: totals.finalProfitRate,
        },
        items: items.map((i) => {
          const executionTotal = i.execution_unit_cost * i.quantity
          const quotedAmount = i.quoted_unit_price * i.quantity
          return {
            item_master_id: i.item_master_id,
            category: i.category,
            name: i.name,
            size: i.size,
            description: i.description,
            unit: i.unit,
            execution_unit_cost: i.execution_unit_cost,
            quantity: i.quantity,
            margin_rate: deriveMarginRate(executionTotal, quotedAmount),
            execution_total: executionTotal,
            quoted_unit_price: i.quoted_unit_price,
            quoted_amount: quotedAmount,
            show_to_client: i.show_to_client,
            supplier: i.supplier,
            memo: i.memo,
            is_custom: i.is_custom,
            sort_order: i.sort_order,
          }
        }),
        adjustments: [
          { adjustment_type: 'overhead', label: overheadLabel, value_type: 'rate', value: overheadRate },
          { adjustment_type: 'discount', label: undefined, value_type: discountType, value: discountValue },
        ],
        risks: riskOptions
          .filter((r) => selectedRiskIds.has(r.id))
          .map((r) => ({ risk_option_id: r.id, name: r.name, rate: r.default_rate })),
      })
      navigate(`/estimates/${estimateId}`)
    } catch (e) {
      console.error(e)
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-4 md:p-6 text-center text-slate-400 py-20">불러오는 중...</div>
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">{isEdit ? '견적서 수정' : '견적서 작성'}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{info.estimate_number}</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors shadow-sm disabled:opacity-50">
          <Save size={15} />{saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div className="space-y-4 md:space-y-5">
        {/* 기본 정보 */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">견적 기본 정보</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">고객 유형</label>
                <select value={info.client_type} onChange={(e) => handleClientTypeChange(e.target.value as ClientType)}
                  className={`${inputCls} w-full`}>
                  <option value="기획사용">기획사용</option>
                  <option value="참가사용">참가사용</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">고객명 *</label>
                <input value={info.client_name} onChange={(e) => setInfo({ ...info, client_name: e.target.value })}
                  className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">담당자 연락처</label>
                <input value={info.client_contact} onChange={(e) => setInfo({ ...info, client_contact: e.target.value })}
                  className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">전시회명</label>
                <input value={info.exhibition_name} onChange={(e) => setInfo({ ...info, exhibition_name: e.target.value })}
                  className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">전시장</label>
                <input value={info.venue} onChange={(e) => setInfo({ ...info, venue: e.target.value })}
                  className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">담당 PM</label>
                <input value={info.pm} onChange={(e) => setInfo({ ...info, pm: e.target.value })}
                  className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">부스 면적</label>
                <input value={info.booth_size} onChange={(e) => setInfo({ ...info, booth_size: e.target.value })}
                  placeholder="예: 30㎡" className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">부스 타입</label>
                <input value={info.booth_type} onChange={(e) => setInfo({ ...info, booth_type: e.target.value })}
                  placeholder="예: 독립부스" className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">상태</label>
                <select value={info.status} onChange={(e) => setInfo({ ...info, status: e.target.value as EstimateStatus })}
                  className={`${inputCls} w-full`}>
                  <option value="작성중">작성중</option>
                  <option value="발송완료">발송완료</option>
                  <option value="계약완료">계약완료</option>
                  <option value="취소">취소</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">설치일</label>
                <input type="date" value={info.install_date} onChange={(e) => setInfo({ ...info, install_date: e.target.value })}
                  className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">철거일</label>
                <input type="date" value={info.dismantle_date} onChange={(e) => setInfo({ ...info, dismantle_date: e.target.value })}
                  className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">견적 유효기간</label>
                <input type="date" value={info.valid_until} onChange={(e) => setInfo({ ...info, valid_until: e.target.value })}
                  className={`${inputCls} w-full`} />
              </div>
            </div>
          </div>

          {/* 카테고리별 품목 */}
          <EstimateItemsAccordion
            items={items}
            onChangeItem={handleChangeItem}
            onAddCustomItem={handleAddCustomItem}
            onRemoveItem={handleRemoveItem}
            onSaveItemToMaster={handleSaveItemToMaster}
          />

          {/* 조정 */}
          <EstimateAdjustmentsPanel
            overheadRate={overheadRate}
            overheadLabel={overheadLabel}
            onOverheadRateChange={setOverheadRate}
            onOverheadLabelChange={setOverheadLabel}
            riskOptions={riskOptions}
            selectedRiskIds={selectedRiskIds}
            onToggleRisk={(riskId) => setSelectedRiskIds((prev) => {
              const next = new Set(prev)
              if (next.has(riskId)) next.delete(riskId)
              else next.add(riskId)
              return next
            })}
            discountType={discountType}
            discountValue={discountValue}
            onDiscountTypeChange={setDiscountType}
            onDiscountValueChange={setDiscountValue}
          />

          {/* 견적서 문구 */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">견적서 문구 (고객 제출용에 표시)</p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">포함 사항</label>
              <textarea value={info.included_scope} onChange={(e) => setInfo({ ...info, included_scope: e.target.value })}
                rows={4} className={`${inputCls} w-full resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">불포함 사항</label>
              <textarea value={info.excluded_scope} onChange={(e) => setInfo({ ...info, excluded_scope: e.target.value })}
                rows={4} className={`${inputCls} w-full resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">결제 조건</label>
              <input value={info.payment_terms} onChange={(e) => setInfo({ ...info, payment_terms: e.target.value })}
                className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">비고 (고객용)</label>
              <textarea value={info.customer_notes} onChange={(e) => setInfo({ ...info, customer_notes: e.target.value })}
                rows={5} className={`${inputCls} w-full resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">내부 메모 (PM 전용, 고객 노출 안 됨)</label>
              <textarea value={info.notes} onChange={(e) => setInfo({ ...info, notes: e.target.value })}
                rows={2} className={`${inputCls} w-full resize-none`} />
            </div>
          </div>

        <EstimateSummaryPanel totals={totals} overheadLabel={overheadLabel} />
      </div>
    </div>
  )
}
