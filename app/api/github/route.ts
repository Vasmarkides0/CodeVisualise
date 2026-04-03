import { NextRequest, NextResponse } from 'next/server'
import { parseRepoUrl, fetchTree, fetchFileContent } from '@/lib/github'
import { parseTree } from '@/lib/parseTree'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const repoUrl = searchParams.get('url')
    const filePath = searchParams.get('path')

    if (!repoUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
    }

    const { owner, repo } = parseRepoUrl(repoUrl)

    if (filePath) {
      const content = await fetchFileContent(owner, repo, filePath)
      return NextResponse.json({ content })
    }

    const tree = await fetchTree(owner, repo)
    const graphData = parseTree(tree)
    return NextResponse.json(graphData)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
