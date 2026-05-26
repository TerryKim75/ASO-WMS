import { useState, useRef } from 'react'
import { X, ImagePlus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCategories } from '../contexts/CategoriesContext'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function AddItemModal({ onClose, onSuccess }: Props) {
  const { categories } = useCategories()
  const [form, setForm] = useState({
    name: '',
    category: '',
    unit: 'EA',
    description: '',
    initialStock: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedCategory = form.category || categories[0]?.name || ''

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 업로드 가능합니다.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('파일 크기는 5MB 이하여야 합니다.'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError('')
  }

  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError('')
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('자재명을 입력해주세요.'); return }
    if (!selectedCategory) { setError('카테고리를 선택해주세요.'); return }
    setLoading(true)
    setError('')

    try {
      let image_url: string | null = null

      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('item-images')
          .upload(fileName, imageFile, { cacheControl: '3600', upsert: false })
        if (uploadError) throw new Error('이미지 업로드 실패: ' + uploadError.message)
        const { data: urlData } = supabase.storage.from('item-images').getPublicUrl(fileName)
        image_url = urlData.publicUrl
      }

      const { data: item, error: itemError } = await supabase
        .from('items')
        .insert({
          name: form.name.trim(),
          category: selectedCategory,
          unit: form.unit.trim() || 'EA',
          description: form.description.trim() || null,
          image_url,
        })
        .select()
        .single()

      if (itemError) throw itemError

      const qty = parseInt(form.initialStock)
      if (qty > 0 && item) {
        const today = new Date()
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        const { error: txError } = await supabase.from('inventory_transactions').insert({
          item_id: item.id,
          transaction_type: '입고',
          quantity: qty,
          transaction_date: dateStr,
          notes: '초기 재고',
        })
        if (txError) throw txError
      }

      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '자재 추가 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-slate-800">자재 추가</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">자재 이미지 (선택)</label>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="미리보기" className="w-full h-48 object-contain bg-slate-50 border border-slate-200 rounded-lg" />
                <button type="button" onClick={clearImage} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleImageDrop}
                onDragOver={(e) => e.preventDefault()}
                className="w-full h-36 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-colors"
              >
                <ImagePlus size={28} className="text-slate-400" />
                <p className="text-sm text-slate-500">클릭하거나 이미지를 드래그하세요</p>
                <p className="text-xs text-slate-400">PNG, JPG, WEBP · 최대 5MB</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              자재명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: 1000mm 프레임"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              카테고리 <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">단위</label>
            <input
              type="text"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="EA"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">초기 재고수량 (선택)</label>
            <input
              type="number"
              value={form.initialStock}
              onChange={(e) => setForm({ ...form, initialStock: e.target.value })}
              placeholder="0"
              min="0"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">설명 (선택)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="자재에 대한 설명을 입력하세요"
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              취소
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50">
              {loading ? '저장 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
