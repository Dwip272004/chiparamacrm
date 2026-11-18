import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, MessageSquare, Plus, Search, Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ENRICH_KEYS, useCandidateSearch, useEnrichment, useEnrichmentEvents, useRpc, type EnrichmentReq } from '../lib/api'
import { ago, cx, place, useDebounced } from '../lib/util'
import { Avatar, Badge, Button, Empty, Input, Modal, Spinner } from '../components/ui'
import { CompleteForm, DecideForm, EnrichBadge, RequestForm, Stepper } from '../components/Enrichment'
import { useShell } from '../components/Shell'

type Tab = 'action' | 'mine' | 'done' | 'all'
const open = (r: EnrichmentReq) => r.status === 'pending' || r.status === 'approved'

export default function Enrichment() {
  const { isManager, canWrite, session } = useAuth()
  const me = session?.user.id
  const q = useEnrichment()
  const [tab, setTab] = useState<Tab>(isManager ? 'action' : 'mine')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<null | { kind: 'reject' | 'complete'; r: EnrichmentReq } | { kind: 'new' }>(null)
  const rows = q.data ?? []
  const counts = useMemo(() => ({
    action: rows.filter(open).length, mine: rows.filter((r) => r.requested_by === me).length,
    done: rows.filter((r) => !open(r)).length, all: rows.length,
  }), [rows, me])
  const shown = rows.filter((r) => {
    if (tab === 'action' && !open(r)) return false
    if (tab === 'mine' && r.requested_by !== me) return false
    if (tab === 'done' && open(r)) return false
    const t = search.trim().toLowerCase()
    return !t || (r.candidates?.full_name ?? '').toLowerCase().includes(t) || (r.requested_by_name ?? '').toLowerCase().includes(t)
  })
  const tabs: [Tab, string][] = [['action', isManager ? 'Needs action' : 'Open'], ['mine', 'My requests'], ['done', 'Completed'], ['all', 'All']]

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900"><Sparkles className="h-5 w-5 text-brand-600" />Enrichment</h1>
          <p className="text-sm text-slate-500">Ask an admin to find missing email / phone. Everyone sees the status.</p></div>
        {canWrite && <Button className="ml-auto" onClick={() => setModal({ kind: 'new' })}><Plus className="h-4 w-4" />New request</Button>}
      </div>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cx('rounded-md px-3 py-1 text-sm font-medium', tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
              {l} <span className="ml-1 text-xs text-slate-400">{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-60"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-8" placeholder="Filter by candidate or requester" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      {q.isLoading ? <Spinner /> : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white"><Empty icon={<Sparkles className="h-8 w-8" />} title={tab === 'action' ? 'Nothing waiting' : 'No requests here'} hint={canWrite ? 'Open a candidate with no email or phone and click “Request enrichment”.' : undefined} /></div>
      ) : (
        <div className="space-y-2">{shown.map((r) => <Row key={r.id} r={r} me={me} isManager={isManager} onReject={() => setModal({ kind: 'reject', r })} onComplete={() => setModal({ kind: 'complete', r })} />)}</div>
      )}

      <Modal open={modal?.kind === 'reject'} onClose={() => setModal(null)} title="Reject request">
        {modal?.kind === 'reject' && <DecideForm id={modal.r.id} name={modal.r.candidates?.full_name ?? ''} onDone={() => setModal(null)} />}
      </Modal>
      <Modal open={modal?.kind === 'complete'} onClose={() => setModal(null)} title="Enrich candidate">
        {modal?.kind === 'complete' && <CompleteForm id={modal.r.id} name={modal.r.candidates?.full_name ?? ''} needs={modal.r.needs} onDone={() => setModal(null)} />}
      </Modal>
      <Modal open={modal?.kind === 'new'} onClose={() => setModal(null)} title="New enrichment request" wide>
        {modal?.kind === 'new' && <NewRequest onDone={() => setModal(null)} />}
      </Modal>
    </div>
  )
}

