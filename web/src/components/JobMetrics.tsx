import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowUpRight, Briefcase, CheckCircle2, Target, TrendingUp, Users } from 'lucide-react'
import type { Job } from '../lib/types'
import type { JobStat } from '../lib/api'
import { cx, isOpenStatus } from '../lib/util'
import { Badge, Segmented } from './ui'
import { stageColor } from './JobCard'
import { PRIORITY_ORDER, PriorityBadge, asPriority } from './Priority'

type J = Job & { job_candidates?: { count: number }[] }
export interface Apply { prio?: string; pipe?: string; mode?: string; client?: string; status?: string }

const isOpen = (j: J) => isOpenStatus(j.status)
const daysSince = (d?: string | null) => (d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400_000)) : null)
const PLACED = /hire|placed|join|onboard/i
const PRIO_COLOR: Record<string, string> = { urgent: '#ef4444', high: '#f97316', normal: '#38bdf8', low: '#94a3b8' }

function Tile({ icon, n, label, sub, tone = 'brand' }: { icon: ReactNode; n: ReactNode; label: string; sub?: string; tone?: 'brand' | 'green' | 'amber' | 'red' | 'violet' | 'sky' }) {
  const c = { brand: 'bg-brand-50 text-brand-600', green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600', violet: 'bg-violet-50 text-violet-600', sky: 'bg-sky-50 text-sky-600' }[tone]
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', c)}>{icon}</div>
        <div className="min-w-0"><div className="text-2xl font-semibold leading-tight tracking-tight text-slate-900 tabular-nums">{n}</div><div className="truncate text-xs font-medium text-slate-600">{label}</div></div>
      </div>
      {sub && <div className="mt-2 truncate text-[11px] text-slate-400">{sub}</div>}
    </div>
  )
}
const Panel = ({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) => (
  <section className={cx('rounded-xl border border-slate-200/80 bg-white p-5 shadow-card', className)}>
    <div className="mb-3.5 flex items-baseline justify-between gap-2"><h3 className="text-sm font-semibold text-slate-900">{title}</h3>{hint && <span className="text-[11px] text-slate-400">{hint}</span>}</div>{children}
  </section>
)
function Row({ label, n, total, color, onClick, right }: { label: ReactNode; n: number; total: number; color: string; onClick?: () => void; right?: ReactNode }) {
  const body = (<>
    <div className="mb-1 flex items-center justify-between gap-2 text-[13px]"><span className="flex min-w-0 items-center gap-2 text-slate-600">{label}</span><span className="flex items-center gap-2 font-semibold tabular-nums text-slate-800">{n}{right}</span></div>
    <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full transition-all" style={{ width: `${total ? Math.max(n ? 3 : 0, (n / total) * 100) : 0}%`, background: color }} /></div>
  </>)
  return onClick ? <button onClick={onClick} className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50">{body}</button> : <div className="py-1.5">{body}</div>
}
function Dist({ title, items, color, onPick }: { title: string; items: [string, number][]; color: string; onPick?: (k: string) => void }) {
  const total = items.reduce((a, [, n]) => a + n, 0)
  return (
    <Panel title={title}>
      {items.length ? items.map(([k, n]) => <Row key={k} label={k} n={n} total={total} color={color} onClick={onPick ? () => onPick(k) : undefined} />) : <div className="py-3 text-sm text-slate-400">No data.</div>}
    </Panel>
  )
}

export default function JobMetrics({ all, filtered, stats, filtersOn, onApply }: { all: J[]; filtered: J[]; stats?: Map<string, JobStat>; filtersOn: boolean; onApply: (a: Apply) => void }) {
  const [scope, setScope] = useState<'all' | 'filtered'>('all')
  const jobs = scope === 'filtered' ? filtered : all

  const m = useMemo(() => {
    const open = jobs.filter(isOpen)
    const st = (j: J) => stats?.get(j.id)
    const total = (j: J) => st(j)?.total ?? j.job_candidates?.[0]?.count ?? 0
    const stageMap = new Map<string, { n: number; ord: number }>()
    let placed = 0, interviewing = 0, offers = 0, stuck = 0
    jobs.forEach((j) => (st(j)?.stages ?? []).forEach((s, i) => {
      if (PLACED.test(s.name)) placed += s.n
      if (!isOpen(j)) return
      if (/interview/i.test(s.name)) interviewing += s.n
      if (/offer/i.test(s.name)) offers += s.n
      const cur = stageMap.get(s.name); stageMap.set(s.name, { n: (cur?.n ?? 0) + s.n, ord: Math.min(cur?.ord ?? 99, i) })
    }))
    open.forEach((j) => { stuck += st(j)?.stale ?? 0 })
    const stages = [...stageMap].sort((a, b) => a[1].ord - b[1].ord).map(([name, v]) => ({ name, n: v.n }))
    const openCands = open.reduce((a, j) => a + total(j), 0)
    const openings = open.reduce((a, j) => a + (j.openings ?? 0), 0)
    const totalOpenings = jobs.reduce((a, j) => a + (j.openings ?? 0), 0)
    const noCands = open.filter((j) => total(j) === 0)
    const idle = open.filter((j) => { const d = daysSince(st(j)?.last_move); return total(j) > 0 && d != null && d >= 14 })
    const prio = PRIORITY_ORDER.map((p) => [p, jobs.filter((j) => asPriority(j.priority) === p).length] as [string, number])
    const aging = [['0–14 days', 0, 14], ['15–30 days', 15, 30], ['31–60 days', 31, 60], ['60+ days', 61, 1e9]].map(([label, lo, hi]) => [label as string, open.filter((j) => { const d = daysSince(j.open_date ?? j.rc_created_at ?? j.created_at) ?? 0; return d >= (lo as number) && d <= (hi as number) }).length] as [string, number])
    const count = (f: (j: J) => string | null | undefined, src = open) => { const mp = new Map<string, number>(); src.forEach((j) => { const k = f(j)?.trim(); if (k) mp.set(k, (mp.get(k) ?? 0) + 1) }); return [...mp].sort((a, b) => b[1] - a[1]) }
    const clients = (() => { const mp = new Map<string, { jobs: number; cands: number }>(); open.forEach((j) => { const k = j.company_name?.trim() || 'No client'; const c = mp.get(k) ?? { jobs: 0, cands: 0 }; c.jobs++; c.cands += total(j); mp.set(k, c) }); return [...mp].sort((a, b) => b[1].jobs - a[1].jobs || b[1].cands - a[1].cands).slice(0, 6) })()
    const attention = open.map((j) => {
      const reasons: string[] = []; const n = total(j); const d = daysSince(st(j)?.last_move)
      if (n === 0) reasons.push('No candidates')
      else if (n < 3 && ['urgent', 'high'].includes(asPriority(j.priority))) reasons.push(`Only ${n} candidate${n > 1 ? 's' : ''}`)
      if ((st(j)?.stale ?? 0) > 0) reasons.push(`${st(j)!.stale} stuck 14d+`)
      if (n > 0 && d != null && d >= 14) reasons.push(`Idle ${d}d`)
      const score = reasons.length * 10 + (4 - PRIORITY_ORDER.indexOf(asPriority(j.priority))) * 3 + (n === 0 ? 5 : 0)
      return { j, reasons, score }
    }).filter((x) => x.reasons.length).sort((a, b) => b.score - a.score)
    const biggest = [...open].sort((a, b) => total(b) - total(a)).slice(0, 5).map((j) => ({ j, n: total(j) }))
    const avgAge = open.length ? Math.round(open.reduce((a, j) => a + (daysSince(j.open_date ?? j.rc_created_at ?? j.created_at) ?? 0), 0) / open.length) : 0
    return { open, openCands, openings, totalOpenings, placed, interviewing, offers, stuck, stages, noCands, idle, prio, aging, attention, biggest, avgAge,
      modes: count((j) => j.work_mode), types: count((j) => j.employment_type), clients, closed: jobs.length - open.length,
      fill: totalOpenings ? Math.round((placed / totalOpenings) * 100) : 0 }
  }, [jobs, stats])

  const stageTotal = m.stages.reduce((a, s) => a + s.n, 0)
  const maxOf = (xs: [string, number][]) => xs.reduce((a, [, n]) => a + n, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{jobs.length} job{jobs.length === 1 ? '' : 's'} · {m.open.length} open · {m.closed} closed. Click a bar to filter the list.</p>
        <Segmented size="sm" value={scope} onChange={setScope} options={[{ value: 'all', label: 'All jobs', count: all.length }, { value: 'filtered', label: filtersOn ? 'Current filters' : 'Shown now', count: filtered.length }]} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Tile icon={<Briefcase className="h-[18px] w-[18px]" />} n={m.open.length} label="Open jobs" sub={`${m.closed} closed`} />
        <Tile icon={<Target className="h-[18px] w-[18px]" />} n={m.openings} label="Openings to fill" tone="violet" sub="across open jobs" />
        <Tile icon={<Users className="h-[18px] w-[18px]" />} n={m.openCands.toLocaleString()} label="In open pipelines" tone="sky" sub={m.open.length ? `${(m.openCands / m.open.length).toFixed(1)} per job` : undefined} />
        <Tile icon={<TrendingUp className="h-[18px] w-[18px]" />} n={m.interviewing} label="Interviewing" tone="green" sub={`${m.offers} at offer stage`} />
        <Tile icon={<CheckCircle2 className="h-[18px] w-[18px]" />} n={m.placed} label="Placed" tone="green" sub={m.totalOpenings ? `${m.fill}% of ${m.totalOpenings} openings` : undefined} />
        <Tile icon={<AlertTriangle className="h-[18px] w-[18px]" />} n={m.attention.length} label="Need attention" tone={m.attention.length ? 'red' : 'green'} sub={m.attention.length ? 'see list below' : 'all healthy'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Pipeline across open jobs" hint={`${stageTotal.toLocaleString()} candidate${stageTotal === 1 ? '' : 's'}`}>
          {stageTotal ? (<>
            <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-slate-100">{m.stages.map((s) => <div key={s.name} title={`${s.name}: ${s.n}`} style={{ width: `${(s.n / stageTotal) * 100}%`, background: stageColor(s.name) }} />)}</div>
            <div className="grid gap-x-8 sm:grid-cols-2">{m.stages.map((s) => <Row key={s.name} label={<><i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: stageColor(s.name) }} />{s.name}</>} n={s.n} total={stageTotal} color={stageColor(s.name)} right={<span className="w-9 text-right text-[11px] font-normal text-slate-400">{Math.round((s.n / stageTotal) * 100)}%</span>} />)}</div>
          </>) : <div className="py-6 text-center text-sm text-slate-400">No candidates in these pipelines yet.</div>}
        </Panel>
        <Panel title="By priority" hint="click to filter">
          {m.prio.map(([k, n]) => <Row key={k} label={<PriorityBadge priority={k} />} n={n} total={maxOf(m.prio)} color={PRIO_COLOR[k] ?? '#94a3b8'} onClick={() => onApply({ prio: k })} />)}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="How long open jobs have been open" hint={`avg ${m.avgAge} days`}>
          {m.aging.map(([k, n], i) => <Row key={k} label={k} n={n} total={m.open.length} color={['#10b981', '#f59e0b', '#f97316', '#ef4444'][i]} />)}
        </Panel>
        <Panel title="Pipeline health" hint="open jobs only">
          <div className="space-y-1">
            {[
              { label: 'No candidates yet', n: m.noCands.length, tone: 'red' as const, apply: { pipe: 'empty', status: 'open' } },
              { label: 'No stage movement in 14+ days', n: m.idle.length, tone: 'amber' as const },
              { label: 'Candidates stuck 14+ days', n: m.stuck, tone: 'amber' as const },
              { label: 'Urgent / high priority', n: m.open.filter((j) => ['urgent', 'high'].includes(asPriority(j.priority))).length, tone: 'brand' as const },
            ].map((r) => (
              <button key={r.label} onClick={r.apply ? () => onApply(r.apply) : undefined} disabled={!r.apply} className={cx('flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[13px] text-slate-600', r.apply && 'hover:bg-slate-50')}>
                <span>{r.label}</span><Badge tone={r.n ? r.tone : 'green'}>{r.n}</Badge>
              </button>))}
          </div>
        </Panel>
        <Panel title="Top clients" hint="open jobs · candidates">
          {m.clients.length ? m.clients.map(([k, v]) => (
            <button key={k} onClick={() => k !== 'No client' && onApply({ client: k })} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-[13px] hover:bg-slate-50"><span className="truncate text-slate-700">{k}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500"><b className="font-semibold text-slate-800">{v.jobs}</b> job{v.jobs === 1 ? '' : 's'} · {v.cands}</span></button>)) : <div className="py-3 text-sm text-slate-400">No clients.</div>}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Dist title="Work mode" items={m.modes} color="#6366f1" onPick={(k) => onApply({ mode: k })} />
        <Dist title="Employment type" items={m.types} color="#14b8a6" />
        <Panel className="lg:col-span-2" title="Needs attention" hint={`${m.attention.length} job${m.attention.length === 1 ? '' : 's'}`}>
          {m.attention.slice(0, 5).map(({ j, reasons }) => (
            <Link key={j.id} to={`/jobs/${j.id}`} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-sm font-medium text-slate-800 group-hover:text-brand-700">{j.name}</span><PriorityBadge priority={j.priority} /></div>
                <div className="truncate text-xs text-slate-500">{j.company_name || 'No client'}</div></div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">{reasons.map((r) => <Badge key={r} tone={/No cand/.test(r) ? 'red' : 'amber'}>{r}</Badge>)}</div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-brand-600" />
            </Link>))}
          {!m.attention.length && <div className="py-6 text-center text-sm text-slate-400">Every open job looks healthy 🎉</div>}
        </Panel>
      </div>

      {!!m.biggest.length && (
        <Panel title="Biggest pipelines" hint="open jobs">
          <div className="grid gap-x-8 md:grid-cols-2">{m.biggest.map(({ j, n }) => (
            <Link key={j.id} to={`/jobs/${j.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-[13px] hover:bg-slate-50"><span className="truncate text-slate-700">{j.name}<span className="ml-2 text-xs text-slate-400">{j.company_name}</span></span><span className="inline-flex shrink-0 items-center gap-1 font-semibold tabular-nums text-slate-800">{n}</span></Link>))}</div>
        </Panel>
      )}
    </div>
  )
}
