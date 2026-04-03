import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3'

export interface GitHubTreeItem {
  path: string
  type: 'blob' | 'tree'
  sha: string
  size?: number
  url: string
}

export interface GraphNode extends SimulationNodeDatum {
  id: string
  name: string
  type: 'file' | 'dir'
  extension: string
  depth: number
  path: string
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}
