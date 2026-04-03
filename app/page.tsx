'use client'

import dynamic from 'next/dynamic'
import type { GraphNode, GraphData } from '@/types'

const ForceGraph = dynamic(
  () => import('@/components/ForceGraph').then(m => m.ForceGraph),
  { ssr: false }
)

const STUB: GraphData = {
  nodes: [
    { id: '__root__', name: '/', type: 'dir', extension: '', depth: 0, path: '' },
    { id: 'src', name: 'src', type: 'dir', extension: '', depth: 1, path: 'src' },
    { id: 'lib', name: 'lib', type: 'dir', extension: '', depth: 1, path: 'lib' },
    { id: 'src/index.ts', name: 'index.ts', type: 'file', extension: 'ts', depth: 2, path: 'src/index.ts' },
    { id: 'src/app.tsx', name: 'app.tsx', type: 'file', extension: 'tsx', depth: 2, path: 'src/app.tsx' },
    { id: 'src/utils.js', name: 'utils.js', type: 'file', extension: 'js', depth: 2, path: 'src/utils.js' },
    { id: 'lib/helpers.ts', name: 'helpers.ts', type: 'file', extension: 'ts', depth: 2, path: 'lib/helpers.ts' },
    { id: 'lib/styles.css', name: 'styles.css', type: 'file', extension: 'css', depth: 2, path: 'lib/styles.css' },
    { id: 'package.json', name: 'package.json', type: 'file', extension: 'json', depth: 1, path: 'package.json' },
    { id: 'README.md', name: 'README.md', type: 'file', extension: 'md', depth: 1, path: 'README.md' },
    { id: 'tsconfig.json', name: 'tsconfig.json', type: 'file', extension: 'json', depth: 1, path: 'tsconfig.json' },
  ],
  links: [
    { source: '__root__', target: 'src' },
    { source: '__root__', target: 'lib' },
    { source: '__root__', target: 'package.json' },
    { source: '__root__', target: 'README.md' },
    { source: '__root__', target: 'tsconfig.json' },
    { source: 'src', target: 'src/index.ts' },
    { source: 'src', target: 'src/app.tsx' },
    { source: 'src', target: 'src/utils.js' },
    { source: 'lib', target: 'lib/helpers.ts' },
    { source: 'lib', target: 'lib/styles.css' },
  ],
}

export default function HomePage() {
  return (
    <div className="w-screen h-screen bg-slate-950">
      <ForceGraph
        data={STUB}
        onNodeClick={(node: GraphNode) => console.log('clicked:', node.path)}
      />
    </div>
  )
}
