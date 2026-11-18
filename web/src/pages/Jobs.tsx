import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, MapPin, Plus, Search, Users } from 'lucide-react'
import { useJobs } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ago, cx, place } from '../lib/util'
import { Badge, Button, Empty, Input, Spinner, SyncBadge } from '../components/ui'
import { useShell } from '../components/Shell'

const tone = (s?: string | null) => (/open/i.test(s ?? '') ? 'green' : /hold/i.test(s ?? '') ? 'amber' : 'slate') as 'green' | 'amber' | 'slate'

export default function Jobs() {
  const shell = useShell(); const { canWrite } = useAuth(); const jobs = useJobs()
  const [q, setQ] = useState(''); const [status, setStatus] = useState('open')
  const all = jobs.data ?? []
  const list = all.filter((j) => (status === 'all' || (status === 'open' ? /open/i.test(j.status ?? '') : !/open/i.test(j.status ?? ''))) &&
    [j.name, j.company_name, j.city].join(' ').toLowerCase().includes(q.toLowerCase()))
  const openN = all.filter((j) => /open/i.test(j.status ?? '')).length
  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-4 flex items-end justify-between">
        <div><h1 className="text-xl font-semibold text-slate-900">Jobs</h1><p className="text-sm text-slate-500">{openN} open · {all.length} total</p></div>
        {canWrite && <Button onClick={shell.newJob}><Plus className="h-4 w-4" />New job</Button>}
      </div>
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input data-search className="pl-9" placeholder="Filter by title, client or city…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
          {['open', 'closed', 'all'].map((s) => <button key={s} onClick={() => setStatus(s)} className={cx('rounded-md px-3 py-1.5 text-xs font-medium capitalize', status === s ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100')}>{s}</button>)}
        </div>
      </div>
      {jobs.isLoading ? <Spinner /> : !list.length ? <Empty icon={<Briefcase className="h-10 w-10" />} title="No jobs match" /> : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {list.map((j) => (
            <Link key={j.id} to={`/jobs/${j.id}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-500/50 hover:shadow-md">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate font-medium text-slate-900">{j.name}</div><div className="truncate text-xs text-slate-500">{j.company_name || j.company_rc_id || 'No client'}</div></div>
                <div className="flex gap-1"><SyncBadge status={j.sync_status} /><Badge tone={tone(j.status)}>{j.status || '—'}</Badge></div></div>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{place(j) || 'No location'}</span>
                <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{j.job_candidates?.[0]?.count ?? 0} in pipeline</span>
                <span className="ml-auto">{ago(j.rc_updated_at ?? j.created_at)}</span>
              </div>
              {!!j.skills.length && <div className="mt-2.5 flex flex-wrap gap-1">{j.skills.slice(0, 4).map((s) => <Badge key={s}>{s}</Badge>)}</div>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
