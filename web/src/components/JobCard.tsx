import { Link } from 'react-router-dom'
import { AlertTriangle, Briefcase, CalendarClock, GraduationCap, MapPin, Wallet } from 'lucide-react'
import type { Job } from '../lib/types'
import type { JobStat } from '../lib/api'
import { ago, cx, place } from '../lib/util'
import { Avatar, Badge, SyncBadge } from './ui'
import { PRIORITIES, PriorityPicker, asPriority } from './Priority'

const tone = (s?: string | null) => (/open/i.test(s ?? '') ? 'green' : /hold/i.test(s ?? '') ? 'amber' : 'slate') as 'green' | 'amber' | 'slate'
const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']
const KNOWN: [RegExp, string][] = [[/appl|new|sourc/i, '#6366f1'], [/screen|shortlist|submit/i, '#0ea5e9'], [/interview/i, '#10b981'], [/offer/i, '#f59e0b'], [/hire|placed|join|onboard/i, '#ec4899'], [/reject|drop|declin/i, '#94a3b8']]
export const stageColor = (name: string) => KNOWN.find(([r]) => r.test(name))?.[1] ?? PALETTE[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length]

const compact = (n?: number | null) => (n ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : null)
const range = (a?: number | null, b?: number | null, f: (n: number) => string = String) => (a && b ? `${f(a)}–${f(b)}` : a ? `${f(a)}+` : b ? `up to ${f(b)}` : null)
const daysSince = (d?: string | null) => (d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400_000)) : null)

function Stat({ n, label, tone: t = 'slate', sub }: { n: number | string; label: string; tone?: 'slate' | 'green' | 'amber' | 'brand'; sub?: string }) {
  const c = { slate: 'text-slate-900', green: 'text-emerald-600', amber: 'text-amber-600', brand: 'text-brand-600' }[t]
  return <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2"><div className={cx('text-lg font-semibold leading-tight tabular-nums', c)}>{n}{sub && <span className="ml-0.5 text-xs font-medium text-slate-400">{sub}</span>}</div><div className="truncate text-[11px] text-slate-500">{label}</div></div>
}

export default function JobCard({ j, stat, canWrite }: { j: Job; stat?: JobStat; canWrite: boolean }) {
  const open = /open/i.test(j.status ?? '')
  const total = stat?.total ?? 0
  const sum = (re: RegExp) => (stat?.stages ?? []).filter((s) => re.test(s.name)).reduce((a, s) => a + s.n, 0)
  const interviewing = sum(/interview/i), offers = sum(/offer/i), placed = sum(/hire|placed|join|onboard/i)
  const age = daysSince(j.open_date ?? j.rc_created_at ?? j.created_at)
  const idle = daysSince(stat?.last_move)
  const flags: { tone: 'red' | 'amber'; text: string }[] = []
  if (open && total === 0) flags.push({ tone: 'red', text: 'No candidates yet' })
  if (open && stat && stat.stale > 0) flags.push({ tone: 'amber', text: `${stat.stale} stuck 14d+` })
  if (open && total > 0 && idle != null && idle >= 14) flags.push({ tone: 'amber', text: `No movement ${idle}d` })
  const exp = range(j.min_experience, j.max_experience, (n) => `${n}`)
  const sal = range(j.min_salary, j.max_salary, (n) => compact(n) ?? '')

  return (
    <Link to={`/jobs/${j.id}`} className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 pl-6 shadow-card transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-pop">
      <i className={cx('absolute inset-y-0 left-0 w-1.5', PRIORITIES[asPriority(j.priority)].stripe)} />

      <div className="flex items-start gap-3">
        <Avatar name={j.company_name || j.name} size={10} className="!rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-slate-900 group-hover:text-brand-700">{j.name}</div>
          <div className="truncate text-sm text-slate-500">{j.company_name || j.company_rc_id || 'No client'}{j.job_code && <span className="ml-1.5 text-xs text-slate-400">· #{j.job_code}</span>}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5"><PriorityPicker jobId={j.id} priority={j.priority} canEdit={canWrite} /><Badge tone={tone(j.status)} dot>{j.status || '—'}</Badge><SyncBadge status={j.sync_status} /></div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" />{place(j) || 'No location'}</span>
        {j.work_mode && <span className="rounded bg-slate-100 px-1.5 py-0.5">{j.work_mode}</span>}
        {j.employment_type && <span className="rounded bg-slate-100 px-1.5 py-0.5">{j.employment_type}</span>}
        {exp && <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5 text-slate-400" />{exp} yrs</span>}
        {sal && <span className="inline-flex items-center gap-1"><Wallet className="h-3.5 w-3.5 text-slate-400" />{j.currency && j.currency.length <= 4 ? `${j.currency} ` : ''}{sal}</span>}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <Stat n={total} label="In pipeline" tone={total ? 'brand' : 'slate'} />
        <Stat n={interviewing} label="Interviewing" tone={interviewing ? 'green' : 'slate'} />
        <Stat n={offers} label="Offers" tone={offers ? 'amber' : 'slate'} />
        <Stat n={placed} sub={j.openings ? `/${j.openings}` : undefined} label={j.openings ? 'Placed / openings' : 'Placed'} tone={placed ? 'green' : 'slate'} />
      </div>

      {total > 0 && (
        <div className="mt-3.5">
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
            {(stat?.stages ?? []).map((s) => <div key={s.name} title={`${s.name}: ${s.n}`} style={{ width: `${(s.n / total) * 100}%`, background: stageColor(s.name) }} />)}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
            {(stat?.stages ?? []).map((s) => <span key={s.name} className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: stageColor(s.name) }} />{s.name} <b className="font-semibold tabular-nums text-slate-700">{s.n}</b></span>)}
          </div>
        </div>
      )}

      {!!flags.length && <div className="mt-3 flex flex-wrap gap-1.5">{flags.map((f) => <Badge key={f.text} tone={f.tone}><AlertTriangle className="h-3 w-3" />{f.text}</Badge>)}</div>}

      {!!j.skills.length && <div className="mt-3 flex flex-wrap gap-1">{j.skills.slice(0, 5).map((s) => <Badge key={s} tone="brand">{s}</Badge>)}{j.skills.length > 5 && <span className="self-center text-xs text-slate-400">+{j.skills.length - 5}</span>}</div>}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3.5 text-xs text-slate-500" >
        <div className="flex items-center">
          {stat?.people.length ? (
            <div className="flex items-center" title={stat.people.map((p) => p.name).join(', ')}>
              <div className="flex -space-x-2">{stat.people.slice(0, 4).map((p) => <Avatar key={p.id} name={p.name} size={6} className="ring-2 ring-white" />)}</div>
              {total > 4 && <span className="ml-2 font-medium text-slate-600">+{total - 4}</span>}
            </div>
          ) : <span className="inline-flex items-center gap-1.5 text-slate-400"><Briefcase className="h-3.5 w-3.5" />No candidates</span>}
        </div>
        <div className="flex items-center gap-3 text-right text-[11px] text-slate-400">
          {age != null && open && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />Open {age}d</span>}
          <span>{idle != null ? `Last move ${idle === 0 ? 'today' : `${idle}d ago`}` : `Updated ${ago(j.rc_updated_at ?? j.created_at)}`}</span>
        </div>
      </div>
    </Link>
  )
}
