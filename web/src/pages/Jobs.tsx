import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Briefcase, MapPin, Plus, Search, SlidersHorizontal, Users, X } from 'lucide-react'
import { useJobs } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ago, cx, place } from '../lib/util'
import { Avatar, Badge, Button, Empty, Input, PageHeader, Segmented, Spinner, SyncBadge } from '../components/ui'
import { useShell } from '../components/Shell'
import { PRIORITIES, PRIORITY_ORDER, PriorityPicker, asPriority } from '../components/Priority'

const tone = (s?: string | null) => (/open/i.test(s ?? '') ? 'green' : /hold/i.test(s ?? '') ? 'amber' : 'slate') as 'green' | 'amber' | 'slate'

const SORTS = { updated: 'Recently updated', priority: 'Priority (urgent first)', name: 'Title A–Z', pipeline: 'Most candidates', openings: 'Most openings' } as const
type Sort = keyof typeof SORTS
const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x?.trim()))].sort((a, b) => a.localeCompare(b))
const sel = 'h-8 rounded-lg border py-0 pl-3 pr-7 text-[13px] font-medium'

export default function Jobs() {
  const shell = useShell(); const { canWrite } = useAuth(); const jobs = useJobs()
  const [sp, setSp] = useSearchParams()
  const exact = sp.get('status') ?? ''   // exact status from a dashboard click, e.g. ?status=Closed
  const [q, setQ] = useState(''); const [status, setStatus] = useState('open')
  const [client, setClient] = useState(''); const [location, setLocation] = useState(''); const [mode, setMode] = useState(''); const [emp, setEmp] = useState('')
  const [skill, setSkill] = useState(''); const [pipe, setPipe] = useState(''); const [prio, setPrio] = useState(''); const [sort, setSort] = useState<Sort>('updated'); const [more, setMore] = useState(false)
  const all = jobs.data ?? []
  const opts = useMemo(() => ({ clients: uniq(all.map((j) => j.company_name)), modes: uniq(all.map((j) => j.work_mode)), emps: uniq(all.map((j) => j.employment_type)) }), [all])
  const nOf = (j: (typeof all)[number]) => j.job_candidates?.[0]?.count ?? 0

  const { pre, list } = useMemo(() => {
    const t = q.trim().toLowerCase(); const loc = location.trim().toLowerCase(); const skills = skill.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
    const out = all.filter((j) => {
      const isOpen = /open/i.test(j.status ?? '')
      if (exact ? (j.status ?? 'Unknown').toLowerCase() !== exact.toLowerCase() : !(status === 'all' || (status === 'open' ? isOpen : !isOpen))) return false
      if (t && ![j.name, j.company_name, j.city].join(' ').toLowerCase().includes(t)) return false
      if (client && j.company_name !== client) return false
      if (mode && j.work_mode !== mode) return false
      if (emp && j.employment_type !== emp) return false
      if (loc && ![j.city, j.state, j.country].join(' ').toLowerCase().includes(loc)) return false
      if (skills.length && !skills.every((k) => j.skills.some((s) => s.toLowerCase().includes(k)))) return false
      const n = nOf(j)
      if (pipe === 'has' && n === 0) return false
      if (pipe === 'empty' && n > 0) return false
      if (pipe === '10' && n < 10) return false
      return true
    })
    const by: Record<Sort, (a: (typeof all)[number], b: (typeof all)[number]) => number> = {
      updated: (a, b) => +new Date(b.rc_updated_at ?? b.created_at) - +new Date(a.rc_updated_at ?? a.created_at),
      priority: (a, b) => PRIORITY_ORDER.indexOf(asPriority(a.priority)) - PRIORITY_ORDER.indexOf(asPriority(b.priority)) || +new Date(b.rc_updated_at ?? b.created_at) - +new Date(a.rc_updated_at ?? a.created_at),
      name: (a, b) => a.name.localeCompare(b.name), pipeline: (a, b) => nOf(b) - nOf(a), openings: (a, b) => (b.openings ?? 0) - (a.openings ?? 0),
    }
    const sorted = out.sort(by[sort])
    return { pre: sorted, list: prio ? sorted.filter((j) => asPriority(j.priority) === prio) : sorted }
  }, [all, q, status, exact, client, location, mode, emp, skill, pipe, sort, prio])  // eslint-disable-line react-hooks/exhaustive-deps

  const openN = all.filter((j) => /open/i.test(j.status ?? '')).length
  const activeMore = [client, location, mode, emp, skill, pipe].filter(Boolean).length
  const filtered = !!(q || exact || activeMore || prio)
  const clearAll = () => { setQ(''); setSp({}); setClient(''); setLocation(''); setMode(''); setEmp(''); setSkill(''); setPipe(''); setPrio(''); setStatus('open') }
  const pick = (val: string, set: (v: string) => void, label: string, options: string[]) => (
    <select value={val} onChange={(e) => set(e.target.value)} className={cx(sel, val ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600')}>
      <option value="">{label}: any</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-7">
      <PageHeader title="Jobs" subtitle={<><b className="font-semibold text-slate-700">{list.length}</b> {filtered ? 'matching your filters' : 'shown'} · {openN} open · {all.length} total</>} actions={canWrite && <Button onClick={shell.newJob}><Plus className="h-4 w-4" />New job</Button>} />

      <div className="mb-5 rounded-xl border border-slate-200/80 bg-white p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input data-search className="h-10 pl-9" placeholder="Search title, client or city…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Segmented value={exact ? ('' as never) : (status as 'open')} onChange={(v) => { setSp({}); setStatus(v) }} options={[{ value: 'open', label: 'Open', count: openN }, { value: 'closed', label: 'Closed', count: all.length - openN }, { value: 'all', label: 'All', count: all.length }]} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Priority</span>
          {[{ k: '', label: 'All', dot: '', n: pre.length }, ...PRIORITY_ORDER.map((k) => ({ k: k as string, label: PRIORITIES[k].label, dot: PRIORITIES[k].dot, n: pre.filter((j) => asPriority(j.priority) === k).length }))].map((c) => (
            <button key={c.k || 'all'} onClick={() => setPrio(c.k)} className={cx('inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition',
              prio === c.k ? 'border-brand-600 bg-brand-600 text-white' : c.n ? 'border-slate-200 bg-white text-slate-700 hover:border-slate-300' : 'border-slate-200 bg-white text-slate-300')}>
              {c.dot && <i className={cx('h-2 w-2 rounded-full', c.dot)} />}{c.label}<span className={cx('rounded-full px-1.5 text-[10px] tabular-nums', prio === c.k ? 'bg-white/25' : 'bg-slate-100 text-slate-500')}>{c.n}</span>
            </button>))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setMore(!more)} className={cx('inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition', more || activeMore ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
            <SlidersHorizontal className="h-3.5 w-3.5" />More filters{activeMore > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">{activeMore}</span>}</button>
          {pick(client, setClient, 'Client', opts.clients)}
          {pick(mode, setMode, 'Work mode', opts.modes)}
          {exact && <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 pl-3 pr-1.5 text-[13px] font-medium text-white">Status: <b className="font-semibold">{exact}</b>
            <button onClick={() => setSp({})} title="Remove filter" className="rounded p-1 hover:bg-white/20"><X className="h-3 w-3" /></button></span>}
          <div className="ml-auto flex items-center gap-2 text-[13px] text-slate-500">
            {filtered && <button onClick={clearAll} className="font-medium text-brand-600 hover:underline">Clear all</button>}
            <span>Sort</span><select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={cx(sel, 'border-slate-200 bg-white text-slate-700')}>{Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
        </div>
        {(more || activeMore > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {pick(emp, setEmp, 'Type', opts.emps)}
            <div className="relative w-48"><MapPin className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" /><Input className="!h-8 pl-8 text-[13px]" placeholder="City or country" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
            <Input className="!h-8 !w-52 text-[13px]" placeholder="Skills (a, b = both)" title="Separate several skills with commas: the job must list all of them" value={skill} onChange={(e) => setSkill(e.target.value)} />
            <select value={pipe} onChange={(e) => setPipe(e.target.value)} className={cx(sel, pipe ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600')}>
              <option value="">Pipeline: any</option><option value="has">Has candidates</option><option value="empty">No candidates yet</option><option value="10">10+ candidates</option>
            </select>
          </div>
        )}
      </div>

      {jobs.isLoading ? <Spinner /> : !list.length ? <Empty icon={<Briefcase />} title="No jobs match" hint="Try another status or clear some filters." action={filtered ? <Button variant="secondary" size="sm" onClick={clearAll}>Clear all filters</Button> : undefined} /> : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {list.map((j) => {
            const open = /open/i.test(j.status ?? ''); const n = j.job_candidates?.[0]?.count ?? 0
            return (
              <Link key={j.id} to={`/jobs/${j.id}`} className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-pop">
                <i className={cx('absolute inset-y-0 left-0 w-1', PRIORITIES[asPriority(j.priority)].stripe)} />
                <div className="flex items-start gap-3">
                  <Avatar name={j.company_name || j.name} size={10} className="!rounded-xl" />
                  <div className="min-w-0 flex-1"><div className="truncate font-semibold text-slate-900 group-hover:text-brand-700">{j.name}</div><div className="truncate text-sm text-slate-500">{j.company_name || j.company_rc_id || 'No client'}</div></div>
                  <div className="flex flex-col items-end gap-1.5"><PriorityPicker jobId={j.id} priority={j.priority} canEdit={canWrite} /><Badge tone={tone(j.status)} dot>{j.status || '—'}</Badge><SyncBadge status={j.sync_status} /></div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" />{place(j) || 'No location'}</span>
                  {j.work_mode && <span>{j.work_mode}</span>}{j.employment_type && <span>{j.employment_type}</span>}
                </div>
                {!!j.skills.length && <div className="mt-3 flex flex-wrap gap-1">{j.skills.slice(0, 4).map((s) => <Badge key={s}>{s}</Badge>)}{j.skills.length > 4 && <span className="self-center text-xs text-slate-400">+{j.skills.length - 4}</span>}</div>}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-700"><Users className="h-3.5 w-3.5 text-slate-400" />{n} in pipeline</span>
                  <span className="text-slate-400">Updated {ago(j.rc_updated_at ?? j.created_at)}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
