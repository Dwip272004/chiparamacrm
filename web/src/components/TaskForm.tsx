import { useState } from 'react'
import { useRpc, useMembers } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Button, Input, Label, Select, Textarea } from './ui'

export default function TaskForm({ preset, onDone }: { preset?: { candidate_id?: string; job_id?: string }; onDone: () => void }) {
  const { member } = useAuth(); const members = useMembers()
  const [f, setF] = useState({ title: '', description: '', due_at: '', assigned_to: member?.user_id ?? '' })
  const save = useRpc<{ p_id: null; p: object }>('save_task', { ok: 'Task added', onDone })
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate({ p_id: null, p: { ...f, due_at: f.due_at ? new Date(f.due_at).toISOString() : '', ...preset } }) }} className="space-y-3">
      <div><Label>What needs doing?</Label><Input autoFocus required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Call back about the offer" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Due</Label><Input type="datetime-local" value={f.due_at} onChange={(e) => setF({ ...f, due_at: e.target.value })} /></div>
        <div><Label>Assign to</Label><Select value={f.assigned_to} onChange={(e) => setF({ ...f, assigned_to: e.target.value })}>{members.data?.filter((m) => m.is_active).map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name || m.email}</option>)}</Select></div>
      </div>
      <div><Label>Details</Label><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onDone}>Cancel</Button><Button type="submit" loading={save.isPending}>Add task</Button></div>
    </form>
  )
}
