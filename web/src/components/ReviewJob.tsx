import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, unwrap } from '../lib/supabase'
import { useRpc } from '../lib/api'
import type { Job } from '../lib/types'
import { Button, Input, Label, Select, Textarea } from './ui'

interface St { key: string; label: string; sort_order: number; is_active: boolean }

/** Admin structures a submitted JD and sets its status. Raw JD stays visible on the left. */
export default function ReviewJob({ job, onDone }: { job: Job; onDone: () => void }) {
  const statuses = useQuery({ queryKey: ['job-statuses'], queryFn: () => unwrap<St[]>(supabase.from('job_statuses').select('*').eq('is_active', true).order('sort_order')), staleTime: 5 * 60_000 })
  const [f, setF] = useState({
    name: job.name ?? '', company_name: job.company_name ?? '', city: job.city ?? '', work_mode: job.work_mode ?? '', employment_type: job.employment_type ?? '', experience: job.experience ?? '', compensation: job.compensation ?? '',
    openings: String(job.openings ?? 1), skills: (job.skills ?? []).join(', '), summary: job.summary ?? '', responsibilities: job.responsibilities ?? '', requirements: job.requirements ?? '', pay_rate: job.pay_rate ?? '', bill_rate: job.bill_rate ?? '',
    status: /pending/i.test(job.status ?? '') ? 'Open' : job.status ?? 'Open',
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const m = useRpc<{ p_id: string; p: object }>('review_job', { ok: 'Job updated', invalidate: [['jobs'], ['job'], ['job-stats'], ['dashboard']], onDone })
  return (
    <form className="grid gap-5 lg:grid-cols-[1fr_1.3fr]" onSubmit={(e) => { e.preventDefault(); m.mutate({ p_id: job.id, p: { ...f, skills: f.skills.split(',').map((s) => s.trim()).filter(Boolean) } }) }}>
      <div>
        <Label>Submitted JD{job.submitted_by_name ? ` · by ${job.submitted_by_name}` : ''}</Label>
        <div className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{job.raw_jd || 'No raw JD on file.'}</div>
        {job.intake_note && <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"><b className="font-semibold">Note:</b> {job.intake_note}</div>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Job title</Label><Input required value={f.name} onChange={set('name')} /></div>
        <div><Label>Client</Label><Input value={f.company_name} onChange={set('company_name')} /></div><div><Label>Location</Label><Input value={f.city} onChange={set('city')} /></div>
        <div><Label>Work mode</Label><Select value={f.work_mode} onChange={set('work_mode')}><option value="">—</option><option>Onsite</option><option>Hybrid</option><option>Remote</option></Select></div>
        <div><Label>Employment type</Label><Input value={f.employment_type} onChange={set('employment_type')} placeholder="Full time, Contract…" /></div>
        <div><Label>Experience wanted</Label><Input value={f.experience} onChange={set('experience')} placeholder="5–9 years" /></div><div><Label>Compensation</Label><Input value={f.compensation} onChange={set('compensation')} /></div>
        <div><Label>Pay rate</Label><Input value={f.pay_rate} onChange={set('pay_rate')} /></div><div><Label>Bill rate</Label><Input value={f.bill_rate} onChange={set('bill_rate')} /></div>
        <div><Label>Openings</Label><Input type="number" min={1} value={f.openings} onChange={set('openings')} /></div>
        <div><Label>Status</Label><Select value={f.status} onChange={set('status')}>{(statuses.data ?? []).map((s) => <option key={s.key} value={s.label}>{s.label}</option>)}</Select></div>
        <div className="col-span-2"><Label hint="comma separated">Skills</Label><Input value={f.skills} onChange={set('skills')} /></div>
        <div className="col-span-2"><Label>Summary</Label><Textarea rows={3} value={f.summary} onChange={set('summary')} /></div>
        <div className="col-span-2"><Label>Responsibilities</Label><Textarea rows={3} value={f.responsibilities} onChange={set('responsibilities')} /></div>
        <div className="col-span-2"><Label>Requirements</Label><Textarea rows={3} value={f.requirements} onChange={set('requirements')} /></div>
        <div className="col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={onDone}>Cancel</Button><Button type="submit" loading={m.isPending}>Save</Button></div>
      </div>
    </form>
  )
}
