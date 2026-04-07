'use client'

import { COLOR_MAP, DEFAULT_COLOR } from '@/lib/fileColors'

interface Props {
  filename: string | null
  filepath: string | null
  extension: string | null
  explanation: string | null
  loading: boolean
  onClose: () => void
  onBreadcrumbClick: (dirPath: string) => void
}

export function Sidebar({ filename, filepath, extension, explanation, loading, onClose, onBreadcrumbClick }: Props) {
  if (!filename) return null

  const badgeColor = extension ? (COLOR_MAP[extension.toLowerCase()] ?? DEFAULT_COLOR) : DEFAULT_COLOR

  // Build breadcrumb segments from filepath
  const segments = filepath ? filepath.split('/') : [filename]
  // each segment's full path
  const segPaths = segments.map((_, i) => segments.slice(0, i + 1).join('/'))

  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, height: '100%', width: '360px',
      background: '#ffffff', borderLeft: '1px solid #e5e7eb',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column',
      animation: 'sidebarIn 0.3s ease-out', zIndex: 10,
    }}>
      <style>{`
        @keyframes sidebarIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {/* Breadcrumb */}
            {segments.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px', marginBottom: '6px' }}>
                {segments.map((seg, i) => {
                  const isLast = i === segments.length - 1
                  const segPath = segPaths[i]
                  return (
                    <span key={segPath} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      {i > 0 && <span style={{ color: '#d1d5db', fontSize: '12px', padding: '0 1px' }}>/</span>}
                      {isLast ? (
                        <span style={{ fontSize: '12px', color: '#374151' }}>{seg}</span>
                      ) : (
                        <button
                          onClick={() => onBreadcrumbClick(segPath)}
                          style={{
                            fontSize: '12px', color: '#6b7280', background: 'none',
                            border: 'none', cursor: 'pointer', padding: '0',
                            transition: 'color 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#6366f1')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
                        >
                          {seg}
                        </button>
                      )}
                    </span>
                  )
                })}
              </div>
            )}

            {/* Filename + badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#111827', wordBreak: 'break-all' }}>
                {filename}
              </span>
              {extension && (
                <span style={{
                  fontSize: '11px', borderRadius: '20px', padding: '2px 8px', flexShrink: 0,
                  background: `${badgeColor}18`, color: badgeColor,
                  fontWeight: 500, border: `1px solid ${badgeColor}30`,
                }}>
                  .{extension}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', flexShrink: 0, lineHeight: 1 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="shimmer-line" style={{ height: '14px', width: '100%' }} />
            <div className="shimmer-line" style={{ height: '14px', width: '88%' }} />
            <div className="shimmer-line" style={{ height: '14px', width: '72%' }} />
            <div style={{ height: '8px' }} />
            <div className="shimmer-line" style={{ height: '14px', width: '95%' }} />
            <div className="shimmer-line" style={{ height: '14px', width: '60%' }} />
          </div>
        ) : (
          <p style={{ fontSize: '14px', color: '#374151', lineHeight: 1.7, margin: 0 }}>
            {explanation}
          </p>
        )}
      </div>
    </div>
  )
}
