import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT =
  'You are an expert developer assistant helping a user understand a GitHub repository. ' +
  'You have access to the repository structure and can answer questions about any file or the codebase as a whole. ' +
  'Be concise, conversational, and specific. No markdown headers. Use plain prose.'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface RepoContext {
  owner: string
  repo: string
  branch: string
}

interface CurrentFile {
  path: string
  contents: string
}

export async function POST(req: NextRequest) {
  try {
    const { messages, repoContext, currentFile } = await req.json() as {
      messages: Message[]
      repoContext: RepoContext
      currentFile: CurrentFile | null
    }

    if (!messages?.length) {
      return NextResponse.json({ error: 'Missing messages' }, { status: 400 })
    }

    // Inject file context into the first user message
    const augmented: Message[] = messages.map((m, i) => {
      if (i === 0 && m.role === 'user' && currentFile) {
        return {
          role: 'user',
          content: `The user is currently viewing: ${currentFile.path}\n\nFile contents:\n${currentFile.contents}\n\n${m.content}`,
        }
      }
      return m
    })

    const systemWithRepo = repoContext
      ? `${SYSTEM_PROMPT}\n\nRepository: ${repoContext.owner}/${repoContext.repo} (branch: ${repoContext.branch})`
      : SYSTEM_PROMPT

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: systemWithRepo,
      messages: augmented,
    })

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error'
          controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
