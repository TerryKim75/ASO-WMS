import { Printer } from 'lucide-react'
import { formatKRW } from '../../lib/format'
import { ASO_COMPANY_INFO } from '../../lib/companyInfo'

export interface ContractPrintData {
  contract_number: string
  client_name: string
  client_contact?: string
  client_business_number?: string
  client_representative?: string
  client_address?: string
  exhibition_name?: string
  venue?: string
  booth_size?: string
  install_date?: string
  dismantle_date?: string
  total_amount: number
  contract_date?: string
  payment_terms?: string
  special_terms?: string
}

interface Props {
  data: ContractPrintData
}

function formatDate(date?: string) {
  if (!date) return '-'
  return date.split('T')[0].replace(/-/g, '.')
}

const GENERAL_TERMS = [
  '1. "을"은 계약된 내용과 일정에 따라 전시부스 시공을 성실히 수행한다.',
  '2. "갑"은 계약금액을 본 계약서에 명시된 지급조건에 따라 지급한다.',
  '3. 천재지변, 전시장 사정 등 불가항력적 사유로 인한 일정 변경 시 "갑"과 "을"은 상호 협의하여 조정한다.',
  '4. 계약 체결 후 "갑"의 사정으로 계약을 해지하는 경우, 기시공 및 기투입 비용은 "갑"이 부담한다.',
  '5. 본 계약서에 명시되지 않은 사항은 관계 법령 및 일반 상관례에 따른다.',
].join('\n')

