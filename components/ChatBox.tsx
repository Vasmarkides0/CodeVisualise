'use client'

import { useEffect, useRef, useState } from 'react'
import { COLOR_MAP, DEFAULT_COLOR } from '@/lib/fileColors'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  repoContext: { owner: string; repo: string; branch: string } | null
  currentFile: { path: string; contents: string } | null
}

const BASE_STARTERS = [
  'What does this repo do overall?',
  'What are the main entry points?',
  'What tech stack is this using?',
]

const MAX_HISTORY = 10

export function ChatBox({ isOpen, onClose, repoContext, currentFile }: Props) {
  const [messages, setMessages]      = useState<Message[]>([])
  const [input, setInput]            = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [isOpen])

  const disabled = !repoContext

  // Derived starter chips
  const starters = currentFile
    ? [
        ...BASE_STARTERS,
        `How does ${currentFile.path.split('/').pop()} work?`,
        `What calls this file?`,
      ]
    : BASE_STARTERS

  async function send(text: string) {
    if (!text.trim() || isStreaming || disabled) return

    const userMsg: Message = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setIsStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    // Limit history sent to API
    const trimmed = next.slice(-MAX_HISTORY)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: trimmed, repoContext, currentFile }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: `Error: ${error ?? 'Unknown error'}` }
          return copy
        })
        return
      }

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: copy[copy.length - 1].content + chunk }
          return copy
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: `Error: ${msg}` }
        return copy
      })
    } finally {
      setIsStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  // Derive file meta for context pill
  const fileName  = currentFile?.path.split('/').pop() ?? null
  const fileExt   = fileName?.split('.').pop()?.toLowerCase() ?? ''
  const dotColor  = COLOR_MAP[fileExt] ?? DEFAULT_COLOR

  if (!isOpen) return null

  return (
    <>
      <style>{`
        @keyframes chatSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        .chat-cursor::after {
          content: '▋';
          display: inline-block;
          animation: blink 0.8s step-start infinite;
          color: #6366f1;
          font-size: 0.85em;
          margin-left: 1px;
        }
        .chat-chip:hover { background: #e0e7ff !important; color: #4338ca !important; }
      `}</style>

      <div style={{
        position: 'fixed', bottom: '60px', right: '20px',
        width: '380px', height: '520px',
        background: '#ffffff', border: '1px solid #e5e7eb',
        borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
        zIndex: 50, animation: 'chatSlideUp 0.3s ease-out', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid #f3f4f6',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
              Ask about this codebase
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '12px', color: '#9ca3af', padding: '2px 6px', borderRadius: '4px',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#6b7280')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
                >
                  Clear
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#9ca3af', fontSize: '18px', lineHeight: 1, padding: '2px',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
                onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Context pill */}
          {fileName && (
            <div style={{
              marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: '#f9fafb', border: '1px solid #f3f4f6',
              borderRadius: '20px', padding: '3px 10px',
            }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: '#6b7280' }}>
                Asking about <span style={{ color: '#374151', fontWeight: 500 }}>{fileName}</span>
              </span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '8px' }}>
              <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.6, margin: 0, textAlign: 'center' }}>
                {disabled
                  ? 'Load a repository to start chatting.'
                  : 'Ask anything about the codebase.'}
              </p>
              {!disabled && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {starters.map(q => (
                    <button
                      key={q}
                      className="chat-chip"
                      onClick={() => send(q)}
                      style={{
                        background: '#f0f1ff', color: '#6366f1',
                        border: '1px solid #e0e7ff', borderRadius: '20px',
                        padding: '5px 11px', fontSize: '12px', cursor: 'pointer',
                        transition: 'background 0.15s, color 0.15s',
                        fontFamily: 'inherit',
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((msg, i) => {
              const isUser         = msg.role === 'user'
              const isLastAssistant = !isUser && i === messages.length - 1 && isStreaming
              return (
                <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                  <div
                    className={isLastAssistant ? 'chat-cursor' : undefined}
                    style={{
                      maxWidth: isUser ? '80%' : '85%',
                      padding: '8px 12px',
                      borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      background: isUser ? '#6366f1' : '#f9fafb',
                      color: isUser ? '#ffffff' : '#374151',
                      fontSize: '13px', lineHeight: 1.6,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}
                  >
                    {msg.content || (isLastAssistant ? '' : '…')}
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px', flexShrink: 0, position: 'relative' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={disabled ? 'Load a repository first' : 'Ask a question…'}
            rows={1}
            style={{
              width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px',
              padding: '8px 40px 8px 12px', fontSize: '13px',
              color: disabled ? '#9ca3af' : '#374151',
              background: disabled ? '#f9fafb' : '#ffffff',
              resize: 'none', outline: 'none', fontFamily: 'inherit',
              lineHeight: 1.5, boxSizing: 'border-box',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              cursor: disabled ? 'not-allowed' : 'text',
            }}
            onFocus={e => {
              if (!disabled) {
                e.target.style.borderColor = '#6366f1'
                e.target.style.boxShadow   = '0 0 0 3px rgba(99,102,241,0.1)'
              }
            }}
            onBlur={e => {
              e.target.style.borderColor = '#e5e7eb'
              e.target.style.boxShadow   = 'none'
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={isStreaming || !input.trim() || disabled}
            style={{
              position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', padding: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: isStreaming || !input.trim() || disabled ? 'default' : 'pointer',
              color: isStreaming || !input.trim() || disabled ? '#d1d5db' : '#6366f1',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { if (!isStreaming && input.trim() && !disabled) e.currentTarget.style.color = '#4f46e5' }}
            onMouseLeave={e => { if (!isStreaming && input.trim() && !disabled) e.currentTarget.style.color = '#6366f1' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}
