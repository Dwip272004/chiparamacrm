import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileUp, Layers, PhoneCall, Trash2, Upload } from 'lucide-react'
import { supabase, unwrap } from '../lib/supabase'
import { useCallers, useRpc } from '../lib/api'
import { downloadTemplate, mapTable, parseDelimited } from '../lib/calling'
import { cx } from '../lib/util'
import { Avatar, Badge, Button, Card, Empty, Input, Label, Modal, Select, Spinner, Textarea, useToast } from './ui'
import { DeleteLot } from '../pages/Calling'

interface Summary { total: number; in_scope: number; unassigned: number; uncalled: number; callers: { id: string; name: string; assigned: number; not_called: number; called: number }[] }
interface Lot { id: string; tag: string; source: string | null; created_by_name: string | null; created_at: string; outreach: { count: number }[] }

const Tile = ({ n, label, tone = 'text-slate-900' }: { n: number; label: string; tone?: string }) => <Card className="px-4 py-3.5"><div className={cx('text-2xl font-semibold tabular-nums', tone)}>{n}</div><div className="text-xs text-slate-500">{label}</div></Card>

/** Admin tools for one job: lots, upload candidates, and splitting the calling list between callers. */
export default function JobCalling({ jobId }: { jobId: string }) {
  const qc = useQueryClient(); const toast = useToast()
  const [lot, setLot] = useState('')
  const [upload, setUpload] = useState(false); const [delLot, setDelLot] = useState<Lot | null>(null)
  const callers = useCallers()
  const lots = useQuery({ queryKey: ['job-lots', jobId], queryFn: () => unwrap<Lot[]>(supabase.from('candidate_batches').select('*, outreach(count)').eq('job_id', jobId).order('created_at', { ascending: false })) })
  const sum = useQuery({ queryKey: ['job-calling', jobId, lot], queryFn: () => unwrap<Summary>(supabase.rpc('job_calling_summary', { p_job_id: jobId, p_batch_id: lot || null })) })
  const done = () => { for (const k of ['job-calling', 'job-lots', 'call-list', 'board', 'job-stats', 'cands']) void qc.invalidateQueries({ queryKey: [k] }) }
  const release = useRpc<{ p_job_id: string; p_caller_ids: string[]; p_scope: string; p_batch_id: string | null }>('assign_job_calling', {
    invalidate: [['job-calling'], ['call-list']],
    onDone: (r: { assigned: number; unassigned?: number }) => toast(r.unassigned ? `Released ${r.unassigned} candidates back to the pool` : 'Nothing to release'),
  })
  const s = sum.data
  const lotName = lots.data?.find((l) => l.id === lot)?.tag

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Upload candidate lists. Every caller sees the whole list; whoever opens a candidate first claims them.</p>
        <Button onClick={() => setUpload(true)}><Upload className="h-4 w-4" />Upload candidates</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile n={s?.total ?? 0} label="Candidates on this job" /><Tile n={s?.in_scope ?? 0} label={lot ? `In lot “${lotName}”` : 'On calling lists'} tone="text-brand-600" />
        <Tile n={s?.unassigned ?? 0} label="Open to pick up" tone={s?.unassigned ? 'text-emerald-600' : 'text-slate-900'} /><Tile n={s?.uncalled ?? 0} label="Picked up, not called yet" tone={s?.uncalled ? 'text-amber-600' : 'text-slate-900'} />
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
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Who is calling {lot ? <span className="font-normal text-slate-500">— lot “{lotName}”</span> : <span className="font-normal text-slate-500">— whole job</span>}</h3>
        <p className="mb-4 text-xs text-slate-500">A candidate belongs to the first caller who opens them, and nobody else can call that person.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(s?.callers ?? []).map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><Avatar name={c.name} size={9} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-900">{c.name}</div><div className="text-xs text-slate-500">{c.assigned} picked up · {c.called} called · {c.not_called} waiting</div></div></div>))}
          {!callers.isLoading && !s?.callers.length && <div className="text-sm text-slate-400">No active managers or recruiters yet.</div>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <Button variant="secondary" loading={release.isPending} disabled={!s?.uncalled} onClick={() => { if (confirm('Release everyone who was picked up but not called yet, so any caller can take them?')) release.mutate({ p_job_id: jobId, p_caller_ids: [], p_scope: 'uncalled', p_batch_id: lot || null }) }}><PhoneCall className="h-4 w-4" />Release picked-up but not called</Button>
          <span className="text-xs text-slate-400">Use this if someone opened candidates and then went away.</span>
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
