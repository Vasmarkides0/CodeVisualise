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
      system: 'You are a senior developer explaining code to a smart non-technical person. For the given file, write exactly 2-3 sentences answering: what does this file do, and why does it exist in this project? Rules: no markdown, no bullet points, no headers, no backticks, no code formatting. Never start with "This file" or "This code". Get straight to the point. Be specific to what the file actually does — not generic. If it is a config file say what it configures and why that matters. If it is a utility say what problem it solves. If it is a component say what the user sees or experiences. Write like you are explaining to a smart friend, not writing documentation.',
      messages: [{
        role: 'user',
        content: `File: "${filename}"\n\n${truncated}`,
      }],
    })

    const explanation = (message.content[0] as { type: 'text'; text: string }).text
    return NextResponse.json({ explanation })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
