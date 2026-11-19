import { useEffect, useState } from 'react'
import { Check, Copy, Download, ExternalLink, FileText, Mail, MapPin, MessageSquare, Pencil, Phone, Plus, Sparkles, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useCandidate, useCandidateAssignments, useCandidateEnrichment, useNotes, useRpc, useStages, useTasks } from '../lib/api'
import { ago, fmtDate, money, place, cx } from '../lib/util'
import { Avatar, Badge, Button, Drawer, Modal, Select, Spinner, SyncBadge, Textarea, useToast } from './ui'
import CandidateForm from './CandidateForm'
import { PickJobModal } from './AssignModal'
import { useShell } from './Shell'
import { RichText } from './Rich'
import { EnrichBadge, RequestForm } from './Enrichment'

function Copy_({ text, icon: Icon, label }: { text: string; icon: typeof Mail; label?: string }) {
  const toast = useToast()
  return (
    <button onClick={() => { void navigator.clipboard.writeText(text); toast(`Copied ${text}`) }} title="Click to copy"
      className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"><Icon className="h-3.5 w-3.5 text-slate-400" />{label ?? text}<Copy className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100" /></button>
  )
}

export default function CandidateDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [tab, setTab] = useState<'overview' | 'resume' | 'pipeline' | 'notes' | 'tasks'>('overview')
  const [edit, setEdit] = useState(false); const [pick, setPick] = useState(false)
  useEffect(() => { setTab('overview'); setEdit(false) }, [id])
  const { canWrite } = useAuth()
  const c = useCandidate(id ?? undefined)
  const assigns = useCandidateAssignments(id ?? undefined)
  const enr = useCandidateEnrichment(id ?? undefined)
  const [reqOpen, setReqOpen] = useState(false)
  const navigate = useNavigate()
  const missing = !!c.data && (!c.data.email || !c.data.phone)
  const openReq = enr.data && (enr.data.status === 'pending' || enr.data.status === 'approved')

  return (
    <Drawer open={!!id} onClose={onClose}>
      {!c.data ? <Spinner /> : (
        <>
          <div className="border-b border-slate-200 px-6 pb-0 pt-5">
            <div className="flex items-start gap-3">
              <Avatar name={c.data.full_name} size={11} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><h2 className="truncate text-lg font-semibold text-slate-900">{c.data.full_name || 'Unnamed'}</h2><SyncBadge status={c.data.sync_status} />{c.data.off_limit && <Badge tone="red">Off limit</Badge>}</div>
                <div className="truncate text-sm text-slate-600">{[c.data.current_position, c.data.current_organization].filter(Boolean).join(' at ') || '—'}</div>
                <div className="mt-1 flex flex-wrap items-center gap-0.5 -ml-2">
                  {c.data.email && <Copy_ text={c.data.email} icon={Mail} />}
                  {c.data.phone && <Copy_ text={c.data.phone} icon={Phone} />}
                  {place(c.data) && <span className="inline-flex items-center gap-1.5 px-2 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5 text-slate-400" />{place(c.data)}</span>}
                  {c.data.linkedin_url && <a href={c.data.linkedin_url.startsWith('http') ? c.data.linkedin_url : `https://${c.data.linkedin_url}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-brand-600 hover:bg-brand-50"><ExternalLink className="h-3 w-3" />LinkedIn</a>}
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => { onClose(); navigate(`/chat?ref=${c.data!.id}`) }}><MessageSquare className="h-3.5 w-3.5" />Discuss</Button>
                {canWrite && <Button size="sm" variant="secondary" onClick={() => setPick(true)}><Plus className="h-3.5 w-3.5" />Add to job</Button>}
                {canWrite && <Button size="sm" variant="secondary" onClick={() => { setEdit(true); setTab('overview') }}><Pencil className="h-3.5 w-3.5" />Edit</Button>}
                <button onClick={onClose} className="rounded p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mt-4 flex gap-1">
              {(['overview', 'resume', 'pipeline', 'notes', 'tasks'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={cx('border-b-2 px-3 py-2 text-sm font-medium capitalize', tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>
                  {t}{t === 'resume' && !!c.data.raw?.resume?.file_link && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand-600 align-middle" />}{t === 'pipeline' && !!assigns.data?.length && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-600">{assigns.data.length}</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto scroll-thin bg-slate-50 p-6">
            {(missing || enr.data) && (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <Sparkles className="h-4 w-4 shrink-0 text-brand-600" />
                <div className="min-w-0 flex-1 text-sm text-slate-700">
                  {enr.data && (openReq || !missing || enr.data.status === 'not_found' || enr.data.status === 'rejected') ? (
                    <span className="flex flex-wrap items-center gap-2">Enrichment <EnrichBadge status={enr.data.status} />{enr.data.status === 'rejected' && enr.data.decision_note && <span className="text-xs text-slate-500">“{enr.data.decision_note}”</span>}<Link to="/enrichment" onClick={onClose} className="text-xs text-brand-600 hover:underline">View request</Link></span>
                  ) : <span>Missing {[!c.data.email && 'email', !c.data.phone && 'phone'].filter(Boolean).join(' and ')}. Ask an admin to find it.</span>}
                </div>
                {canWrite && missing && !openReq && <Button size="sm" onClick={() => setReqOpen(true)}>Request enrichment</Button>}
              </div>
            )}
            {tab === 'overview' && (edit ? <div className="rounded-xl border border-slate-200 bg-white p-5"><CandidateForm initial={c.data} onDone={() => setEdit(false)} /></div> : (
              <div className="space-y-4">
                <Card title="Resume">
                  {c.data.raw?.resume?.file_link ? (
                    <div className="flex items-center gap-3"><FileText className="h-5 w-5 text-brand-600" /><div className="min-w-0 flex-1 truncate text-sm text-slate-800">{c.data.raw.resume.filename}</div><Button size="sm" variant="secondary" onClick={() => setTab('resume')}>Preview</Button></div>
                  ) : <div className="text-sm text-slate-500">No resume on file.</div>}
                </Card>
                {!!c.data.skills.length && <Card title="Skills"><div className="flex flex-wrap gap-1.5">{c.data.skills.map((s) => <Badge key={s} tone="brand">{s}</Badge>)}</div></Card>}
                <Card title="Details">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <D k="Experience" v={c.data.experience_years != null ? `${c.data.experience_years} yrs` : null} /><D k="Notice period" v={c.data.notice_period} />
                    <D k="Current salary" v={c.data.current_salary ? money(c.data.current_salary) : null} /><D k="Expected salary" v={c.data.expected_salary ? money(c.data.expected_salary) : null} />
                    <D k="Source" v={c.data.source} /><D k="Last updated" v={ago(c.data.rc_updated_at)} />
                  </dl>
                </Card>
              </div>
            ))}
            {tab === 'resume' && <ResumeTab resume={c.data.raw?.resume} />}
            {tab === 'pipeline' && <PipelineTab candidateId={c.data.id} />}
            {tab === 'notes' && <NotesTab candidateId={c.data.id} />}
            {tab === 'tasks' && <TasksTab candidateId={c.data.id} />}
          </div>
          <Modal open={reqOpen} onClose={() => setReqOpen(false)} title="Request enrichment"><RequestForm candidateId={c.data.id} name={c.data.full_name} hasEmail={!!c.data.email} hasPhone={!!c.data.phone} onDone={() => setReqOpen(false)} /></Modal>
          {pick && <PickJobModal candidateIds={[c.data.id]} onClose={() => setPick(false)} />}
        </>
      )}
    </Drawer>
  )
}

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>{children}</div>
)
const D = ({ k, v }: { k: string; v?: string | null }) => <div><dt className="text-xs text-slate-500">{k}</dt><dd className="text-slate-800">{v || '—'}</dd></div>

function StageSelect({ a }: { a: { id: string; stage_id: string | null; jobs: { pipeline_id: string | null } } }) {
  const { canWrite } = useAuth()
  const stages = useStages(a.jobs.pipeline_id)
  const move = useRpc<{ p_job_candidate: string; p_stage: string }>('move_stage', { ok: 'Stage updated' })
  return (
    <Select disabled={!canWrite || move.isPending} value={a.stage_id ?? ''} onChange={(e) => move.mutate({ p_job_candidate: a.id, p_stage: e.target.value })} className="!w-52 !py-1.5 text-xs">
      {!a.stage_id && <option value="">—</option>}{stages.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </Select>
  )
}

function PipelineTab({ candidateId }: { candidateId: string }) {
  const { canWrite } = useAuth()
  const as = useCandidateAssignments(candidateId)
  const un = useRpc<{ p_job_candidate: string }>('unassign_candidate', { ok: 'Removed from job' })
  if (as.isLoading) return <Spinner />
  if (!as.data?.length) return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Not in any job pipeline yet. Use <b>Add to job</b> above.</div>
  return (
    <div className="space-y-2.5">
      {as.data.map((a) => (
        <div key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="min-w-0 flex-1">
            <Link to={`/jobs/${a.jobs.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">{a.jobs.name}</Link>
            <div className="text-xs text-slate-500">{[a.jobs.company_name, a.jobs.status].filter(Boolean).join(' · ')} · moved {ago(a.stage_updated_at)}</div>
          </div>
          <SyncBadge status={a.sync_status} />
          <StageSelect a={a} />
          {canWrite && <button title="Remove from job" onClick={() => confirm('Remove this candidate from the job?') && un.mutate({ p_job_candidate: a.id })} className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>}
        </div>
      ))}
    </div>
  )
}

export function NotesTab({ candidateId, jobId }: { candidateId?: string; jobId?: string }) {
  const { canWrite } = useAuth()
  const notes = useNotes({ candidate: candidateId, job: jobId })
  const [body, setBody] = useState('')
  const add = useRpc<{ p_candidate: string | null; p_job: string | null; p_body: string }>('add_note', { invalidate: [['notes']], onDone: () => setBody('') })
  const submit = () => body.trim() && add.mutate({ p_candidate: candidateId ?? null, p_job: jobId ?? null, p_body: body })
  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note… (⌘/Ctrl + Enter to save)" className="border-0 !ring-0"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() } }} />
          <div className="flex justify-end"><Button size="sm" disabled={!body.trim()} loading={add.isPending} onClick={submit}>Save note</Button></div>
        </div>
      )}
      {notes.isLoading ? <Spinner /> : notes.data?.map((n) => (
        <div key={n.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-1.5 flex items-center gap-2 text-xs text-slate-500"><b className="font-medium text-slate-700">{n.created_by_name || 'RecruitCRM'}</b>{n.note_type && <Badge>{n.note_type}</Badge>}<SyncBadge status={n.sync_status} /><span className="ml-auto">{ago(n.created_at)}</span></div>
          <RichText html={n.description} />
        </div>
      ))}
      {notes.data?.length === 0 && <div className="py-6 text-center text-sm text-slate-400">No notes yet.</div>}
    </div>
  )
}

