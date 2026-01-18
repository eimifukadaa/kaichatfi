
'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatComposer } from './composer'
import { MessageBubble } from './message-bubble'
import { SourcesDrawer } from '@/components/sources/sources-drawer'
import { createClient } from '@/lib/supabase/client'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function ChatWindow({ chatId, onChatCreated }: { chatId: string | null, onChatCreated?: (id: string) => void }) {
    const [messages, setMessages] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [streaming, setStreaming] = useState(false)
    const [activeCitation, setActiveCitation] = useState<any>(null)

    const scrollRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    useEffect(() => {
        if (chatId) {
            loadMessages()
        } else {
            setMessages([])
        }
    }, [chatId])

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const scrollToBottom = () => {
        if (scrollRef.current) {
            const container = scrollRef.current.closest('[data-slot="scroll-area-viewport"]')
            if (container) {
                container.scrollTop = container.scrollHeight
            } else {
                scrollRef.current.scrollIntoView({ behavior: 'auto' })
            }
        }
    }

    const loadMessages = async () => {
        setLoading(true)
        try {
            const { data } = await fetch(`/api/chats/${chatId}/messages`).then(res => res.json())
            if (data) setMessages(data)
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    const handleSend = async (content: string) => {
        let activeChatId = chatId

        // Auto-create chat if none exists
        if (!activeChatId) {
            try {
                const res = await fetch('/api/chats', { method: 'POST' })
                const data = await res.json()
                if (data.error) throw new Error(data.error)
                activeChatId = data.chatId

                if (onChatCreated) {
                    onChatCreated(activeChatId!)
                } else {
                    window.location.href = `/?chat=${activeChatId}`
                    return
                }
            } catch (err) {
                toast.error('Failed to create chat')
                return
            }
        }

        // Optimistic User Message
        const userMsg = { role: 'user', content, created_at: new Date().toISOString() }
        setMessages(prev => [...prev, userMsg])

        setStreaming(true)

        try {
            const response = await fetch(`/api/chats/${activeChatId}/messages/stream`, {
                method: 'POST',
                body: JSON.stringify({ content })
            })

            if (!response.ok || !response.body) throw new Error('Network error')

            // Stream Reader
            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let assistantMsg = { role: 'assistant', content: '', created_at: new Date().toISOString(), citations: [] }

            setMessages(prev => [...prev, assistantMsg])

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                assistantMsg.content += chunk

                // Update state
                setMessages(prev => {
                    const newMsgs = [...prev]
                    newMsgs[newMsgs.length - 1] = { ...assistantMsg }
                    return newMsgs
                })
            }

            // Reload to get real citations?
            // For MVP, we don't show citations instantly until reload unless we return them in stream or separate call.
            // "Streaming assistant responses... Shows citations... list of docs"
            // I'll reload messages quietly to fetch citations after stream end.
            loadMessages()

        } catch (err) {
            toast.error('Failed to send message')
        } finally {
            setStreaming(false)
        }
    }

    return (
        <div className="flex flex-col h-full relative overflow-hidden">
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-4 scroll-smooth"
                data-slot="scroll-area-viewport"
            >
                <div className="space-y-4 max-w-3xl mx-auto pb-8 min-h-full flex flex-col justify-end">
                    {messages.length === 0 && !loading && (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50 min-h-[400px]">
                            <h2 className="text-2xl font-bold mb-2">PT.KAI AI CHAT</h2>
                            <p>Upload documents and start chatting.</p>
                        </div>
                    )}

                    <div className="flex-1" />

                    {messages.map((m, i) => (
                        <MessageBubble
                            key={i}
                            message={m}
                            onSourceClick={setActiveCitation}
                        />
                    ))}

                    {/* Thinking Indicator */}
                    {streaming && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.content && (
                        <div className="flex items-center gap-3 text-muted-foreground animate-pulse p-4">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-sm font-medium">AI is thinking...</span>
                        </div>
                    )}

                    {loading && <div className="flex justify-center p-4"><Loader2 className="animate-spin text-primary" /></div>}
                    <div ref={scrollRef} className="h-2" />
                </div>
            </div>

            <ChatComposer onSend={handleSend} disabled={streaming} />

            <SourcesDrawer
                citation={activeCitation}
                open={!!activeCitation}
                onOpenChange={(op: boolean) => !op && setActiveCitation(null)}
            />
        </div>
    )
}
