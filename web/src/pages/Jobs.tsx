import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Briefcase, MapPin, Plus, Search, Users, X } from 'lucide-react'
import { useJobs } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ago, cx, place } from '../lib/util'
import { Avatar, Badge, Button, Empty, Input, PageHeader, Segmented, Spinner, SyncBadge } from '../components/ui'
import { useShell } from '../components/Shell'

const tone = (s?: string | null) => (/open/i.test(s ?? '') ? 'green' : /hold/i.test(s ?? '') ? 'amber' : 'slate') as 'green' | 'amber' | 'slate'

export default function Jobs() {
  const shell = useShell(); const { canWrite } = useAuth(); const jobs = useJobs()
  const [sp, setSp] = useSearchParams()
  const exact = sp.get('status') ?? ''   // exact status from a dashboard click, e.g. ?status=Closed
  const [q, setQ] = useState(''); const [status, setStatus] = useState('open')
  const all = jobs.data ?? []
  const list = all.filter((j) => (exact ? (j.status ?? 'Unknown').toLowerCase() === exact.toLowerCase() : (status === 'all' || (status === 'open' ? /open/i.test(j.status ?? '') : !/open/i.test(j.status ?? '')))) &&
    [j.name, j.company_name, j.city].join(' ').toLowerCase().includes(q.toLowerCase()))
  const openN = all.filter((j) => /open/i.test(j.status ?? '')).length
  return (
    <div className="mx-auto max-w-[1400px] px-8 py-7">
      <PageHeader title="Jobs" subtitle={<><b className="font-semibold text-slate-700">{openN}</b> open · {all.length} total</>} actions={canWrite && <Button onClick={shell.newJob}><Plus className="h-4 w-4" />New job</Button>} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] max-w-md flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input data-search className="h-10 pl-9" placeholder="Filter by title, client or city…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Segmented value={exact ? ('' as never) : (status as 'open')} onChange={(s) => { setSp({}); setStatus(s) }} options={[{ value: 'open', label: 'Open', count: openN }, { value: 'closed', label: 'Closed', count: all.length - openN }, { value: 'all', label: 'All', count: all.length }]} />
        {exact && <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 pl-3 pr-1.5 text-[13px] font-medium text-white">Status: <b className="font-semibold">{exact}</b>
          <button onClick={() => setSp({})} title="Remove filter" className="rounded p-1 hover:bg-white/20"><X className="h-3 w-3" /></button></span>}
      </div>
      {jobs.isLoading ? <Spinner /> : !list.length ? <Empty icon={<Briefcase />} title="No jobs match" hint="Try another status or clear the search." /> : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {list.map((j) => {
            const open = /open/i.test(j.status ?? ''); const n = j.job_candidates?.[0]?.count ?? 0
            return (
              <Link key={j.id} to={`/jobs/${j.id}`} className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-pop">
                <i className={cx('absolute inset-y-0 left-0 w-1', open ? 'bg-emerald-500' : /hold/i.test(j.status ?? '') ? 'bg-amber-500' : 'bg-slate-300')} />
                <div className="flex items-start gap-3">
                  <Avatar name={j.company_name || j.name} size={10} className="!rounded-xl" />
                  <div className="min-w-0 flex-1"><div className="truncate font-semibold text-slate-900 group-hover:text-brand-700">{j.name}</div><div className="truncate text-sm text-slate-500">{j.company_name || j.company_rc_id || 'No client'}</div></div>
                  <div className="flex flex-col items-end gap-1"><Badge tone={tone(j.status)} dot>{j.status || '—'}</Badge><SyncBadge status={j.sync_status} /></div>
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
