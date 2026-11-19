import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Spinner } from './ui'
import { RichText } from './Rich'

// Word files can't be shown in an iframe. The file is fetched through the resume-file function (team members only),
// converted to HTML in the browser (the converter is only downloaded when a .docx is opened) and sanitised before display.
async function load(candidateId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resume-file`, {
    method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate_id: candidateId }),
  })
  if (!r.ok) { let m = 'Could not load the file'; try { m = (await r.json()).message || m } catch { /* not json */ } throw new Error(m) }
  const buf = await r.arrayBuffer()
  const mammoth = await import('mammoth')
  const { value } = await mammoth.convertToHtml({ arrayBuffer: buf })
  return value
}

export default function DocxPreview({ candidateId }: { candidateId: string }) {
  const q = useQuery({ queryKey: ['resume-docx', candidateId], queryFn: () => load(candidateId), retry: false, staleTime: 5 * 60_000 })
  if (q.isLoading) return <div className="rounded-xl border border-slate-200 bg-white py-14 text-center text-sm text-slate-500"><Spinner />Loading resume…</div>
  if (q.error) return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{(q.error as Error).message} — use Download to open it instead.</div>
  return (
    <div className="min-h-[560px] flex-1 overflow-auto scroll-thin rounded-xl border border-slate-200 bg-white p-8">
      <RichText html={q.data} empty="This document has no readable text." />
      <div className="mt-6 border-t border-slate-100 pt-3 text-[11px] text-slate-400">Text preview. Layout, images and fonts may differ from the original — use Download for the exact file.</div>
    </div>
  )
}
