import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Pencil, Plus } from 'lucide-react'
import { useBoard, useJob, useStages } from '../lib/api'
import { useAuth } from '../lib/auth'
import { cx, money, place } from '../lib/util'
import { Badge, Button, Modal, Spinner, SyncBadge } from '../components/ui'
import Pipeline from '../components/Pipeline'
import { useShell } from '../components/Shell'
import { AddCandidatesModal } from '../components/AssignModal'
import { NotesTab, TasksTab } from '../components/CandidateDrawer'
import JobForm from '../components/JobForm'
import { RichText } from '../components/Rich'

export default function JobDetail() {
  const { id } = useParams(); const shell = useShell(); const { canWrite } = useAuth()
  const job = useJob(id); const stages = useStages(job.data?.pipeline_id); const board = useBoard(id)
  const [add, setAdd] = useState(false); const [edit, setEdit] = useState(false)
  const [tab, setTab] = useState<'description' | 'notes' | 'tasks'>('description')

  if (job.isLoading) return <Spinner />
  const j = job.data; if (!j) return <div className="p-10 text-center text-slate-500">Job not found.</div>

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <Link to="/jobs" className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3 w-3" />All jobs</Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><h1 className="truncate text-xl font-semibold text-slate-900">{j.name}</h1><Badge tone={/open/i.test(j.status ?? '') ? 'green' : 'slate'}>{j.status}</Badge><SyncBadge status={j.sync_status} /></div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              {j.company_name && <span>{j.company_name}</span>}{place(j) && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{place(j)}</span>}
              {j.work_mode && <span>{j.work_mode}</span>}{j.employment_type && <span>{j.employment_type}</span>}
              {j.openings != null && <span>{j.openings} opening{j.openings === 1 ? '' : 's'}</span>}
              {!!(j.min_salary || j.max_salary) && <span>{money(j.min_salary)} – {money(j.max_salary)}</span>}
              <span>{board.data?.length ?? 0} in pipeline</span>
            </div>
          </div>
          {canWrite && <div className="flex gap-2"><Button variant="secondary" onClick={() => setEdit(true)}><Pencil className="h-3.5 w-3.5" />Edit</Button><Button onClick={() => setAdd(true)}><Plus className="h-4 w-4" />Add candidates</Button></div>}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <Pipeline jobId={j.id} stages={stages.data ?? []} rows={board.data ?? []} loading={board.isLoading || stages.isLoading} canWrite={canWrite} onOpen={shell.openCandidate} />

        <div className="h-64 shrink-0 border-t border-slate-200 bg-white">
          <div className="flex gap-1 border-b border-slate-200 px-6">{(['description', 'notes', 'tasks'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cx('border-b-2 px-3 py-2 text-sm font-medium capitalize', tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>{t}</button>))}</div>
          <div className="h-[calc(100%-41px)] overflow-auto scroll-thin bg-slate-50 p-5">
            {tab === 'description' && <div>{!!j.skills.length && <div className="mb-3 flex flex-wrap gap-1.5">{j.skills.map((s) => <Badge key={s} tone="brand">{s}</Badge>)}</div>}<RichText html={j.description} empty="No description." /></div>}
            {tab === 'notes' && <NotesTab jobId={j.id} />}
            {tab === 'tasks' && <TasksTab jobId={j.id} />}
          </div>
        </div>
      </div>
      {add && <AddCandidatesModal jobId={j.id} onClose={() => setAdd(false)} />}
      <Modal open={edit} onClose={() => setEdit(false)} title="Edit job" wide><JobForm initial={j} onDone={() => setEdit(false)} /></Modal>
    </div>
  )
}
