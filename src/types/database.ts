
export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            documents: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    file_type: 'pdf' | 'docx' | 'txt'
                    storage_path: string
                    status: 'uploading' | 'processing' | 'ready' | 'error'
                    pages_total: number
                    pages_done: number
                    ocr_language: string
                    ocr_provider: 'tesseract' | 'google'
                    enhanced_ocr: boolean
                    error_message: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    file_type: 'pdf' | 'docx' | 'txt'
                    storage_path: string
                    status?: 'uploading' | 'processing' | 'ready' | 'error'
                    pages_total?: number
                    pages_done?: number
                    ocr_language?: string
                    ocr_provider?: 'tesseract' | 'google'
                    enhanced_ocr?: boolean
                    error_message?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    file_type?: 'pdf' | 'docx' | 'txt'
                    storage_path?: string
                    status?: 'uploading' | 'processing' | 'ready' | 'error'
                    pages_total?: number
                    pages_done?: number
                    ocr_language?: string
                    ocr_provider?: 'tesseract' | 'google'
                    enhanced_ocr?: boolean
                    error_message?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            document_pages: {
                Row: {
                    id: string
                    document_id: string
                    page_number: number | null
                    section_number: number | null
                    text: string
                    scanned: boolean
                    ocr_confidence: number | null
                    preview_image_path: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    document_id: string
                    page_number?: number | null
                    section_number?: number | null
                    text: string
                    scanned?: boolean
                    ocr_confidence?: number | null
                    preview_image_path?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            document_chunks: {
                Row: {
                    id: string
                    document_id: string
                    page_number: number | null
                    section_number: number | null
                    chunk_index: number
                    content: string
                    content_preview: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    document_id: string
                    page_number?: number | null
                    section_number?: number | null
                    chunk_index: number
                    content: string
                    content_preview: string
                    created_at?: string
                    updated_at?: string
                }
            }
            jobs: {
                Row: {
                    id: string
                    document_id: string
                    user_id: string
                    status: 'queued' | 'running' | 'done' | 'error'
                    stage: string
                    attempts: number
                    last_error: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    document_id: string
                    user_id: string
                    status?: 'queued' | 'running' | 'done' | 'error'
                    stage?: string
                    attempts?: number
                    last_error?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    status?: 'queued' | 'running' | 'done' | 'error'
                    stage?: string
                    attempts?: number
                    last_error?: string | null
                    updated_at?: string
                }
            }
            chats: {
                Row: {
                    id: string
                    user_id: string
                    title: string
                    scope: 'all' | 'document'
                    document_id: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    title?: string
                    scope?: 'all' | 'document'
                    document_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    title?: string
                    updated_at?: string
                }
            }
            messages: {
                Row: {
                    id: string
                    chat_id: string
                    user_id: string
                    role: 'user' | 'assistant' | 'system'
                    content: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    chat_id: string
                    user_id: string
                    role: 'user' | 'assistant' | 'system'
                    content: string
                    created_at?: string
                }
            }
            citations: {
                Row: {
                    id: string
                    message_id: string
                    document_id: string
                    page_number: number | null
                    section_number: number | null
                    chunk_id: string
                    snippet: string
                    score: number
                }
                Insert: {
                    id?: string
                    message_id: string
                    document_id: string
                    page_number?: number | null
                    section_number?: number | null
                    chunk_id: string
                    snippet: string
                    score?: number
                }
            }
        }
    }
}
