'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { RepoInput } from '@/components/RepoInput'
import { Sidebar } from '@/components/Sidebar'
import { ChatBox } from '@/components/ChatBox'
import type { GraphData, GraphNode } from '@/types'
import type { RenderMode } from '@/components/ForceGraph'

const ForceGraph = dynamic(
  () => import('@/components/ForceGraph').then(m => m.ForceGraph),
  { ssr: false }
)

const INTERESTING_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'py'])

const EXAMPLE_ROWS = [
  ['vercel/next.js', 'facebook/react', 'anthropics/anthropic-sdk-python'],
  ['torvalds/linux', 'Vasmarkides0/CodeVisualise'],
]

const FEATURE_PILLS = ['🌳 Visual tree', '🤖 AI explanations', '💬 Ask questions']

function EmptyState({ onExample }: { onExample: (url: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '24px', padding: '40px 20px' }}>
      <style>{`
        @keyframes nodePulse {
          0%, 100% { r: 9; opacity: 1; }
          50%       { r: 11; opacity: 0.7; }
        }
        @keyframes lineFade {
          0%, 100% { stroke-opacity: 0.25; }
          50%       { stroke-opacity: 0.7; }
        }
        .es-node { animation: nodePulse 2.4s ease-in-out infinite; }
        .es-node:nth-child(2) { animation-delay: 0.8s; }
        .es-node:nth-child(3) { animation-delay: 1.6s; }
        .es-line { animation: lineFade 2.4s ease-in-out infinite; }
        .es-line:nth-child(5) { animation-delay: 0.4s; }
        .es-line:nth-child(6) { animation-delay: 1.2s; }
        .es-chip:hover { background: #f9fafb !important; border-color: #6366f1 !important; color: #374151 !important; }
      `}</style>

      {/* Animated icon */}
      <svg width="100" height="80" viewBox="0 0 100 80" fill="none">
        <circle className="es-node" cx="50" cy="12" r="9" fill="#e0e7ff" stroke="#6366f1" strokeWidth="2" />
        <circle className="es-node" cx="20" cy="62" r="9" fill="#e0e7ff" stroke="#6366f1" strokeWidth="2" />
        <circle className="es-node" cx="80" cy="62" r="9" fill="#e0e7ff" stroke="#6366f1" strokeWidth="2" />
        <line className="es-line" x1="50" y1="21" x2="20" y2="53" stroke="#6366f1" strokeWidth="1.5" />
        <line className="es-line" x1="50" y1="21" x2="80" y2="53" stroke="#6366f1" strokeWidth="1.5" />
        <line className="es-line" x1="29" y1="62" x2="71" y2="62" stroke="#6366f1" strokeWidth="1.5" />
      </svg>

      {/* Heading + subheading */}
      <div style={{ textAlign: 'center', maxWidth: '480px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: '0 0 12px', lineHeight: 1.2 }}>
          Understand any codebase instantly
        </h2>
        <p style={{ fontSize: '15px', color: '#6b7280', margin: 0, lineHeight: 1.6, maxWidth: '420px' }}>
          Paste a GitHub URL to visualise its structure and ask AI questions about any file
        </p>
      </div>

      {/* Example chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
        {EXAMPLE_ROWS.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {row.map(ex => (
              <button
                key={ex}
                className="es-chip"
                onClick={() => onExample(`https://github.com/${ex}`)}
                style={{
                  border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 16px',
                  fontSize: '13px', color: '#6b7280', background: '#ffffff', cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                  fontFamily: 'inherit',
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Feature pills */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {FEATURE_PILLS.map(p => (
          <span key={p} style={{ fontSize: '12px', color: '#9ca3af' }}>{p}</span>
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
  const [repoOwner, setRepoOwner]       = useState('')
  const [graphData, setGraphData]       = useState<GraphData | null>(null)
  const [loading, setLoading]           = useState(false)
  const [selectedFile, setSelectedFile] = useState<GraphNode | null>(null)
  const [explanation, setExplanation]   = useState<string | null>(null)
  const [explainLoading, setExplainLoading] = useState(false)
  const [highlightedDirPath, setHighlightedDirPath] = useState<string | undefined>(undefined)
  const [dirFiles, setDirFiles]         = useState<GraphNode[]>([])

  const [isChatOpen, setIsChatOpen]     = useState(false)
  const [hasOpenedChat, setHasOpenedChat] = useState(false)
  const [chatCurrentFile, setChatCurrentFile] = useState<{ path: string; contents: string } | null>(null)

  const cacheRef    = useRef<Map<string, string>>(new Map())
  const contentsRef = useRef<Map<string, string>>(new Map())
  const repoUrlRef  = useRef('')
  const allDataRef  = useRef<GraphData | null>(null)

  const renderMode = useMemo((): RenderMode => {
    if (!graphData) return 'tree'
    const fileCount = graphData.nodes.filter(n => n.type === 'file').length
    return fileCount < 40 ? 'tree' : 'directory'
  }, [graphData])

  const repoContext = useMemo(() => {
    if (!graphData || !repoOwner || !repoName) return null
    return { owner: repoOwner, repo: repoName, branch: 'main' }
  }, [graphData, repoOwner, repoName])

  function handleReset() {
    setRepoUrl('')
    setRepoName('')
    setRepoOwner('')
    setGraphData(null)
    setSelectedFile(null)
    setExplanation(null)
    setExplainLoading(false)
    setHighlightedDirPath(undefined)
    setDirFiles([])
    setIsChatOpen(false)
    setHasOpenedChat(false)
    setChatCurrentFile(null)
    cacheRef.current.clear()
    contentsRef.current.clear()
    allDataRef.current = null
    repoUrlRef.current = ''
  }

  function openChat() {
    setIsChatOpen(true)
    setHasOpenedChat(true)
  }

  async function handleRepoSubmit(url: string) {
    setLoading(true)
    setGraphData(null)
    setSelectedFile(null)
    setExplanation(null)
    setHighlightedDirPath(undefined)
    setDirFiles([])
    setChatCurrentFile(null)
    repoUrlRef.current = url
    cacheRef.current.clear()
    contentsRef.current.clear()
    allDataRef.current = null

    const match = url.match(/github\.com\/([^/]+)\/([^/?#]+)/)
    setRepoOwner(match?.[1] ?? '')
    setRepoName(match?.[2]?.replace(/\.git$/, '') ?? '')

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
        if (content) contentsRef.current.set(node.path, content)
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

    // Set chat context from cache if available
    const cachedContents = contentsRef.current.get(node.path)
    if (cachedContents) setChatCurrentFile({ path: node.path, contents: cachedContents })

    if (cached && cachedContents) return

    try {
      const cr = await fetch(`/api/github?url=${encodeURIComponent(repoUrlRef.current)}&path=${encodeURIComponent(node.path)}`)
      const { content } = await cr.json()
      if (content) {
        contentsRef.current.set(node.path, content)
        setChatCurrentFile({ path: node.path, contents: content })
      }
      if (!cached) {
        const er = await fetch('/api/explain', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, filename: node.name }),
        })
        const { explanation } = await er.json()
        cacheRef.current.set(node.path, explanation)
        setExplanation(explanation)
      }
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

    const cachedContents = contentsRef.current.get(node.path)
    if (cachedContents) setChatCurrentFile({ path: node.path, contents: cachedContents })

    if (cached && cachedContents) return

    try {
      const cr = await fetch(`/api/github?url=${encodeURIComponent(repoUrlRef.current)}&path=${encodeURIComponent(node.path)}`)
      const { content } = await cr.json()
      if (content) {
        contentsRef.current.set(node.path, content)
        setChatCurrentFile({ path: node.path, contents: content })
      }
      if (!cached) {
        const er = await fetch('/api/explain', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, filename: node.name }),
        })
        const { explanation } = await er.json()
        cacheRef.current.set(node.path, explanation)
        setExplanation(explanation)
      }
    } catch {
      setExplanation('Failed to load explanation.')
    } finally {
      setExplainLoading(false)
    }
  }, [])

  function handleBreadcrumbClick(dirPath: string) {
    setHighlightedDirPath(prev => prev === dirPath ? undefined : dirPath)
  }

  const fileSelected = !!selectedFile && selectedFile.type === 'file'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fafafa' }}>
      <style>{`
        @keyframes chatBounce {
          0%, 100% { transform: translateY(0); }
          30%       { transform: translateY(-6px); }
          60%       { transform: translateY(-3px); }
        }
        @keyframes chatRing {
          0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
          70%  { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
          100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
        }
      `}</style>

      <RepoInput
        value={repoUrl}
        onChange={setRepoUrl}
        onSubmit={handleRepoSubmit}
        onReset={handleReset}
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

        {/* Instruction hint */}
        {graphData && !selectedFile && !loading && (
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            border: '1px solid #e5e7eb',
            borderRadius: '20px',
            padding: '6px 16px',
            fontSize: '13px',
            color: '#9ca3af',
            background: '#ffffff',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 5,
          }}>
            Click any file node to understand what it does
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

        {/* Floating chat button */}
        {graphData && !isChatOpen && (
          <div style={{ position: 'fixed', bottom: '60px', right: '20px', zIndex: 40 }}>
            {/* Tooltip */}
            <div className="chat-tooltip" style={{
              position: 'absolute', bottom: '56px', right: 0,
              background: '#111827', color: '#fff',
              fontSize: '12px', borderRadius: '6px', padding: '5px 10px',
              whiteSpace: 'nowrap', pointerEvents: 'none',
              opacity: 0, transition: 'opacity 0.15s',
            }}>
              Ask about this codebase
              <div style={{
                position: 'absolute', bottom: '-4px', right: '18px',
                width: '8px', height: '8px', background: '#111827',
                transform: 'rotate(45deg)',
              }} />
            </div>

            <style>{`.chat-btn:hover + * { opacity: 0 !important } .chat-btn-wrap:hover .chat-tooltip { opacity: 1 !important }`}</style>

            <div className="chat-btn-wrap" style={{ position: 'relative' }}>
              <button
                onClick={openChat}
                style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: '#6366f1', color: '#ffffff',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                  animation: fileSelected
                    ? 'chatRing 1.5s ease-out infinite'
                    : `chatBounce 1s ease-out 0.8s 2`,
                  transition: 'background 0.15s, transform 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget.style.background = '#4f46e5'); (e.currentTarget.style.transform = 'scale(1.08)') }}
                onMouseLeave={e => { (e.currentTarget.style.background = '#6366f1'); (e.currentTarget.style.transform = 'scale(1)') }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M2 4.5A2.5 2.5 0 014.5 2h11A2.5 2.5 0 0118 4.5v7a2.5 2.5 0 01-2.5 2.5H11l-3.5 3v-3H4.5A2.5 2.5 0 012 11.5v-7z"
                    fill="white" fillOpacity="0.95" />
                </svg>
                {/* Unread dot */}
                {!hasOpenedChat && (
                  <div style={{
                    position: 'absolute', top: '2px', right: '2px',
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: '#ef4444', border: '2px solid #ffffff',
                  }} />
                )}
              </button>
              <div className="chat-tooltip" style={{
                position: 'absolute', bottom: '56px', right: 0,
                background: '#111827', color: '#fff',
                fontSize: '12px', borderRadius: '6px', padding: '5px 10px',
                whiteSpace: 'nowrap', pointerEvents: 'none',
                opacity: 0, transition: 'opacity 0.15s',
              }}>
                {fileSelected ? `Ask about ${selectedFile!.name}` : 'Ask about this codebase'}
                <div style={{
                  position: 'absolute', bottom: '-4px', right: '18px',
                  width: '8px', height: '8px', background: '#111827',
                  transform: 'rotate(45deg)',
                }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <ChatBox
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        repoContext={repoContext}
        currentFile={chatCurrentFile}
      />
    </div>
  )
}
