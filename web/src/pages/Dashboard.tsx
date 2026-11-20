import { Link } from 'react-router-dom'
import { Activity, AlertCircle, AlertTriangle, ArrowUpRight, Briefcase, CheckSquare, Clock, FileText, Layers, MoveRight, Plus, UserPlus, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useDashboard, useInsights, useRpc, useTasks } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ago, cx, fmtDate } from '../lib/util'
import { Avatar, Badge, Button, Card as Surface, Spinner } from '../components/ui'
import { useShell } from '../components/Shell'

const label = (a: any) => {
  const d = a.detail ?? {}
  if (a.action === 'stage') return <>moved <b className="font-medium text-slate-800">{d.candidate}</b> to <b className="font-medium text-slate-800">{d.to}</b> on {d.job}</>
  if (a.action === 'assign') return <>added <b className="font-medium text-slate-800">{d.candidate}</b> to <b className="font-medium text-slate-800">{d.job}</b></>
  if (a.action === 'unassign') return <>removed <b className="font-medium text-slate-800">{d.candidate}</b> from {d.job}</>
  return <>{a.action === 'create' ? 'created' : a.action === 'update' ? 'updated' : a.action} a {String(a.entity).replace('_', ' ')}</>
}

const Panel = ({ title, right, children, className }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) => (
  <Surface className={cx('p-5', className)}>
    <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">{title}</h2>{right}</div>{children}
  </Surface>
)

const tones = {
  brand: 'bg-brand-50 text-brand-600', red: 'bg-red-50 text-red-600', green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', sky: 'bg-sky-50 text-sky-600', violet: 'bg-violet-50 text-violet-600',
}
function Kpi({ to, icon, n, text, sub, tone = 'brand', alert }: { to: string; icon: ReactNode; n: number | string; text: string; sub?: string; tone?: keyof typeof tones; alert?: boolean }) {
  return (
    <Link to={to} className={cx('group relative rounded-xl border bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop', alert ? 'border-red-200' : 'border-slate-200/80')}>
      <div className="flex items-start justify-between">
        <div className={cx('flex h-10 w-10 items-center justify-center rounded-xl', tones[tone])}>{icon}</div>
        <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-brand-600" />
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{typeof n === 'number' ? n.toLocaleString() : n}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-600">{text}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </Link>
  )
}

function Stat({ icon, n, text, sub, tone = 'brand', to }: { icon: ReactNode; n: number | string; text: string; sub?: string; tone?: keyof typeof tones; to?: string }) {
  const body = (
    <div className={cx('flex items-center gap-3 px-5 py-4', to && 'transition hover:bg-slate-50')}>
      <div className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tones[tone])}>{icon}</div>
      <div className="min-w-0"><div className="text-xl font-semibold leading-tight text-slate-900 tabular-nums">{typeof n === 'number' ? n.toLocaleString() : n}</div><div className="truncate text-xs text-slate-500">{text}</div>{sub && <div className="truncate text-[11px] text-slate-400">{sub}</div>}</div>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

function Bars({ rows, color = 'bg-brand-500', to }: { rows: { k: string; n: number }[]; color?: string; to?: (k: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.n))
  if (!rows.length) return <div className="py-3 text-sm text-slate-400">Nothing to show yet.</div>
  return <div className="space-y-0.5">{rows.map((r) => {
    const inner = (<><div className="mb-1.5 flex justify-between text-[13px]"><span className="truncate pr-2 capitalize text-slate-600 transition group-hover/row:text-brand-700">{r.k}</span><span className="font-semibold tabular-nums text-slate-800">{r.n.toLocaleString()}</span></div>
      <div className="h-2 rounded-full bg-slate-100"><div className={cx('h-2 rounded-full transition-all', color)} style={{ width: `${Math.max(3, (r.n / max) * 100)}%` }} /></div></>)
    return to ? <Link key={r.k} to={to(r.k)} title="Click to see these" className="group/row -mx-2 block rounded-lg px-2 py-2 transition hover:bg-slate-50">{inner}</Link> : <div key={r.k} className="py-2">{inner}</div>
  })}</div>
}

