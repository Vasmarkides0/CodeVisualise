# CodeVisualise

Understand any codebase instantly. Paste a GitHub repo URL, explore its structure as an interactive tree, and ask AI questions about any file.

Live: https://code-visualise.vercel.app

## What it does

CodeVisualise turns any public GitHub repository into an interactive visual map. Instead of clicking through folders on GitHub trying to understand how a project fits together, you get the full picture in seconds.

Paste a URL. See the structure. Click any file. Get a plain English explanation.

## Features

**Interactive tree visualization** — Repos render as animated D3 tree graphs. Small repos show every file in a left-to-right layout. Larger repos show a directory-level overview with file count badges to keep things readable.

**AI file explanations** — Click any file node and Claude explains what it does in 2-3 sentences of plain English. The first few files are pre-cached on load so clicks feel instant.

**Chat with the codebase** — Ask follow-up questions about any file or the repo as a whole through the built-in chat panel.

**Directory exploration** — Click any directory node to expand it in a sidebar showing its contents.

**Smart layout** — Auto-fits to your viewport with zoom, pan, and drag. Nodes are color-coded by file type.

## Tech stack

- Next.js 14 (App Router) — frontend and API routes
- D3.js v7 — tree layout, animations, zoom/pan
- Claude API — file explanations and chat
- GitHub REST API — repo trees and file contents
- Tailwind CSS — styling
- TypeScript throughout
- Deployed on Vercel

## Getting started

1. Clone the repo

git clone https://github.com/Vasmarkides0/CodeVisualise.git
cd CodeVisualise

2. Install dependencies

npm install

3. Create a .env.local file in the root

GITHUB_TOKEN=your_github_personal_access_token
ANTHROPIC_API_KEY=your_anthropic_api_key

GitHub token: github.com/settings/tokens (classic token, "repo" scope)
Anthropic key: console.anthropic.com

4. Run the dev server

npm run dev

5. Open http://localhost:3000

## How it works

You paste a GitHub repo URL. The app fetches the full file tree via the GitHub API, parses it into D3-compatible nodes and links (inferring implicit parent directories from paths), and renders an animated tree. Clicking a file fetches its contents from GitHub, sends them to Claude, and displays the explanation in a sidebar. The chat feature uses the same file contents as context for follow-up questions.

## Project structure

app/
  page.tsx              — main UI: input bar, graph, sidebar, chat
  api/
    github/route.ts     — proxies GitHub API requests
    explain/route.ts    — file explanations via Claude
    chat/route.ts       — chat messages via Claude
components/
  ForceGraph.tsx        — D3 tree visualization
  RepoInput.tsx         — URL input bar
  Sidebar.tsx           — file explanation panel
lib/
  github.ts             — GitHub API helpers
  parseTree.ts          — GitHub tree to D3 nodes/links
  fileColors.ts         — file extension to color mapping
types/
  index.ts              — shared TypeScript interfaces

## Limitations

- Public repositories only
- GitHub API rate limit: 5000 requests/hour with a personal access token
- Files over 100KB are truncated before being sent to Claude

## License

MIT

