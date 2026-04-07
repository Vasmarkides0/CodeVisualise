'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { GraphData, GraphNode } from '@/types'
import { COLOR_MAP, DEFAULT_COLOR } from '@/lib/fileColors'

export type RenderMode = 'tree' | 'directory'

interface Props {
  data: GraphData
  onNodeClick: (node: GraphNode) => void
  selectedNodeId?: string
  highlightedDirPath?: string
  repoName?: string
  renderMode: RenderMode
}

type HN      = d3.HierarchyPointNode<GraphNode>
type HL      = d3.HierarchyPointLink<GraphNode>
type NodeSel = d3.Selection<SVGGElement, HN, SVGGElement, unknown>

const MODE_LABELS: Record<RenderMode, string> = {
  tree:      'Tree view',
  directory: 'Directory view',
}

const LEGEND_ITEMS = [
  { label: 'TypeScript', color: '#6366f1' },
  { label: 'JavaScript', color: '#f59e0b' },
  { label: 'Python',     color: '#10b981' },
  { label: 'Markdown',   color: '#94a3b8' },
  { label: 'Other',      color: '#cbd5e1' },
]

function fileColor(ext: string): string {
  return COLOR_MAP[ext.toLowerCase()] ?? DEFAULT_COLOR
}

function nodeLabel(node: GraphNode, repoName?: string): string {
  return node.id === '__root__' ? (repoName ?? '/') : node.name
}

function dirW(label: string): number {
  return Math.max(68, label.length * 7 + 24)
}
const DIR_H = 26

// Build a map of dir id → total file count (from full unfiltered data)
function buildFileCounts(allNodes: GraphNode[]): Map<string, number> {
  const files = allNodes.filter(n => n.type === 'file')
  const dirs  = allNodes.filter(n => n.type === 'dir')
  const counts = new Map<string, number>()
  for (const dir of dirs) {
    if (dir.id === '__root__') {
      counts.set(dir.id, files.length)
    } else {
      const prefix = dir.path + '/'
      counts.set(dir.id, files.filter(f => f.path.startsWith(prefix)).length)
    }
  }
  return counts
}

function badgeLabel(node: GraphNode, counts: Map<string, number>, repoName?: string): string {
  const name  = nodeLabel(node, repoName)
  const count = counts.get(node.id) ?? 0
  return count > 0 ? `${name}  ·  ${count} files` : name
}

// BFS cap — always produces a connected subgraph
function capData(data: GraphData, mode: RenderMode, max: number): GraphData {
  const childMap = new Map<string, string[]>()
  const nodeMap  = new Map(data.nodes.map(n => [n.id, n]))

  for (const link of data.links) {
    const src = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id
    const tgt = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id
    if (!childMap.has(src)) childMap.set(src, [])
    childMap.get(src)!.push(tgt)
  }

  const result: GraphNode[] = []
  const visited = new Set<string>()
  const queue   = ['__root__']

  while (queue.length > 0 && result.length < max) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const node = nodeMap.get(id)
    if (!node) continue
    if (mode === 'directory' && node.type === 'file') continue // dirs only
    result.push(node)
    for (const child of childMap.get(id) ?? []) {
      if (!visited.has(child)) queue.push(child)
    }
  }

  const ids   = new Set(result.map(n => n.id))
  const links = data.links.filter(l => {
    const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id
    const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id
    return ids.has(src) && ids.has(tgt)
  })

  return { nodes: result, links }
}

// ─────────────────────────────────────────────────────────────────────────────

