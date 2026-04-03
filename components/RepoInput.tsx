'use client'

import { useState, FormEvent } from 'react'

interface Props {
  onSubmit: (url: string) => void
  loading: boolean
}

export function RepoInput({ onSubmit, loading }: Props) {
  const [value, setValue] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed) onSubmit(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 bg-slate-900 border-b border-slate-700">
      <input
        type="url"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="https://github.com/owner/repo"
        className="flex-1 bg-slate-800 text-slate-100 rounded px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-blue-500"
      />
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors"
      >
        {loading ? 'Loading…' : 'Visualize'}
      </button>
    </form>
  )
}
