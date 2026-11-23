import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Lock, Phone, Play, Search, Trash2 } from 'lucide-react'
import { useCallList, useMembers, useRpc } from '../lib/api'
import { useAuth } from '../lib/auth'
import { callBucket, claimOf, fmtDateTime, sortForCalling, statusMeta, type CallRow } from '../lib/calling'
import { cx } from '../lib/util'
import { Avatar, Badge, Button, Card, Empty, Input, Modal, PageHeader, Segmented, Select, Spinner, useToast } from '../components/ui'

export const CallBadge = ({ status }: { status: string }) => { const m = statusMeta('call', status); return <Badge tone={m?.tone ?? 'slate'} dot>{m?.label ?? status}</Badge> }

type View = 'queue' | 'mine' | 'taken' | 'done' | 'all'

export default function Calling() {
  const { isAdmin, member } = useAuth(); const navigate = useNavigate(); const qc = useQueryClient(); const toast = useToast()
  const me = member?.user_id
  const list = useCallList(); const members = useMembers()
  const [view, setView] = useState<View>('queue')
  const [job, setJob] = useState(''); const [lot, setLot] = useState(''); const [caller, setCaller] = useState(''); const [q, setQ] = useState('')
  const [delLot, setDelLot] = useState<null | { id: string; tag: string; n: number }>(null)
  const rows = list.data ?? []
  const cand = (r: CallRow) => r.job_candidates.candidates
  const jobOf = (r: CallRow) => r.job_candidates.jobs
  const name = (id: string | null) => (id ? members.data?.find((m) => m.user_id === id)?.full_name || members.data?.find((m) => m.user_id === id)?.email || 'a teammate' : '')
  const claim = (r: CallRow) => claimOf(r, me)
  // callers can only work free rows and their own; admins can open anything
  const workable = (r: CallRow) => isAdmin || claim(r) !== 'taken'
  const callersInList = useMemo(() => [...new Set(rows.map((r) => r.call_assigned_to).filter((x): x is string => !!x))], [rows])

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

  // the numbers you see are about the candidates you can work on
  const stats = useMemo(() => {
    const s = { new: 0, callback: 0, retry: 0, done: 0, interested: 0, taken: 0 }
    rows.forEach((r) => { if (!workable(r)) { s.taken++; return } s[callBucket(r)]++; if (r.call_status === 'connected_interested') s.interested++ })
    return s
  }, [rows, me, isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  const inView = (r: CallRow, v: View) => {
    const b = callBucket(r); const c = claim(r)
    if (v === 'queue') return b !== 'done' && workable(r)
    if (v === 'mine') return c === 'mine'
    if (v === 'taken') return isAdmin ? c !== 'free' : c === 'taken'
    if (v === 'done') return b === 'done' && workable(r)
    return true
  }
  const match = (r: CallRow, v: View) => {
    if (!inView(r, v)) return false
    if (job && r.job_candidates.job_id !== job) return false
    if (caller && r.call_assigned_to !== caller) return false
    if (lot && r.batch_id !== lot) return false
    if (!q.trim()) return true
    const c = cand(r)
    return `${c.full_name} ${c.phone ?? ''} ${c.current_organization ?? ''} ${r.candidate_batches?.tag ?? ''}`.toLowerCase().includes(q.toLowerCase())
  }
  const visible = useMemo(() => rows.filter((r) => match(r, view)).sort(sortForCalling), [rows, view, job, lot, caller, q, me]) // eslint-disable-line react-hooks/exhaustive-deps
  const first = useMemo(() => rows.filter((r) => match(r, 'queue')).sort(sortForCalling)[0], [rows, job, lot, caller, q, me]) // eslint-disable-line react-hooks/exhaustive-deps
  const qs = [job && `job=${job}`, lot && `lot=${lot}`].filter(Boolean).join('&')
  const open = (r: CallRow) => {
    if (!workable(r)) { toast(`${name(r.call_assigned_to)} already has this candidate`, 'err'); return }
    navigate(`/calling/${r.job_candidate_id}${qs ? `?${qs}` : ''}`)
  }
  const counts: Record<View, number> = {
    queue: rows.filter((r) => inView(r, 'queue')).length, mine: rows.filter((r) => inView(r, 'mine')).length, taken: rows.filter((r) => inView(r, 'taken')).length,
    done: rows.filter((r) => inView(r, 'done')).length, all: rows.length,
  }
  const opts: { value: View; label: string; count: number }[] = [
    { value: 'queue', label: 'To call', count: counts.queue }, { value: 'mine', label: 'Mine', count: counts.mine },
    { value: 'taken', label: isAdmin ? 'Picked up' : 'Taken by others', count: counts.taken }, { value: 'done', label: 'Completed', count: counts.done }, { value: 'all', label: 'All', count: counts.all },
  ]

  return (
    <div className="mx-auto max-w-[1500px] px-8 py-7">
      <PageHeader title="Calling list" subtitle={isAdmin ? 'Everyone’s candidates in one pool. Callers claim a candidate by opening them.' : 'Open a candidate to claim them. Once you do, nobody else can call that person.'}
        actions={first && <Button size="lg" onClick={() => open(first)}><Play className="h-4 w-4" />Start calling</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {([['Not called yet', stats.new, 'text-slate-900'], ['Call back requested', stats.callback, 'text-sky-600'], ['To retry', stats.retry, 'text-amber-600'], ['Interested', stats.interested, 'text-emerald-600'], [isAdmin ? 'Completed' : 'Taken by others', isAdmin ? stats.done : stats.taken, 'text-slate-500']] as const).map(([l, n, c]) => (
          <Card key={l} className="px-4 py-3.5"><div className={cx('text-2xl font-semibold tabular-nums', c)}>{n}</div><div className="mt-0.5 text-xs text-slate-500">{l}</div></Card>))}
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={view} onChange={setView} options={opts} />
          <Select className="!h-9 !w-56" value={job} onChange={(e) => { setJob(e.target.value); setLot('') }}><option value="">All jobs</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.job_code} {j.name}</option>)}</Select>
          <Select className="!h-9 !w-56" value={lot} onChange={(e) => setLot(e.target.value)}><option value="">All lots</option>{lots.map((l) => <option key={l.id} value={l.id}>{job ? l.tag : `${l.code} · ${l.tag}`} ({l.n})</option>)}</Select>
          {isAdmin && <Select className="!h-9 !w-44" value={caller} onChange={(e) => setCaller(e.target.value)}><option value="">All callers</option>{callersInList.map((id) => <option key={id} value={id}>{name(id)}</option>)}</Select>}
          <div className="relative ml-auto w-64"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Search name, phone, company, lot…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {isAdmin && lot && <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600"><span>Lot “{lots.find((l) => l.id === lot)?.tag}” · {lots.find((l) => l.id === lot)?.n} on the calling list</span>
          <Button size="sm" variant="ghost" className="!text-red-600" onClick={() => setDelLot(lots.find((l) => l.id === lot) ?? null)}><Trash2 className="h-3.5 w-3.5" />Delete lot / calling list…</Button></div>}
      </Card>

      <Card>
        {list.isLoading ? <Spinner /> : !visible.length ? <Empty icon={<Phone />} title={rows.length ? 'Nothing in this view' : 'No candidates on calling lists yet'} hint={rows.length ? undefined : 'Admins upload candidate lots from the job’s Calling tab.'} /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200/80 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 [&>th]:py-3 [&>th]:pr-4">
              <th className="rounded-tl-xl !pl-5">Candidate</th><th>Phone</th><th>Job</th><th>Lot</th><th>Stage</th><th>Status</th><th>Attempts</th><th>Last called</th><th>Called by</th><th className="w-4 rounded-tr-xl" />
            </tr></thead>
            <tbody>
              {visible.map((r) => { const c = cand(r); const j = jobOf(r); const cl = claim(r); const locked = !workable(r); return (
                <tr key={r.job_candidate_id} onClick={() => open(r)} className={cx('border-b border-slate-100 transition last:border-0', locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-brand-50/40')}>
                  <td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar name={c.full_name} size={8} /><div className="min-w-0"><div className="flex items-center gap-1.5 font-semibold text-slate-900">{c.full_name}{locked && <Lock className="h-3.5 w-3.5 text-slate-400" />}</div><div className="truncate text-xs text-slate-500">{[c.current_position, c.current_organization].filter(Boolean).join(' · ')}</div></div></div></td>
                  <td className="whitespace-nowrap pr-4 font-mono text-[13px] text-slate-700">{locked ? '••••••••' : c.phone ?? '—'}</td>
                  <td className="max-w-[200px] pr-4 text-xs"><span className="font-mono text-slate-500">{j?.job_code}</span> <span className="text-slate-700">{j?.name}</span></td>
                  <td className="pr-4">{r.candidate_batches ? <Badge>{r.candidate_batches.tag}</Badge> : <span className="text-slate-300">—</span>}</td>
                  <td className="pr-4 text-xs text-slate-600">{r.job_candidates.stage_name ?? '—'}</td>
                  <td className="pr-4"><CallBadge status={r.call_status} /></td>
                  <td className="pr-4 tabular-nums text-slate-600">{r.call_attempts}</td>
                  <td className="whitespace-nowrap pr-4 text-xs text-slate-500">{r.last_called_at ? fmtDateTime(r.last_called_at) : '—'}</td>
                  <td className="pr-4 text-xs">{cl === 'free' ? <Badge tone="green">Available</Badge> : cl === 'mine' ? <Badge tone="brand">You</Badge> : <span className="font-medium text-slate-700">{name(r.call_assigned_to)}</span>}</td>
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
        {([['unassign', 'Release the candidates', 'Keep the lot and its candidates; free anyone who has been picked up but not yet called, so any caller can take them.'], ['delete', 'Delete the lot', 'Remove the lot and its candidates from the job. People stay in the master candidate list; candidates that came from RecruitCRM are kept.']] as const).map(([k, t, d]) => (
          <label key={k} className={cx('flex cursor-pointer gap-3 rounded-xl border p-3', mode === k ? 'border-brand-400 bg-brand-50/50' : 'border-slate-200')}><input type="radio" checked={mode === k} onChange={() => setMode(k)} className="mt-1" /><div><div className="font-medium text-slate-900">{t}</div><div className="text-xs">{d}</div></div></label>))}
      </div>
      <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={mode === 'delete' ? 'danger' : 'primary'} loading={m.isPending} onClick={() => m.mutate({ p_batch_id: lot.id, p_mode: mode })}>{mode === 'delete' ? 'Delete lot' : 'Release'}</Button></div>
    </Modal>
  )
}
