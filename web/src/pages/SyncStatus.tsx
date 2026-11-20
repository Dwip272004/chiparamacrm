import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, CloudUpload, XCircle } from 'lucide-react'
import { supabase, unwrap } from '../lib/supabase'
import { ago } from '../lib/util'
import { Badge, Spinner, PageHeader } from '../components/ui'

export default function SyncStatus() {
  const state = useQuery({ queryKey: ['sync-state'], queryFn: () => unwrap<any[]>(supabase.from('sync_state').select('*').order('entity')), refetchInterval: 15_000 })
  const runs = useQuery({ queryKey: ['sync-runs'], queryFn: () => unwrap<any[]>(supabase.from('sync_runs').select('*').order('started_at', { ascending: false }).limit(15)), refetchInterval: 15_000 })
  const out = useQuery({ queryKey: ['outbox'], queryFn: () => unwrap<any[]>(supabase.from('sync_outbox').select('*').in('status', ['pending', 'failed', 'processing']).order('created_at').limit(50)), refetchInterval: 15_000 })
  return (
    <div className="mx-auto max-w-5xl px-8 py-7">
      <PageHeader title="Sync status" subtitle="How the portal and RecruitCRM stay in step" />
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-card shadow-sm">
        <CloudUpload className="h-5 w-5 text-amber-600" />
        <div className="text-sm"><b>{out.data?.length ?? 0}</b> change{out.data?.length === 1 ? '' : 's'} saved in the portal waiting to be pushed to RecruitCRM.<span className="ml-1 text-slate-500">Edits are never lost — they are queued and pushed once syncing is switched on.</span></div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200/80 bg-white shadow-card"><div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Data from RecruitCRM</div>
          {state.isLoading ? <Spinner /> : state.data?.map((s) => (
            <div key={s.entity} className="flex items-center gap-3 border-b border-slate-50 px-4 py-2.5 text-sm last:border-0">
              {s.status === 'error' ? <XCircle className="h-4 w-4 text-red-500" /> : <CheckCircle2 className={s.last_synced_at ? 'h-4 w-4 text-emerald-500' : 'h-4 w-4 text-slate-300'} />}
              <span className="flex-1 capitalize text-slate-800">{s.entity.replace('_', ' ')}</span>
              <span className="text-xs text-slate-500">{s.last_synced_at ? ago(s.last_synced_at) : 'never'}</span>
            </div>
          ))}
        </section>
        <section className="rounded-xl border border-slate-200/80 bg-white shadow-card"><div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Recent runs</div>
          {runs.data?.map((r) => (
            <div key={r.id} className="flex items-center gap-2 border-b border-slate-50 px-4 py-2 text-xs last:border-0">
              <Badge tone={r.status === 'success' ? 'green' : r.status === 'failed' ? 'red' : 'amber'}>{r.status}</Badge><span className="capitalize text-slate-700">{r.entity.replace('_', ' ')}</span>
              <span className="text-slate-400">{r.mode}</span><span className="ml-auto text-slate-500">{r.upserted} rows · {ago(r.started_at)}</span>
            </div>
          ))}
          {!runs.data?.length && !runs.isLoading && <div className="p-6 text-center text-sm text-slate-400">No runs yet.</div>}
        </section>
      </div>
      {!!out.data?.length && (
        <section className="mt-5 rounded-xl border border-slate-200/80 bg-white shadow-card"><div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Waiting to push</div>
          {out.data.map((o) => <div key={o.id} className="flex items-center gap-2 border-b border-slate-50 px-4 py-2 text-xs last:border-0"><Badge tone={o.status === 'failed' ? 'red' : 'amber'}>{o.status}</Badge><span className="capitalize">{o.entity.replace('_', ' ')} · {o.op === 'action' ? o.payload?.action : o.op}</span>{o.last_error && <span className="truncate text-red-600">{o.last_error}</span>}<span className="ml-auto text-slate-500">{ago(o.created_at)}</span></div>)}
        </section>
      )}
    </div>
  )
}
