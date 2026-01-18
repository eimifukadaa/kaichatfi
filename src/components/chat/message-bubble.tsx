
'use client'

import ReactMemo from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User, Bot, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const MessageBubble = ({ message, onSourceClick }: any) => {
    const isUser = message.role === 'user'

    return (
        <div className={`flex w-full gap-3 p-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && (
                <Avatar className="h-8 w-8 mt-1 border border-white/10">
                    <AvatarImage src="/bot-avatar.png" />
                    <AvatarFallback className="bg-primary text-primary-foreground"><Bot className="h-4 w-4" /></AvatarFallback>
                </Avatar>
            )}

            <div className={`flex max-w-[80%] flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-lg p-3 ${isUser
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-foreground border border-white/5'
                    }`}>
                    <div className="prose prose-invert prose-sm max-w-none break-words">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                // @ts-ignore
                                pre: ({ node, ...props }) => <div className="overflow-auto rounded-md bg-black/50 p-2 my-2" {...props} />,
                                // @ts-ignore
                                code: ({ node, ...props }) => <code className="bg-black/20 rounded px-1" {...props} />
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    </div>
                </div>

                {/* Citations/Sources */}
                {!isUser && message.citations && message.citations.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                        {message.citations.map((cite: any, i: number) => (
                            <Button
                                key={cite.id || i}
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs gap-1 border-primary/30 bg-primary/5 hover:bg-primary/10"
                                onClick={() => onSourceClick(cite)}
                            >
                                <FileText className="h-3 w-3" />
                                Source {i + 1}
                            </Button>
                        ))}
                    </div>
                )}
            </div>

            {isUser && (
                <Avatar className="h-8 w-8 mt-1 border border-white/10">
                    <AvatarFallback className="bg-secondary text-secondary-foreground"><User className="h-4 w-4" /></AvatarFallback>
                </Avatar>
            )}
        </div>
    )
}
