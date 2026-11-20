import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, LayoutGrid, List, Search, X } from 'lucide-react'
import { useRpc, type BoardRow } from '../lib/api'
import { ago, cx } from '../lib/util'
import type { Stage } from '../lib/types'
import { Avatar, Badge, Input, Spinner, SyncBadge, Verified, useToast } from './ui'

const STAGE_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']
interface Props { jobId: string; stages: Stage[]; rows: BoardRow[]; loading: boolean; canWrite: boolean; onOpen: (candidateId: string) => void }

export default function Pipeline({ jobId, stages, rows, loading, canWrite, onOpen }: Props) {
  const qc = useQueryClient(); const toast = useToast()
  const [view, setView] = useState<'list' | 'board'>('list')
  const [stage, setStage] = useState<string>('all')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState<string | null>(null)
  const move = useRpc<{ p_job_candidate: string; p_stage: string }>('move_stage', { invalidate: [['board'], ['cand-assign'], ['dashboard'], ['job-stats']] })
  const order = useMemo(() => new Map(stages.map((s, i) => [s.id, i])), [stages])
  const name = (id: string | null) => stages.find((s) => s.id === id)?.name ?? 'No stage'

  const counts = useMemo(() => { const m = new Map<string | null, number>(); rows.forEach((r) => m.set(r.stage_id, (m.get(r.stage_id) ?? 0) + 1)); return m }, [rows])
  const t = q.trim().toLowerCase()
  const match = (r: BoardRow) => !t || [r.candidates.full_name, r.candidates.current_position, r.candidates.current_organization, r.candidates.email].some((x) => x?.toLowerCase().includes(t))
  const visible = useMemo(() => rows.filter((r) => match(r) && (stage === 'all' || r.stage_id === stage))
    .sort((a, b) => (order.get(a.stage_id ?? '') ?? -1) - (order.get(b.stage_id ?? '') ?? -1) || +new Date(b.stage_updated_at ?? 0) - +new Date(a.stage_updated_at ?? 0)), [rows, stage, t, order]) // eslint-disable-line react-hooks/exhaustive-deps

  function moveTo(ids: string[], stageId: string) {
    const todo = rows.filter((r) => ids.includes(r.id) && r.stage_id !== stageId)
    if (!todo.length) return
    qc.setQueryData<BoardRow[]>(['board', jobId], (old) => old?.map((r) => (ids.includes(r.id) ? { ...r, stage_id: stageId, stage_name: name(stageId), sync_status: 'pending_push' } : r)))
    Promise.all(todo.map((r) => move.mutateAsync({ p_job_candidate: r.id, p_stage: stageId })))
      .then(() => toast(`${todo.length > 1 ? todo.length + ' candidates' : todo[0].candidates.full_name} → ${name(stageId)}`))
      .catch(() => qc.invalidateQueries({ queryKey: ['board', jobId] }))
    setSel(new Set())
  }
  const nextOf = (id: string | null) => { const i = order.get(id ?? ''); return i == null ? stages[0] : stages[i + 1] }
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const StageSelect = ({ r }: { r: BoardRow }) => (
    <select value={r.stage_id ?? ''} disabled={!canWrite} onClick={(e) => e.stopPropagation()} onChange={(e) => moveTo([r.id], e.target.value)}
      className="h-8 max-w-[10rem] rounded-lg border border-slate-200 bg-white py-0 pl-2.5 pr-7 text-xs font-medium text-slate-700 shadow-card hover:border-slate-300 focus:border-brand-500 focus:outline-none">
      {!r.stage_id && <option value="">No stage</option>}
      {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  )
  const NextBtn = ({ r }: { r: BoardRow }) => {
    const n = nextOf(r.stage_id); if (!canWrite || !n) return null
    return <button onClick={(e) => { e.stopPropagation(); moveTo([r.id], n.id) }} title={`Move to ${n.name}`} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"><ArrowRight className="h-3 w-3" /><span className="max-w-[6rem] truncate">{n.name}</span></button>
  }

  if (loading) return <Spinner />
  const chips: { id: string; label: string; n: number }[] = [{ id: 'all', label: 'All', n: rows.length }, ...(counts.get(null) ? [{ id: '', label: 'No stage', n: counts.get(null)! }] : []), ...stages.map((s) => ({ id: s.id, label: s.name, n: counts.get(s.id) ?? 0 }))]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b border-slate-200/80 bg-white px-8 py-3">
        <div className="flex items-center gap-2">
          <div className="relative w-64"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" /><Input className="h-9 pl-8" placeholder="Find in this pipeline…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="ml-auto flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
            {([['list', List, 'List'], ['board', LayoutGrid, 'Board']] as const).map(([k, Icon, l]) => (
              <button key={k} onClick={() => setView(k)} className={cx('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition', view === k ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500')}><Icon className="h-3.5 w-3.5" />{l}</button>))}
          </div>
        </div>
        {view === 'list' && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <button key={c.id || 'none'} onClick={() => setStage(c.id)} className={cx('inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition',
                stage === c.id ? 'border-brand-600 bg-brand-600 text-white' : c.n ? 'border-slate-300 bg-white text-slate-700 hover:border-brand-400' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300')}>
                {c.label}<span className={cx('rounded-full px-1.5 text-[10px]', stage === c.id ? 'bg-white/25' : 'bg-slate-100 text-slate-600')}>{c.n}</span>
              </button>))}
          </div>
        )}
        {canWrite && sel.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-sm text-brand-800">
            <b>{sel.size}</b> selected · move to
            <select defaultValue="" onChange={(e) => e.target.value && moveTo([...sel], e.target.value)} className="rounded-md border border-brand-200 bg-white py-1 pl-2 pr-6 text-xs">
              <option value="" disabled>Choose stage…</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={() => setSel(new Set())} className="ml-auto text-brand-700"><X className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      {view === 'list' ? (
        <div className="min-h-0 flex-1 overflow-auto scroll-thin bg-slate-50 p-8">
          {visible.length === 0 ? <div className="py-12 text-center text-sm text-slate-500">{t ? 'No one matches your search.' : 'No candidates in this stage.'}</div> : (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
              {visible.map((r) => (
                <div key={r.id} onClick={() => onOpen(r.candidate_id)} className={cx('group flex cursor-pointer items-center gap-4 px-5 py-3 transition hover:bg-brand-50/40', sel.has(r.id) && 'bg-brand-50/60')}>
                  {canWrite && <input type="checkbox" checked={sel.has(r.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r.id)} className="h-4 w-4 rounded accent-[#4f46e5]" />}
                  <Avatar name={r.candidates.full_name} size={8} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5"><span className="truncate text-sm font-medium text-slate-900">{r.candidates.full_name}</span><Verified email={r.candidates.email} phone={r.candidates.phone} /><SyncBadge status={r.sync_status} /></div>
                    <div className="truncate text-xs text-slate-500">{[r.candidates.current_position, r.candidates.current_organization].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  
                  <span className="hidden w-20 text-right text-[11px] text-slate-400 sm:block">{ago(r.stage_updated_at)}</span>
                  <NextBtn r={r} />
                  <StageSelect r={r} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden scroll-thin bg-slate-50 p-6">
          {[...(counts.get(null) ? [{ id: null as string | null, name: 'No stage' }] : []), ...stages.map((s) => ({ id: s.id as string | null, name: s.name }))].map((col) => {
            const cr = rows.filter((r) => r.stage_id === col.id && match(r))
            return (
              <div key={col.id ?? 'none'} onDragOver={(e) => { if (canWrite && col.id) { e.preventDefault(); setDragOver(col.id) } }} onDragLeave={() => setDragOver(null)}
                onDrop={(e) => { e.preventDefault(); setDragOver(null); const id = e.dataTransfer.getData('text/jc'); if (id && col.id) moveTo([id], col.id) }}
                className={cx('flex w-72 shrink-0 flex-col rounded-xl border bg-slate-100/60', dragOver === col.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200/80')}>
                <div className="flex items-center justify-between px-3 py-2.5"><span className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: STAGE_COLORS[(order.get(col.id ?? '') ?? 0) % STAGE_COLORS.length] }} /><span className="truncate text-xs font-semibold uppercase tracking-wide text-slate-600">{col.name}</span></span><span className="rounded-full bg-white px-2 text-xs font-medium text-slate-600">{cr.length}</span></div>
                <div className="flex-1 space-y-2 overflow-y-auto scroll-thin px-2 pb-2">
                  {cr.map((r) => (
                    <div key={r.id} draggable={canWrite} onDragStart={(e) => e.dataTransfer.setData('text/jc', r.id)} onClick={() => onOpen(r.candidate_id)} className="cursor-pointer rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm hover:border-brand-500/50 hover:shadow">
                      <div className="flex items-center gap-2"><Avatar name={r.candidates.full_name} size={7} /><div className="min-w-0"><div className="flex items-center gap-1"><span className="truncate text-sm font-medium text-slate-900">{r.candidates.full_name}</span><Verified email={r.candidates.email} phone={r.candidates.phone} /></div><div className="truncate text-xs text-slate-500">{r.candidates.current_position || r.candidates.current_organization || '—'}</div></div></div>
                      <div className="mt-2 flex items-center justify-between gap-1"><span className="text-[11px] text-slate-400">{ago(r.stage_updated_at)}</span><div className="flex items-center gap-1"><NextBtn r={r} /><StageSelect r={r} /></div></div>
                    </div>
                  ))}
                  {!cr.length && <div className="py-4 text-center text-xs text-slate-400">{canWrite ? 'Drop here' : '—'}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
