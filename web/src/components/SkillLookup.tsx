import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cx } from '../lib/util'
import { Badge, Button, Spinner, useToast } from './ui'

interface Match {
  uid: string; fullName: string; location?: string; openToWork?: boolean; skills?: string[]
  experience?: { company?: string; title?: string }[]; score: number; why: string[]
}
async function lookup(candidateId: string): Promise<{ matches: Match[]; total: number }> {
  const { data, error } = await supabase.functions.invoke('signalhire-lookup', { body: { candidate_id: candidateId } })
  if (error) {
    let msg = error.message
    try { const j = await (error as unknown as { context: Response }).context.json(); msg = j.message || msg } catch { /* keep generic */ }
    throw new Error(msg)
  }
  return data
}
const esc = (s?: string) => (s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))

export default function SkillLookup({ candidateId, name, existing, onDone }: { candidateId: string; name: string; existing: string[]; onDone: () => void }) {
  // staleTime: Infinity so reopening the dialog never repeats a search (they count against SignalHire's daily limit)
  const q = useQuery({ queryKey: ['skill-lookup', candidateId], queryFn: () => lookup(candidateId), retry: false, staleTime: Infinity, gcTime: 10 * 60_000 })
  const [open, setOpen] = useState<string | null>(null)

  if (q.isLoading) return <div className="py-10 text-center text-sm text-slate-500"><Spinner />Looking up {name} on SignalHire… no credits used.</div>
  if (q.error) return <div className="space-y-3"><div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{(q.error as Error).message}</div><div className="flex justify-end"><Button variant="secondary" onClick={() => q.refetch()}>Try again</Button></div></div>
  const ms = q.data?.matches ?? []
  if (!ms.length) return <div className="space-y-3 py-6 text-center text-sm text-slate-500">No profile found for “{name}”.<div><Button variant="secondary" onClick={onDone}>Close</Button></div></div>

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Pick the profile that is really <b>{name}</b>. Only public skills and job history are used, no contact details and no credits.</p>
      {ms.map((m) => (
        <MatchCard key={m.uid} m={m} existing={existing} candidateId={candidateId} open={open === m.uid} onToggle={() => setOpen(open === m.uid ? null : m.uid)} onDone={onDone} />
      ))}
    </div>
  )
}

function MatchCard({ m, existing, candidateId, open, onToggle, onDone }: { m: Match; existing: string[]; candidateId: string; open: boolean; onToggle: () => void; onDone: () => void }) {
  const qc = useQueryClient(); const toast = useToast()
  const have = new Set(existing.map((s) => s.toLowerCase()))
  const fresh = (m.skills ?? []).filter((s) => !have.has(s.toLowerCase()))
  const [pick, setPick] = useState<Set<string>>(new Set(fresh.slice(0, 40)))
  const [note, setNote] = useState(true)
  const [busy, setBusy] = useState(false)
  const tone = m.score >= 70 ? 'green' : m.score >= 40 ? 'amber' : 'slate'
  const label = m.score >= 70 ? 'Likely match' : m.score >= 40 ? 'Possible match' : 'Weak match'

  async function apply() {
    setBusy(true)
    try {
      const skills = [...existing, ...fresh.filter((s) => pick.has(s))]
      const r = await supabase.rpc('save_candidate', { p_id: candidateId, p: { skills } })
      if (r.error) throw r.error
      if (note && m.experience?.length) {
        const body = `<p><b>Work history (from SignalHire profile)</b></p><ul>${m.experience.map((e) => `<li>${esc(e.title)} at ${esc(e.company)}</li>`).join('')}</ul>`
        const n = await supabase.rpc('add_note', { p_candidate: candidateId, p_job: null, p_body: body, p_type: 'Note' })
        if (n.error) throw n.error
      }
      ;['cand', 'cands', 'notes', 'board'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      toast(`Added ${pick.size} skill${pick.size === 1 ? '' : 's'} to the profile`)
      onDone()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  return (
    <div className={cx('rounded-xl border bg-white', open ? 'border-brand-400' : 'border-slate-200')}>
      <button onClick={onToggle} className="flex w-full items-start gap-3 p-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-slate-900">{m.fullName}</span><Badge tone={tone}>{label} · {m.score}</Badge>{m.openToWork && <Badge tone="blue">Open to work</Badge>}</div>
          {m.location && <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3" />{m.location}</div>}
          <div className="mt-1 text-xs text-slate-600">{(m.experience ?? []).slice(0, 3).map((e) => `${e.title ?? ''}${e.company ? ' at ' + e.company : ''}`).join('  ·  ') || 'No job history'}</div>
          {!!m.why.length && <div className="mt-1 text-[11px] text-slate-400">{m.why.join(' · ')}</div>}
        </div>
        <span className="mt-1 text-xs font-medium text-brand-600">{open ? 'Close' : 'Review'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 p-3">
          {fresh.length === 0 ? <div className="text-sm text-slate-500">{(m.skills ?? []).length ? 'All of this person’s skills are already on the profile.' : 'This profile lists no skills.'}</div> : (
            <>
              <div className="flex items-center justify-between text-xs text-slate-500"><span>{pick.size} of {fresh.length} new skills selected</span>
                <span className="flex gap-3"><button className="text-brand-600" onClick={() => setPick(new Set(fresh))}>All</button><button className="text-brand-600" onClick={() => setPick(new Set())}>None</button></span></div>
              <div className="flex max-h-48 flex-wrap gap-1.5 overflow-auto scroll-thin">
                {fresh.map((s) => (
                  <button key={s} onClick={() => setPick((p) => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n })}
                    className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs', pick.has(s) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-400 line-through')}>{pick.has(s) && <Check className="h-3 w-3" />}{s}</button>
                ))}
              </div>
            </>
          )}
          {!!m.experience?.length && <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={note} onChange={(e) => setNote(e.target.checked)} />Save work history as a note</label>}
          <div className="flex justify-end"><Button onClick={apply} loading={busy} disabled={!pick.size && !(note && m.experience?.length)}>Apply to profile</Button></div>
        </div>
      )}
    </div>
  )
}
