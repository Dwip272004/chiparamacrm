import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Phone, PhoneCall, Play, Search, Trash2 } from 'lucide-react'
import { useCallList, useCallers, useRpc } from '../lib/api'
import { useAuth } from '../lib/auth'
import { callBucket, fmtDateTime, sortForCalling, statusMeta, type CallRow } from '../lib/calling'
import { cx } from '../lib/util'
import { Avatar, Badge, Button, Card, Empty, Input, Modal, PageHeader, Segmented, Select, Spinner } from '../components/ui'

export const CallBadge = ({ status }: { status: string }) => { const m = statusMeta('call', status); return <Badge tone={m?.tone ?? 'slate'} dot>{m?.label ?? status}</Badge> }

export default function Calling() {
  const { isAdmin } = useAuth(); const navigate = useNavigate(); const qc = useQueryClient()
  const list = useCallList(); const callers = useCallers(isAdmin)
  const [view, setView] = useState<'queue' | 'done' | 'all'>('queue')
  const [job, setJob] = useState(''); const [lot, setLot] = useState(''); const [caller, setCaller] = useState(''); const [q, setQ] = useState('')
  const [delLot, setDelLot] = useState<null | { id: string; tag: string; n: number }>(null)
  const rows = list.data ?? []
  const cand = (r: CallRow) => r.job_candidates.candidates
  const jobOf = (r: CallRow) => r.job_candidates.jobs

  const jobs = useMemo(() => { const m = new Map<string, NonNullable<ReturnType<typeof jobOf>>>(); rows.forEach((r) => { const j = jobOf(r); if (j) m.set(j.id, j) }); return [...m.values()] }, [rows])
  const lots = useMemo(() => {
    const m = new Map<string, { id: string; tag: string; code: string; n: number; todo: number }>()
    rows.forEach((r) => {
      if (!r.candidate_batches || (job && r.job_candidates.job_id !== job)) return
      const c = m.get(r.candidate_batches.id) ?? { id: r.candidate_batches.id, tag: r.candidate_batches.tag, code: jobOf(r)?.job_code ?? '', n: 0, todo: 0 }
      c.n++; if (callBucket(r) !== 'done') c.todo++; m.set(c.id, c)
    })
    return [...m.values()].sort((a, b) => `${a.code}${a.tag}`.localeCompare(`${b.code}${b.tag}`))
  }, [rows, job])
  const stats = useMemo(() => { const s = { new: 0, callback: 0, retry: 0, done: 0, interested: 0 }; rows.forEach((r) => { s[callBucket(r)]++; if (r.call_status === 'connected_interested') s.interested++ }); return s }, [rows])
  const callerName = (id: string | null) => callers.data?.find((c) => c.user_id === id)?.full_name ?? '—'

  const match = (r: CallRow, ignoreView = false) => {
    const b = callBucket(r)
    if (!ignoreView && view === 'queue' && b === 'done') return false
    if (!ignoreView && view === 'done' && b !== 'done') return false
    if (job && r.job_candidates.job_id !== job) return false
    if (caller && r.call_assigned_to !== caller) return false
    if (lot && r.batch_id !== lot) return false
    if (!q.trim()) return true
    const c = cand(r)
    return `${c.full_name} ${c.phone ?? ''} ${c.current_organization ?? ''} ${r.candidate_batches?.tag ?? ''}`.toLowerCase().includes(q.toLowerCase())
  }
  const visible = useMemo(() => rows.filter((r) => match(r)).sort(sortForCalling), [rows, view, job, lot, caller, q]) // eslint-disable-line react-hooks/exhaustive-deps
  const first = useMemo(() => rows.filter((r) => callBucket(r) !== 'done' && match(r, true)).sort(sortForCalling)[0], [rows, job, lot, caller, q]) // eslint-disable-line react-hooks/exhaustive-deps
  const open = (id: string) => navigate(`/calling/${id}${[job && `job=${job}`, lot && `lot=${lot}`].filter(Boolean).length ? '?' + [job && `job=${job}`, lot && `lot=${lot}`].filter(Boolean).join('&') : ''}`)
  const counts = { queue: stats.new + stats.callback + stats.retry, done: stats.done, all: rows.length }

  return (
    <div className="mx-auto max-w-[1500px] px-8 py-7">
      <PageHeader title={isAdmin ? 'Calling list' : 'My calling list'} subtitle={isAdmin ? 'Every caller’s queue. Assign candidates from a job’s page.' : 'Candidates assigned to you, in the order to call them.'}
        actions={first && <Button size="lg" onClick={() => open(first.job_candidate_id)}><Play className="h-4 w-4" />Start calling</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[['Not called yet', stats.new, 'text-slate-900', Phone], ['Call back requested', stats.callback, 'text-sky-600', PhoneCall], ['To retry', stats.retry, 'text-amber-600', PhoneCall], ['Interested', stats.interested, 'text-emerald-600', PhoneCall], ['Completed', stats.done, 'text-slate-500', PhoneCall]].map(([l, n, c, Icon]) => (
          <Card key={l as string} className="px-4 py-3.5"><div className={cx('text-2xl font-semibold tabular-nums', c as string)}>{n as number}</div><div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">{l as string}</div></Card>))}
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={view} onChange={setView} options={[{ value: 'queue', label: 'To call', count: counts.queue }, { value: 'done', label: 'Completed', count: counts.done }, { value: 'all', label: 'All', count: counts.all }]} />
          <Select className="!h-9 !w-56" value={job} onChange={(e) => { setJob(e.target.value); setLot('') }}><option value="">All jobs</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.job_code} {j.name}</option>)}</Select>
          <Select className="!h-9 !w-56" value={lot} onChange={(e) => setLot(e.target.value)}><option value="">All lots</option>{lots.map((l) => <option key={l.id} value={l.id}>{job ? l.tag : `${l.code} · ${l.tag}`} ({l.n})</option>)}</Select>
          {isAdmin && <Select className="!h-9 !w-44" value={caller} onChange={(e) => setCaller(e.target.value)}><option value="">All callers</option>{callers.data?.map((c) => <option key={c.user_id} value={c.user_id}>{c.full_name}</option>)}</Select>}
          <div className="relative ml-auto w-64"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Search name, phone, company, lot…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {isAdmin && lot && <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600"><span>Lot “{lots.find((l) => l.id === lot)?.tag}” · {lots.find((l) => l.id === lot)?.n} on the calling list</span>
          <Button size="sm" variant="ghost" className="!text-red-600" onClick={() => setDelLot(lots.find((l) => l.id === lot) ?? null)}><Trash2 className="h-3.5 w-3.5" />Delete lot / calling list…</Button></div>}
      </Card>

      <Card>
        {list.isLoading ? <Spinner /> : !visible.length ? <Empty icon={<Phone />} title={rows.length ? 'Nothing in this view' : 'No candidates assigned for calling yet'} hint={rows.length ? undefined : 'Admins assign calling lots from the job’s page.'} /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200/80 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 [&>th]:py-3 [&>th]:pr-4">
              <th className="rounded-tl-xl !pl-5">Candidate</th><th>Phone</th><th>Job</th><th>Lot</th><th>Stage</th><th>Status</th><th>Attempts</th><th>Last called</th>{isAdmin && <th>Caller</th>}<th className="w-4 rounded-tr-xl" />
            </tr></thead>
            <tbody>
              {visible.map((r) => { const c = cand(r); const j = jobOf(r); return (
                <tr key={r.job_candidate_id} onClick={() => open(r.job_candidate_id)} className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-brand-50/40">
                  <td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar name={c.full_name} size={8} /><div className="min-w-0"><div className="font-semibold text-slate-900">{c.full_name}</div><div className="truncate text-xs text-slate-500">{[c.current_position, c.current_organization].filter(Boolean).join(' · ')}</div></div></div></td>
                  <td className="whitespace-nowrap pr-4 font-mono text-[13px] text-slate-700">{c.phone ?? '—'}</td>
                  <td className="max-w-[200px] pr-4 text-xs"><span className="font-mono text-slate-500">{j?.job_code}</span> <span className="text-slate-700">{j?.name}</span></td>
                  <td className="pr-4">{r.candidate_batches ? <Badge>{r.candidate_batches.tag}</Badge> : <span className="text-slate-300">—</span>}</td>
                  <td className="pr-4 text-xs text-slate-600">{r.job_candidates.stage_name ?? '—'}</td>
                  <td className="pr-4"><CallBadge status={r.call_status} /></td>
                  <td className="pr-4 tabular-nums text-slate-600">{r.call_attempts}</td>
                  <td className="whitespace-nowrap pr-4 text-xs text-slate-500">{r.last_called_at ? fmtDateTime(r.last_called_at) : '—'}</td>
                  {isAdmin && <td className="pr-4 text-xs text-slate-600">{callerName(r.call_assigned_to)}</td>}
                  <td />
                </tr>) })}
            </tbody>
          </table>
        )}
      </Card>
      {delLot && <DeleteLot lot={delLot} onClose={() => setDelLot(null)} onDone={() => { setDelLot(null); setLot(''); void qc.invalidateQueries({ queryKey: ['call-list'] }) }} />}
    </div>
  )
}

