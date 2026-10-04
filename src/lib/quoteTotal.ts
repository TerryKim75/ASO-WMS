/**
 * 견적서 파일(PDF / 엑셀)에서 총계 금액을 추출한다.
 * - PDF: pdfjs로 텍스트를 뽑아 "총계/합계/총액" 등 키워드 뒤의 금액을 찾는다.
 * - 엑셀: 시트를 CSV로 변환해 같은 방식으로 찾는다.
 * - 이미지·스캔본처럼 텍스트가 없으면 null (호출부에서 직접 입력받는다).
 * 키워드 뒤 금액이 여러 개면 가장 큰 값(보통 VAT 포함 총액)을 쓴다.
 * 키워드를 못 찾으면(글꼴이 깨진 PDF 등) 문서의 천 단위 콤마 금액 중 가장 큰 값을 후보로 쓴다.
 */

const TOTAL_PATTERN =
  /(최\s*종\s*견\s*적\s*가|견\s*적\s*가|일\s*금|총\s*합\s*계|총\s*계|총\s*액|총\s*금\s*액|합\s*계\s*금\s*액|견\s*적\s*금\s*액|합\s*계|grand\s*total|total)[^0-9\n]{0,30}?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})/gi

export function findTotalInText(text: string): number | null {
  let best: number | null = null
  for (const m of text.matchAll(TOTAL_PATTERN)) {
    const n = Number(m[2].replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0 && (best === null || n > best)) best = n
  }
  if (best !== null) return best
  for (const m of text.matchAll(/[0-9]{1,3}(?:,[0-9]{3})+/g)) {
    const n = Number(m[0].replace(/,/g, ''))
    if (best === null || n > best) best = n
  }
  return best
}

async function pdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    // 한글 CID 폰트 PDF의 텍스트 추출에 필요
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
  }).promise
  const lines: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent()
    lines.push(content.items.map((it) => ('str' in it ? it.str : '')).join(' '))
  }
  return lines.join('\n')
}

async function sheetText(file: File): Promise<string> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer())
  return wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n')
}

export async function extractQuoteTotal(file: File): Promise<number | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  try {
    if (ext === 'pdf') return findTotalInText(await pdfText(file))
    if (ext === 'xlsx' || ext === 'xls') return findTotalInText(await sheetText(file))
  } catch (err) {
    console.error('[quoteTotal] 견적서 금액 추출 실패', err)
  }
  return null
}

/** 추출한 금액을 확인/수정받는다. 취소하면 null. */
export function confirmQuoteTotal(extracted: number | null): number | null {
  const msg = extracted !== null
    ? '견적서에서 읽은 총계입니다. 맞으면 확인, 다르면 수정해주세요.'
    : '견적서에서 총계를 찾지 못했습니다. 금액을 입력해주세요. (숫자만)'
  const input = window.prompt(msg, extracted !== null ? extracted.toLocaleString() : '')
  if (input === null) return null
  const n = Number(input.replace(/[^0-9]/g, ''))
  return Number.isFinite(n) ? n : null
}

export const QUOTE_FILE_ACCEPT = '.pdf,.xlsx,.xls,.jpg,.jpeg,.png'

/**
 * 발주서에 견적서를 첨부하고, 견적서 총계를 발주 금액(total_amount)으로 저장한다.
 * 금액 확인창에서 취소해도 파일은 첨부되고 금액만 그대로 둔다.
 */
export async function attachQuoteToPurchaseOrder(poId: string, file: File): Promise<void> {
  const { supabase } = await import('./supabase')
  const ext = file.name.split('.').pop()
  const path = `${poId}/${Date.now()}.${ext}`
  const [{ error: uploadError }, extracted] = await Promise.all([
    supabase.storage.from('purchase-order-files').upload(path, file),
    extractQuoteTotal(file),
  ])
  if (uploadError) throw uploadError
  const { data: urlData } = supabase.storage.from('purchase-order-files').getPublicUrl(path)
  const total = confirmQuoteTotal(extracted)
  const patch: { file_url: string; total_amount?: number } = { file_url: urlData.publicUrl }
  if (total !== null) patch.total_amount = total
  const { error } = await supabase.from('purchase_orders').update(patch).eq('id', poId)
  if (error) throw error
}
