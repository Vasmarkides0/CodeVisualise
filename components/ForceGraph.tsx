'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { GraphData, GraphNode, GraphLink } from '@/types'
import { nodeColor } from '@/lib/fileColors'

interface Props {
  data: GraphData
  onNodeClick: (node: GraphNode) => void
}

export function ForceGraph({ data, onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data.nodes.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width, height } = containerRef.current.getBoundingClientRect()
    svg.attr('width', width).attr('height', height)

    const cx = width / 2
    const cy = height / 2

    const nodes: GraphNode[] = data.nodes.map(n => ({ ...n, x: 0, y: 0 }))
    const links: GraphLink[] = data.links.map(l => ({ ...l }))

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(60)
      )
      .force('charge', d3.forceManyBody<GraphNode>().strength(-350))
      .force('center', d3.forceCenter(cx, cy))
      .force('collide', d3.forceCollide<GraphNode>(d => d.type === 'dir' ? 18 : 12))
      .alphaDecay(0.02)
      .alpha(1)

    simulationRef.current = simulation

    function applyRadialLayout() {
      const byDepth = d3.group(nodes, d => d.depth)
      byDepth.forEach((nodesAtDepth, depth) => {
        const radius = depth * 80
        nodesAtDepth.forEach((node, i) => {
          const angle = (2 * Math.PI * i) / nodesAtDepth.length
          node.x = cx + radius * Math.cos(angle)
          node.y = cy + radius * Math.sin(angle)
        })
      })
    }

    const fallbackTimer = setTimeout(() => {
      if (simulation.alpha() > simulation.alphaMin()) {
        simulation.stop()
        applyRadialLayout()
        refreshPositions()
      }
    }, 5000)

    // Links — more visible
    const linkSel = svg.append('g')
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', '#64748b')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1.5)

    // Nodes
    const nodeSel = svg.append('g')
      .selectAll<SVGCircleElement, GraphNode>('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => d.type === 'dir' ? 12 : 8)
      .attr('fill', d => nodeColor(d))
      .attr('stroke', d => d.type === 'dir' ? '#e2e8f0' : 'none')
      .attr('stroke-width', d => d.type === 'dir' ? 2 : 0)
      .style('cursor', d => d.type === 'file' ? 'pointer' : 'default')

    // Directory labels (always visible)
    const labelSel = svg.append('g')
      .selectAll<SVGTextElement, GraphNode>('text')
      .data(nodes.filter(n => n.type === 'dir'))
      .join('text')
      .text(d => d.name)
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('text-anchor', 'middle')
      .attr('dy', '-16')
      .style('pointer-events', 'none')
      .style('user-select', 'none')

    // Hover tooltip for file nodes
    const tooltip = d3.select(tooltipRef.current)

    nodeSel
      .on('mouseover', (event: MouseEvent, d: GraphNode) => {
        // Pulse scale up
        d3.select(event.currentTarget as SVGCircleElement)
          .transition().duration(150)
          .attr('r', d.type === 'dir' ? 15 : 11)
          .attr('stroke', nodeColor(d))
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.6)

        // Show tooltip for file nodes
        if (d.type === 'file') {
          tooltip
            .style('display', 'block')
            .text(d.path)
        }
      })
      .on('mousemove', (event: MouseEvent) => {
        const rect = containerRef.current!.getBoundingClientRect()
        tooltip
          .style('left', `${event.clientX - rect.left + 12}px`)
          .style('top', `${event.clientY - rect.top - 8}px`)
      })
      .on('mouseout', (event: MouseEvent, d: GraphNode) => {
        d3.select(event.currentTarget as SVGCircleElement)
          .transition().duration(150)
          .attr('r', d.type === 'dir' ? 12 : 8)
          .attr('stroke', d.type === 'dir' ? '#e2e8f0' : 'none')
          .attr('stroke-width', d.type === 'dir' ? 2 : 0)
          .attr('stroke-opacity', 1)

        tooltip.style('display', 'none')
      })

    // Drag
    const drag = d3.drag<SVGCircleElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    nodeSel.call(drag)

    nodeSel.on('click', (event, d) => {
      event.stopPropagation()
      if (d.type === 'file') onNodeClick(d)
    })

    function refreshPositions() {
      linkSel
        .attr('x1', d => (d.source as GraphNode).x ?? 0)
        .attr('y1', d => (d.source as GraphNode).y ?? 0)
        .attr('x2', d => (d.target as GraphNode).x ?? 0)
        .attr('y2', d => (d.target as GraphNode).y ?? 0)
      nodeSel
        .attr('cx', d => d.x ?? 0)
        .attr('cy', d => d.y ?? 0)
      labelSel
        .attr('x', d => d.x ?? 0)
        .attr('y', d => d.y ?? 0)
    }

    simulation.on('tick', refreshPositions)
    simulation.on('end', () => clearTimeout(fallbackTimer))

    return () => {
      simulation.stop()
      clearTimeout(fallbackTimer)
    }
  }, [data, onNodeClick])

  // ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      d3.select(svgRef.current).attr('width', width).attr('height', height)
      const sim = simulationRef.current
      if (sim) {
        sim.force('center', d3.forceCenter(width / 2, height / 2))
        sim.alpha(0.3).restart()
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg ref={svgRef} />
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none hidden bg-slate-800 text-slate-200 text-xs font-mono px-2 py-1 rounded border border-slate-600 whitespace-nowrap z-20"
        style={{ display: 'none' }}
      />
    </div>
  )
}
