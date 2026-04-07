import type { GraphNode } from '@/types'

export const COLOR_MAP: Record<string, string> = {
  ts:   '#6366f1',
  tsx:  '#6366f1',
  js:   '#f59e0b',
  jsx:  '#f59e0b',
  mjs:  '#f59e0b',
  py:   '#10b981',
  md:   '#94a3b8',
  mdx:  '#94a3b8',
  json: '#f97316',
  css:  '#ec4899',
  scss: '#ec4899',
  sass: '#ec4899',
  html: '#ef4444',
  yml:  '#14b8a6',
  yaml: '#14b8a6',
  rs:   '#fb923c',
  go:   '#06b6d4',
  rb:   '#f87171',
  sh:   '#84cc16',
}

export const DIR_COLOR = '#6366f1'
export const DEFAULT_COLOR = '#94a3b8'

export function nodeColor(node: Pick<GraphNode, 'type' | 'extension'>): string {
  if (node.type === 'dir') return DIR_COLOR
  return COLOR_MAP[node.extension.toLowerCase()] ?? DEFAULT_COLOR
}
