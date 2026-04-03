# Live Codebase Visualizer — Hackathon Plan

## Context
Empty git repo (only LICENSE + README). Building a full Next.js 14 app: GitHub repo URL → D3 force graph → Claude explanation sidebar. Demo tonight.

Each phase is one Claude Code session. Complete the gate check before starting the next phase.

---

## Decisions
1. **Pre-cache**: depth ≤ 2 + extensions ts/js/py/tsx/jsx, first 5 matches
2. **Labels**: hover tooltip via SVG `<title>` (no static labels)
3. **File-type gate**: skip `.lock`, `.min.js`, `.map`, `.svg`, `.png`, `.jpg`, `.ico`
4. **Claude model**: `claude-sonnet-4-6`
5. **Scope**: public repos only

---

## - [x] Phase 1 — Scaffold & Install

**Goal:** Runnable Next.js 14 dev server with Tailwind.

**Files to create:**
- `package.json`
- `.gitignore` — node_modules/, .next/, .env.local
- `tsconfig.json` — `"moduleResolution": "bundler"` (required for D3 ESM types)
- `next.config.mjs` — `transpilePackages: ['d3', 'internmap', 'robust-predicates', 'd3-delaunay']` (must be `.mjs`, not `.ts` — Next.js 14 doesn't support TS config files)
- `tailwind.config.ts` — `animate-slide-in` keyframe: `translateX(100%) → translateX(0)`
- `postcss.config.js`
- `app/globals.css` — `@tailwind` directives; `html,body { height:100%; background:#0f172a; color:#f1f5f9 }`
- `app/layout.tsx` — root layout, imports globals.css
- `.env.local` — `GITHUB_TOKEN=` and `ANTHROPIC_API_KEY=` (no `NEXT_PUBLIC_` — server only)

**Install command (run after creating package.json):**
```bash
npm install next@14.2.35 react@18 react-dom@18 d3@7.9.0 @anthropic-ai/sdk@0.82.0 \
  && npm install -D typescript@5 @types/node@22 @types/react@18 @types/react-dom@18 \
     @types/d3@7.4.3 tailwindcss@3.4.19 postcss@8 autoprefixer@10
```

**Gate:** `npm run dev` starts without errors; `http://localhost:3000` returns 404 (no page yet — expected).

---

## - [x] Phase 2 — Types & Lib Utilities

**Goal:** All shared types and pure helper functions. No React, no D3 at runtime.

**Files to create:**

`types/index.ts`
- `GitHubTreeItem` — `path`, `type: 'blob'|'tree'`, `sha`, `size?`, `url`
- `GraphNode extends SimulationNodeDatum` — `id`, `name`, `type: 'file'|'dir'`, `extension`, `depth`, `path`; init `x:0, y:0`
- `GraphLink extends SimulationLinkDatum<GraphNode>` — `source: string|GraphNode`, `target: string|GraphNode`
- `GraphData` — `{ nodes: GraphNode[], links: GraphLink[] }`

`lib/fileColors.ts`
- `COLOR_MAP`: ts→blue-500, tsx→blue-400, js→yellow-500, jsx→yellow-400, py→green-500, css→pink-500, scss→pink-400, json→orange-500, md→violet-400, html→red-500, yml/yaml→teal-500, rs→orange-400, go→cyan-300
- `DIR_COLOR = '#94a3b8'`, `DEFAULT_COLOR = '#cbd5e1'`
- `export function nodeColor(node: Pick<GraphNode, 'type'|'extension'>): string`

`lib/github.ts`
- `headers()` — Authorization Bearer + Accept + X-GitHub-Api-Version
- `fetchTree(owner, repo)` — tries `main` then `master`; `next: { revalidate: 60 }`; warns on `truncated`
- `fetchFileContent(owner, repo, path)` — `Buffer.from(b64.replace(/\n/g,''), 'base64').toString('utf-8')`
- `parseRepoUrl(url)` — regex `github.com/owner/repo`, strip `.git`

`lib/parseTree.ts`
- `IGNORED_DIRS = new Set(['node_modules','.git','dist','build','.next','__pycache__','vendor'])`
- `MAX_NODES = 300`
- Implicit `__root__` dir node; skip items whose top-level segment is in `IGNORED_DIRS`
- Link each node to its parent (or `__root__` if depth 1); stop at `MAX_NODES`

**Gate:** `npx tsc --noEmit` passes on these files (ignore missing `next-env.d.ts`).

---

## - [x] Phase 3 — API Routes

**Goal:** Two working API endpoints. No frontend yet.

**Files to create:**

`app/api/github/route.ts`
- `GET ?url=` → fetch tree → `parseTree()` → return `GraphData` JSON
- `GET ?url=&path=` → `fetchFileContent()` → return `{ content: string }`
- 400 if `url` missing; 500 `{ error }` on thrown errors

`app/api/explain/route.ts`
- `POST { content, filename }`
- Skip list: `.lock`, `.min.js`, `.map`, `.svg`, `.png`, `.jpg`, `.ico` → return `{ explanation: 'Binary or generated file — no explanation available.' }`
- Truncate `content` to 4000 chars
- `model: 'claude-sonnet-4-6'`, `max_tokens: 300`
- `Anthropic` client instantiated at module level
- No `export const runtime = 'edge'` — Anthropic SDK requires Node.js

**Gate:**
```bash
curl "http://localhost:3000/api/github?url=https://github.com/sindresorhus/is-odd"
curl -X POST http://localhost:3000/api/explain \
  -H "Content-Type: application/json" \
  -d '{"content":"module.exports = n => n % 2 !== 0","filename":"index.js"}'
```

---

## - [x] Phase 4 — ForceGraph Component

**Goal:** Animated D3 graph renders in isolation with stub data.

**File:** `components/ForceGraph.tsx` — `'use client'`

- `containerRef` (div), `svgRef` (svg), `simulationRef = useRef<Simulation|null>(null)`
- `useEffect`: `svg.selectAll('*').remove()` on re-render; D3 owns all SVG children
- Forces: `forceLink(distance=50).id(d=>d.id)` + `forceManyBody(strength=-300)` + `forceCenter(cx,cy)` + `forceCollide(r: dir=14, file=10)`
- `alphaDecay: 0.02`, `alpha: 1` — slow cooling, all nodes start at (0,0)
- Tick: update `x1/y1/x2/y2` on links, `cx/cy` on nodes
- 5s radial fallback: if `sim.alpha() > sim.alphaMin()` → stop → group by `depth` → rings at `depth * 80px` → redraw
- Drag: fix `fx/fy` on start, track on drag, release on end
- Click: `if (d.type === 'file') onNodeClick(d)` — dirs no-op; `event.stopPropagation()`
- ResizeObserver: update SVG `width`/`height` attrs; update `forceCenter`; `sim.alpha(0.3).restart()`
- Render order: `<line>` links → `<circle>` nodes → `<title>` per node (full path tooltip)
- Links: `stroke='#475569'`, `strokeOpacity=0.4`, `strokeWidth=1`
- Dir nodes: `r=10`, fill from `nodeColor()`, `stroke='#e2e8f0'`, `strokeWidth=2`
- File nodes: `r=6`, fill from `nodeColor()`, `cursor='pointer'`
- Cast `link.source as GraphNode` in tick handler (D3 mutates string→object after init)

**Gate:** Stub `app/page.tsx` with 10–20 hardcoded nodes. Verify: nodes explode from center, drag works, hover shows path tooltip, clicking a file node logs to console.

---

## - [ ] Phase 5 — UI Wiring & Pre-cache

**Goal:** Full working app end-to-end.

**Files to create:**

`components/RepoInput.tsx`
- Controlled `<input type="url">` + `<form onSubmit>`
- Props: `onSubmit(url: string)`, `loading: boolean`
- Button disabled + "Loading…" while loading

`components/Sidebar.tsx`
- Returns `null` if `filename` is null
- `animate-slide-in`, `absolute right-0 top-0 h-full w-80 bg-slate-900 border-l border-slate-700 z-10`
- Header: filename in mono blue + ✕ close button
- Skeleton pulse while loading; explanation `<p>` when ready

`app/page.tsx`
- `dynamic(() => import('@/components/ForceGraph'), { ssr: false })` — mandatory
- State: `graphData`, `loading`, `selectedFile`, `explanation`, `explainLoading`
- `cacheRef = useRef<Map<string,string>>(new Map())`, `repoUrlRef = useRef('')`
- `handleRepoSubmit`: fetch `/api/github?url=` → `setGraphData` → `preCacheFirstFiles()`
- `preCacheFirstFiles`: filter `type==='file' && depth<=2 && ext in [ts,js,py,tsx,jsx]`, first 5, fire-and-forget fetch+explain, store in cache
- `handleNodeClick`: cache hit → instant; miss → fetch content → POST explain → display
- Layout: `flex flex-col h-screen` → input bar + `flex-1 relative` (graph + sidebar)
- Empty state: centered "Enter a GitHub repository URL above to visualize its structure"

**Gate:**
- `npm run dev` — no console errors
- Paste `https://github.com/sindresorhus/is-odd` → graph loads and animates
- Hover a node → path tooltip appears
- Click a `.js` file → sidebar slides in with explanation
- Click a pre-cached file → explanation appears instantly (no loading state)
- Resize window → graph recenters smoothly

---

## Cross-phase Gotchas

| # | Gotcha |
|---|--------|
| 1 | **D3 + SSR**: `transpilePackages` in next.config.ts + `ssr:false` in dynamic import — both required |
| 2 | **forceLink mutation**: after sim init, `link.source` is a `GraphNode` object — cast `as GraphNode` in tick handler |
| 3 | **Node cap**: 300-node hard limit + ignored dirs — without this, large repos freeze the browser |
| 4 | **Rate limits**: `GITHUB_TOKEN` mandatory — unauthenticated limit is 60 req/hr |
| 5 | **Tailwind keyframe**: `animate-slide-in` must be in `tailwind.config.ts` `keyframes` block or JIT won't emit it |
| 6 | **SVG sizing**: use `width`/`height` attrs (not `viewBox`) — viewBox doesn't reposition `forceCenter` on resize |
| 7 | **Anthropic SDK runtime**: never add `export const runtime = 'edge'` to explain route |
| 8 | **Buffer**: fine in Route Handlers; never use in client components — use `atob()` instead |
