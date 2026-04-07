'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { GraphData, GraphNode } from '@/types'
import { COLOR_MAP, DEFAULT_COLOR } from '@/lib/fileColors'

interface Props {
  data: GraphData
  onNodeClick: (node: GraphNode) => void
  selectedNodeId?: string
  highlightedDirPath?: string
  repoName?: string
}

type TreeNode = d3.HierarchyPointNode<GraphNode>
type TreeLink = d3.HierarchyPointLink<GraphNode>
type NodeGs   = d3.Selection<SVGGElement, TreeNode, SVGGElement, unknown>

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

function dirW(name: string): number {
  return Math.max(64, name.length * 7 + 24)
}
const DIR_H = 26

export function ForceGraph({ data, onNodeClick, selectedNodeId, highlightedDirPath, repoName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef       = useRef<SVGSVGElement>(null)
  const tooltipRef   = useRef<HTMLDivElement>(null)
  const nodeGsRef    = useRef<NodeGs | null>(null)

  // Lightweight effect: update selection ring + highlight without re-rendering
  useEffect(() => {
    const g = nodeGsRef.current
    if (!g) return

    // File circles
    g.select<SVGCircleElement>('circle')
      .attr('stroke', (d: TreeNode) => d.data.id === selectedNodeId ? '#6366f1' : 'none')
      .attr('stroke-width', (d: TreeNode) => d.data.id === selectedNodeId ? 2.5 : 0)
      .attr('opacity', (d: TreeNode) => {
        if (!highlightedDirPath) return 1
        return d.data.path.startsWith(highlightedDirPath) ? 1 : 0.2
      })

    // Dir rects
    g.select<SVGRectElement>('rect')
      .attr('stroke', (d: TreeNode) => d.data.id === selectedNodeId ? '#4f46e5' : '#6366f1')
      .attr('stroke-width', (d: TreeNode) => d.data.id === selectedNodeId ? 2.5 : 1.5)
      .attr('opacity', (d: TreeNode) => {
        if (!highlightedDirPath) return 1
        if (d.data.id === '__root__') return 1
        if (highlightedDirPath.startsWith(d.data.path) && d.data.path !== '') return 1 // ancestors
        if (d.data.path.startsWith(highlightedDirPath)) return 1 // self + descendants
        return 0.2
      })
  }, [selectedNodeId, highlightedDirPath])

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data.nodes.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width, height } = containerRef.current.getBoundingClientRect()
    svg.attr('width', width).attr('height', height)

    // Build parent map
    const parentMap = new Map<string, string>()
    for (const link of data.links) {
      const src = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id
      const tgt = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id
      parentMap.set(tgt, src)
    }

    // Drop orphan nodes (no parent, not root) — prevents stratify throwing
    const validNodes = data.nodes.filter(n => n.id === '__root__' || parentMap.has(n.id))

    let treeData: TreeNode
    try {
      const hier = d3.stratify<GraphNode>()
        .id(d => d.id)
        .parentId(d => parentMap.get(d.id) ?? null)
        (validNodes)

      treeData = d3.tree<GraphNode>()
        .nodeSize([70, 110])
        .separation((a, b) => {
          const wa = a.data.type === 'dir' ? dirW(a.data.name) / 70 : 0.8
          const wb = b.data.type === 'dir' ? dirW(b.data.name) / 70 : 0.8
          return a.parent === b.parent ? (wa + wb) / 2 + 0.2 : (wa + wb) / 2 + 0.6
        })(hier)
    } catch {
      return
    }

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 3])
      .on('zoom', ev => rootG.attr('transform', ev.transform))
    svg.call(zoom).on('dblclick.zoom', null)

    const rootG = svg.append('g')

    function fitTree() {
      const pts  = treeData.descendants()
      const xs   = pts.map(n => n.x)
      const ys   = pts.map(n => n.y)
      const pad  = 40
      const minX = Math.min(...xs) - 50
      const maxX = Math.max(...xs) + 50
      const minY = Math.min(...ys) - 20
      const maxY = Math.max(...ys) + 44
      const tw   = maxX - minX
      const th   = maxY - minY
      const scale = Math.min(1.4, (width - pad * 2) / tw, (height - pad * 2) / th)
      const tx    = (width  - tw * scale) / 2 - minX * scale
      const ty    = pad - minY * scale
      svg.transition().duration(600)
        .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
    }

    // Curved vertical links
    const linkGen = d3.linkVertical<TreeLink, TreeNode>()
      .x(d => d.x)
      .y(d => d.y)

    rootG.append('g')
      .selectAll<SVGPathElement, TreeLink>('path')
      .data(treeData.links())
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0)
      .attr('d', d => linkGen(d))
      .transition().delay(350).duration(550)
      .attr('opacity', 1)

    // Node groups — all start at root, animate to final position
    const rootX = treeData.x
    const rootY = treeData.y

    const nodeGs: NodeGs = rootG.append('g')
      .selectAll<SVGGElement, TreeNode>('g')
      .data(treeData.descendants())
      .join('g')
      .attr('transform', `translate(${rootX},${rootY})`)

    nodeGsRef.current = nodeGs

    // Compute label density to decide font-size and truncation length
    const fileNodes = treeData.descendants().filter(d => d.data.type === 'file')
    const byDepth   = d3.group(fileNodes, d => d.depth)
    let minHDist    = Infinity
    byDepth.forEach(nodesAtDepth => {
      const sorted = nodesAtDepth.slice().sort((a, b) => a.x - b.x)
      for (let i = 1; i < sorted.length; i++) {
        minHDist = Math.min(minHDist, sorted[i].x - sorted[i - 1].x)
      }
    })
    const dense = minHDist < 75
    const labelFontSize  = dense ? '9px'  : '10px'
    const labelMaxChars  = dense ? 10     : 12

    function dirLabel(d: TreeNode): string {
      return d.data.id === '__root__' ? (repoName ?? '/') : d.data.name
    }

    // Dir nodes → rounded rect
    const dirGs = nodeGs.filter(d => d.data.type === 'dir')

    dirGs.append('rect')
      .attr('x', d => -dirW(dirLabel(d)) / 2)
      .attr('y', -DIR_H / 2)
      .attr('width', d => dirW(dirLabel(d)))
      .attr('height', DIR_H)
      .attr('rx', 6)
      .attr('fill', '#eff6ff')
      .attr('stroke', '#6366f1')
      .attr('stroke-width', 1.5)
      .style('filter', 'drop-shadow(0 1px 4px rgba(99,102,241,0.18))')
      .style('cursor', 'default')

    dirGs.append('text')
      .text(d => dirLabel(d))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', '#374151')
      .style('pointer-events', 'none')
      .style('user-select', 'none')

    // File nodes → circle + label
    const fileGs = nodeGs.filter(d => d.data.type === 'file')

    fileGs.append('circle')
      .attr('r', 5)
      .attr('fill', d => fileColor(d.data.extension))
      .style('cursor', 'pointer')

    fileGs.append('text')
      .text(d => {
        const n = d.data.name
        return n.length > labelMaxChars ? n.slice(0, labelMaxChars - 1) + '…' : n
      })
      .attr('font-size', labelFontSize)
      .attr('fill', '#6b7280')
      .attr('text-anchor', 'middle')
      .attr('transform', 'translate(0,14)')
      .style('pointer-events', 'none')
      .style('user-select', 'none')

    // Tooltip
    const tooltip = d3.select(tooltipRef.current)

    nodeGs
      .on('mouseover', (event: MouseEvent, d: TreeNode) => {
        const el = d3.select(event.currentTarget as SVGGElement)
        if (d.data.type === 'dir') {
          el.select('rect').transition().duration(120).attr('fill', '#e0e7ff')
        } else {
          el.select('circle').transition().duration(120).attr('r', 7.5)
          const color = fileColor(d.data.extension)
          const ext   = d.data.extension || '—'
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
      .on('mouseout', (event: MouseEvent, d: TreeNode) => {
        const el = d3.select(event.currentTarget as SVGGElement)
        if (d.data.type === 'dir') {
          el.select('rect').transition().duration(120).attr('fill', '#eff6ff')
        } else {
          el.select('circle').transition().duration(120).attr('r', 5)
          tooltip.style('display', 'none')
        }
      })
      .on('click', (event: MouseEvent, d: TreeNode) => {
        event.stopPropagation()
        if (d.data.type === 'file') onNodeClick(d.data)
      })

    // Fly-in: animate from root to final positions
    nodeGs.transition()
      .duration(800).ease(d3.easeCubicOut)
      .attr('transform', d => `translate(${d.x},${d.y})`)

    // Zoom to fit after animation settles
    setTimeout(fitTree, 900)

    return () => { nodeGsRef.current = null }
  }, [data, onNodeClick, repoName])

  // ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      d3.select(svgRef.current).attr('width', width).attr('height', height)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const fileCount = data.nodes.filter(n => n.type === 'file').length
  const dirCount  = data.nodes.filter(n => n.type === 'dir' && n.id !== '__root__').length

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

      {/* Legend */}
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

      {/* File count badge */}
      <div style={{
        position: 'absolute', bottom: '20px', right: '20px',
        background: '#111827', color: '#ffffff',
        borderRadius: '20px', padding: '4px 12px', fontSize: '12px', zIndex: 10,
      }}>
        {fileCount} files · {dirCount} {dirCount === 1 ? 'directory' : 'directories'}
      </div>
    </div>
  )
}
