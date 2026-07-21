import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, Mail, ArrowLeft } from 'lucide-react'
import {
  generateContractNumber, fetchContract, saveContract, markInvoiceRequested,
} from '../lib/contractActions'
import { fetchEstimateList } from '../lib/estimateActions'
import { ASO_COMPANY_INFO, ACCOUNTING_EMAIL } from '../lib/companyInfo'
import { formatKRW } from '../lib/format'
import CustomerContractView from '../components/contracts/CustomerContractView'
import type { ContractStatus, Estimate } from '../types'

function plusDaysStr(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayStr() {
  return plusDaysStr(0)
}

function defaultPaymentTerms() {
  return [
    `결제 계좌: ${ASO_COMPANY_INFO.bankName} ${ASO_COMPANY_INFO.bankAccount} (예금주: ${ASO_COMPANY_INFO.bankHolder})`,
    '',
    '계약금 50% : 계약 체결 시',
    '잔금 50% : 설치 완료 후 7일 이내',
  ].join('\n')
}

interface ContractInfoState {
  contract_number: string
  estimate_id?: string
  client_name: string
  client_contact: string
  client_business_number: string
  client_representative: string
  client_address: string
  exhibition_name: string
  venue: string
  booth_size: string
  install_date: string
  dismantle_date: string
  total_amount: number
  contract_date: string
  payment_terms: string
  special_terms: string
  notes: string
  status: ContractStatus
  invoice_requested_at?: string
}

const emptyInfo = (): ContractInfoState => ({
  contract_number: '',
  estimate_id: undefined,
  client_name: '',
  client_contact: '',
  client_business_number: '',
  client_representative: '',
  client_address: '',
  exhibition_name: '',
  venue: '',
  booth_size: '',
  install_date: '',
  dismantle_date: '',
  total_amount: 0,
  contract_date: todayStr(),
  payment_terms: defaultPaymentTerms(),
  special_terms: '',
  notes: '',
  status: '작성중',
})

const inputCls =
  'border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent'

export default function ContractForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [info, setInfo] = useState<ContractInfoState>(emptyInfo())
  const [estimates, setEstimates] = useState<Estimate[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const estimateList = await fetchEstimateList()
        setEstimates(estimateList)

        if (isEdit && id) {
          const contract = await fetchContract(id)
          setInfo({
            contract_number: contract.contract_number,
            estimate_id: contract.estimate_id,
            client_name: contract.client_name,
            client_contact: contract.client_contact || '',
            client_business_number: contract.client_business_number || '',
            client_representative: contract.client_representative || '',
            client_address: contract.client_address || '',
            exhibition_name: contract.exhibition_name || '',
            venue: contract.venue || '',
            booth_size: contract.booth_size || '',
            install_date: contract.install_date || '',
            dismantle_date: contract.dismantle_date || '',
            total_amount: contract.total_amount,
            contract_date: contract.contract_date || todayStr(),
            payment_terms: contract.payment_terms || defaultPaymentTerms(),
            special_terms: contract.special_terms || '',
            notes: contract.notes || '',
            status: contract.status,
            invoice_requested_at: contract.invoice_requested_at,
          })
        } else {
          const number = await generateContractNumber()
          setInfo((prev) => ({ ...prev, contract_number: number }))
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, isEdit])

  const handleSelectEstimate = useCallback((estimateId: string) => {
    const estimate = estimates.find((e) => e.id === estimateId)
    if (!estimate) {
      setInfo((prev) => ({ ...prev, estimate_id: undefined }))
      return
    }
    setInfo((prev) => ({
      ...prev,
      estimate_id: estimate.id,
      client_name: estimate.client_name,
      client_contact: estimate.client_contact || prev.client_contact,
      exhibition_name: estimate.exhibition_name || prev.exhibition_name,
      venue: estimate.venue || prev.venue,
      booth_size: estimate.booth_size || prev.booth_size,
      install_date: estimate.install_date || prev.install_date,
      dismantle_date: estimate.dismantle_date || prev.dismantle_date,
      total_amount: estimate.final_total_amount,
    }))
  }, [estimates])

  const handleSave = async () => {
    if (!info.client_name.trim()) { alert('발주처명을 입력해주세요 (견적서를 먼저 불러와주세요).'); return }
    setSaving(true)
    try {
      const contractId = await saveContract({
        id: isEdit ? id : undefined,
        contract_number: info.contract_number,
        estimate_id: info.estimate_id,
        client_name: info.client_name.trim(),
        client_contact: info.client_contact || undefined,
        client_business_number: info.client_business_number || undefined,
        client_representative: info.client_representative || undefined,
        client_address: info.client_address || undefined,
        exhibition_name: info.exhibition_name || undefined,
        venue: info.venue || undefined,
        booth_size: info.booth_size || undefined,
        install_date: info.install_date || undefined,
        dismantle_date: info.dismantle_date || undefined,
        total_amount: info.total_amount,
        contract_date: info.contract_date || undefined,
        payment_terms: info.payment_terms || undefined,
        special_terms: info.special_terms || undefined,
        notes: info.notes || undefined,
        status: info.status,
        invoice_requested_at: info.invoice_requested_at,
      })
      if (!isEdit) {
        navigate(`/contracts/${contractId}/edit`)
      } else {
        alert('저장되었습니다.')
      }
    } catch (e) {
      console.error(e)
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleIssueInvoice = async () => {
    if (!isEdit || !id) { alert('먼저 계약서를 저장한 후 계산서 발행을 요청해주세요.'); return }
    if (!window.confirm('관리부에 계산서 발행을 요청하는 메일을 작성합니다. 진행하시겠습니까?')) return

    try {
      const requestedAt = await markInvoiceRequested(id)
      setInfo((prev) => ({ ...prev, status: '계산서요청', invoice_requested_at: requestedAt }))

      const subject = `[계산서 발행 요청] ${info.contract_number} - ${info.client_name}`
      const body = [
        '관리부 담당자님, 안녕하세요.',
        '아래 계약 건의 계산서 발행을 요청드립니다.',
        '',
        `계약번호: ${info.contract_number}`,
        `발주처: ${info.client_name}${info.client_business_number ? ` (사업자번호: ${info.client_business_number})` : ''}`,
        `전시회: ${info.exhibition_name || '-'}`,
        `계약금액: ${formatKRW(info.total_amount)} (VAT 포함)`,
        `계약일: ${info.contract_date || '-'}`,
        '',
        '감사합니다.',
      ].join('\n')

      window.location.href = `mailto:${ACCOUNTING_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    } catch (e) {
      console.error(e)
      alert('계산서 발행 요청 처리에 실패했습니다.')
    }
  }

  if (loading) {
    return <div className="p-4 md:p-6 text-center text-slate-400 py-20">불러오는 중...</div>
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={() => navigate('/contracts')}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-2">
            <ArrowLeft size={13} />목록으로
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">{isEdit ? '계약서 수정' : '계약서 작성'}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{info.contract_number}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleIssueInvoice}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors">
            <Mail size={15} />계산서 발행
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors shadow-sm disabled:opacity-50">
            <Save size={15} />{saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {info.invoice_requested_at && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Mail size={14} />
          계산서 발행이 {info.invoice_requested_at.split('T')[0].replace(/-/g, '.')}에 관리부로 요청되었습니다.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <div className="lg:col-span-2 space-y-4 md:space-y-5">
          {/* 견적서 불러오기 */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">견적서 불러오기</p>
            <select value={info.estimate_id || ''} onChange={(e) => handleSelectEstimate(e.target.value)}
              className={`${inputCls} w-full`}>
              <option value="">-- 견적서 선택 --</option>
              {estimates.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.estimate_number} · {e.client_name}{e.exhibition_name ? ` (${e.exhibition_name})` : ''} · {formatKRW(e.final_total_amount)}
                </option>
              ))}
            </select>
            {info.estimate_id && (
              <p className="text-xs text-slate-400 mt-2">견적서를 다시 선택하면 발주처/전시회/설치일/계약금액이 새로 덮어씌워집니다.</p>
            )}
          </div>

          {/* 발주처 정보 */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">발주처 정보</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">발주처명 *</label>
                <input value={info.client_name} onChange={(e) => setInfo({ ...info, client_name: e.target.value })}
                  className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">담당자 연락처</label>
                <input value={info.client_contact} onChange={(e) => setInfo({ ...info, client_contact: e.target.value })}
                  className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">사업자등록번호</label>
                <input value={info.client_business_number} onChange={(e) => setInfo({ ...info, client_business_number: e.target.value })}
                  placeholder="000-00-00000" className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">대표자</label>
                <input value={info.client_representative} onChange={(e) => setInfo({ ...info, client_representative: e.target.value })}
                  className={`${inputCls} w-full`} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">주소</label>
                <input value={info.client_address} onChange={(e) => setInfo({ ...info, client_address: e.target.value })}
                  className={`${inputCls} w-full`} />
              </div>
            </div>
          </div>

          {/* 시공사 정보 (고정) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">시공사 정보</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 text-sm">
              <div><span className="text-slate-400 text-xs block">상호</span>{ASO_COMPANY_INFO.name}</div>
              <div><span className="text-slate-400 text-xs block">대표자</span>{ASO_COMPANY_INFO.representative}</div>
              <div><span className="text-slate-400 text-xs block">사업자등록번호</span>{ASO_COMPANY_INFO.businessNumber}</div>
              <div><span className="text-slate-400 text-xs block">연락처</span>{ASO_COMPANY_INFO.phone}</div>
              <div className="col-span-2"><span className="text-slate-400 text-xs block">주소</span>{ASO_COMPANY_INFO.address}</div>
            </div>
          </div>

          {/* 전시회 / 설치 정보 */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">전시회 / 설치 정보</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                <label className="block text-xs font-medium text-slate-600 mb-1">부스 면적</label>
                <input value={info.booth_size} onChange={(e) => setInfo({ ...info, booth_size: e.target.value })}
                  placeholder="예: 30㎡" className={`${inputCls} w-full`} />
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
                <label className="block text-xs font-medium text-slate-600 mb-1">계약일</label>
                <input type="date" value={info.contract_date} onChange={(e) => setInfo({ ...info, contract_date: e.target.value })}
                  className={`${inputCls} w-full`} />
              </div>
            </div>
          </div>

          {/* 결제정보 / 특약사항 */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">결제정보 / 특약사항</p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">결제정보</label>
              <textarea value={info.payment_terms} onChange={(e) => setInfo({ ...info, payment_terms: e.target.value })}
                rows={5} className={`${inputCls} w-full resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">특약사항</label>
              <textarea value={info.special_terms} onChange={(e) => setInfo({ ...info, special_terms: e.target.value })}
                rows={3} className={`${inputCls} w-full resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">내부 메모</label>
              <textarea value={info.notes} onChange={(e) => setInfo({ ...info, notes: e.target.value })}
                rows={2} className={`${inputCls} w-full resize-none`} />
            </div>
          </div>
        </div>

        {/* 요약 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5 space-y-3 lg:sticky lg:top-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">계약 요약</p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">계약금액 (VAT 포함)</label>
              <input type="number" min="0" value={info.total_amount}
                onChange={(e) => setInfo({ ...info, total_amount: Number(e.target.value) || 0 })}
                className={`${inputCls} w-full text-right font-bold text-lg`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">상태</label>
              <select value={info.status} onChange={(e) => setInfo({ ...info, status: e.target.value as ContractStatus })}
                className={`${inputCls} w-full`}>
                <option value="작성중">작성중</option>
                <option value="발송완료">발송완료</option>
                <option value="서명완료">서명완료</option>
                <option value="계산서요청">계산서요청</option>
                <option value="완료">완료</option>
                <option value="취소">취소</option>
              </select>
            </div>
            <div className="pt-3 border-t border-slate-100 text-xs text-slate-400 space-y-1">
              <p>발주처: {info.client_name || '-'}</p>
              <p>전시회: {info.exhibition_name || '-'}</p>
              <p>계약일: {info.contract_date || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      <CustomerContractView
        data={{
          contract_number: info.contract_number,
          client_name: info.client_name || '-',
          client_contact: info.client_contact || undefined,
          client_business_number: info.client_business_number || undefined,
          client_representative: info.client_representative || undefined,
          client_address: info.client_address || undefined,
          exhibition_name: info.exhibition_name || undefined,
          venue: info.venue || undefined,
          booth_size: info.booth_size || undefined,
          install_date: info.install_date || undefined,
          dismantle_date: info.dismantle_date || undefined,
          total_amount: info.total_amount,
          contract_date: info.contract_date || undefined,
          payment_terms: info.payment_terms || undefined,
          special_terms: info.special_terms || undefined,
        }}
      />
    </div>
  )
}
