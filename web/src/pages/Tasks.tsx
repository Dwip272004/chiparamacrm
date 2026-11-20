import { useState } from 'react'
import { Check, CheckSquare, Plus } from 'lucide-react'
import { useMembers, useRpc, useTasks } from '../lib/api'
import { useAuth } from '../lib/auth'
import { cx, fmtDate } from '../lib/util'
import { Avatar, Badge, Button, Card, Empty, PageHeader, Segmented, Spinner } from '../components/ui'
import { useShell } from '../components/Shell'
import type { Task } from '../lib/types'

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

export default function Tasks() {
  const { member, canWrite } = useAuth(); const shell = useShell()
  const [scope, setScope] = useState<'mine' | 'all' | 'done'>('mine')
  const tasks = useTasks(scope, undefined, member?.user_id); const members = useMembers()
  const done = useRpc<{ p_id: string; p_done: boolean }>('set_task_done', { invalidate: [['tasks'], ['dashboard']] })
  const who = (id: string | null) => members.data?.find((m) => m.user_id === id)?.full_name || members.data?.find((m) => m.user_id === id)?.email || 'Unassigned'

  const today = startOfDay(new Date())
  const groups: { key: string; title: string; tone: string; items: Task[] }[] = scope === 'done'
    ? [{ key: 'done', title: 'Completed', tone: 'text-slate-500', items: tasks.data ?? [] }]
    : [
      { key: 'over', title: 'Overdue', tone: 'text-red-600', items: [] }, { key: 'today', title: 'Today', tone: 'text-brand-700', items: [] },
      { key: 'soon', title: 'Upcoming', tone: 'text-slate-600', items: [] }, { key: 'none', title: 'No due date', tone: 'text-slate-400', items: [] },
    ]
  if (scope !== 'done') (tasks.data ?? []).forEach((t) => {
    const g = !t.due_at ? 'none' : startOfDay(new Date(t.due_at)) < today ? 'over' : startOfDay(new Date(t.due_at)) === today ? 'today' : 'soon'
    groups.find((x) => x.key === g)!.items.push(t)
  })
  const open = (tasks.data ?? []).length

  return (
    <div className="mx-auto max-w-4xl px-8 py-7">
      <PageHeader title="Tasks" subtitle="Follow-ups for you and the team" actions={canWrite && <Button onClick={() => shell.newTask()}><Plus className="h-4 w-4" />New task</Button>} />
      <div className="mb-5"><Segmented value={scope} onChange={setScope} options={[{ value: 'mine', label: 'My tasks' }, { value: 'all', label: 'Everyone' }, { value: 'done', label: 'Completed' }]} /></div>

      {tasks.isLoading ? <Spinner /> : !open ? (
        <Card><Empty icon={<CheckSquare />} title={scope === 'done' ? 'Nothing completed yet' : 'You\'re all caught up'} hint="Add follow-ups from here, or from any candidate or job." action={canWrite && scope !== 'done' ? <Button onClick={() => shell.newTask()}><Plus className="h-4 w-4" />New task</Button> : undefined} /></Card>
      ) : (
        <div className="space-y-6">
          {groups.filter((g) => g.items.length).map((g) => (
            <section key={g.key}>
              <div className="mb-2 flex items-center gap-2 px-1"><h2 className={cx('text-xs font-semibold uppercase tracking-wider', g.tone)}>{g.title}</h2><span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-500">{g.items.length}</span></div>
              <Card className="divide-y divide-slate-100 overflow-hidden">
                {g.items.map((t) => {
                  const overdue = t.status !== 'done' && !!t.due_at && new Date(t.due_at).getTime() < Date.now()
                  return (
                    <div key={t.id} className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50">
                      <button disabled={!canWrite} onClick={() => done.mutate({ p_id: t.id, p_done: t.status !== 'done' })} title={t.status === 'done' ? 'Mark as not done' : 'Mark done'}
                        className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition', t.status === 'done' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50')}>{t.status === 'done' && <Check className="h-3 w-3" strokeWidth={3} />}</button>
                      <div className="min-w-0 flex-1"><div className={cx('truncate text-sm font-medium', t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800')}>{t.title}</div>{t.description && <div className="truncate text-xs text-slate-500">{t.description}</div>}</div>
                      {scope === 'all' && <div className="flex items-center gap-2 text-xs text-slate-500"><Avatar name={who(t.assigned_to)} size={6} />{who(t.assigned_to)}</div>}
                      {t.due_at && <Badge tone={overdue ? 'red' : 'slate'} dot={overdue}>{fmtDate(t.due_at)}</Badge>}
                    </div>
                  )
                })}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
