
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, MessageSquare, FileText, Trash2, LogOut, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DocumentList } from '@/components/documents/document-list'
import { DocumentUpload } from '@/components/documents/document-upload'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useRouter } from 'next/navigation'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

export function Sidebar({ currentChatId, onSelectChat, onNewChat }: any) {
    const [chats, setChats] = useState<any[]>([])
    const [user, setUser] = useState<any>(null)
    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setUser(data.user))
        fetchChats()

        // Subscribe to new chats? For now, just initial fetch + polling or trigger
        const interval = setInterval(fetchChats, 5000)
        return () => clearInterval(interval)
    }, [])

    const fetchChats = async () => {
        const { data } = await fetch('/api/chats').then(res => res.json())
        if (data) setChats(data)
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <div className="flex h-full w-[260px] flex-col bg-[#1E1F29] text-[#F8F8F2] border-r border-white/10">
            <div className="p-3">
                <Button onClick={onNewChat} variant="outline" className="w-full justify-start gap-2 border-white/20 hover:bg-white/10 text-white">
                    <Plus className="h-4 w-4" />
                    New chat
                </Button>
            </div>

            <ScrollArea className="flex-1 px-3">
                <div className="mb-4">
                    {chats.map(chat => (
                        <Button
                            key={chat.id}
                            variant="ghost"
                            className={`w-full justify-start text-sm font-normal mb-1 overflow-hidden text-ellipsis ${currentChatId === chat.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                            onClick={() => onSelectChat(chat.id)}
                        >
                            <MessageSquare className="mr-2 h-4 w-4 shrink-0" />
                            <span className="truncate">{chat.title}</span>
                        </Button>
                    ))}
                </div>
            </ScrollArea>

            <Separator className="bg-white/10" />

            <div className="p-3">
                <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Knowledge Base
                </h3>
                <DocumentUpload onUploadComplete={() => { }} />
                <div className="mt-3">
                    <DocumentList />
                </div>
            </div>

            <div className="p-3 border-t border-white/10">
                <div className="flex items-center gap-3 rounded-md p-2 hover:bg-white/5 cursor-pointer">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-medium">{user?.email}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 text-muted-foreground hover:text-white">
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