export function ForceGraph({ data, onNodeClick, selectedNodeId, highlightedDirPath, repoName, renderMode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef       = useRef<SVGSVGElement>(null)
  const tooltipRef   = useRef<HTMLDivElement>(null)
  const nodeGsRef    = useRef<NodeSel | null>(null)

  // Lightweight selection / highlight update — no re-render
  useEffect(() => {
    const g = nodeGsRef.current
    if (!g) return
    g.select<SVGCircleElement>('circle')
      .attr('stroke', (d: HN) => d.data.id === selectedNodeId ? '#6366f1' : 'none')
      .attr('stroke-width', (d: HN) => d.data.id === selectedNodeId ? 2.5 : 0)
      .attr('opacity', (d: HN) => {
        if (!highlightedDirPath) return 1
        return d.data.path.startsWith(highlightedDirPath) ? 1 : 0.2
      })
    g.select<SVGRectElement>('rect')
      .attr('stroke', (d: HN) => d.data.id === selectedNodeId ? '#4f46e5' : '#6366f1')
      .attr('stroke-width', (d: HN) => d.data.id === selectedNodeId ? 2.5 : 1.5)
      .attr('opacity', (d: HN) => {
        if (!highlightedDirPath) return 1
        if (d.data.id === '__root__') return 1
        if (highlightedDirPath.startsWith(d.data.path) && d.data.path !== '') return 1
        if (d.data.path.startsWith(highlightedDirPath)) return 1
        return 0.2
      })
  }, [selectedNodeId, highlightedDirPath])

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data.nodes.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width, height } = containerRef.current.getBoundingClientRect()
    svg.attr('width', width).attr('height', height)

    // Counts from FULL data (for directory badges and true totals)
    const fileCounts = buildFileCounts(data.nodes)

    // Cap to 120 SVG nodes
    const capped = capData(data, renderMode, 120)

    // Build parent map for stratify
    const parentMap = new Map<string, string>()
    for (const link of capped.links) {
      const src = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id
      const tgt = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id
      parentMap.set(tgt, src)
    }
    const validNodes = capped.nodes.filter(n => n.id === '__root__' || parentMap.has(n.id))

    let treeData: HN
    try {
      const hier = d3.stratify<GraphNode>()
        .id(d => d.id)
        .parentId(d => parentMap.get(d.id) ?? null)
        (validNodes)

      if (renderMode === 'tree') {
        // LTR: d.x = breadth (vertical on screen), d.y = depth (horizontal)
        treeData = d3.tree<GraphNode>()
          .nodeSize([40, 180])
          .separation((a, b) => a.parent === b.parent ? 1 : 1.5)(hier)
      } else {
        // Directory mode: top-to-bottom, dirs only
        const baseW = 110
        treeData = d3.tree<GraphNode>()
          .nodeSize([baseW, 100])
          .separation((a, b) => {
            const la = badgeLabel(a.data, fileCounts, repoName)
            const lb = badgeLabel(b.data, fileCounts, repoName)
            const wa = dirW(la) / baseW
            const wb = dirW(lb) / baseW
            return a.parent === b.parent ? (wa + wb) / 2 + 0.2 : (wa + wb) / 2 + 0.6
          })(hier)
      }
    } catch {
      return
    }

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 3])
      .on('zoom', ev => rootG.attr('transform', ev.transform))
    svg.call(zoom).on('dblclick.zoom', null)

    const rootG = svg.append('g')

    function fitToViewport() {
      const pts = treeData.descendants()
      const pad = 60
      if (renderMode === 'tree') {
        // LTR: screen x = d.y, screen y = d.x
        const xs   = pts.map(d => d.y)
        const ys   = pts.map(d => d.x)
        const minX = Math.min(...xs) - 40
        const maxX = Math.max(...xs) + 60
        const minY = Math.min(...ys) - 24
        const maxY = Math.max(...ys) + 24
        const tw   = maxX - minX, th = maxY - minY
        const scale = Math.min(1.2, (width - pad * 2) / tw, (height - pad * 2) / th)
        svg.transition().duration(600).call(zoom.transform,
          d3.zoomIdentity.translate(pad - minX * scale, (height - th * scale) / 2 - minY * scale).scale(scale))
      } else {
        // Top-to-bottom: screen x = d.x, screen y = d.y
        const xs   = pts.map(d => d.x)
        const ys   = pts.map(d => d.y)
        const minX = Math.min(...xs) - 60
        const maxX = Math.max(...xs) + 60
        const minY = Math.min(...ys) - 24
        const maxY = Math.max(...ys) + 44
        const tw   = maxX - minX, th = maxY - minY
        const scale = Math.min(1.4, (width - pad * 2) / tw, (height - pad * 2) / th)
        svg.transition().duration(600).call(zoom.transform,
          d3.zoomIdentity.translate((width - tw * scale) / 2 - minX * scale, pad - minY * scale).scale(scale))
      }
    }

    // ── Links ────────────────────────────────────────────────────────────────
    const linkGen = renderMode === 'tree'
      ? d3.linkHorizontal<HL, HN>().x(d => d.y).y(d => d.x)
      : d3.linkVertical<HL, HN>().x(d => d.x).y(d => d.y)

    rootG.append('g')
      .selectAll<SVGPathElement, HL>('path')
      .data(treeData.links())
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0)
      .attr('d', d => linkGen(d))
      .transition().delay(320).duration(580)
      .attr('opacity', 1)

    // ── Node groups (all start at tree root) ─────────────────────────────────
    const startT = renderMode === 'tree'
      ? `translate(${treeData.y},${treeData.x})`
      : `translate(${treeData.x},${treeData.y})`

    const nodeGs: NodeSel = rootG.append('g')
      .selectAll<SVGGElement, HN>('g')
      .data(treeData.descendants())
      .join('g')
      .attr('transform', startT)

    nodeGsRef.current = nodeGs

    // ── Render by mode ───────────────────────────────────────────────────────
    if (renderMode === 'directory') {
      // Rounded rect with "name · N files" badge — ALL nodes are dirs
      nodeGs.append('rect')
        .attr('x',      d => -dirW(badgeLabel(d.data, fileCounts, repoName)) / 2)
        .attr('y',      -DIR_H / 2)
        .attr('width',  d =>  dirW(badgeLabel(d.data, fileCounts, repoName)))
        .attr('height', DIR_H)
        .attr('rx', 6)
        .attr('fill', '#eff6ff')
        .attr('stroke', '#6366f1')
        .attr('stroke-width', 1.5)
        .style('filter', 'drop-shadow(0 1px 4px rgba(99,102,241,0.18))')
        .style('cursor', 'pointer')

      nodeGs.append('text')
        .text(d => badgeLabel(d.data, fileCounts, repoName))
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('font-size', '11px').attr('font-weight', '600').attr('fill', '#374151')
        .style('pointer-events', 'none').style('user-select', 'none')

    } else {
      // Tree mode — dirs + files
      const dirGs  = nodeGs.filter(d => d.data.type === 'dir')
      const fileGs = nodeGs.filter(d => d.data.type === 'file')

      dirGs.append('rect')
        .attr('x',      d => -dirW(nodeLabel(d.data, repoName)) / 2)
        .attr('y',      -DIR_H / 2)
        .attr('width',  d =>  dirW(nodeLabel(d.data, repoName)))
        .attr('height', DIR_H)
        .attr('rx', 6)
        .attr('fill', '#eff6ff')
        .attr('stroke', '#6366f1')
        .attr('stroke-width', 1.5)
        .style('filter', 'drop-shadow(0 1px 4px rgba(99,102,241,0.18))')
        .style('cursor', 'default')

      dirGs.append('text')
        .text(d => nodeLabel(d.data, repoName))
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('font-size', '11px').attr('font-weight', '600').attr('fill', '#374151')
        .style('pointer-events', 'none').style('user-select', 'none')

      fileGs.append('circle')
        .attr('r', 5)
        .attr('fill', d => fileColor(d.data.extension))
        .style('cursor', 'pointer')

      // File labels — adapt density
      const fnodes   = treeData.descendants().filter(d => d.data.type === 'file')
      const byDepth  = d3.group(fnodes, d => d.depth)
      let minHDist   = Infinity
      byDepth.forEach(arr => {
        const sorted = arr.slice().sort((a, b) => a.x - b.x)
        for (let i = 1; i < sorted.length; i++) minHDist = Math.min(minHDist, sorted[i].x - sorted[i - 1].x)
      })
      const dense      = minHDist < 75
      const labelSize  = dense ? '9px'  : '10px'
      const labelMaxCh = dense ? 10     : 12

      fileGs.append('text')
        .text(d => { const n = d.data.name; return n.length > labelMaxCh ? n.slice(0, labelMaxCh - 1) + '…' : n })
        .attr('font-size', labelSize).attr('fill', '#6b7280')
        .attr('text-anchor', 'middle').attr('transform', 'translate(0,14)')
        .style('pointer-events', 'none').style('user-select', 'none')
    }

    // ── Tooltip ──────────────────────────────────────────────────────────────
    const tooltip = d3.select(tooltipRef.current)

    nodeGs
      .on('mouseover', (event: MouseEvent, d: HN) => {
        const el = d3.select(event.currentTarget as SVGGElement)
        if (d.data.type === 'dir') {
          el.select('rect').transition().duration(120).attr('fill', '#e0e7ff')
          if (renderMode === 'directory') {
            const count = (fileCounts.get(d.data.id) ?? 0)
            tooltip.style('display', 'block').html(
              `<span style="font-weight:500;color:#111827">${nodeLabel(d.data, repoName)}</span>` +
              `<span style="margin-left:8px;font-size:11px;color:#6b7280">${count} files — click to browse</span>`
            )
          }
        } else {
          el.select('circle').transition().duration(120).attr('r', 7.5)
          const color = fileColor(d.data.extension), ext = d.data.extension || '—'
          tooltip.style('display', 'block').html(
            `<span style="font-weight:500;color:#111827">${d.data.name}</span>` +
            `<span style="margin-left:8px;font-size:11px;border-radius:20px;padding:2px 7px;` +
            `background:${color}18;color:${color};border:1px solid ${color}30">.${ext}</span>`
          )
        }
      })
      .on('mousemove', (event: MouseEvent) => {
        const r = containerRef.current!.getBoundingClientRect()
        tooltip.style('left', `${event.clientX - r.left + 12}px`).style('top', `${event.clientY - r.top - 8}px`)
      })
      .on('mouseout', (event: MouseEvent, d: HN) => {
        d3.select(event.currentTarget as SVGGElement)
          .select(d.data.type === 'dir' ? 'rect' : 'circle')
          .transition().duration(120)
          .attr(d.data.type === 'dir' ? 'fill' : 'r', d.data.type === 'dir' ? '#eff6ff' : 5)
        tooltip.style('display', 'none')
      })
      .on('click', (event: MouseEvent, d: HN) => {
        event.stopPropagation()
        if (renderMode === 'directory' && d.data.type === 'dir')  onNodeClick(d.data)
        if (renderMode !== 'directory' && d.data.type === 'file') onNodeClick(d.data)
      })

    // ── Fly-in animation ─────────────────────────────────────────────────────
    nodeGs.transition()
      .duration(800).ease(d3.easeCubicOut)
      .attr('transform', d => renderMode === 'tree'
        ? `translate(${d.y},${d.x})`
        : `translate(${d.x},${d.y})`)

    svg.on('dblclick', fitToViewport)

    setTimeout(fitToViewport, 900)

    return () => { nodeGsRef.current = null }
  }, [data, onNodeClick, renderMode, repoName])

  // ResizeObserver — update SVG dimensions only
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      d3.select(svgRef.current).attr('width', width).attr('height', height)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // True totals from FULL data for badge
  const totalFiles = data.nodes.filter(n => n.type === 'file').length
  const totalDirs  = data.nodes.filter(n => n.type === 'dir' && n.id !== '__root__').length

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', background: '#fafafa' }}>
      <svg ref={svgRef} style={{ display: 'block' }} />

      {/* Hover tooltip */}
      <div ref={tooltipRef} style={{
        display: 'none', position: 'absolute', pointerEvents: 'none',
        background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px',
        padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
        fontSize: '13px', whiteSpace: 'nowrap', zIndex: 20,
      }} />

      {/* Mode badge — top-right */}
      <div style={{
        position: 'absolute', top: '16px', right: '16px',
        background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '20px',
        padding: '4px 12px', fontSize: '12px', color: '#6b7280',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', zIndex: 10,
      }}>
        {MODE_LABELS[renderMode]}
      </div>

      {/* Legend — bottom-left */}
      <div style={{
        position: 'absolute', bottom: '20px', left: '20px',
        background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', zIndex: 10,
      }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          File types
        </div>
        {LEGEND_ITEMS.map(({ label, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#6b7280' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* True file count badge — bottom-right */}
      <div style={{
        position: 'absolute', bottom: '20px', right: '20px',
        background: '#111827', color: '#ffffff',
        borderRadius: '20px', padding: '4px 12px', fontSize: '12px', zIndex: 10,
      }}>
        {totalFiles} files · {totalDirs} {totalDirs === 1 ? 'directory' : 'directories'}
      </div>
    </div>
  )
}