function Row({ r, me, isManager, onReject, onComplete }: { r: EnrichmentReq; me?: string; isManager: boolean; onReject: () => void; onComplete: () => void }) {
  const [exp, setExp] = useState(false)
  const { openCandidate } = useShell()
  const navigate = useNavigate()
  const approve = useRpc('decide_enrichment', { ok: 'Approved — requester notified', invalidate: ENRICH_KEYS })
  const cancel = useRpc('cancel_enrichment', { ok: 'Request cancelled', invalidate: ENRICH_KEYS })
  const c = r.candidates
  const isOpen = open(r)
  const mine = r.requested_by === me
  return (
    <div className={cx('rounded-xl border bg-white', r.priority === 'urgent' && isOpen ? 'border-amber-300' : 'border-slate-200')}>
      <div className="flex items-start gap-3 p-4">
        <button onClick={() => setExp(!exp)} className="mt-1 text-slate-400">{exp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
        <Avatar name={c?.full_name} size={9} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => c && openCandidate(c.id)} className="truncate text-sm font-semibold text-slate-900 hover:text-brand-700">{c?.full_name ?? 'Candidate'}</button>
            <EnrichBadge status={r.status} />
            {r.priority === 'urgent' && isOpen && <Badge tone="amber">Urgent</Badge>}
            {r.needs.map((n) => <Badge key={n} tone="brand">{n}</Badge>)}
          </div>
          <div className="truncate text-xs text-slate-500">{[c?.current_position, c?.current_organization, c && place(c)].filter(Boolean).join(' · ')}</div>
          <div className="mt-1.5 text-xs text-slate-500">Requested by <b className="text-slate-700">{mine ? 'you' : r.requested_by_name}</b> · {ago(r.created_at)}{r.note && <> · “{r.note}”</>}</div>
          <div className="mt-2"><Stepper status={r.status} /></div>
          {r.status === 'rejected' && <div className="mt-2 text-xs text-red-700">Rejected by {r.decided_by_name}{r.decision_note && `: ${r.decision_note}`}</div>}
          {(r.status === 'enriched' || r.status === 'not_found') && (
            <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {r.status === 'enriched' ? <>Added {[r.found_email, r.found_phone].filter(Boolean).join(' · ')}</> : 'No contact details could be found'} — by {r.completed_by_name} · {ago(r.completed_at)}{r.result_note && <> · “{r.result_note}”</>}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {isManager && r.status === 'pending' && (
            <div className="flex gap-1.5"><Button size="sm" loading={approve.isPending} onClick={() => approve.mutate({ p_id: r.id, p_approve: true })}><Check className="h-3.5 w-3.5" />Approve</Button><Button size="sm" variant="secondary" onClick={onReject}><X className="h-3.5 w-3.5" />Reject</Button></div>
          )}
          {isManager && isOpen && <Button size="sm" variant={r.status === 'approved' ? 'primary' : 'secondary'} onClick={onComplete}>Enrich…</Button>}
          {isOpen && (mine || isManager) && <button onClick={() => cancel.mutate({ p_id: r.id })} className="text-xs text-slate-400 hover:text-red-600">Cancel request</button>}
          {c && <button onClick={() => navigate(`/chat?ref=${c.id}`)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700"><MessageSquare className="h-3 w-3" />Discuss</button>}
        </div>
      </div>
      {exp && <Timeline id={r.id} />}
    </div>
  )
}

function Timeline({ id }: { id: string }) {
  const ev = useEnrichmentEvents(id)
  const label: Record<string, string> = { requested: 'requested enrichment', approved: 'approved', rejected: 'rejected', enriched: 'added contact details', not_found: 'could not find details', cancelled: 'cancelled' }
  return (
    <div className="border-t border-slate-100 bg-slate-50 px-12 py-3">
      {ev.isLoading ? <Spinner /> : (ev.data ?? []).map((e) => (
        <div key={e.id} className="flex gap-2 py-0.5 text-xs text-slate-600"><span className="w-28 shrink-0 text-slate-400">{ago(e.created_at)}</span><span><b>{e.actor_name}</b> {label[e.action] ?? e.action}{e.detail && <i className="text-slate-500"> — {e.detail}</i>}</span></div>
      ))}
    </div>
  )
}

function NewRequest({ onDone }: { onDone: () => void }) {
  const [q, setQ] = useState(''); const dq = useDebounced(q, 250)
  const [pick, setPick] = useState<{ id: string; full_name: string; email: string | null; phone: string | null } | null>(null)
  const res = useCandidateSearch({ q: dq, limit: 12 }, dq.trim().length > 1)
  if (pick) return <RequestForm candidateId={pick.id} name={pick.full_name} hasEmail={!!pick.email} hasPhone={!!pick.phone} onDone={onDone} />
  return (
    <div className="space-y-3">
      <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search candidate by name, skill, company…" />
      <div className="max-h-72 overflow-auto scroll-thin rounded-lg border border-slate-200">
        {(res.data?.rows ?? []).map((c) => (
          <button key={c.id} onClick={() => setPick(c)} className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50">
            <Avatar name={c.full_name} size={8} />
            <div className="min-w-0 flex-1"><div className="truncate text-sm text-slate-800">{c.full_name}</div><div className="truncate text-xs text-slate-500">{[c.current_position, c.current_organization].filter(Boolean).join(' · ')}</div></div>
            <div className="flex gap-1">{!c.email && <Badge tone="amber">no email</Badge>}{!c.phone && <Badge tone="amber">no phone</Badge>}</div>
          </button>
        ))}
        {dq.trim().length > 1 && !res.isFetching && !res.data?.rows.length && <div className="p-6 text-center text-sm text-slate-500">No candidates found</div>}
        {dq.trim().length <= 1 && <div className="p-6 text-center text-sm text-slate-500">Type at least 2 characters</div>}
      </div>
    </div>
  )
}