export function TasksTab({ candidateId, jobId }: { candidateId?: string; jobId?: string }) {
  const { canWrite } = useAuth(); const shell = useShell()
  const tasks = useTasks('all', { candidate: candidateId, job: jobId })
  const done = useRpc<{ p_id: string; p_done: boolean }>('set_task_done', { invalidate: [['tasks'], ['dashboard']] })
  return (
    <div className="space-y-2.5">
      {canWrite && <Button size="sm" variant="secondary" onClick={() => shell.newTask({ candidate_id: candidateId, job_id: jobId })}><Plus className="h-3.5 w-3.5" />Add task</Button>}
      {tasks.data?.map((t) => (
        <div key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <button disabled={!canWrite} onClick={() => done.mutate({ p_id: t.id, p_done: true })} className="flex h-5 w-5 items-center justify-center rounded border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50"><Check className="h-3 w-3 text-transparent hover:text-emerald-600" /></button>
          <div className="min-w-0 flex-1"><div className="truncate text-sm text-slate-800">{t.title}</div>{t.due_at && <div className={cx('text-xs', new Date(t.due_at) < new Date() ? 'text-red-600' : 'text-slate-500')}>Due {fmtDate(t.due_at)}</div>}</div>
        </div>
      ))}
      {tasks.data?.length === 0 && <div className="py-6 text-center text-sm text-slate-400">No open tasks.</div>}
    </div>
  )
}

