'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { RepoInput } from '@/components/RepoInput'
import { Sidebar } from '@/components/Sidebar'
import { ChatBox } from '@/components/ChatBox'
import type { GraphData, GraphNode } from '@/types'
import type { RenderMode } from '@/components/ForceGraph'
import * as d3 from 'd3'
import { COLOR_MAP, DIR_COLOR, DEFAULT_COLOR } from '@/lib/fileColors'

const ForceGraph = dynamic(
  () => import('@/components/ForceGraph').then(m => m.ForceGraph),
  { ssr: false }
)

const INTERESTING_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'py'])

const EXAMPLE_REPOS = [
  'anthropics/anthropic-sdk-python',
  'github/copilot-engine-sdk',
  'Vasmarkides0/CodeVisualise',
]

type TreeNodeDatum = { name: string; type: 'dir' | 'file'; extension: string; children?: TreeNodeDatum[] }

const TREE_DATA: TreeNodeDatum = {
  name: 'repo', type: 'dir', extension: '',
  children: [
    {
      name: 'src', type: 'dir', extension: '',
      children: [
        { name: 'App.tsx',   type: 'file', extension: 'tsx' },
        { name: 'index.ts',  type: 'file', extension: 'ts'  },
        {
          name: 'components', type: 'dir', extension: '',
          children: [
            { name: 'Button.tsx', type: 'file', extension: 'tsx' },
            { name: 'Card.tsx',   type: 'file', extension: 'tsx' },
            { name: 'Header.tsx', type: 'file', extension: 'tsx' },
          ]
        },
        {
          name: 'utils', type: 'dir', extension: '',
          children: [
            { name: 'helpers.ts', type: 'file', extension: 'ts' },
            { name: 'format.ts',  type: 'file', extension: 'ts' },
          ]
        },
      ]
    },
    { name: 'package.json', type: 'file', extension: 'json' },
    { name: 'README.md',    type: 'file', extension: 'md'   },
  ]
}

const FEATURE_CARDS = [
  {
    name: 'Visual tree',
    desc: 'See your entire repo structure at a glance',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="4"  r="2.2" fill="#6366f1" />
        <circle cx="5"  cy="15" r="2.2" fill="#6366f1" />
        <circle cx="19" cy="15" r="2.2" fill="#6366f1" />
        <line x1="12" y1="6.2"  x2="5.8"  y2="12.8" stroke="#6366f1" strokeWidth="1.5" />
        <line x1="12" y1="6.2"  x2="18.2" y2="12.8" stroke="#6366f1" strokeWidth="1.5" />
        <line x1="5"  y1="17.2" x2="5"    y2="21"   stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="19" y1="17.2" x2="19"   y2="21"   stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: 'AI explanations',
    desc: 'Click any file for a plain English summary',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2a7 7 0 0 1 5 11.95V16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-2.05A7 7 0 0 1 12 2z"
          stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round" />
        <line x1="9"  y1="20" x2="15" y2="20" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="22" x2="14" y2="22" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: 'Ask questions',
    desc: 'Chat with AI about the codebase',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v8A2.5 2.5 0 0 1 18.5 17H13l-4 3.5V17H5.5A2.5 2.5 0 0 1 3 14.5v-8z"
          stroke="#10b981" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="8"  cy="10.5" r="1" fill="#10b981" />
        <circle cx="12" cy="10.5" r="1" fill="#10b981" />
        <circle cx="16" cy="10.5" r="1" fill="#10b981" />
      </svg>
    ),
  },
]

function MiniTreePreview() {
  const { nodes, links } = useMemo(() => {
    const root = d3.hierarchy(TREE_DATA)
    const pts = d3.tree<TreeNodeDatum>().size([240, 130])(root)
    return { nodes: pts.descendants(), links: pts.links() }
  }, [])

  return (
    <svg width={300} height={200} viewBox="0 0 300 200" style={{ display: 'block', overflow: 'visible' }}>
      {links.map((link, i) => (
        <line
          key={i}
          x1={link.source.x + 30} y1={link.source.y + 30}
          x2={link.target.x + 30} y2={link.target.y + 30}
          stroke="#d1d5db" strokeWidth={1.5}
        />
      ))}
      {nodes.map((node, i) => {
        const c = node.data.type === 'dir' ? DIR_COLOR : (COLOR_MAP[node.data.extension] ?? DEFAULT_COLOR)
        const r = node.data.type === 'dir' ? 6 : 4
        return (
          <g
            key={i}
            transform={`translate(${node.x + 30}, ${node.y + 30})`}
            style={{
              animation: `breathe 3s ease-in-out ${node.depth * 0.7}s infinite`,
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          >
            <circle r={r} fill={c} fillOpacity={0.9} />
          </g>
        )
      })}
    </svg>
  )
}

function EmptyState({ onExample }: { onExample: (url: string) => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', padding: '40px 20px',
      backgroundImage: 'radial-gradient(rgba(229,231,235,0.5) 1px, transparent 0)',
      backgroundSize: '24px 24px',
    }}>
      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.03); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .es-chip {
          border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 14px;
          font-size: 13px; color: #6b7280; background: #ffffff; cursor: pointer;
          transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s, box-shadow 0.15s;
          font-family: inherit; display: inline-flex; align-items: center; gap: 6px;
        }
        .es-chip:hover {
          background: #f5f3ff; border-color: #6366f1; color: #4f46e5;
          transform: scale(1.04); box-shadow: 0 2px 8px rgba(99,102,241,0.15);
        }
        .feature-card {
          border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px 20px;
          background: #ffffff; display: flex; flex-direction: column; gap: 6px;
          min-width: 180px; max-width: 210px; flex: 1;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .feature-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.08);
        }
      `}</style>

      {/* Mini tree preview */}
      <div style={{ marginBottom: '32px', animation: 'fadeInUp 0.8s ease-out forwards' }}>
        <MiniTreePreview />
      </div>

      {/* Heading + subheading */}
      <div style={{ textAlign: 'center', maxWidth: '480px', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 700, color: '#111827', margin: '0 0 12px', lineHeight: 1.2 }}>
          Understand any codebase instantly
        </h2>
        <p style={{ fontSize: '15px', color: '#6b7280', margin: 0, lineHeight: 1.6, maxWidth: '420px' }}>
          Paste a GitHub URL to visualise its structure and ask AI questions about any file
        </p>
      </div>

      {/* Example chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '40px' }}>
        {EXAMPLE_REPOS.map(ex => (
          <button
            key={ex}
            className="es-chip"
            onClick={() => onExample(`https://github.com/${ex}`)}
          >
            {ex}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
              <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>

      {/* Feature cards */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '700px' }}>
        {FEATURE_CARDS.map(card => (
          <div key={card.name} className="feature-card">
            {card.icon}
            <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827', marginTop: '2px' }}>{card.name}</span>
            <span style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.5 }}>{card.desc}</span>
          </div>
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
          <EmptyState onExample={url => { setRepoUrl(url); handleRepoSubmit(url) }} />
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
