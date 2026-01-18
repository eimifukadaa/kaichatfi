
'use client'

import { useDropzone } from 'react-dropzone'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, File } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'

export function DocumentUpload({ onUploadComplete }: any) {
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const supabase = createClient()

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) setSelectedFile(acceptedFiles[0])
    }, [])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'text/plain': ['.txt']
        },
        maxFiles: 1
    })

    const handleUpload = async () => {
        if (!selectedFile) return
        setUploading(true)
        setProgress(10)

        try {
            // 1. Create Doc Entry
            const res = await fetch('/api/documents/create', {
                method: 'POST',
                body: JSON.stringify({
                    name: selectedFile.name,
                    fileType: selectedFile.name.split('.').pop()?.toLowerCase(),
                    ocrLanguage: 'ind+eng',
                    enhancedOcr: true
                })
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error)

            const { documentId, storagePath, token } = data
            setProgress(30)

            // 2. Upload to Storage using SDK
            const { error: uploadError } = await supabase.storage
                .from('kai_docs')
                .uploadToSignedUrl(storagePath, token, selectedFile)

            if (uploadError) throw new Error(uploadError.message)



            setProgress(80)

            // 3. Complete
            await fetch('/api/documents/complete', {
                method: 'POST',
                body: JSON.stringify({ documentId })
            })

            setProgress(100)
            toast.success('Upload started')
            setIsOpen(false)
            setSelectedFile(null)
            onUploadComplete()

        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setUploading(false)
            setProgress(0)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2 border-white/20 hover:bg-white/10 text-white">
                    <Upload className="h-4 w-4" /> Upload Document
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur">
                <DialogHeader>
                    <DialogTitle>Upload Knowledge Base</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'
                            }`}
                    >
                        <input {...getInputProps()} />
                        {selectedFile ? (
                            <div className="flex flex-col items-center gap-2">
                                <File className="h-8 w-8 text-primary" />
                                <p className="font-medium">{selectedFile.name}</p>
                                <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Upload className="h-8 w-8" />
                                <p>Drag & drop or click to select</p>
                                <p className="text-xs">PDF, DOCX, TXT (Max 50MB)</p>
                            </div>
                        )}
                    </div>

                    {uploading && (
                        <div className="space-y-1">
                            <Progress value={progress} className="h-2" />
                            <p className="text-xs text-center text-muted-foreground">Uploading...</p>
                        </div>
                    )}

                    <Button
                        className="w-full bg-primary hover:bg-primary/90"
                        onClick={handleUpload}
                        disabled={!selectedFile || uploading}
                    >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Start Processing'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
