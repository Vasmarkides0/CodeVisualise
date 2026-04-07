'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { RepoInput } from '@/components/RepoInput'
import { Sidebar } from '@/components/Sidebar'
import type { GraphData, GraphNode } from '@/types'
import type { RenderMode } from '@/components/ForceGraph'

const ForceGraph = dynamic(
  () => import('@/components/ForceGraph').then(m => m.ForceGraph),
  { ssr: false }
)

const INTERESTING_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'py'])

const EXAMPLES = [
  'vercel/next.js',
  'facebook/react',
  'anthropics/anthropic-sdk-python',
]

function EmptyState({ onExample }: { onExample: (url: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="14" r="9" fill="#e0e7ff" stroke="#6366f1" strokeWidth="2" />
        <circle cx="14" cy="50" r="9" fill="#e0e7ff" stroke="#6366f1" strokeWidth="2" />
        <circle cx="50" cy="50" r="9" fill="#e0e7ff" stroke="#6366f1" strokeWidth="2" />
        <line x1="32" y1="23" x2="14" y2="41" stroke="#6366f1" strokeWidth="1.5" strokeOpacity="0.4" />
        <line x1="32" y1="23" x2="50" y2="41" stroke="#6366f1" strokeWidth="1.5" strokeOpacity="0.4" />
        <line x1="23" y1="50" x2="41" y2="50" stroke="#6366f1" strokeWidth="1.5" strokeOpacity="0.4" />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>
          Visualize any GitHub repository
        </h2>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
          Paste a GitHub URL above to explore its file structure
        </p>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {EXAMPLES.map(ex => (
          <button key={ex} onClick={() => onExample(`https://github.com/${ex}`)} style={{
            border: '1px solid #e5e7eb', borderRadius: '20px', padding: '4px 12px',
            fontSize: '12px', color: '#6b7280', background: '#ffffff', cursor: 'pointer',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
            onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '14px' }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <circle cx="16" cy="16" r="13" stroke="#e5e7eb" strokeWidth="3" />
        <path d="M16 3 A13 13 0 0 1 29 16" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span style={{ fontSize: '14px', color: '#6b7280' }}>Fetching repository structure…</span>
    </div>
  )
}

export default function HomePage() {
  const [repoUrl, setRepoUrl]           = useState('')
  const [repoName, setRepoName]         = useState('')
  const [graphData, setGraphData]       = useState<GraphData | null>(null)
  const [loading, setLoading]           = useState(false)
  const [selectedFile, setSelectedFile] = useState<GraphNode | null>(null)
  const [explanation, setExplanation]   = useState<string | null>(null)
  const [explainLoading, setExplainLoading] = useState(false)
  const [highlightedDirPath, setHighlightedDirPath] = useState<string | undefined>(undefined)
  const [dirFiles, setDirFiles] = useState<GraphNode[]>([])

  const cacheRef   = useRef<Map<string, string>>(new Map())
  const repoUrlRef = useRef('')
  const allDataRef = useRef<GraphData | null>(null)

  const renderMode = useMemo((): RenderMode => {
    if (!graphData) return 'tree'
    const fileCount = graphData.nodes.filter(n => n.type === 'file').length
    return fileCount < 40 ? 'tree' : 'directory'
  }, [graphData])

  async function handleRepoSubmit(url: string) {
    setLoading(true)
    setGraphData(null)
    setSelectedFile(null)
    setExplanation(null)
    setHighlightedDirPath(undefined)
    setDirFiles([])
    repoUrlRef.current = url
    cacheRef.current.clear()
    allDataRef.current = null
    const parsed = url.match(/github\.com\/[^/]+\/([^/?#]+)/)?.[1]?.replace(/\.git$/, '') ?? ''
    setRepoName(parsed)

    try {
      const res = await fetch(`/api/github?url=${encodeURIComponent(url)}`)
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Failed to fetch repo')
      }
      const data: GraphData = await res.json()
      setGraphData(data)
      allDataRef.current = data
      preCacheFirstFiles(data, url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function preCacheFirstFiles(data: GraphData, url: string) {
    const targets = data.nodes
      .filter(n => n.type === 'file' && n.depth <= 2 && INTERESTING_EXTS.has(n.extension))
      .slice(0, 5)

    targets.forEach(async node => {
      try {
        const cr = await fetch(`/api/github?url=${encodeURIComponent(url)}&path=${encodeURIComponent(node.path)}`)
        const { content } = await cr.json()
        const er = await fetch('/api/explain', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, filename: node.name }),
        })
        const { explanation } = await er.json()
        if (explanation) cacheRef.current.set(node.path, explanation)
      } catch { /* silent */ }
    })
  }

  const handleNodeClick = useCallback(async (node: GraphNode) => {
    // Directory mode: clicking a dir shows its file list
    if (renderMode === 'directory' && node.type === 'dir') {
      const all = allDataRef.current
      if (!all) return
      const prefix = node.id === '__root__' ? '' : node.path + '/'
      const files = all.nodes.filter(n =>
        n.type === 'file' && (node.id === '__root__' ? true : n.path.startsWith(prefix))
      ).sort((a, b) => a.name.localeCompare(b.name))
      setSelectedFile(node)
      setDirFiles(files)
      setExplanation(null)
      setExplainLoading(false)
      setHighlightedDirPath(undefined)
      return
    }

    // Normal file click
    setDirFiles([])
    const cached = cacheRef.current.get(node.path)
    setSelectedFile(node)
    setExplanation(cached ?? null)
    setExplainLoading(!cached)
    setHighlightedDirPath(undefined)

    if (cached) return

    try {
      const cr = await fetch(`/api/github?url=${encodeURIComponent(repoUrlRef.current)}&path=${encodeURIComponent(node.path)}`)
      const { content } = await cr.json()
      const er = await fetch('/api/explain', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filename: node.name }),
      })
      const { explanation } = await er.json()
      cacheRef.current.set(node.path, explanation)
      setExplanation(explanation)
    } catch {
      setExplanation('Failed to load explanation.')
    } finally {
      setExplainLoading(false)
    }
  }, [renderMode])

  const handleFileFromList = useCallback(async (node: GraphNode) => {
    setDirFiles([])
    const cached = cacheRef.current.get(node.path)
    setSelectedFile(node)
    setExplanation(cached ?? null)
    setExplainLoading(!cached)

    if (cached) return

    try {
      const cr = await fetch(`/api/github?url=${encodeURIComponent(repoUrlRef.current)}&path=${encodeURIComponent(node.path)}`)
      const { content } = await cr.json()
      const er = await fetch('/api/explain', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filename: node.name }),
      })
      const { explanation } = await er.json()
      cacheRef.current.set(node.path, explanation)
      setExplanation(explanation)
    } catch {
      setExplanation('Failed to load explanation.')
    } finally {
      setExplainLoading(false)
    }
  }, [])

  function handleBreadcrumbClick(dirPath: string) {
    setHighlightedDirPath(prev => prev === dirPath ? undefined : dirPath)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fafafa' }}>
      <RepoInput
        value={repoUrl}
        onChange={setRepoUrl}
        onSubmit={handleRepoSubmit}
        loading={loading}
      />

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {loading ? (
          <LoadingState />
        ) : graphData ? (
          <ForceGraph
            data={graphData}
            onNodeClick={handleNodeClick}
            selectedNodeId={selectedFile?.id}
            highlightedDirPath={highlightedDirPath}
            repoName={repoName}
            renderMode={renderMode}
          />
        ) : (
          <EmptyState onExample={url => { setRepoUrl(url) }} />
        )}

        {/* Instruction hint — shown when graph loaded but nothing selected */}
        {graphData && !selectedFile && !loading && (
          <div style={{
            position: 'absolute',
            bottom: '72px',
            left: '50%',
            transform: 'translateX(-50%)',
            border: '1px dashed #d1d5db',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '13px',
            color: '#9ca3af',
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(4px)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 5,
          }}>
            ← Click any file node to understand what it does
          </div>
        )}

        {graphData && (
          <Sidebar
            filename={selectedFile?.name ?? null}
            filepath={selectedFile?.path ?? null}
            extension={selectedFile?.extension ?? null}
            explanation={explanation}
            loading={explainLoading}
            onClose={() => { setSelectedFile(null); setExplanation(null); setHighlightedDirPath(undefined); setDirFiles([]) }}
            onBreadcrumbClick={handleBreadcrumbClick}
            fileList={dirFiles.length > 0 ? dirFiles : undefined}
            onFileSelect={handleFileFromList}
          />
        )}
      </div>
    </div>
  )
}
