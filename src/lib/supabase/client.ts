
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    if (typeof window === 'undefined') {
      console.warn('Supabase env variables missing during build. Returning null.')
    }
    // @ts-ignore
    return null
  }

  return createBrowserClient(url, key)
}
