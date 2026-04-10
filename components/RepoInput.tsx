'use client'

import { FormEvent } from 'react'

interface Props {
  value: string
  onChange: (url: string) => void
  onSubmit: (url: string) => void
  onReset: () => void
  loading: boolean
}

export function RepoInput({ value, onChange, onSubmit, onReset, loading }: Props) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed) onSubmit(trimmed)
  }

  return (
    <header style={{
      height: '52px',
      background: '#ffffff',
      borderBottom: '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: '16px',
      flexShrink: 0,
    }}>
      {/* Logo — click to reset */}
      <button
        onClick={onReset}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
          borderRadius: '6px', transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="1" y="1" width="7" height="7" rx="1.5" fill="#6366f1" />
          <rect x="10" y="1" width="7" height="7" rx="1.5" fill="#6366f1" />
          <rect x="1" y="10" width="7" height="7" rx="1.5" fill="#6366f1" />
          <rect x="10" y="10" width="7" height="7" rx="1.5" fill="#6366f1" />
        </svg>
        <span style={{ fontWeight: 600, fontSize: '15px', color: '#111827', letterSpacing: '-0.01em' }}>
          CodeVisualise
        </span>
      </button>

      {/* Input — centered */}
      <form
        onSubmit={handleSubmit}
        style={{ flex: 1, display: 'flex', justifyContent: 'center' }}
      >
        <input
          type="url"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="https://github.com/owner/repo"
          style={{
            width: '480px',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '14px',
            color: '#374151',
            outline: 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onFocus={e => {
            e.target.style.borderColor = '#6366f1'
            e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
          }}
          onBlur={e => {
            e.target.style.borderColor = '#e5e7eb'
            e.target.style.boxShadow = 'none'
          }}
        />
      </form>

      {/* Button */}
      <button
        onClick={() => { const t = value.trim(); if (t) onSubmit(t) }}
        disabled={loading}
        style={{
          background: loading ? '#a5b4fc' : '#6366f1',
          color: '#ffffff',
          borderRadius: '8px',
          padding: '8px 18px',
          fontSize: '14px',
          fontWeight: 500,
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.background = '#4f46e5' }}
        onMouseLeave={e => { if (!loading) (e.target as HTMLButtonElement).style.background = '#6366f1' }}
      >
        {loading ? 'Loading…' : 'Visualize'}
      </button>
    </header>
  )
}
