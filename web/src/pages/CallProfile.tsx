import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Copy, ExternalLink, Lock, Mail, MapPin, Phone, PartyPopper } from 'lucide-react'
import { useCallList, useMembers, useOutreachActivity } from '../lib/api'
import { useAuth } from '../lib/auth'
import { supabase, unwrap } from '../lib/supabase'
import { CALL_OUTCOMES, CHANNELS, callBucket, claimOf, fmtDateTime, sortForCalling, statusMeta, type CallRow } from '../lib/calling'
import { cx } from '../lib/util'
import { Avatar, Badge, Button, Card, Empty, Spinner, Textarea, useToast } from '../components/ui'
import { RichText } from '../components/Rich'
import { CallBadge } from './Calling'

const href = (u: string) => (u.startsWith('http') ? u : `https://${u}`)
const TONE: Record<string, string> = { green: 'border-emerald-300 bg-emerald-50 text-emerald-800', amber: 'border-amber-300 bg-amber-50 text-amber-800', blue: 'border-sky-300 bg-sky-50 text-sky-800', red: 'border-red-300 bg-red-50 text-red-800', slate: 'border-slate-300 bg-slate-100 text-slate-700', brand: 'border-brand-300 bg-brand-50 text-brand-800' }

function Copyable({ text, label }: { text: string; label: string }) {
  const toast = useToast()
  return <button onClick={() => { void navigator.clipboard.writeText(text); toast(`Copied ${label}`) }} title="Copy" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Copy className="h-3.5 w-3.5" /></button>
}

// Full-page calling screen for one candidate, with fast navigation through the queue.
export default function CallProfile() {
  const { id = '' } = useParams(); const [sp] = useSearchParams(); const navigate = useNavigate()
  const job = sp.get('job') ?? ''; const lot = sp.get('lot') ?? ''
  const qs = [job && `job=${job}`, lot && `lot=${lot}`].filter(Boolean).join('&')
  const list = useCallList(); const { isAdmin, member } = useAuth(); const me = member?.user_id
  const rows = list.data
  const available = (r: CallRow) => isAdmin || claimOf(r, me) !== 'taken'   // callers can only work free candidates and their own
  const [queue, setQueue] = useState<string[]>([]); const [handled, setHandled] = useState<Set<string>>(new Set()); const snap = useRef(false)

  // snapshot the queue once, so the order doesn't jump while you're calling
  useEffect(() => {
    if (!rows || snap.current) return
    snap.current = true
    setQueue(rows.filter((r) => callBucket(r) !== 'done' && available(r) && (!job || r.job_candidates.job_id === job) && (!lot || r.batch_id === lot)).sort(sortForCalling).map((r) => r.job_candidate_id))
  }, [rows, job, lot])

  const row = rows?.find((r) => r.job_candidate_id === id)
  const pos = queue.indexOf(id)
  const go = useCallback((to: string) => navigate(`/calling/${to}${qs ? `?${qs}` : ''}`), [navigate, qs])
  const nextId = useMemo(() => {
    if (!rows) return null
    for (let i = pos >= 0 ? pos + 1 : 0; i < queue.length; i++) { const r = rows.find((x) => x.job_candidate_id === queue[i]); if (r && !handled.has(r.job_candidate_id) && callBucket(r) !== 'done' && available(r)) return r.job_candidate_id }
    return null
  }, [rows, queue, pos, handled])
  const prevId = pos > 0 ? queue[pos - 1] : null
  const upNext = useMemo(() => (rows ? queue.slice(Math.max(pos, -1) + 1).map((q) => rows.find((r) => r.job_candidate_id === q)).filter((r): r is CallRow => !!r && !handled.has(r.job_candidate_id) && callBucket(r) !== 'done' && available(r)).slice(0, 4) : []), [rows, queue, pos, handled])

  if (list.isLoading || !rows) return <Spinner />
  if (!row) return <Card className="m-8"><Empty icon={<Phone />} title="This candidate isn't in your list" action={<Link to="/calling" className="text-sm font-medium text-brand-600 hover:underline">Back to calling list</Link>} /></Card>
  return <Profile key={row.job_candidate_id} row={row} pos={pos} total={queue.length} upNext={upNext} nextId={nextId} prevId={prevId} onGo={go} onSaved={(rid) => setHandled((h) => new Set(h).add(rid))} />
}