const STAGE_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']
function Funnel({ rows }: { rows: { k: string; n: number }[] }) {
  const total = rows.reduce((a, r) => a + r.n, 0)
  if (!total) return <div className="py-3 text-sm text-slate-400">No candidates in pipelines yet.</div>
  return (
    <div>
      <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
        {rows.map((r, i) => <div key={r.k} title={`${r.k}: ${r.n.toLocaleString()}`} style={{ width: `${(r.n / total) * 100}%`, background: STAGE_COLORS[i % STAGE_COLORS.length] }} className="first:rounded-l-full last:rounded-r-full" />)}
      </div>
      <div className="space-y-0.5">
        {rows.map((r, i) => (
          <Link key={r.k} to={`/candidates?stage=${encodeURIComponent(r.k)}`} title="Click to see these candidates" className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 text-[13px] transition hover:bg-slate-50">
            <i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: STAGE_COLORS[i % STAGE_COLORS.length] }} />
            <span className="flex-1 truncate text-slate-600">{r.k}</span>
            <span className="font-semibold tabular-nums text-slate-800">{r.n.toLocaleString()}</span>
            <span className="w-10 text-right text-xs tabular-nums text-slate-400">{Math.round((r.n / total) * 100)}%</span>
          </Link>))}
      </div>
    </div>
  )
}

