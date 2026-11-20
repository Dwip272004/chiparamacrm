import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// `npm run dev:demo` swaps in an offline client with fictional data (for design work and screenshots).
export const supabase: SupabaseClient = import.meta.env.VITE_DEMO
  ? (await import('./demo')).demoClient
  : createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    { db: { schema: 'crm' }, auth: { persistSession: true, autoRefreshToken: true } },
  )

// Throws a readable error instead of returning {error}.
export async function unwrap<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data as T
}
