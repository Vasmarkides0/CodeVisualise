import type { GitHubTreeItem } from '@/types'

const BASE = 'https://api.github.com'

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

export async function fetchTree(owner: string, repo: string): Promise<GitHubTreeItem[]> {
  for (const branch of ['main', 'master']) {
    const url = `${BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
    const res = await fetch(url, {
      headers: headers(),
      next: { revalidate: 60 },
    } as RequestInit)
    if (res.status === 404) continue
    if (!res.ok) {
      const remaining = res.headers.get('X-RateLimit-Remaining')
      console.log(`GitHub rate limit remaining: ${remaining}`)
      throw new Error(`GitHub API error ${res.status}`)
    }
    const json = await res.json()
    if (json.truncated) console.warn('GitHub tree response was truncated (>100k items)')
    return json.tree as GitHubTreeItem[]
  }
  throw new Error('Repository not found on main or master branch')
}

export async function fetchFileContent(owner: string, repo: string, path: string): Promise<string> {
  const url = `${BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error(`GitHub contents API error ${res.status}`)
  const json = await res.json()
  const clean = (json.content as string).replace(/\n/g, '')
  return Buffer.from(clean, 'base64').toString('utf-8')
}

export function parseRepoUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/?#]+)/)
  if (!match) throw new Error('Invalid GitHub URL — expected https://github.com/owner/repo')
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') }
}
