import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, MapPin, Pencil, Plus } from 'lucide-react'
import { useBoard, useJob, useRpc, useStages, type BoardRow } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ago, cx, money, place } from '../lib/util'
import { Avatar, Badge, Button, Modal, Spinner, SyncBadge, useToast } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useShell } from '../components/Shell'
import { AddCandidatesModal } from '../components/AssignModal'
import { NotesTab, TasksTab } from '../components/CandidateDrawer'
import JobForm from '../components/JobForm'
import { RichText } from '../components/Rich'

export default function JobDetail() {
  const { id } = useParams(); const shell = useShell(); const { canWrite } = useAuth(); const qc = useQueryClient(); const toast = useToast()
  const job = useJob(id); const stages = useStages(job.data?.pipeline_id); const board = useBoard(id)
  const [add, setAdd] = useState(false); const [edit, setEdit] = useState(false)
  const [tab, setTab] = useState<'description' | 'notes' | 'tasks'>('description')
  const [dragOver, setDragOver] = useState<string | null>(null)
  const move = useRpc<{ p_job_candidate: string; p_stage: string }>('move_stage', { invalidate: [['board'], ['cand-assign'], ['dashboard']] })

  const cols = useMemo(() => {
    const st = stages.data ?? []; const rows = board.data ?? []
    const by = new Map<string | null, BoardRow[]>()
    rows.forEach((r) => by.set(r.stage_id, [...(by.get(r.stage_id) ?? []), r]))
    const out = st.map((s) => ({ id: s.id as string | null, name: s.name, rows: by.get(s.id) ?? [] }))
    const orphan = by.get(null) ?? []
    return orphan.length ? [{ id: null, name: 'No stage', rows: orphan }, ...out] : out
  }, [stages.data, board.data])

  function drop(stageId: string | null, e: React.DragEvent) {
    e.preventDefault(); setDragOver(null)
    const jcId = e.dataTransfer.getData('text/jc'); if (!jcId || !stageId) return
    const row = board.data?.find((r) => r.id === jcId); if (!row || row.stage_id === stageId) return
    // optimistic: card jumps immediately, server confirms
    qc.setQueryData<BoardRow[]>(['board', id], (old) => old?.map((r) => r.id === jcId ? { ...r, stage_id: stageId, sync_status: 'pending_push' } : r))
    move.mutate({ p_job_candidate: jcId, p_stage: stageId }, { onError: () => qc.invalidateQueries({ queryKey: ['board', id] }), onSuccess: () => toast(`Moved to ${stages.data?.find((s) => s.id === stageId)?.name}`) })
  }

  if (job.isLoading) return <Spinner />
  const j = job.data; if (!j) return <div className="p-10 text-center text-slate-500">Job not found.</div>
  void supabase

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
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden scroll-thin p-4">
          {board.isLoading || stages.isLoading ? <Spinner /> : cols.map((col) => (
            <div key={col.id ?? 'none'} onDragOver={(e) => { if (canWrite && col.id) { e.preventDefault(); setDragOver(col.id) } }} onDragLeave={() => setDragOver(null)} onDrop={(e) => drop(col.id, e)}
              className={cx('flex w-64 shrink-0 flex-col rounded-xl border bg-slate-100/70', dragOver === col.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200')}>
              <div className="flex items-center justify-between px-3 py-2.5"><span className="truncate text-xs font-semibold uppercase tracking-wide text-slate-600">{col.name}</span><span className="rounded-full bg-white px-2 text-xs font-medium text-slate-600">{col.rows.length}</span></div>
              <div className="flex-1 space-y-2 overflow-y-auto scroll-thin px-2 pb-2">
                {col.rows.map((r) => (
                  <div key={r.id} draggable={canWrite} onDragStart={(e) => e.dataTransfer.setData('text/jc', r.id)} onClick={() => shell.openCandidate(r.candidate_id)}
                    className="cursor-pointer rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm hover:border-brand-500/50 hover:shadow">
                    <div className="flex items-center gap-2"><Avatar name={r.candidates.full_name} size={7} /><div className="min-w-0"><div className="truncate text-sm font-medium text-slate-900">{r.candidates.full_name}</div><div className="truncate text-xs text-slate-500">{r.candidates.current_position || r.candidates.current_organization || '—'}</div></div></div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400"><span>{ago(r.stage_updated_at)}</span><SyncBadge status={r.sync_status} /></div>
                  </div>
                ))}
                {!col.rows.length && <div className="py-4 text-center text-xs text-slate-400">{canWrite ? 'Drop here' : '—'}</div>}
              </div>
            </div>
          ))}
        </div>

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
