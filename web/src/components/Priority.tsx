import { ChevronDown, Flame } from 'lucide-react'
import { useRpc } from '../lib/api'
import { cx } from '../lib/util'
import { Menu, MenuItem } from './ui'

export type Priority = 'urgent' | 'high' | 'normal' | 'low'
export const PRIORITIES: Record<Priority, { label: string; chip: string; dot: string; stripe: string }> = {
  urgent: { label: 'Urgent', chip: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500', stripe: 'bg-red-500' },
  high: { label: 'High', chip: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500', stripe: 'bg-orange-500' },
  normal: { label: 'Normal', chip: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500', stripe: 'bg-sky-400' },
  low: { label: 'Low', chip: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400', stripe: 'bg-slate-300' },
}
export const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'normal', 'low']
export const asPriority = (p?: string | null): Priority => (p && p in PRIORITIES ? (p as Priority) : 'normal')

export function PriorityBadge({ priority, className }: { priority?: string | null; className?: string }) {
  const p = PRIORITIES[asPriority(priority)]
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', p.chip, className)}>
      {asPriority(priority) === 'urgent' ? <Flame className="h-3 w-3" /> : <i className={cx('h-1.5 w-1.5 rounded-full', p.dot)} />}{p.label}
    </span>
  )
}

/** Badge that opens a menu to change the priority (read-only badge when you can't edit). */
export function PriorityPicker({ jobId, priority, canEdit }: { jobId: string; priority?: string | null; canEdit: boolean }) {
  const set = useRpc<{ p_id: string; p_priority: string }>('set_job_priority', { ok: 'Priority updated', invalidate: [['jobs'], ['job']] })
  if (!canEdit) return <PriorityBadge priority={priority} />
  return (
    <span onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
      <Menu width="w-44" trigger={(_o, toggle) => (
        <button onClick={toggle} title="Change priority" className="group inline-flex items-center gap-0.5 rounded-full hover:opacity-80"><PriorityBadge priority={priority} /><ChevronDown className="h-3 w-3 text-slate-400 opacity-0 transition group-hover:opacity-100" /></button>)}>
        {(close) => PRIORITY_ORDER.map((p) => (
          <MenuItem key={p} icon={<i className={cx('block h-2.5 w-2.5 rounded-full', PRIORITIES[p].dot)} />} onClick={() => { close(); if (p !== asPriority(priority)) set.mutate({ p_id: jobId, p_priority: p }) }}>
            <span className={cx(asPriority(priority) === p && 'font-semibold')}>{PRIORITIES[p].label}</span>
          </MenuItem>))}
      </Menu>
    </span>
  )
}
