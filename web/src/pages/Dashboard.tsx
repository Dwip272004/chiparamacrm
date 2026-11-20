import { Link } from 'react-router-dom'
import { Activity, AlertCircle, AlertTriangle, Briefcase, CalendarClock, CheckSquare, Clock, FileText, Layers, MoveRight, UserPlus, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useDashboard, useInsights, useRpc, useTasks } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ago, cx, fmtDate } from '../lib/util'
import { Badge, Spinner } from '../components/ui'
import { useShell } from '../components/Shell'

const label = (a: any) => {
  const d = a.detail ?? {}
  if (a.action === 'stage') return <>moved <b>{d.candidate}</b> to <b>{d.to}</b> on {d.job}</>
  if (a.action === 'assign') return <>added <b>{d.candidate}</b> to <b>{d.job}</b></>
  if (a.action === 'unassign') return <>removed <b>{d.candidate}</b> from {d.job}</>
  return <>{a.action === 'create' ? 'created' : a.action === 'update' ? 'updated' : a.action} a {String(a.entity).replace('_', ' ')}</>
}

const Card = ({ title, right, children, className }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={cx('rounded-xl border border-slate-200 bg-white p-5 shadow-sm', className)}>
    <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">{title}</h2>{right}</div>{children}
  </section>
)

