import type { GraphNode } from '@/types'

const COLOR_MAP: Record<string, string> = {
  ts: '#3b82f6',
  tsx: '#60a5fa',
  js: '#eab308',
  jsx: '#fbbf24',
  mjs: '#fbbf24',
  py: '#22c55e',
  css: '#ec4899',
  scss: '#f472b6',
  sass: '#f472b6',
  json: '#f97316',
  md: '#a78bfa',
  mdx: '#c4b5fd',
  html: '#ef4444',
  yml: '#14b8a6',
  yaml: '#14b8a6',
  rs: '#fb923c',
  go: '#67e8f9',
}

const DIR_COLOR = '#94a3b8'
const DEFAULT_COLOR = '#cbd5e1'

export function nodeColor(node: Pick<GraphNode, 'type' | 'extension'>): string {
  if (node.type === 'dir') return DIR_COLOR
  return COLOR_MAP[node.extension.toLowerCase()] ?? DEFAULT_COLOR
}
