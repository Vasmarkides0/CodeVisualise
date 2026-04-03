import type { GitHubTreeItem, GraphData, GraphNode, GraphLink } from '@/types'

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'vendor',
])

const MAX_NODES = 300

export function parseTree(items: GitHubTreeItem[]): GraphData {
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []
  const nodeIds = new Set<string>()

  const root: GraphNode = {
    id: '__root__',
    name: '/',
    type: 'dir',
    extension: '',
    depth: 0,
    path: '',
    x: 0,
    y: 0,
  }
  nodes.push(root)
  nodeIds.add('__root__')

  const sorted = [...items].sort((a, b) => a.path.localeCompare(b.path))

  for (const item of sorted) {
    if (nodes.length >= MAX_NODES) break

    const segments = item.path.split('/')
    if (IGNORED_DIRS.has(segments[0])) continue

    const name = segments[segments.length - 1]
    const ext = name.includes('.') ? name.split('.').pop()! : ''

    const node: GraphNode = {
      id: item.path,
      name,
      type: item.type === 'tree' ? 'dir' : 'file',
      extension: ext,
      depth: segments.length,
      path: item.path,
      x: 0,
      y: 0,
    }

    nodes.push(node)
    nodeIds.add(item.path)

    const parentPath = segments.slice(0, -1).join('/')
    const parentId = parentPath === '' ? '__root__' : parentPath
    if (nodeIds.has(parentId)) {
      links.push({ source: parentId, target: item.path })
    }
  }

  return { nodes, links }
}