function Tile({ to, icon, n, text, tone = 'brand', sub }: { to?: string; icon: ReactNode; n: number | string; text: string; tone?: 'brand' | 'red' | 'green' | 'amber'; sub?: string }) {
  const c = { brand: 'bg-brand-50 text-brand-600', red: 'bg-red-50 text-red-600', green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600' }[tone]
  const body = (
    <div className={cx('flex items-center gap-3.5 rounded-xl border bg-white p-4 shadow-sm', tone === 'red' ? 'border-red-200' : 'border-slate-200', to && 'hover:shadow-md')}>
      <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', c)}>{icon}</div>
      <div className="min-w-0"><div className="text-2xl font-semibold leading-tight text-slate-900">{typeof n === 'number' ? n.toLocaleString() : n}</div><div className="truncate text-xs text-slate-500">{text}</div>{sub && <div className="truncate text-[11px] text-slate-400">{sub}</div>}</div>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

function Bars({ rows, color = 'bg-brand-500', to }: { rows: { k: string; n: number }[]; color?: string; to?: (k: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.n))
  if (!rows.length) return <div className="py-3 text-sm text-slate-400">Nothing to show yet.</div>
  return <div className="space-y-1">{rows.map((r) => {
    const inner = (<><div className="mb-0.5 flex justify-between text-xs"><span className="truncate pr-2 capitalize text-slate-600">{r.k}</span><span className="font-medium text-slate-800">{r.n.toLocaleString()}</span></div>
      <div className="h-1.5 rounded-full bg-slate-100"><div className={cx('h-1.5 rounded-full', color)} style={{ width: `${(r.n / max) * 100}%` }} /></div></>)
    return to ? <Link key={r.k} to={to(r.k)} title="Click to see these" className="-mx-2 block rounded-lg px-2 py-1 hover:bg-slate-50 hover:[&_span]:text-brand-700">{inner}</Link> : <div key={r.k}>{inner}</div>
  })}</div>
}

function Spark({ data, color = '#6366f1' }: { data: { d: string; n: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((x) => x.n)); const total = data.reduce((a, x) => a + x.n, 0)
  return (
    <div>
      <div className="flex h-24 items-end gap-1">
        {data.map((x) => (
          <div key={x.d} title={`${fmtDate(x.d)}: ${x.n}`} className="group flex h-full flex-1 flex-col justify-end">
            <div className="rounded-t transition group-hover:opacity-70" style={{ height: `${Math.max(x.n ? 6 : 2, (x.n / max) * 100)}%`, background: x.n ? color : '#e2e8f0' }} />
          </div>))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-slate-400"><span>{data[0] && fmtDate(data[0].d).slice(0, 6)}</span><b className="font-medium text-slate-500">{total.toLocaleString()} in 14 days</b><span>Today</span></div>
    </div>
  )
}

export default function Dashboard() {
  const { member } = useAuth(); const shell = useShell()
  const d = useDashboard(); const ins = useInsights(); const mine = useTasks('mine', undefined, member?.user_id)
  const done = useRpc<{ p_id: string; p_done: boolean }>('set_task_done', { invalidate: [['tasks'], ['dashboard']] })
  if (d.isLoading) return <Spinner />
  const s = d.data ?? {}; const i = ins.data
  const hr = new Date().getHours()
  const pipePct = s.candidates ? Math.round((s.in_pipeline / s.candidates) * 100) : 0

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Good {hr < 12 ? 'morning' : hr < 18 ? 'afternoon' : 'evening'}, {member?.full_name?.split(' ')[0] || 'there'}</h1>
        <p className="text-sm text-slate-500">Here's what needs your attention today.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile to="/tasks" icon={<CheckSquare className="h-5 w-5" />} n={s.my_open_tasks ?? 0} text="My open tasks" sub={s.my_due_today ? `${s.my_due_today} due today` : undefined} />
        <Tile to="/tasks" icon={<AlertCircle className="h-5 w-5" />} n={s.my_overdue ?? 0} text="Overdue" tone={s.my_overdue > 0 ? 'red' : 'green'} />
        <Tile to="/jobs" icon={<Briefcase className="h-5 w-5" />} n={s.open_jobs ?? 0} text="Open jobs" sub={`${s.active_assignments ?? 0} candidates in active pipelines`} />
        <Tile to="/candidates" icon={<Users className="h-5 w-5" />} n={s.candidates ?? 0} text="Candidates" sub={`${pipePct}% in a pipeline`} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile icon={<UserPlus className="h-5 w-5" />} n={i?.new_candidates_7d ?? '…'} text="New candidates · 7 days" tone="green" sub={i ? `${i.new_candidates_30d} in 30 days` : undefined} />
        <Tile icon={<MoveRight className="h-5 w-5" />} n={i?.moves_7d ?? '…'} text="Stage moves · 7 days" />
        <Tile icon={<FileText className="h-5 w-5" />} n={i?.notes_7d ?? '…'} text="Notes · 7 days" />
        <Tile to="/candidates" icon={<Layers className="h-5 w-5" />} n={i?.unworked ?? '…'} text="Not in any pipeline" tone="amber" sub="Untapped talent pool" />
        <Tile to="/jobs" icon={<AlertTriangle className="h-5 w-5" />} n={i?.jobs_no_candidates ?? '…'} text="Open jobs, no candidates" tone={i?.jobs_no_candidates > 0 ? 'red' : 'green'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Candidates added" right={<span className="text-xs text-slate-400">last 14 days</span>}>{i ? <Spark data={i.added_by_day} color="#10b981" /> : <Spinner />}</Card>
        <Card title="Pipeline movement" right={<span className="text-xs text-slate-400">stage changes, last 14 days</span>}>{i ? <Spark data={i.moves_by_day} /> : <Spinner />}</Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Jobs needing candidates" right={i && <Badge tone={i.jobs_no_candidates ? 'red' : 'green'}>{i.jobs_no_candidates}</Badge>}>
          {i?.empty_jobs?.map((j: any) => (
            <Link key={j.id} to={`/jobs/${j.id}`} className="block border-b border-slate-100 py-2 last:border-0 hover:text-brand-700"><div className="truncate text-sm text-slate-800">{j.name}</div><div className="truncate text-xs text-slate-500">{j.company_name || 'No client'}</div></Link>))}
          {i && !i.empty_jobs?.length && <div className="py-3 text-sm text-slate-400">Every open job has candidates 🎉</div>}
        </Card>
        <Card title="Gone quiet (14+ days)" right={i && <Badge tone={i.stale_count ? 'amber' : 'green'}>{i.stale_count}</Badge>}>
          {i?.stale?.map((x: any) => (
            <button key={`${x.candidate_id}${x.job_id}`} onClick={() => shell.openCandidate(x.candidate_id)} className="block w-full border-b border-slate-100 py-2 text-left last:border-0 hover:text-brand-700">
              <div className="flex justify-between gap-2"><span className="truncate text-sm text-slate-800">{x.full_name}</span><span className="shrink-0 text-xs text-amber-600">{x.days}d</span></div>
              <div className="truncate text-xs text-slate-500">{x.stage_name} · {x.job_name}</div></button>))}
          {i && !i.stale?.length && <div className="py-3 text-sm text-slate-400">Nobody is stuck. Nice.</div>}
        </Card>
        <Card title="Busiest open jobs">
          {i?.busiest_jobs?.map((j: any) => (
            <Link key={j.id} to={`/jobs/${j.id}`} className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 last:border-0 hover:text-brand-700"><div className="min-w-0"><div className="truncate text-sm text-slate-800">{j.name}</div><div className="truncate text-xs text-slate-500">{j.company_name || 'No client'}</div></div><Badge tone="brand">{j.n}</Badge></Link>))}
          {i && !i.busiest_jobs?.length && <div className="py-3 text-sm text-slate-400">No active pipelines.</div>}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Pipeline by stage"><Bars to={(k) => `/candidates?stage=${encodeURIComponent(k)}`} rows={(s.by_stage ?? []).slice(0, 8).map((x: any) => ({ k: x.stage || 'No stage', n: x.n }))} /></Card>
        <Card title="Jobs by status"><Bars color="bg-emerald-500" to={(k) => `/jobs?status=${encodeURIComponent(k)}`} rows={(s.jobs_by_status ?? []).map((x: any) => ({ k: x.status, n: x.n }))} /></Card>
        <Card title="Team activity · 7 days" right={<Activity className="h-4 w-4 text-slate-300" />}>{i ? <Bars color="bg-sky-500" rows={i.leaderboard.map((x: any) => ({ k: x.name, n: x.n }))} /> : <Spinner />}</Card>
        <Card title="Top skills in database">{i ? <Bars color="bg-violet-500" to={(k) => `/candidates?skillx=${encodeURIComponent(k)}`} rows={i.top_skills.map((x: any) => ({ k: x.skill, n: x.n }))} /> : <Spinner />}</Card>
        <Card title="Top locations">{i ? <Bars color="bg-amber-500" to={(k) => `/candidates?place=${encodeURIComponent(k)}`} rows={i.top_locations.map((x: any) => ({ k: x.place, n: x.n }))} /> : <Spinner />}</Card>
        <Card title="My tasks" right={<CalendarClock className="h-4 w-4 text-slate-300" />}>
          {mine.data?.slice(0, 6).map((t) => (
            <div key={t.id} className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-0">
              <button onClick={() => done.mutate({ p_id: t.id, p_done: true })} title="Mark done" className="h-5 w-5 shrink-0 rounded border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50" />
              <div className="min-w-0 flex-1 truncate text-sm text-slate-800">{t.title}</div>
              {t.due_at && <Badge tone={new Date(t.due_at) < new Date() ? 'red' : 'slate'}>{fmtDate(t.due_at)}</Badge>}
            </div>))}
          {!mine.data?.length && <div className="py-4 text-center text-sm text-slate-400">All caught up. <button className="text-brand-600 hover:underline" onClick={() => shell.newTask()}>Add a task</button></div>}
        </Card>
      </div>

      <Card title="Recent team activity" right={<span className="inline-flex items-center gap-1 text-xs text-slate-400"><Clock className="h-3 w-3" />{s.last_sync ? `RecruitCRM last synced ${ago(s.last_sync)}` : 'RecruitCRM sync not run yet'}</span>}>
        {s.recent?.map((a: any) => (
          <div key={a.id} className="flex items-center gap-2 border-b border-slate-100 py-2 text-sm last:border-0"><b className="font-medium text-slate-800">{a.actor_name || 'Someone'}</b><span className="text-slate-600">{label(a)}</span><span className="ml-auto text-xs text-slate-400">{ago(a.created_at)}</span></div>))}
        {!s.recent?.length && <div className="py-4 text-center text-sm text-slate-400">Activity from your team will show up here.</div>}
      </Card>
    </div>
  )
}
