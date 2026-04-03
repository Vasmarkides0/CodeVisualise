import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SKIP_EXTENSIONS = new Set(['.lock', '.min.js', '.map', '.svg', '.png', '.jpg', '.ico'])

function shouldSkip(filename: string): boolean {
  return SKIP_EXTENSIONS.has('.' + filename.split('.').pop()!) ||
    filename.endsWith('.min.js') ||
    filename.endsWith('.lock')
}

const MAX_CONTENT_CHARS = 4000

export async function POST(req: NextRequest) {
  try {
    const { content, filename } = await req.json() as { content: string; filename: string }

    if (!content || !filename) {
      return NextResponse.json({ error: 'Missing content or filename' }, { status: 400 })
    }

    if (shouldSkip(filename)) {
      return NextResponse.json({ explanation: 'Binary or generated file — no explanation available.' })
    }

    const truncated = content.slice(0, MAX_CONTENT_CHARS)

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Briefly explain what the file "${filename}" does in 2-4 sentences. Focus on its purpose, key exports, and how it fits into the wider project. Be concise.\n\n\`\`\`\n${truncated}\n\`\`\``,
      }],
    })

    const explanation = (message.content[0] as { type: 'text'; text: string }).text
    return NextResponse.json({ explanation })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