function Profile({ row, pos, total, upNext, nextId, prevId, onGo, onSaved }: { row: CallRow; pos: number; total: number; upNext: CallRow[]; nextId: string | null; prevId: string | null; onGo: (id: string) => void; onSaved: (id: string) => void }) {
  const c = row.job_candidates.candidates; const job = row.job_candidates.jobs
  const [status, setStatus] = useState(row.call_status === 'not_called' ? '' : row.call_status); const [note, setNote] = useState(''); const [error, setError] = useState('')
  const [finished, setFinished] = useState(false)
  const { isAdmin, member } = useAuth(); const members = useMembers(); const me = member?.user_id
  const [claimed, setClaimed] = useState<{ status: string; by?: string } | null>(null)
  const takenByOther = !isAdmin && row.call_assigned_to && row.call_assigned_to !== me
  const ownerName = (id: string | null) => members.data?.find((m) => m.user_id === id)?.full_name ?? 'a teammate'
  const noteRef = useRef<HTMLTextAreaElement>(null); const qc = useQueryClient(); const toast = useToast()
  const activity = useOutreachActivity(row.job_candidate_id)
  const log = useMutation({ mutationFn: (a: { status: string; note: string }) => unwrap(supabase.rpc('log_call', { p_id: row.job_candidate_id, p_status: a.status, p_note: a.note || null })) })

  // opening a free candidate claims them for you; if someone got there first you'll see who
  useEffect(() => {
    if (isAdmin || !me || row.call_assigned_to === me || row.call_assigned_to) return
    let live = true
    void unwrap<{ status: string; by?: string }>(supabase.rpc('claim_call', { p_id: row.job_candidate_id })).then((r) => { if (!live) return; setClaimed(r); void qc.invalidateQueries({ queryKey: ['call-list'] }) }).catch((e: Error) => { if (live) toast(e.message, 'err') })
    return () => { live = false }
  }, [isAdmin, me, row.call_assigned_to, row.job_candidate_id, qc, toast])

  const save = useCallback(async (andNext: boolean) => {
    if (log.isPending) return
    if (!status) { setError('Pick the call outcome first.'); return }
    setError('')
    try {
      await log.mutateAsync({ status, note })
      await qc.invalidateQueries({ queryKey: ['call-list'] }); void qc.invalidateQueries({ queryKey: ['outreach-activity'] }); void qc.invalidateQueries({ queryKey: ['dashboard'] })
      onSaved(row.job_candidate_id); setNote(''); toast('Call saved')
      if (andNext) { if (nextId) onGo(nextId); else setFinished(true) }
    } catch (e) { setError((e as Error).message) }
  }, [log, status, note, qc, onSaved, row.job_candidate_id, toast, nextId, onGo])

  // Keyboard: 1-8 pick an outcome, Ctrl/Cmd+Enter = save & next
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void save(true); return }
      const t = (e.target as HTMLElement).tagName
      if (t === 'TEXTAREA' || t === 'INPUT' || t === 'SELECT') return
      const n = Number(e.key)
      if (n >= 1 && n <= CALL_OUTCOMES.length) { setStatus(CALL_OUTCOMES[n - 1].key); noteRef.current?.focus() }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [save])

  const takenName = takenByOther ? ownerName(row.call_assigned_to) : claimed?.status === 'taken' ? claimed.by ?? 'a teammate' : null
  if (takenName) return (
    <div className="mx-auto max-w-xl px-8 py-16"><Card className="p-8 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Lock className="h-7 w-7" /></div>
      <h2 className="text-lg font-semibold text-slate-900">{takenName} already has {c.full_name}</h2>
      <p className="mt-1 text-sm text-slate-500">Whoever opens a candidate first is the one who calls them, so this one isn’t yours to call.</p>
      <div className="mt-5 flex justify-center gap-2"><Link to="/calling" className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Back to calling list</Link>{nextId && <Button onClick={() => onGo(nextId)}>Next candidate<ArrowRight className="h-4 w-4" /></Button>}</div>
    </Card></div>)
  if (finished) return <Card className="m-8"><Empty icon={<PartyPopper />} title="You're all caught up" hint="No more candidates in this queue right now." action={<Link to="/calling" className="text-sm font-medium text-brand-600 hover:underline">Back to calling list</Link>} /></Card>
  const phones = [c.phone, c.phone_2, c.phone_3].filter((p): p is string => !!p)
  const roleSections: [string, string | null, boolean][] = [['Summary', job?.summary ?? null, true], ['Responsibilities', job?.responsibilities ?? null, false], ['Requirements', job?.requirements ?? null, true]]

  return (
    <div className="mx-auto max-w-[1300px] px-8 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link to="/calling" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />Calling list</Link>
        <div className="flex items-center gap-2"><span className="text-sm text-slate-500">{pos >= 0 ? `Candidate ${pos + 1} of ${total}` : 'Outside current queue'}</span>
          <Button size="sm" variant="secondary" disabled={!prevId} onClick={() => prevId && onGo(prevId)}><ArrowLeft className="h-3.5 w-3.5" />Previous</Button>
          <Button size="sm" variant="secondary" disabled={!nextId} onClick={() => nextId && onGo(nextId)}>Skip<ArrowRight className="h-3.5 w-3.5" /></Button></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card className="flex flex-wrap items-start gap-5 p-6">
            <Avatar name={c.full_name} size={16} className="shadow-card" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{c.full_name}</h1>
              <div className="text-sm text-slate-600">{[c.current_position, c.current_organization].filter(Boolean).join(' at ') || 'No current role on file'}</div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {[c.city && [c.city, c.country].filter(Boolean).join(', '), c.experience_years != null && `${c.experience_years} yrs experience`].filter(Boolean).map((t) => <Badge key={t as string}>{t as string}</Badge>)}
                {c.open_to_work === true && <Badge tone="green" dot>Open to work</Badge>}{c.open_to_work === false && <Badge>Not open to work</Badge>}
                {row.candidate_batches && <Badge tone="brand">Lot: {row.candidate_batches.tag}</Badge>}
              </div>
            </div>
            <div className="space-y-1.5 text-right text-xs text-slate-500">
              <div className="flex justify-end gap-1.5">{row.job_candidates.stage_name && <Badge tone="brand">{row.job_candidates.stage_name}</Badge>}<CallBadge status={row.call_status} /></div>
              <div>Attempts: <b className="text-slate-800">{row.call_attempts}</b></div><div>Last called: {row.last_called_at ? fmtDateTime(row.last_called_at) : 'never'}</div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Contact</h3>
            {!phones.length && <div className="text-sm text-slate-500">No phone number on file.</div>}
            <div className="space-y-2">
              {phones.map((p, i) => (
                <div key={p} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <span className="w-14 text-xs text-slate-400">Phone {i + 1}</span><span className="flex-1 font-mono text-lg font-medium text-slate-900">{p}</span>
                  <a href={`tel:${p.replace(/[^\d+]/g, '')}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-card hover:bg-emerald-700"><Phone className="h-4 w-4" />Call</a><Copyable text={p} label="number" />
                </div>))}
              {([['Email (work)', c.email], ['Email (personal)', c.alt_email]] as const).filter(([, v]) => v).map(([l, v]) => (
                <div key={l} className="flex items-center gap-3 px-4 py-1.5"><span className="w-24 text-xs text-slate-400">{l}</span><a href={`mailto:${v}`} className="flex-1 text-sm text-brand-700 hover:underline"><Mail className="mr-1.5 inline h-3.5 w-3.5" />{v}</a><Copyable text={v!} label="email" /></div>))}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 px-4 text-sm">
              {c.linkedin_url && <a href={href(c.linkedin_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline"><ExternalLink className="h-3.5 w-3.5" />LinkedIn profile</a>}
              {c.recruiter_profile_url && <a href={href(c.recruiter_profile_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline"><ExternalLink className="h-3.5 w-3.5" />Recruiter profile</a>}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">Other outreach:
              {CHANNELS.filter((ch) => ch.key !== 'call').map((ch) => <Badge key={ch.key} tone={statusMeta(ch.key, row[ch.col])?.tone ?? 'slate'}>{ch.label}: {statusMeta(ch.key, row[ch.col])?.label}</Badge>)}</div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Role you're calling about</h3>
            <div className="text-lg font-semibold text-slate-900"><span className="mr-2 font-mono text-sm text-slate-400">{job?.job_code}</span>{job?.name}{job?.company_name && <span className="text-sm font-normal text-slate-500"> · {job.company_name}</span>}</div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3">
              {([['Location', [job?.city, job?.country].filter(Boolean).join(', ')], ['Work mode', job?.work_mode], ['Employment type', job?.employment_type], ['Experience wanted', job?.experience], ['Compensation', job?.compensation], ['Openings', job?.openings]] as const).filter(([, v]) => v).map(([l, v]) => (
                <div key={l}><dt className="text-xs text-slate-400"><MapPin className="hidden" />{l}</dt><dd className="font-medium text-slate-800">{String(v)}</dd></div>))}
            </dl>
            {!!job?.skills?.length && <div className="mt-3 flex flex-wrap gap-1.5">{job.skills.map((s) => <Badge key={s} tone="brand">{s}</Badge>)}</div>}
            <div className="mt-3 space-y-1">
              {roleSections.filter(([, v]) => v).map(([l, v, o]) => <details key={l} open={o} className="rounded-lg border border-slate-100 px-3 py-2"><summary className="cursor-pointer text-sm font-medium text-slate-700">{l}</summary><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{v}</p></details>)}
              {!roleSections.some(([, v]) => v) && job?.description && <details open className="rounded-lg border border-slate-100 px-3 py-2"><summary className="cursor-pointer text-sm font-medium text-slate-700">Job description</summary><div className="mt-2"><RichText html={job.description} empty="" /></div></details>}
            </div>
          </Card>

          {row.call_notes && <Card className="p-6"><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Latest call note</h3><p className="whitespace-pre-wrap text-sm text-slate-700">{row.call_notes}</p></Card>}

          <Card className="p-6">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">History</h3>
            {!activity.data?.length ? <div className="text-sm text-slate-400">No calls or changes yet.</div> : (
              <ul className="space-y-3">
                {activity.data.map((a) => (
                  <li key={a.id} className="border-l-2 border-slate-200 pl-4">
                    <div className="text-sm text-slate-800">{a.channel === 'interview' ? (a.to_status ? `Interview set for ${fmtDateTime(a.to_status)}` : 'Interview time cleared') : a.channel === 'assignment' ? (a.from_status ? 'Reassigned' : `Picked up by ${a.actor_name ?? 'a caller'}`) : <><span className="text-xs capitalize text-slate-400">{a.channel === 'call' ? 'Call' : a.channel}: </span><Badge tone={statusMeta(a.channel === 'call' ? 'call' : 'msg', a.to_status)?.tone ?? 'slate'}>{statusMeta(a.channel === 'call' ? 'call' : 'msg', a.to_status)?.label ?? a.to_status}</Badge></>}</div>
                    {a.note && <div className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{a.note}</div>}
                    <div className="mt-1 text-xs text-slate-400">{a.actor_name ?? 'System'} · {fmtDateTime(a.created_at)}</div>
                  </li>))}
              </ul>)}
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">How did the call go?</h3>
            <div className="grid grid-cols-2 gap-2">
              {CALL_OUTCOMES.map((s, i) => (
                <button key={s.key} onClick={() => { setStatus(s.key); noteRef.current?.focus() }}
                  className={cx('flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition', status === s.key ? cx(TONE[s.tone], 'ring-2 ring-brand-500/30') : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
                  <kbd>{i + 1}</kbd><span className="leading-tight">{s.label}</span></button>))}
            </div>
            <label className="mt-4 block text-xs font-medium text-slate-700">Notes</label>
            <Textarea ref={noteRef} rows={6} className="mt-1.5" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Current CTC, expected CTC, notice period, location preference, availability…" />
            {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <Button size="lg" className="mt-4 w-full" loading={log.isPending} onClick={() => void save(true)}>{nextId ? <>Save &amp; next candidate<ArrowRight className="h-4 w-4" /></> : 'Save & finish'}</Button>
            <Button variant="ghost" className="mt-2 w-full" disabled={log.isPending} onClick={() => void save(false)}>Save and stay</Button>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">Shortcuts: 1–8 pick an outcome · Ctrl/⌘ + Enter saves &amp; moves on. The time of the call is recorded automatically.</p>
          </Card>
          {upNext.length > 0 && (
            <Card className="p-5"><h3 className="mb-2 text-sm font-semibold text-slate-900">Up next</h3>
              {upNext.map((r) => <button key={r.job_candidate_id} onClick={() => onGo(r.job_candidate_id)} className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50"><span className="truncate text-sm font-medium text-slate-800">{r.job_candidates.candidates.full_name}</span><span className="truncate text-xs text-slate-400">{r.job_candidates.candidates.current_organization}</span></button>)}
            </Card>)}
        </aside>
      </div>
    </div>
  )
}
