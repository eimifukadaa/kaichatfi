
'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

export function SourcesDrawer({ citation, open, onOpenChange }: any) {
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        if (citation && open) {
            // Ideally we check if there is a preview image for this page
            // path: kai_previews/{user}/{doc}/pages/{page}.jpg
            setLoading(true)
            // We need user id? No, RLS handles select.
            // Construct path:
            // We generally need userId to fetch from storage, or use signed url.
            // Or public bucket? Bucket is private.
            // We can get public URL if policy allows? No, private bucket.
            // Create signed URL for display.
            fetchPreview()
        }
    }, [citation, open])

    const fetchPreview = async () => {
        if (!citation) return
        // We need to know user_id... or we can just fetch via API if complex?
        // Supabase client can get session.
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Try to get page image
        const path = `${user.id}/${citation.document_id}/pages/${citation.page_number}.jpg`
        const { data } = await supabase.storage.from('kai_previews').createSignedUrl(path, 3600)

        if (data?.signedUrl) {
            setImageUrl(data.signedUrl)
        } else {
            setImageUrl(null)
        }
        setLoading(false)
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px] bg-card border-l border-white/10">
                <SheetHeader>
                    <SheetTitle>Source Detail</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-full py-4 pr-4">
                    {citation && (
                        <div className="space-y-6">
                            <div className="rounded-lg bg-muted/50 p-4 font-mono text-sm border border-white/5">
                                <p className="font-semibold text-primary mb-2">Excerpt</p>
                                {citation.snippet}
                            </div>

                            <div>
                                <p className="font-semibold text-primary mb-2">Original Page</p>
                                {loading ? (
                                    <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin" /></div>
                                ) : imageUrl ? (
                                    <img src={imageUrl} alt="Page Preview" className="w-full rounded-lg border border-white/10" />
                                ) : (
                                    <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-white/20 bg-muted/20">
                                        <p className="text-muted-foreground">No page preview available</p>
                                    </div>
                                )}
                            </div>

                            <div className="text-xs text-muted-foreground">
                                Document ID: {citation.document_id} <br />
                                Page: {citation.page_number} <br />
                                Chunk ID: {citation.chunk_id}
                            </div>
                        </div>
                    )}
                </ScrollArea>
            </SheetContent>
        </Sheet>
    )
}
