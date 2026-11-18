import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { useMembers, useRpc, useTasks } from '../lib/api'
import { useAuth } from '../lib/auth'
import { cx, fmtDate } from '../lib/util'
import { Badge, Button, Empty, Spinner } from '../components/ui'
import { useShell } from '../components/Shell'

export default function Tasks() {
  const { member, canWrite } = useAuth(); const shell = useShell()
  const [scope, setScope] = useState<'mine' | 'all' | 'done'>('mine')
  const tasks = useTasks(scope, undefined, member?.user_id); const members = useMembers()
  const done = useRpc<{ p_id: string; p_done: boolean }>('set_task_done', { invalidate: [['tasks'], ['dashboard']] })
  const who = (id: string | null) => members.data?.find((m) => m.user_id === id)?.full_name || members.data?.find((m) => m.user_id === id)?.email || 'Unassigned'
  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-end justify-between"><div><h1 className="text-xl font-semibold text-slate-900">Tasks</h1><p className="text-sm text-slate-500">Follow-ups for you and the team</p></div>
        {canWrite && <Button onClick={() => shell.newTask()}><Plus className="h-4 w-4" />New task</Button>}</div>
      <div className="mb-3 inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
        {([['mine', 'My tasks'], ['all', 'Everyone'], ['done', 'Completed']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setScope(k)} className={cx('rounded-md px-3 py-1.5 text-xs font-medium', scope === k ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100')}>{l}</button>))}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {tasks.isLoading ? <Spinner /> : tasks.data?.map((t) => (
          <div key={t.id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50">
            <button disabled={!canWrite} onClick={() => done.mutate({ p_id: t.id, p_done: t.status !== 'done' })}
              className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded border', t.status === 'done' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-500')}>{t.status === 'done' && <Check className="h-3 w-3" />}</button>
            <div className="min-w-0 flex-1"><div className={cx('truncate text-sm', t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800')}>{t.title}</div>{t.description && <div className="truncate text-xs text-slate-500">{t.description}</div>}</div>
            {scope === 'all' && <span className="text-xs text-slate-500">{who(t.assigned_to)}</span>}
            {t.due_at && <Badge tone={t.status !== 'done' && new Date(t.due_at) < new Date() ? 'red' : 'slate'}>{fmtDate(t.due_at)}</Badge>}
          </div>
        ))}
        {!tasks.isLoading && !tasks.data?.length && <Empty title={scope === 'done' ? 'Nothing completed yet' : 'No open tasks'} hint="Add follow-ups from here, or from any candidate or job." />}
      </div>
    </div>
  )
}
