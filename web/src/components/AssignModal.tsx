import { useState } from 'react'
import { Search } from 'lucide-react'
import { useCandidateSearch, useJobs, useRpc } from '../lib/api'
import { useDebounced, place, isOpenStatus } from '../lib/util'
import { Badge, Button, Input, Modal, Spinner } from './ui'

// Add candidates TO a job (pick candidates) - used on the job board.
export function AddCandidatesModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [q, setQ] = useState(''); const dq = useDebounced(q)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const res = useCandidateSearch({ q: dq, excludeJob: jobId, limit: 30 })
  const assign = useRpc<{ p_job: string; p_candidates: string[] }>('assign_candidates', { onDone: (n) => { onClose(); void n } , ok: 'Added to pipeline' })
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  return (
    <Modal open onClose={onClose} title="Add candidates to this job" wide>
      <div className="relative mb-3"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input autoFocus className="pl-9" placeholder="Search by name, skill, title, company, phone…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="max-h-[50vh] overflow-auto scroll-thin rounded-lg border border-slate-200">
        {res.isLoading ? <Spinner /> : res.data?.rows.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-slate-50">
            <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 rounded border-slate-300 accent-[#4f46e5]" />
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate-800">{c.full_name}</div><div className="truncate text-xs text-slate-500">{[c.current_position, c.current_organization, place(c)].filter(Boolean).join(' · ')}</div></div>
            {c.skills.slice(0, 3).map((s) => <Badge key={s}>{s}</Badge>)}
          </label>
        ))}
        {res.data?.rows.length === 0 && <div className="p-6 text-center text-sm text-slate-500">No matching candidates outside this pipeline.</div>}
      </div>
      <div className="mt-4 flex items-center justify-between"><span className="text-xs text-slate-500">{sel.size} selected · {res.data?.total.toLocaleString() ?? '…'} matches</span>
        <div className="flex gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!sel.size} loading={assign.isPending} onClick={() => assign.mutate({ p_job: jobId, p_candidates: [...sel] })}>Add {sel.size || ''} to pipeline</Button></div></div>
    </Modal>
  )
}

// Add selected candidates to a job (pick a job) - used on the candidate list.
export function PickJobModal({ candidateIds, onClose, onDone }: { candidateIds: string[]; onClose: () => void; onDone?: () => void }) {
  const jobs = useJobs(); const [q, setQ] = useState('')
  const assign = useRpc<{ p_job: string; p_candidates: string[] }>('assign_candidates', { ok: 'Added to pipeline', onDone: () => { onDone?.(); onClose() } })
  const list = (jobs.data ?? []).filter((j) => isOpenStatus(j.status ?? 'open') && j.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <Modal open onClose={onClose} title={`Add ${candidateIds.length} candidate${candidateIds.length > 1 ? 's' : ''} to a job`}>
      <Input autoFocus placeholder="Filter open jobs…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
      <div className="max-h-[50vh] overflow-auto scroll-thin rounded-lg border border-slate-200">
        {jobs.isLoading ? <Spinner /> : list.map((j) => (
          <button key={j.id} disabled={assign.isPending} onClick={() => assign.mutate({ p_job: j.id, p_candidates: candidateIds })} className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-brand-50">
            <div><div className="text-sm font-medium text-slate-800">{j.name}</div><div className="text-xs text-slate-500">{[j.company_name, place(j)].filter(Boolean).join(' · ')}</div></div>
            <Badge tone="brand">{j.job_candidates?.[0]?.count ?? 0} in pipeline</Badge>
          </button>
        ))}
        {!jobs.isLoading && !list.length && <div className="p-6 text-center text-sm text-slate-500">No open jobs match.</div>}
      </div>
    </Modal>
  )
}