function ResumeTab({ resume }: { resume?: { filename: string; file_link: string } | null }) {
  if (!resume?.file_link) return <div className="rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center text-sm text-slate-500">No resume on file for this candidate.</div>
  const ext = (resume.filename.split('.').pop() ?? '').toLowerCase()
  const kind = ext === 'pdf' ? 'pdf' : ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) ? 'img' : 'none'
  return (
    <div className="flex h-full min-h-[420px] flex-col gap-3">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <FileText className="h-5 w-5 shrink-0 text-brand-600" />
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate-800">{resume.filename}</div><div className="text-xs uppercase text-slate-400">{ext} · from RecruitCRM</div></div>
        <a href={resume.file_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><ExternalLink className="h-3.5 w-3.5" />New tab</a>
        <a href={resume.file_link} download={resume.filename} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"><Download className="h-3.5 w-3.5" />Download</a>
      </div>
      {kind === 'pdf' && <iframe key={resume.file_link} title={resume.filename} src={resume.file_link} className="min-h-[560px] w-full flex-1 rounded-xl border border-slate-200 bg-white" />}
      {kind === 'img' && <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white p-2"><img src={resume.file_link} alt={resume.filename} className="mx-auto max-w-full" /></div>}
      {kind === 'none' && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <div className="text-sm font-medium text-slate-700">Preview isn't available for .{ext} files</div>
          <div className="mt-1 text-xs text-slate-500">Browsers can only show PDFs and images inline. Use Download to open it in Word.</div>
        </div>
      )}
    </div>
  )
}