function buildPrintHtml(data: ContractPrintData) {
  const logoUrl = `${window.location.origin}/images/aso-logo.png`

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
  <title>계약서 - ${data.contract_number}</title>
  <style>
    @page { margin: 20mm; }
    body { font-family: 'Malgun Gothic', sans-serif; font-size: 13px; color: #1e293b; }
    .doc-header { display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 3px solid #1e293b; padding-bottom: 12px; margin-bottom: 20px; }
    .brand img { height: 32px; display: block; }
    .brand .address { margin-top: 4px; font-size: 10px; color: #94a3b8; }
    .title { font-size: 24px; font-weight: 700; letter-spacing: 6px; }
    .sub { text-align: center; color: #64748b; font-size: 12px; margin-bottom: 18px; }
    table.parties { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    table.parties th, table.parties td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 12px; }
    table.parties th { background: #f1f5f9; font-weight: 600; width: 90px; text-align: left; }
    table.parties td.party-title { background: #eef2ff; font-weight: 700; text-align: center; width: 60px; }
    section { margin-bottom: 14px; }
    .article-title { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
    .article-body { font-size: 12px; color: #334155; white-space: pre-wrap; line-height: 1.5; }
    .amount-box { font-size: 18px; font-weight: 700; text-align: center; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 4px; }
    .sign-block { margin-top: 28px; display: flex; justify-content: space-between; gap: 24px; }
    .sign-col { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px; }
    .sign-col .role { font-weight: 700; margin-bottom: 8px; }
    .sign-row { display: flex; padding: 3px 0; font-size: 12px; }
    .sign-label { color: #64748b; width: 64px; flex-shrink: 0; }
    .sign-stamp { text-align: right; margin-top: 10px; font-size: 12px; color: #64748b; }
  </style></head><body>
  <div class="doc-header">
    <div class="brand">
      <img src="${logoUrl}" alt="ASO" />
      <div class="address">${ASO_COMPANY_INFO.address}</div>
    </div>
    <div class="title">계 &nbsp; 약 &nbsp; 서</div>
  </div>
  <p class="sub">계약번호: ${data.contract_number} &nbsp;|&nbsp; 계약일자: ${formatDate(data.contract_date)}</p>

  <table class="parties">
    <tr><td class="party-title" rowspan="4">갑<br/>(발주처)</td><th>상호</th><td>${data.client_name}</td></tr>
    <tr><th>사업자번호</th><td>${data.client_business_number || '-'}</td></tr>
    <tr><th>대표자</th><td>${data.client_representative || '-'}</td></tr>
    <tr><th>주소/연락처</th><td>${data.client_address || '-'} ${data.client_contact ? `(${data.client_contact})` : ''}</td></tr>
    <tr><td class="party-title" rowspan="4">을<br/>(시공사)</td><th>상호</th><td>${ASO_COMPANY_INFO.name}</td></tr>
    <tr><th>사업자번호</th><td>${ASO_COMPANY_INFO.businessNumber}</td></tr>
    <tr><th>대표자</th><td>${ASO_COMPANY_INFO.representative}</td></tr>
    <tr><th>주소/연락처</th><td>${ASO_COMPANY_INFO.address} (${ASO_COMPANY_INFO.phone})</td></tr>
  </table>

  <section>
    <div class="article-title">제1조 (계약의 목적)</div>
    <div class="article-body">"갑"과 "을"은 아래 전시회 부스 시공에 관하여 다음과 같이 계약을 체결한다.

전시회명: ${data.exhibition_name || '-'}
전시장: ${data.venue || '-'}
부스 면적: ${data.booth_size || '-'}
설치일: ${formatDate(data.install_date)}   철거일: ${formatDate(data.dismantle_date)}</div>
  </section>

  <section>
    <div class="article-title">제2조 (계약금액)</div>
    <div class="amount-box">일금 ${formatKRW(data.total_amount)} (VAT 포함)</div>
  </section>

  <section>
    <div class="article-title">제3조 (지급조건)</div>
    <div class="article-body">${data.payment_terms || '-'}</div>
  </section>

  ${data.special_terms ? `<section>
    <div class="article-title">제4조 (특약사항)</div>
    <div class="article-body">${data.special_terms}</div>
  </section>` : ''}

  <section>
    <div class="article-title">제${data.special_terms ? '5' : '4'}조 (일반사항)</div>
    <div class="article-body">${GENERAL_TERMS}</div>
  </section>

  <p style="text-align:center;font-size:12px;color:#475569;margin-top:20px">
    위와 같이 계약을 체결하고 이를 증명하기 위하여 계약서 2부를 작성, 각 1부씩 보관한다.
  </p>

  <div class="sign-block">
    <div class="sign-col">
      <div class="role">갑 (발주처)</div>
      <div class="sign-row"><span class="sign-label">상호</span><span>${data.client_name}</span></div>
      <div class="sign-row"><span class="sign-label">대표자</span><span>${data.client_representative || '-'}</span></div>
      <div class="sign-stamp">서명/날인: ______________ (인)</div>
    </div>
    <div class="sign-col">
      <div class="role">을 (시공사)</div>
      <div class="sign-row"><span class="sign-label">상호</span><span>${ASO_COMPANY_INFO.name}</span></div>
      <div class="sign-row"><span class="sign-label">대표자</span><span>${ASO_COMPANY_INFO.representative}</span></div>
      <div class="sign-stamp">서명/날인: ______________ (인)</div>
    </div>
  </div>
  </body></html>`
}

export default function CustomerContractView({ data }: Props) {
  const handlePrint = () => {
    const html = buildPrintHtml(data)
    const win = window.open('', '_blank', 'width=800,height=900')
    if (!win) { alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.'); return }
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 400)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 gap-3 flex-wrap">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">고객 제출용 계약서 미리보기</p>
        <button onClick={handlePrint}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors">
          <Printer size={13} />인쇄 / PDF 저장
        </button>
      </div>

      <div className="p-5 md:p-8 space-y-5">
        <div className="flex items-end justify-between border-b-4 border-slate-800 pb-3">
          <div>
            <img src="/images/aso-logo.png" alt="ASO" className="h-8 w-auto" />
            <p className="text-[11px] text-slate-400 mt-1">{ASO_COMPANY_INFO.address}</p>
          </div>
          <h2 className="text-2xl font-bold tracking-[0.3em] text-slate-800">계 약 서</h2>
        </div>
        <p className="text-center text-xs text-slate-400">
          계약번호 {data.contract_number} · 계약일자 {formatDate(data.contract_date)}
        </p>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td rowSpan={4} className="bg-indigo-50 text-center font-bold w-14 px-2 text-xs">갑<br />(발주처)</td>
                <td className="bg-slate-50 text-xs text-slate-500 w-24 px-3 py-1.5">상호</td>
                <td className="px-3 py-1.5">{data.client_name}</td>
              </tr>
              <tr>
                <td className="bg-slate-50 text-xs text-slate-500 px-3 py-1.5">사업자번호</td>
                <td className="px-3 py-1.5">{data.client_business_number || '-'}</td>
              </tr>
              <tr>
                <td className="bg-slate-50 text-xs text-slate-500 px-3 py-1.5">대표자</td>
                <td className="px-3 py-1.5">{data.client_representative || '-'}</td>
              </tr>
              <tr>
                <td className="bg-slate-50 text-xs text-slate-500 px-3 py-1.5">주소/연락처</td>
                <td className="px-3 py-1.5">{data.client_address || '-'} {data.client_contact && `(${data.client_contact})`}</td>
              </tr>
              <tr>
                <td rowSpan={4} className="bg-indigo-50 text-center font-bold w-14 px-2 text-xs">을<br />(시공사)</td>
                <td className="bg-slate-50 text-xs text-slate-500 px-3 py-1.5">상호</td>
                <td className="px-3 py-1.5">{ASO_COMPANY_INFO.name}</td>
              </tr>
              <tr>
                <td className="bg-slate-50 text-xs text-slate-500 px-3 py-1.5">사업자번호</td>
                <td className="px-3 py-1.5">{ASO_COMPANY_INFO.businessNumber}</td>
              </tr>
              <tr>
                <td className="bg-slate-50 text-xs text-slate-500 px-3 py-1.5">대표자</td>
                <td className="px-3 py-1.5">{ASO_COMPANY_INFO.representative}</td>
              </tr>
              <tr>
                <td className="bg-slate-50 text-xs text-slate-500 px-3 py-1.5">주소/연락처</td>
                <td className="px-3 py-1.5">{ASO_COMPANY_INFO.address} ({ASO_COMPANY_INFO.phone})</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <p className="font-semibold text-sm text-slate-800 mb-1">제1조 (계약의 목적)</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            "갑"과 "을"은 아래 전시회 부스 시공에 관하여 계약을 체결한다.<br />
            전시회명: {data.exhibition_name || '-'} · 전시장: {data.venue || '-'} · 부스 면적: {data.booth_size || '-'}<br />
            설치일: {formatDate(data.install_date)} &nbsp; 철거일: {formatDate(data.dismantle_date)}
          </p>
        </div>

        <div>
          <p className="font-semibold text-sm text-slate-800 mb-1">제2조 (계약금액)</p>
          <div className="text-center text-lg font-bold py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            일금 {formatKRW(data.total_amount)} (VAT 포함)
          </div>
        </div>

        <div>
          <p className="font-semibold text-sm text-slate-800 mb-1">제3조 (지급조건)</p>
          <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed">{data.payment_terms || '-'}</p>
        </div>

        {data.special_terms && (
          <div>
            <p className="font-semibold text-sm text-slate-800 mb-1">제4조 (특약사항)</p>
            <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed">{data.special_terms}</p>
          </div>
        )}

        <div>
          <p className="font-semibold text-sm text-slate-800 mb-1">제{data.special_terms ? '5' : '4'}조 (일반사항)</p>
          <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed">{GENERAL_TERMS}</p>
        </div>

        <p className="text-center text-xs text-slate-400 pt-2">
          위와 같이 계약을 체결하고 이를 증명하기 위하여 계약서 2부를 작성, 각 1부씩 보관한다.
        </p>

        <div className="grid grid-cols-2 gap-4 pt-1">
          <div className="border border-slate-200 rounded-lg p-3">
            <p className="font-semibold text-sm mb-1.5">갑 (발주처)</p>
            <p className="text-xs text-slate-500">상호: {data.client_name}</p>
            <p className="text-xs text-slate-500">대표자: {data.client_representative || '-'}</p>
            <p className="text-xs text-slate-400 text-right mt-2">서명/날인: ______________ (인)</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-3">
            <p className="font-semibold text-sm mb-1.5">을 (시공사)</p>
            <p className="text-xs text-slate-500">상호: {ASO_COMPANY_INFO.name}</p>
            <p className="text-xs text-slate-500">대표자: {ASO_COMPANY_INFO.representative}</p>
            <p className="text-xs text-slate-400 text-right mt-2">서명/날인: ______________ (인)</p>
          </div>
        </div>
      </div>
    </div>
  )
}
