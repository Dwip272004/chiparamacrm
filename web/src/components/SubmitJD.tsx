import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRpc } from '../lib/api'
import { Button, Label, Textarea } from './ui'

/** Any teammate pastes a raw JD; an admin structures and publishes it. */
export default function SubmitJD({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate(); const [jd, setJd] = useState(''); const [note, setNote] = useState('')
  const m = useRpc<{ p_raw_jd: string; p_note: string }>('submit_jd', { ok: 'JD submitted — the admins have been notified', invalidate: [['jobs'], ['job-stats'], ['dashboard']], onDone: (id: string) => { onDone(); if (id) navigate(`/jobs/${id}`) } })
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate({ p_raw_jd: jd, p_note: note }) }}>
      <p className="text-sm text-slate-600">Paste the job description exactly as you received it. An admin will review it, structure the details and publish it.</p>
      <div><Label>Job description</Label><Textarea autoFocus required rows={12} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the full JD here…" /></div>
      <div><Label hint="optional">Note for the admins</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Client, urgency, anything not in the JD" /></div>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={onDone}>Cancel</Button><Button type="submit" loading={m.isPending} disabled={!jd.trim()}>Submit for review</Button></div>
    </form>
  )
}
