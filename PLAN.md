# Live Codebase Visualizer — Hackathon Plan

## Context
Empty git repo (only LICENSE + README). Need to build a full Next.js 14 app from scratch: GitHub repo URL → D3 force graph → Claude explanation sidebar. Demo tonight.

---

## Phase 1: Scaffold & Config

**Files to create:**
- `package.json` (minimal: name, version, scripts)
- `.gitignore`
- `tsconfig.json` — `"moduleResolution": "bundler"` required for D3 ESM
- `next.config.ts` — **critical**: `transpilePackages: ['d3', 'internmap', 'robust-predicates', 'd3-delaunay']`
- `tailwind.config.ts` — include `animate-slide-in` keyframe (slideIn: translateX 100%→0)
- `postcss.config.js`
- `app/globals.css`
- `app/layout.tsx`
- `.env.local` — `GITHUB_TOKEN` + `ANTHROPIC_API_KEY` (server-only, no `NEXT_PUBLIC_`)

**Install command:**
```bash
npm install next@14.2.35 react@18 react-dom@18 d3@7.9.0 @anthropic-ai/sdk@0.82.0 \
  && npm install -D typescript@5 @types/node@22 @types/react@18 @types/react-dom@18 \
     @types/d3@7.4.3 tailwindcss@3.4.19 postcss@8 autoprefixer@10
```

---

## Phase 2: Types & Lib Utilities

**Files to create:**
- `types/index.ts` — `GitHubTreeItem`, `GraphNode extends d3.SimulationNodeDatum`, `GraphLink`, `GraphData`, `ExplainResponse`
- `lib/fileColors.ts` — extension→color map + `nodeColor()` fn
- `lib/github.ts` — `fetchTree()` (main→master fallback), `fetchFileContent()`, `parseRepoUrl()`
- `lib/parseTree.ts` — flat GitHub tree → D3 nodes/links; cap at 300 nodes; ignore `node_modules/.git/dist/build/.next`

Key details:
- `GraphNode`: set `x: 0, y: 0` explicitly → all nodes start at center → "explode" animation
- `lib/github.ts`: add `next: { revalidate: 60 }` on tree fetch only; `Buffer.from(b64, 'base64')` for file content

---

## Phase 3: API Routes

**Files to create:**
- `app/api/github/route.ts` — GET `?url=&path=` (without path: fetch+parse tree; with path: fetch file content)
- `app/api/explain/route.ts` — POST `{content, filename}` → Claude `claude-sonnet-4-6`, max_tokens 300; truncate input at 4000 chars; instantiate `Anthropic` client at module level

Do NOT add `export const runtime = 'edge'` to explain route — Anthropic SDK requires Node.js runtime.

---

## Phase 4: D3 ForceGraph Component

**File:** `components/ForceGraph.tsx` — `'use client'`

- Use `useRef` for SVG + simulation (D3 owns DOM, not React reconciler)
- Simulation forces: `forceLink(distance=50)` + `forceManyBody(strength=-300)` + `forceCenter` + `forceCollide(r=14 dirs, r=10 files)`
- `alphaDecay: 0.02` (slower cooling = more dramatic explosion), `alpha: 1`
- Tick handler: update link x1/y1/x2/y2 and node cx/cy
- **5s fallback**: `setTimeout` → if `alpha() > alphaMin()`, stop + apply radial layout (group by depth, concentric rings at 80px increments)
- Drag: pin `fx/fy` on drag start, release on end
- Click: only file nodes call `onNodeClick(d)` — dirs are no-op
- ResizeObserver: update SVG width/height + re-center + `alpha(0.3).restart()`
- Store simulation in `simulationRef` (so ResizeObserver closure can access live sim)
- Render order: links → circles → tooltips (SVG paint order)
- **Hover tooltip**: SVG `<title>` element on each node showing full path; no static labels
- Dir nodes: `r=10`, white stroke; file nodes: `r=6`, color from `nodeColor()`; `cursor: pointer` on files only

---

## Phase 5: UI Components & Wiring

**Files to create:**
- `components/RepoInput.tsx` — controlled input + form submit → calls `onSubmit(url)`
- `components/Sidebar.tsx` — absolute right-0, `animate-slide-in`, skeleton loader while loading; null render if no file selected

**File:** `app/page.tsx`

- `dynamic(() => import('@/components/ForceGraph'), { ssr: false })` — **mandatory**, prevents D3 SSR crash
- State: `graphData`, `loading`, `selectedFile`, `explanation`, `explainLoading`
- `cacheRef: Map<string, string>` + `repoUrlRef` (avoid stale closures)
- `handleRepoSubmit`: fetch tree → `setGraphData` → call `preCacheFirstFiles()`
- `preCacheFirstFiles()`: fire-and-forget — select nodes at depth ≤ 2 with extensions ts/js/py/tsx/jsx, take first 5, fetch content+explanation, store in `cacheRef`
- `handleNodeClick`: cache hit → instant display; cache miss → fetch content → POST explain → display

---

## Critical Gotchas

1. **D3 SSR**: `dynamic(..., { ssr: false })` + `transpilePackages` in next.config.ts — both required
2. **forceLink types**: after sim init, `link.source` becomes a `GraphNode` object (not string); cast with `as GraphNode` in tick handler
3. **Large repos**: 300-node cap + filter ignored dirs — without this, 15k-node repos freeze browser
4. **Rate limits**: always use `GITHUB_TOKEN`; log `X-RateLimit-Remaining` in dev
5. **Tailwind animation**: `animate-slide-in` must be defined in `tailwind.config.ts` keyframes block
6. **SVG sizing**: use explicit `width`/`height` attrs (not `viewBox`) for ResizeObserver to work with `forceCenter`

---

## Verification

1. `npm run dev` — no ERR_REQUIRE_ESM errors
2. Paste `https://github.com/facebook/react` → graph animates in with explosion effect
3. Nodes are color-coded; dirs larger than files; hover shows full path tooltip
4. Click a file node → sidebar slides in with explanation
5. Click a pre-cached file (depth ≤ 2, ts/js/py/tsx/jsx) → explanation appears instantly
6. Wait 5s on a slow-settling graph → snaps to radial layout
7. Resize browser window → graph recenters

---

## Decisions

1. **Pre-cache selection**: depth ≤ 2 + extensions ts/js/py/tsx/jsx
2. **Labels**: hover tooltip via SVG `<title>` (no static labels)
3. **File-type gate**: skip `.lock`, `.min.js`, `.map`, `.svg`, `.png`, `.jpg`, `.ico` in explain route
4. **Claude model**: `claude-sonnet-4-6`
5. **Scope**: public repos only
