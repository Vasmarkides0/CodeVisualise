'use client'

import { useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { RepoInput } from '@/components/RepoInput'
import { Sidebar } from '@/components/Sidebar'
import type { GraphData, GraphNode } from '@/types'

const ForceGraph = dynamic(
  () => import('@/components/ForceGraph').then(m => m.ForceGraph),
  { ssr: false }
)

const INTERESTING_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'py'])

export default function HomePage() {
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<GraphNode | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [explainLoading, setExplainLoading] = useState(false)

  const cacheRef = useRef<Map<string, string>>(new Map())
  const repoUrlRef = useRef('')

  async function handleRepoSubmit(url: string) {
    setLoading(true)
    setGraphData(null)
    setSelectedFile(null)
    setExplanation(null)
    repoUrlRef.current = url
    cacheRef.current.clear()

    try {
      const res = await fetch(`/api/github?url=${encodeURIComponent(url)}`)
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Failed to fetch repo')
      }
      const data: GraphData = await res.json()
      setGraphData(data)
      preCacheFirstFiles(data, url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function preCacheFirstFiles(data: GraphData, repoUrl: string) {
    const targets = data.nodes
      .filter(n => n.type === 'file' && n.depth <= 2 && INTERESTING_EXTS.has(n.extension))
      .slice(0, 5)

    targets.forEach(async node => {
      try {
        const contentRes = await fetch(
          `/api/github?url=${encodeURIComponent(repoUrl)}&path=${encodeURIComponent(node.path)}`
        )
        const { content } = await contentRes.json()
        const explainRes = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, filename: node.name }),
        })
        const { explanation } = await explainRes.json()
        if (explanation) cacheRef.current.set(node.path, explanation)
      } catch {
        // silent — live fetch will handle it on click
      }
    })
  }

  const handleNodeClick = useCallback(async (node: GraphNode) => {
    setSelectedFile(node)

    const cached = cacheRef.current.get(node.path)
    if (cached) {
      setExplanation(cached)
      setExplainLoading(false)
      return
    }

    setExplainLoading(true)
    setExplanation(null)

    try {
      const contentRes = await fetch(
        `/api/github?url=${encodeURIComponent(repoUrlRef.current)}&path=${encodeURIComponent(node.path)}`
      )
      const { content } = await contentRes.json()

      const explainRes = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filename: node.name }),
      })
      const { explanation } = await explainRes.json()
      cacheRef.current.set(node.path, explanation)
      setExplanation(explanation)
    } catch (err) {
      setExplanation('Failed to load explanation.')
    } finally {
      setExplainLoading(false)
    }
  }, [])

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      <RepoInput onSubmit={handleRepoSubmit} loading={loading} />
      <div className="flex-1 relative overflow-hidden">
        {graphData ? (
          <ForceGraph data={graphData} onNodeClick={handleNodeClick} />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Enter a GitHub repository URL above to visualize its structure
          </div>
        )}
        <Sidebar
          filename={selectedFile?.name ?? null}
          explanation={explanation}
          loading={explainLoading}
          onClose={() => { setSelectedFile(null); setExplanation(null) }}
        />
      </div>
    </div>
  )
}