export function DeleteLot({ lot, onClose, onDone }: { lot: { id: string; tag: string; n: number }; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'unassign' | 'delete'>('unassign')
  const m = useRpc<{ p_batch_id: string; p_mode: string }>('delete_candidate_lot', { ok: 'Done', invalidate: [['call-list']], onDone })
  return (
    <Modal open onClose={onClose} title={`Lot “${lot.tag}”`}>
      <div className="space-y-3 text-sm text-slate-600">
        {([['unassign', 'Clear the calling list', 'Keep the lot and its candidates; just take them off the callers’ lists.'], ['delete', 'Delete the lot', 'Remove the lot and its candidates from the job. People stay in the master candidate list; candidates that came from RecruitCRM are kept.']] as const).map(([k, t, d]) => (
          <label key={k} className={cx('flex cursor-pointer gap-3 rounded-xl border p-3', mode === k ? 'border-brand-400 bg-brand-50/50' : 'border-slate-200')}><input type="radio" checked={mode === k} onChange={() => setMode(k)} className="mt-1" /><div><div className="font-medium text-slate-900">{t}</div><div className="text-xs">{d}</div></div></label>))}
      </div>
      <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={mode === 'delete' ? 'danger' : 'primary'} loading={m.isPending} onClick={() => m.mutate({ p_batch_id: lot.id, p_mode: mode })}>{mode === 'delete' ? 'Delete lot' : 'Clear calling list'}</Button></div>
    </Modal>
  )
}