function Spark({ data, color = '#6366f1' }: { data: { d: string; n: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((x) => x.n))
  return (
    <div>
      <div className="flex h-28 items-end gap-1.5">
        {data.map((x, i) => (
          <div key={x.d} title={`${fmtDate(x.d)}: ${x.n}`} className="group flex h-full flex-1 flex-col justify-end">
            <div className="rounded-md transition group-hover:opacity-70" style={{ height: `${Math.max(x.n ? 8 : 3, (x.n / max) * 100)}%`, background: x.n ? color : 'var(--color-slate-200)', opacity: x.n ? 0.55 + 0.45 * (i / data.length) : 1 }} />
          </div>))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-400"><span>{data[0] && fmtDate(data[0].d).slice(0, 6)}</span><span>Today</span></div>
    </div>
  )
}

const ListRow = ({ to, onClick, title, sub, right }: { to?: string; onClick?: () => void; title: string; sub?: string; right?: ReactNode }) => {
  const body = (<><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate-800">{title}</div>{sub && <div className="truncate text-xs text-slate-500">{sub}</div>}</div>{right}</>)
  const cls = '-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50'
  return to ? <Link to={to} className={cls}>{body}</Link> : <button onClick={onClick} className={cls}>{body}</button>
}

export default function Dashboard() {
  const { member, canWrite } = useAuth(); const shell = useShell()
  const d = useDashboard(); const ins = useInsights(); const mine = useTasks('mine', undefined, member?.user_id)
  const done = useRpc<{ p_id: string; p_done: boolean }>('set_task_done', { invalidate: [['tasks'], ['dashboard']] })
  if (d.isLoading) return <Spinner />
  const s = d.data ?? {}; const i = ins.data
  const hr = new Date().getHours()
  const pipePct = s.candidates ? Math.round((s.in_pipeline / s.candidates) * 100) : 0

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 px-8 py-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Good {hr < 12 ? 'morning' : hr < 18 ? 'afternoon' : 'evening'}, {member?.full_name?.split(' ')[0] || 'there'}</h1>
          <p className="mt-0.5 text-sm text-slate-500">Here's what needs your attention today.</p>
        </div>
        {canWrite && <div className="flex gap-2"><Button variant="secondary" onClick={() => shell.newTask()}><CheckSquare className="h-4 w-4" />New task</Button><Button onClick={shell.newCandidate}><Plus className="h-4 w-4" />New candidate</Button></div>}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi to="/tasks" icon={<CheckSquare className="h-5 w-5" />} n={s.my_open_tasks ?? 0} text="My open tasks" sub={s.my_due_today ? `${s.my_due_today} due today` : 'Nothing due today'} />
        <Kpi to="/tasks" icon={<AlertCircle className="h-5 w-5" />} n={s.my_overdue ?? 0} text="Overdue" tone={s.my_overdue > 0 ? 'red' : 'green'} alert={s.my_overdue > 0} sub={s.my_overdue > 0 ? 'Needs follow-up' : 'All on track'} />
        <Kpi to="/jobs" icon={<Briefcase className="h-5 w-5" />} n={s.open_jobs ?? 0} text="Open jobs" tone="violet" sub={`${(s.active_assignments ?? 0).toLocaleString()} candidates in active pipelines`} />
        <Kpi to="/candidates" icon={<Users className="h-5 w-5" />} n={s.candidates ?? 0} text="Candidates" tone="sky" sub={`${pipePct}% in a pipeline`} />
      </div>

      <Surface className="grid grid-cols-2 divide-x divide-y divide-slate-100 overflow-hidden lg:grid-cols-5 lg:divide-y-0">
        <Stat icon={<UserPlus className="h-[18px] w-[18px]" />} n={i?.new_candidates_7d ?? '…'} text="New candidates · 7 days" tone="green" sub={i ? `${i.new_candidates_30d} in 30 days` : undefined} />
        <Stat icon={<MoveRight className="h-[18px] w-[18px]" />} n={i?.moves_7d ?? '…'} text="Stage moves · 7 days" />
        <Stat icon={<FileText className="h-[18px] w-[18px]" />} n={i?.notes_7d ?? '…'} text="Notes · 7 days" tone="sky" />
        <Stat to="/candidates" icon={<Layers className="h-[18px] w-[18px]" />} n={i?.unworked ?? '…'} text="Not in any pipeline" tone="amber" sub="Untapped talent pool" />
        <Stat to="/jobs" icon={<AlertTriangle className="h-[18px] w-[18px]" />} n={i?.jobs_no_candidates ?? '…'} text="Open jobs, no candidates" tone={i?.jobs_no_candidates > 0 ? 'red' : 'green'} />
      </Surface>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="Pipeline by stage" right={<span className="text-xs text-slate-400">Click a stage to see people</span>}>
          <Funnel rows={(s.by_stage ?? []).slice(0, 8).map((x: any) => ({ k: x.stage || 'No stage', n: x.n }))} />
        </Panel>
        <div className="grid gap-4 lg:col-span-2">
          <Panel title="Candidates added" right={<span className="text-xs text-slate-400">last 14 days</span>}>{i ? <Spark data={i.added_by_day} color="#10b981" /> : <Spinner />}</Panel>
          <Panel title="Pipeline movement" right={<span className="text-xs text-slate-400">stage changes, 14 days</span>}>{i ? <Spark data={i.moves_by_day} /> : <Spinner />}</Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Jobs needing candidates" right={i && <Badge tone={i.jobs_no_candidates ? 'red' : 'green'}>{i.jobs_no_candidates}</Badge>}>
          {i?.empty_jobs?.map((j: any) => <ListRow key={j.id} to={`/jobs/${j.id}`} title={j.name} sub={j.company_name || 'No client'} right={<ArrowUpRight className="h-4 w-4 text-slate-300" />} />)}
          {i && !i.empty_jobs?.length && <div className="py-3 text-sm text-slate-400">Every open job has candidates 🎉</div>}
        </Panel>
        <Panel title="Gone quiet (14+ days)" right={i && <Badge tone={i.stale_count ? 'amber' : 'green'}>{i.stale_count}</Badge>}>
          {i?.stale?.map((x: any) => <ListRow key={`${x.candidate_id}${x.job_id}`} onClick={() => shell.openCandidate(x.candidate_id)} title={x.full_name} sub={`${x.stage_name} · ${x.job_name}`} right={<Badge tone="amber">{x.days}d</Badge>} />)}
          {i && !i.stale?.length && <div className="py-3 text-sm text-slate-400">Nobody is stuck. Nice.</div>}
        </Panel>
        <Panel title="Busiest open jobs">
          {i?.busiest_jobs?.map((j: any) => <ListRow key={j.id} to={`/jobs/${j.id}`} title={j.name} sub={j.company_name || 'No client'} right={<Badge tone="brand">{j.n}</Badge>} />)}
          {i && !i.busiest_jobs?.length && <div className="py-3 text-sm text-slate-400">No active pipelines.</div>}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Jobs by status"><Bars color="bg-emerald-500" to={(k) => `/jobs?status=${encodeURIComponent(k)}`} rows={(s.jobs_by_status ?? []).map((x: any) => ({ k: x.status, n: x.n }))} /></Panel>
        <Panel title="Top locations">{i ? <Bars color="bg-amber-500" to={(k) => `/candidates?place=${encodeURIComponent(k)}`} rows={i.top_locations.slice(0, 6).map((x: any) => ({ k: x.place, n: x.n }))} /> : <Spinner />}</Panel>
        <Panel title="Team activity · 7 days" right={<Activity className="h-4 w-4 text-slate-300" />}>{i ? <Bars color="bg-sky-500" rows={i.leaderboard.map((x: any) => ({ k: x.name, n: x.n }))} /> : <Spinner />}</Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Top skills in database" right={<span className="text-xs text-slate-400">Click a skill to see people</span>}>
          {i ? (
            <div className="flex flex-wrap gap-2">
              {i.top_skills.map((x: any) => (
                <Link key={x.skill} to={`/candidates?skillx=${encodeURIComponent(x.skill)}`} className="group inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-[13px] transition hover:border-brand-300 hover:bg-brand-50">
                  <span className="font-medium capitalize text-slate-700 group-hover:text-brand-700">{x.skill}</span><span className="rounded-md bg-white px-1.5 text-xs font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200">{x.n.toLocaleString()}</span>
                </Link>))}
            </div>
          ) : <Spinner />}
        </Panel>
        <Panel title="My tasks" right={<Link to="/tasks" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>}>
          {mine.data?.slice(0, 5).map((t) => (
            <div key={t.id} className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-0">
              <button onClick={() => done.mutate({ p_id: t.id, p_done: true })} title="Mark done" className="h-[18px] w-[18px] shrink-0 rounded-md border-2 border-slate-300 transition hover:border-emerald-500 hover:bg-emerald-50" />
              <div className="min-w-0 flex-1 truncate text-sm text-slate-800">{t.title}</div>
              {t.due_at && <Badge tone={new Date(t.due_at) < new Date() ? 'red' : 'slate'}>{fmtDate(t.due_at).slice(0, 6)}</Badge>}
            </div>))}
          {!mine.data?.length && <div className="py-4 text-center text-sm text-slate-400">All caught up. <button className="font-medium text-brand-600 hover:underline" onClick={() => shell.newTask()}>Add a task</button></div>}
        </Panel>
      </div>

      <Panel title="Recent team activity" right={<span className="inline-flex items-center gap-1 text-xs text-slate-400"><Clock className="h-3 w-3" />{s.last_sync ? `RecruitCRM last synced ${ago(s.last_sync)}` : 'RecruitCRM sync not run yet'}</span>}>
        {s.recent?.map((a: any) => (
          <div key={a.id} className="flex items-center gap-3 border-b border-slate-100 py-2.5 text-sm last:border-0"><Avatar name={a.actor_name || 'S'} size={7} /><div className="min-w-0 flex-1 truncate text-slate-500"><b className="font-medium text-slate-800">{a.actor_name || 'Someone'}</b> {label(a)}</div><span className="text-xs text-slate-400">{ago(a.created_at)}</span></div>))}
        {!s.recent?.length && <div className="py-4 text-center text-sm text-slate-400">Activity from your team will show up here.</div>}
      </Panel>
    </div>
  )
}
