import { X, Pencil, FileText, ExternalLink } from 'lucide-react'
import type { OrderItem } from './PurchaseOrderModal'

export const PO_STATUSES = ['발주중', '납품완료', '취소']

export const PO_STATUS_COLORS: Record<string, string> = {
  발주중: 'bg-blue-100 text-blue-700',
  납품완료: 'bg-green-100 text-green-700',
  취소: 'bg-slate-100 text-slate-500',
}

export interface PurchaseOrder {
  id: string; vendor_id: string; order_number: string; order_date: string
  delivery_date?: string; project_id?: string; items: OrderItem[]
  total_amount: number; status: string
  file_url?: string; notes?: string
  vendors?: { name: string; contact_name?: string; phone?: string }
  wms_projects?: { name: string } | null
}

export default function ViewPurchaseOrderModal({
  po, onClose, onEdit,
}: { po: PurchaseOrder; onClose: () => void; onEdit: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0 bg-slate-800 rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold text-white">발주서 보기</h2>
            <p className="text-xs text-slate-400 mt-0.5">{po.order_number}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* 기본 정보 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4 space-y-1 text-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">발주처</p>
              <p className="font-semibold text-slate-800 text-base">{po.vendors?.name || '-'}</p>
              {po.vendors?.contact_name && <p className="text-slate-600">담당: {po.vendors.contact_name}</p>}
              {po.vendors?.phone && <p className="text-slate-600">연락처: {po.vendors.phone}</p>}
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between border-b border-dashed border-slate-200 py-1">
                <span className="text-slate-500">발주일</span><span className="font-medium text-slate-800">{po.order_date.replace(/-/g, '.')}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-200 py-1">
                <span className="text-slate-500">납기일</span><span className="font-medium text-slate-800">{po.delivery_date ? po.delivery_date.replace(/-/g, '.') : '-'}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-200 py-1">
                <span className="text-slate-500">프로젝트</span><span className="font-medium text-slate-800">{po.wms_projects?.name || '-'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">상태</span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${PO_STATUS_COLORS[po.status] || 'bg-slate-100 text-slate-600'}`}>{po.status}</span>
              </div>
            </div>
          </div>

          {/* 품목 목록 */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">품목 목록</p>
            <div className="border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600 w-8">No.</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">품목명</th>
                    <th className="text-center px-2 py-2.5 font-semibold text-slate-600 w-20">수량</th>
                    <th className="text-center px-2 py-2.5 font-semibold text-slate-600 w-16">단위</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-slate-600 w-28">단가 (원)</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-slate-600 w-28">금액 (원)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {po.items.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400 text-sm">등록된 품목이 없습니다.</td></tr>
                  ) : po.items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-center text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2 text-slate-800">{item.name}</td>
                      <td className="px-2 py-2 text-center text-slate-600">{item.quantity.toLocaleString()}</td>
                      <td className="px-2 py-2 text-center text-slate-600">{item.unit}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{item.unit_price.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">{item.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td colSpan={5} className="px-3 py-3 text-right font-bold text-slate-700">합 계</td>
                    <td className="px-3 py-3 text-right font-bold text-lg text-violet-700">{po.total_amount.toLocaleString()}원</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 첨부파일 */}
          {po.file_url && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">첨부파일</p>
              <a href={po.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-violet-600 hover:underline w-fit">
                <FileText size={14} /><ExternalLink size={12} />파일 보기
              </a>
            </div>
          )}

          {/* 비고 */}
          {po.notes && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">비고</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{po.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-xl flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
            닫기
          </button>
          <div className="flex-1" />
          <button onClick={onEdit}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors shadow-sm">
            <Pencil size={14} />수정
          </button>
        </div>
      </div>
    </div>
  )
}
