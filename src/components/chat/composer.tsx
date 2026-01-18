
'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Mic, Square } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function ChatComposer({ onSend, disabled }: any) {
    const [input, setInput] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Voice MVP
    const [listening, setListening] = useState(false)
    const recognitionRef = useRef<any>(null)

    useEffect(() => {
        if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
            // @ts-ignore
            const SpeechRecognition = (window as any).webkitSpeechRecognition
            recognitionRef.current = new SpeechRecognition()
            recognitionRef.current.continuous = false
            recognitionRef.current.lang = 'id-ID' // Indonesian default
            recognitionRef.current.interimResults = false

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript
                setInput(prev => prev + ' ' + transcript)
                setListening(false)
            }

            recognitionRef.current.onError = () => setListening(false)
            recognitionRef.current.onend = () => setListening(false)
        }
    }, [])

    const toggleVoice = () => {
        if (listening) {
            recognitionRef.current?.stop()
            setListening(false)
        } else {
            recognitionRef.current?.start()
            setListening(true)
        }
    }

    const handleSend = () => {
        if (!input.trim() || disabled) return
        onSend(input)
        setInput('')
        // Reset height?
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="p-4 bg-background border-t border-white/10">
            <div className="flex gap-2 max-w-3xl mx-auto relative items-end">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                size="icon"
                                variant="ghost"
                                className={`shrink-0 rounded-full ${listening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-muted-foreground'}`}
                                onClick={toggleVoice}
                                disabled={disabled}
                            >
                                {listening ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Voice Input</TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ketik pesan atau tanya dokumen..."
                    className="min-h-[50px] max-h-[200px] resize-none rounded-xl bg-muted/50 border-white/10 focus-visible:ring-primary/50"
                />

                <Button
                    size="icon"
                    className="shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 mb-1"
                    disabled={!input.trim() || disabled}
                    onClick={handleSend}
                >
                    <Send className="h-4 w-4" />
                </Button>
            </div>
            <div className="text-center text-[10px] text-muted-foreground mt-2">
                AI can make mistakes. Check important info.
            </div>
        </div>
    )
}
