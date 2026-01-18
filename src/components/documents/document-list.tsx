
'use client'

import { useEffect, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { FileText, Trash2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function DocumentList() {
    const [docs, setDocs] = useState<any[]>([])
    const supabase = createClient()

    useEffect(() => {
        fetchDocs()
        const interval = setInterval(fetchDocs, 3000)
        return () => clearInterval(interval)
    }, [])

    const fetchDocs = async () => {
        const { data } = await fetch('/api/documents').then(res => res.json())
        if (data) setDocs(data)
    }

    const deleteDoc = async (id: string) => {
        try {
            await fetch(`/api/documents/${id}`, { method: 'DELETE' }) // We need to implement this API
            toast.success('Document deleted')
            fetchDocs()
        } catch {
            toast.error('Failed to delete')
        }
    }

    // Need to implement DELETE route in API
    // Using direct Supabase delete for MVP speed if API missing, but I should implement the API.
    // I missed implementing DELETE doc API. I will do it.

    return (
        <ScrollArea className="h-[200px]">
            <div className="space-y-2">
                {docs.map(doc => (
                    <div key={doc.id} className="group flex items-center justify-between rounded-md p-2 hover:bg-white/5 text-sm">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="h-4 w-4 shrink-0 text-primary" />
                            <div className="flex flex-col overflow-hidden">
                                <span className="truncate font-medium">{doc.name}</span>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    {doc.status === 'processing' && (
                                        <span>{doc.pages_done}/{doc.pages_total || '?'} pages</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            {doc.status === 'uploading' && <Badge variant="secondary" className="text-[10px]">UP</Badge>}
                            {doc.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />}
                            {doc.status === 'ready' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                            {doc.status === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/20"
                                onClick={() => deleteDoc(doc.id)}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    )
}
