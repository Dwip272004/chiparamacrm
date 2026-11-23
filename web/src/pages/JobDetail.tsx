import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Briefcase, MapPin, Pencil, Plus, Users, Wallet } from 'lucide-react'
import { useBoard, useJob, useStages } from '../lib/api'
import { useAuth } from '../lib/auth'
import { cx, isOpenStatus, money, place } from '../lib/util'
import { Avatar, Badge, Button, Card, Modal, Spinner, SyncBadge } from '../components/ui'
import Pipeline from '../components/Pipeline'
import { useShell } from '../components/Shell'
import { AddCandidatesModal } from '../components/AssignModal'
import { NotesTab, TasksTab } from '../components/CandidateDrawer'
import JobForm from '../components/JobForm'
import { RichText } from '../components/Rich'
import JobCalling from '../components/JobCalling'
import ReviewJob from '../components/ReviewJob'
import { PriorityPicker } from '../components/Priority'

const STAGE_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']

export default function JobDetail() {
  const { id } = useParams(); const shell = useShell(); const { canWrite, isAdmin } = useAuth()
  const job = useJob(id); const stages = useStages(job.data?.pipeline_id); const board = useBoard(id)
  const [add, setAdd] = useState(false); const [edit, setEdit] = useState(false)
  const [tab, setTab] = useState<'pipeline' | 'details' | 'calling' | 'notes' | 'tasks'>('pipeline')
  const dist = useMemo(() => (stages.data ?? []).map((s, i) => ({ name: s.name, n: (board.data ?? []).filter((r) => r.stage_id === s.id).length, color: STAGE_COLORS[i % STAGE_COLORS.length] })), [stages.data, board.data])

  if (job.isLoading) return <Spinner />
  const j = job.data; if (!j) return <div className="p-10 text-center text-slate-500">Job not found.</div>
  const total = board.data?.length ?? 0
  const open = isOpenStatus(j.status)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200/80 bg-white px-8 pt-5">
        <Link to="/jobs" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3 w-3" />All jobs</Link>
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar name={j.company_name || j.name} size={12} className="!rounded-2xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5"><h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900">{j.name}</h1><Badge tone={open ? 'green' : 'slate'} dot>{j.status}</Badge><PriorityPicker jobId={j.id} priority={j.priority} canEdit={canWrite} /><SyncBadge status={j.sync_status} /></div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                {j.company_name && <span className="inline-flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-slate-400" />{j.company_name}</span>}
                {place(j) && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400" />{place(j)}</span>}
                {j.work_mode && <span>{j.work_mode}</span>}{j.employment_type && <span>{j.employment_type}</span>}
                {j.openings != null && <span>{j.openings} opening{j.openings === 1 ? '' : 's'}</span>}
                {!!(j.min_salary || j.max_salary) && <span className="inline-flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-slate-400" />{money(j.min_salary)} – {money(j.max_salary)}</span>}
              </div>
            </div>
          </div>
          {canWrite && <div className="flex shrink-0 gap-2">{isAdmin && /pending/i.test(j.status ?? '') ? <Button onClick={() => setEdit(true)}>Review &amp; publish</Button> : <Button variant="secondary" onClick={() => setEdit(true)}><Pencil className="h-3.5 w-3.5" />Edit</Button>}<Button onClick={() => setAdd(true)}><Plus className="h-4 w-4" />Add candidates</Button></div>}
        </div>

        {total > 0 && (
          <div className="mt-5 flex items-center gap-4">
            <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-slate-700"><Users className="h-4 w-4 text-slate-400" />{total} in pipeline</span>
            <div className="flex h-2 max-w-xl flex-1 overflow-hidden rounded-full bg-slate-100">
              {dist.map((d) => d.n > 0 && <div key={d.name} title={`${d.name}: ${d.n}`} style={{ width: `${(d.n / total) * 100}%`, background: d.color }} />)}
            </div>
            <div className="hidden flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 xl:flex">{dist.filter((d) => d.n > 0).map((d) => <span key={d.name} className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: d.color }} />{d.name} {d.n}</span>)}</div>
          </div>
        )}

        <div className="mt-4 flex gap-1">
          {(['pipeline', 'details', ...(isAdmin ? ['calling' as const] : []), 'notes', 'tasks'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cx('border-b-2 px-3.5 py-2.5 text-sm font-medium capitalize transition', tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>{t}{t === 'pipeline' && total > 0 && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-600">{total}</span>}</button>))}
        </div>
      </div>

      {tab === 'pipeline' && <Pipeline jobId={j.id} stages={stages.data ?? []} rows={board.data ?? []} loading={board.isLoading || stages.isLoading} canWrite={canWrite} onOpen={shell.openCandidate} />}
      {tab !== 'pipeline' && (
        <div className="min-h-0 flex-1 overflow-auto scroll-thin p-8">
          <div className="mx-auto max-w-4xl">
            {tab === 'details' && (
              <>
              {j.raw_jd && <Card className="mb-4 p-6"><div className="mb-2 flex items-center justify-between"><div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Submitted JD{j.submitted_by_name ? ` · ${j.submitted_by_name}` : ''}</div></div>{j.intake_note && <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{j.intake_note}</div>}<div className="max-h-72 overflow-auto whitespace-pre-wrap text-sm text-slate-700">{j.raw_jd}</div></Card>}
              <Card className="p-6">
                {!!j.skills.length && <div className="mb-5"><div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Required skills</div><div className="flex flex-wrap gap-1.5">{j.skills.map((s) => <Badge key={s} tone="brand">{s}</Badge>)}</div></div>}
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Description</div>
                <RichText html={j.description} empty="No description." />
              </Card></>
            )}
            {tab === 'calling' && isAdmin && <JobCalling jobId={j.id} />}
            {tab === 'notes' && <NotesTab jobId={j.id} />}
            {tab === 'tasks' && <TasksTab jobId={j.id} />}
          </div>
        </div>
      )}
      {add && <AddCandidatesModal jobId={j.id} onClose={() => setAdd(false)} />}
      <Modal open={edit} onClose={() => setEdit(false)} title={/pending/i.test(j.status ?? '') ? 'Review job' : 'Edit job'} wide={j.origin === 'calling' ? 'xl' : true}>{j.origin === 'calling' && isAdmin ? <ReviewJob job={j} onDone={() => setEdit(false)} /> : <JobForm initial={j} onDone={() => setEdit(false)} />}</Modal>
    </div>
  )
}
