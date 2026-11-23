import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileUp, Layers, PhoneCall, Trash2, Upload, Users } from 'lucide-react'
import { supabase, unwrap } from '../lib/supabase'
import { useCallers, useRpc } from '../lib/api'
import { downloadTemplate, mapTable, parseDelimited } from '../lib/calling'
import { cx } from '../lib/util'
import { Avatar, Badge, Button, Card, Empty, Input, Label, Modal, Select, Spinner, Textarea, useToast } from './ui'
import { DeleteLot } from '../pages/Calling'

interface Summary { total: number; in_scope: number; unassigned: number; uncalled: number; callers: { id: string; name: string; assigned: number; not_called: number }[] }
interface Lot { id: string; tag: string; source: string | null; created_by_name: string | null; created_at: string; outreach: { count: number }[] }

const Tile = ({ n, label, tone = 'text-slate-900' }: { n: number; label: string; tone?: string }) => <Card className="px-4 py-3.5"><div className={cx('text-2xl font-semibold tabular-nums', tone)}>{n}</div><div className="text-xs text-slate-500">{label}</div></Card>

/** Admin tools for one job: lots, upload candidates, and splitting the calling list between callers. */
export default function JobCalling({ jobId }: { jobId: string }) {
  const qc = useQueryClient(); const toast = useToast()
  const [lot, setLot] = useState(''); const [pick, setPick] = useState<string[]>([]); const [scope, setScope] = useState<'unassigned' | 'uncalled'>('unassigned')
  const [upload, setUpload] = useState(false); const [delLot, setDelLot] = useState<Lot | null>(null)
  const callers = useCallers()
  const lots = useQuery({ queryKey: ['job-lots', jobId], queryFn: () => unwrap<Lot[]>(supabase.from('candidate_batches').select('*, outreach(count)').eq('job_id', jobId).order('created_at', { ascending: false })) })
  const sum = useQuery({ queryKey: ['job-calling', jobId, lot], queryFn: () => unwrap<Summary>(supabase.rpc('job_calling_summary', { p_job_id: jobId, p_batch_id: lot || null })) })
  const done = () => { for (const k of ['job-calling', 'job-lots', 'call-list', 'board', 'job-stats', 'cands']) void qc.invalidateQueries({ queryKey: [k] }) }
  const assign = useRpc<{ p_job_id: string; p_caller_ids: string[]; p_scope: string; p_batch_id: string | null }>('assign_job_calling', {
    invalidate: [['job-calling'], ['call-list']],
    onDone: (r: { assigned: number; unassigned?: number }) => { toast(r.unassigned ? `Took ${r.unassigned} candidates off the calling lists` : r.assigned ? `Assigned ${r.assigned} candidates` : 'Nothing to assign in that scope'); setPick([]) },
  })
  const s = sum.data
  const lotName = lots.data?.find((l) => l.id === lot)?.tag
  const toggle = (id: string) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Upload candidate lists and decide who calls whom. Callers only see the candidates assigned to them.</p>
        <Button onClick={() => setUpload(true)}><Upload className="h-4 w-4" />Upload candidates</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile n={s?.total ?? 0} label="Candidates on this job" /><Tile n={s?.in_scope ?? 0} label={lot ? `In lot “${lotName}”` : 'On calling lists'} tone="text-brand-600" />
        <Tile n={s?.unassigned ?? 0} label="Not assigned to a caller" tone={s?.unassigned ? 'text-amber-600' : 'text-slate-900'} /><Tile n={s?.uncalled ?? 0} label="Not called yet" />
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">Lots</h3>{lots.isLoading && <Spinner />}</div>
        {!lots.data?.length ? <Empty icon={<Layers />} title="No lots yet" hint="Upload a spreadsheet of candidates to create the first lot." /> : (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setLot('')} className={cx('rounded-xl border px-3.5 py-2 text-left transition', !lot ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300')}><div className="text-sm font-semibold text-slate-900">All lots</div><div className="text-xs text-slate-500">{lots.data.reduce((a, l) => a + (l.outreach?.[0]?.count ?? 0), 0)} candidates</div></button>
            {lots.data.map((l) => (
              <div key={l.id} className={cx('group relative rounded-xl border px-3.5 py-2 transition', lot === l.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300')}>
                <button onClick={() => setLot(l.id)} className="text-left"><div className="text-sm font-semibold text-slate-900">{l.tag}</div><div className="text-xs text-slate-500">{l.outreach?.[0]?.count ?? 0} candidates{l.source ? ` · ${l.source}` : ''}</div></button>
                <button onClick={() => setDelLot(l)} title="Delete lot / clear calling list" className="absolute right-1.5 top-1.5 rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>))}
          </div>)}
      </Card>

      <Card className="p-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Assign calling {lot ? <span className="font-normal text-slate-500">— lot “{lotName}”</span> : <span className="font-normal text-slate-500">— whole job</span>}</h3>
        <p className="mb-4 text-xs text-slate-500">Pick the people who should call. The candidates are split evenly between them.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(s?.callers ?? []).map((c) => { const on = pick.includes(c.id); return (
            <button key={c.id} onClick={() => toggle(c.id)} className={cx('flex items-center gap-3 rounded-xl border p-3 text-left transition', on ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/15' : 'border-slate-200 hover:border-slate-300')}>
              <Avatar name={c.name} size={9} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-900">{c.name}</div><div className="text-xs text-slate-500">{c.assigned} assigned · {c.not_called} to call</div></div>
              <span className={cx('flex h-5 w-5 items-center justify-center rounded-md border-2 text-xs text-white', on ? 'border-brand-600 bg-brand-600' : 'border-slate-300')}>{on && '✓'}</span></button>) })}
          {!callers.isLoading && !s?.callers.length && <div className="text-sm text-slate-400">No active managers or recruiters to assign to.</div>}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-72"><Label>Which candidates</Label><Select value={scope} onChange={(e) => setScope(e.target.value as 'unassigned')}>
            <option value="unassigned">Only ones nobody has yet ({s?.unassigned ?? 0})</option><option value="uncalled">All not called yet — re-balance ({s?.uncalled ?? 0})</option></Select></div>
          <Button loading={assign.isPending} disabled={!pick.length} onClick={() => assign.mutate({ p_job_id: jobId, p_caller_ids: pick, p_scope: scope, p_batch_id: lot || null })}><Users className="h-4 w-4" />Assign{pick.length ? ` to ${pick.length}` : ''}</Button>
          <Button variant="ghost" disabled={assign.isPending || !s?.uncalled} onClick={() => { if (confirm('Take every not-yet-called candidate off the callers’ lists?')) assign.mutate({ p_job_id: jobId, p_caller_ids: [], p_scope: 'uncalled', p_batch_id: lot || null }) }}><PhoneCall className="h-4 w-4" />Take back not-yet-called</Button>
        </div>
      </Card>

      {upload && <UploadModal jobId={jobId} lots={lots.data ?? []} onClose={() => setUpload(false)} onDone={() => { setUpload(false); done() }} />}
      {delLot && <DeleteLot lot={{ id: delLot.id, tag: delLot.tag, n: delLot.outreach?.[0]?.count ?? 0 }} onClose={() => setDelLot(null)} onDone={() => { setDelLot(null); setLot(''); done() }} />}
    </div>
  )
}

function UploadModal({ jobId, lots, onClose, onDone }: { jobId: string; lots: Lot[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast(); const file = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(''); const [name, setName] = useState(''); const [existing, setExisting] = useState(''); const [tag, setTag] = useState(''); const [source, setSource] = useState('')
  const mapped = useMemo(() => mapTable(parseDelimited(text)), [text])
  const m = useMutation({
    mutationFn: async () => {
      const batch = existing || (await unwrap<string>(supabase.rpc('create_candidate_batch', { p_job_id: jobId, p_tag: tag, p_source: source || null })))
      const total = { added: 0, already_on_job: 0, new_people: 0, skipped: 0 } as Record<string, number>
      for (let i = 0; i < mapped.valid.length; i += 500) {
        const r = await unwrap<Record<string, number>>(supabase.rpc('add_candidates_to_batch', { p_batch_id: batch, p_rows: mapped.valid.slice(i, i + 500) }))
        for (const k of Object.keys(total)) total[k] += r[k] ?? 0
      }
      return total
    },
    onSuccess: (t) => { toast(`Added ${t.added} candidates (${t.new_people} new people${t.already_on_job ? `, ${t.already_on_job} were already on the job` : ''})`); onDone() },
    onError: (e: Error) => toast(e.message, 'err'),
  })
  const ready = mapped.valid.length > 0 && (existing || tag.trim())
  return (
    <Modal open onClose={onClose} title="Upload candidates" wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={file} type="file" accept=".csv,.tsv,.txt" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setText(await f.text()); setName(f.name) } e.target.value = '' }} />
          <Button variant="secondary" onClick={() => file.current?.click()}><FileUp className="h-4 w-4" />Choose a CSV file</Button>
          <Button variant="ghost" onClick={downloadTemplate}><Download className="h-4 w-4" />Download the template</Button>{name && <Badge tone="brand">{name}</Badge>}
        </div>
        <div><Label hint="or paste rows copied from a spreadsheet, first row = headings">Candidates</Label><Textarea rows={6} value={text} onChange={(e) => { setText(e.target.value); setName('') }} placeholder={'name, current title, company, location, phone, work email…'} className="font-mono text-xs" /></div>
        {!!text.trim() && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex flex-wrap gap-2"><Badge tone="green" dot>{mapped.valid.length} ready to add</Badge>{mapped.dupes > 0 && <Badge tone="amber">{mapped.dupes} duplicates inside the file</Badge>}{mapped.invalid.length > 0 && <Badge tone="red">{mapped.invalid.length} skipped</Badge>}</div>
            {!!mapped.recognised.length && <div className="mt-2 text-xs text-slate-500">Columns used: {mapped.recognised.join(', ')}{mapped.ignored.length ? ` · ignored: ${mapped.ignored.join(', ')}` : ''}</div>}
            {mapped.invalid.slice(0, 4).map((x) => <div key={x.line} className="mt-1 text-xs text-red-600">Row {x.line}{x.name ? ` (${x.name})` : ''}: {x.reason}</div>)}
          </div>)}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Add to an existing lot</Label><Select value={existing} onChange={(e) => setExisting(e.target.value)}><option value="">— or create a new lot below —</option>{lots.map((l) => <option key={l.id} value={l.id}>{l.tag}</option>)}</Select></div>
          <div><Label>New lot tag</Label><Input disabled={!!existing} value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. LinkedIn Recruiter – Nov batch 1" /></div>
          {!existing && <div className="sm:col-span-2"><Label hint="optional">Source</Label><Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Where these candidates came from" /></div>}
        </div>
        <p className="text-xs text-slate-500">People already in the CRM (matched by email, LinkedIn or phone) are reused, and any blank details are filled in. Nobody is duplicated.</p>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} disabled={!ready} onClick={() => m.mutate()}>Add {mapped.valid.length || ''} to lot</Button></div>
      </div>
    </Modal>
  )
}
