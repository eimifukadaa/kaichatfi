
'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { ChatWindow } from '@/components/chat/chat-window'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'

function Home() {
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const currentChatIdFromUrl = searchParams.get('chat')

  useEffect(() => {
    // Check auth
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
    })

    // Sync chatId from URL
    if (currentChatIdFromUrl) {
      setCurrentChatId(currentChatIdFromUrl)
    }
  }, [currentChatIdFromUrl])

  const handleNewChat = async () => {
    // Create new chat
    const res = await fetch('/api/chats', { method: 'POST', body: JSON.stringify({ title: 'New Chat' }) })
    const { chatId } = await res.json()
    if (chatId) {
      setCurrentChatId(chatId)
      router.push(`/?chat=${chatId}`)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        currentChatId={currentChatId}
        onSelectChat={setCurrentChatId}
        onNewChat={handleNewChat}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-white/10 flex items-center px-4 bg-[#1E1F29]/50 backdrop-blur justify-between">
          <h1 className="font-semibold text-white">
            {currentChatId ? 'Chat' : 'Start a new conversation'}
          </h1>
        </header>
        <main className="flex-1 overflow-hidden relative">
          <ChatWindow
            chatId={currentChatId}
            onChatCreated={(id) => {
              setCurrentChatId(id)
              router.push(`/?chat=${id}`)
            }}
          />
        </main>
      </div>
    </div>
  )
}
export default function HomePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Home />
    </Suspense>
  )
}
