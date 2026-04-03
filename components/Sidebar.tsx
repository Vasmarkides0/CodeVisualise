'use client'

interface Props {
  filename: string | null
  explanation: string | null
  loading: boolean
  onClose: () => void
}

export function Sidebar({ filename, explanation, loading, onClose }: Props) {
  if (!filename) return null

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-slate-900 border-l border-slate-700 flex flex-col animate-slide-in z-10">
      <div className="flex items-center justify-between p-4 border-b border-slate-700 gap-2">
        <span className="text-sm font-mono text-blue-400 truncate">{filename}</span>
        <button onClick={onClose} className="text-slate-400 hover:text-white shrink-0">✕</button>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-slate-700 rounded w-full" />
            <div className="h-3 bg-slate-700 rounded w-5/6" />
            <div className="h-3 bg-slate-700 rounded w-4/6" />
            <div className="h-3 bg-slate-700 rounded w-full" />
            <div className="h-3 bg-slate-700 rounded w-3/6" />
          </div>
        ) : (
          <p className="text-slate-300 text-sm leading-relaxed">{explanation}</p>
        )}
      </div>
    </div>
  )
}
