import { useState } from 'react'
import { useRpc } from '../lib/api'
import { supabase, unwrap } from '../lib/supabase'
import { useQuery } from '@tanstack/react-query'
import type { Job } from '../lib/types'
import { Button, Input, Label, Select } from './ui'
import { RichEditor } from './Rich'

const STATUSES = ['Open', 'On Hold', 'Closed', 'Filled', 'Cancelled']
const blank = { name: '', company_name: '', status: 'Open', city: '', state: '', country: '', work_mode: '', employment_type: '', openings: '1', min_experience: '', max_experience: '', min_salary: '', max_salary: '', skills: '', description: '', pipeline_id: '' }

export default function JobForm({ initial, onDone }: { initial?: Job; onDone: (id?: string) => void }) {
  const [f, setF] = useState(() => initial ? { ...blank, ...Object.fromEntries(Object.entries(initial).filter(([k]) => k in blank).map(([k, v]) => [k, v == null ? '' : String(v)])), skills: (initial.skills ?? []).join(', ') } : blank)
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value })
  const pipes = useQuery({ queryKey: ['pipelines'], queryFn: () => unwrap<{ id: string; name: string; is_default: boolean }[]>(supabase.from('pipelines').select('id,name,is_default').order('name')) })
  const save = useRpc<{ p_id: string | null; p: object }>('save_job', { ok: initial ? 'Job saved' : 'Job created', onDone: (id) => onDone(id) })

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate({ p_id: initial?.id ?? null, p: { ...f, pipeline_id: f.pipeline_id || pipes.data?.find((p) => p.is_default)?.id || '', skills: f.skills.split(',').map((s) => s.trim()).filter(Boolean) } }) }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Job title</Label><Input autoFocus required value={f.name} onChange={set('name')} /></div>
        <div><Label>Client / company</Label><Input value={f.company_name} onChange={set('company_name')} /></div>
        <div><Label>Status</Label><Select value={f.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></div>
        <div><Label>City</Label><Input value={f.city} onChange={set('city')} /></div>
        <div className="grid grid-cols-2 gap-3"><div><Label>State</Label><Input value={f.state} onChange={set('state')} /></div><div><Label>Country</Label><Input value={f.country} onChange={set('country')} /></div></div>
        <div><Label>Work mode</Label><Select value={f.work_mode} onChange={set('work_mode')}><option value="">—</option><option>Onsite</option><option>Remote</option><option>Hybrid</option></Select></div>
        <div><Label>Employment type</Label><Select value={f.employment_type} onChange={set('employment_type')}><option value="">—</option><option>Full-time</option><option>Contract</option><option>Contract to hire</option><option>Part-time</option></Select></div>
        <div><Label>Openings</Label><Input type="number" min={1} value={f.openings} onChange={set('openings')} /></div>
        {!initial && <div><Label>Hiring pipeline</Label><Select value={f.pipeline_id} onChange={set('pipeline_id')}><option value="">Default</option>{pipes.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>}
        <div><Label>Min / max experience</Label><div className="flex gap-2"><Input type="number" value={f.min_experience} onChange={set('min_experience')} /><Input type="number" value={f.max_experience} onChange={set('max_experience')} /></div></div>
        <div><Label>Min / max salary</Label><div className="flex gap-2"><Input type="number" value={f.min_salary} onChange={set('min_salary')} /><Input type="number" value={f.max_salary} onChange={set('max_salary')} /></div></div>
        <div className="col-span-2"><Label hint="comma separated">Skills</Label><Input value={f.skills} onChange={set('skills')} /></div>
        <div className="col-span-2"><Label>Description</Label><RichEditor value={f.description} onChange={(html) => setF((x) => ({ ...x, description: html }))} placeholder="Responsibilities, requirements, benefits…" /></div>
      </div>
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => onDone()}>Cancel</Button><Button type="submit" loading={save.isPending}>{initial ? 'Save changes' : 'Create job'}</Button></div>
    </form>
  )
}
