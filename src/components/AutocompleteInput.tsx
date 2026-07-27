import { useState, useRef, useEffect } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  onSelectOption?: (value: string) => void
  options: string[]
  placeholder?: string
  className?: string
}

export default function AutocompleteInput({ value, onChange, onSelectOption, options, placeholder, className }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const query = value.trim().toLowerCase()
  const filtered = (query ? options.filter((o) => o.toLowerCase().includes(query)) : options).slice(0, 8)

  return (
    <div className="relative" ref={containerRef}>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {filtered.map((opt) => (
            <li key={opt}>
              <button type="button"
                onClick={() => { onChange(opt); onSelectOption?.(opt); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50 text-slate-700 transition-colors"
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
