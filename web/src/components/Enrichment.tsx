import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { ENRICH_KEYS, useRpc, type EnrichStatus } from '../lib/api'
import { cx } from '../lib/util'
import { Badge, Button, Input, Label, Select, Textarea } from './ui'

export const STATUS: Record<EnrichStatus, { label: string; tone: 'amber' | 'blue' | 'red' | 'green' | 'slate' }> = {
  pending: { label: 'Awaiting approval', tone: 'amber' },
  approved: { label: 'Approved · enriching', tone: 'blue' },
  rejected: { label: 'Rejected', tone: 'red' },
  enriched: { label: 'Enriched', tone: 'green' },
  not_found: { label: 'Not found', tone: 'slate' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
}
export const EnrichBadge = ({ status }: { status: EnrichStatus }) => <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>

// Requested → Approved → Enriched
export function Stepper({ status }: { status: EnrichStatus }) {
  const terminalBad = status === 'rejected' || status === 'cancelled'
  const stage = status === 'pending' ? 0 : status === 'approved' ? 1 : status === 'rejected' || status === 'cancelled' ? 0 : 2
  const steps = ['Requested', status === 'rejected' ? 'Rejected' : status === 'cancelled' ? 'Cancelled' : 'Approved', status === 'not_found' ? 'Not found' : 'Enriched']
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      {steps.map((s, i) => {
        const done = i <= stage && !(terminalBad && i > 0)
        const bad = terminalBad && i === 1
        return (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && <div className={cx('h-px w-4', done || bad ? 'bg-slate-400' : 'bg-slate-200')} />}
            <span className={cx('flex items-center gap-1 rounded-full px-2 py-0.5 font-medium', bad ? 'bg-red-100 text-red-700' : done ? (status === 'not_found' && i === 2 ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700') : 'bg-slate-100 text-slate-400')}>
              {bad ? <X className="h-3 w-3" /> : done && <Check className="h-3 w-3" />}{s}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function RequestForm({ candidateId, name, hasEmail, hasPhone, onDone }: { candidateId: string; name: string; hasEmail: boolean; hasPhone: boolean; onDone: () => void }) {
  const [needs, setNeeds] = useState<string[]>([...(hasEmail ? [] : ['email']), ...(hasPhone ? [] : ['phone'])].length ? [...(hasEmail ? [] : ['email']), ...(hasPhone ? [] : ['phone'])] : ['email', 'phone'])
  const [note, setNote] = useState(''); const [priority, setPriority] = useState('normal')
  const m = useRpc('request_enrichment', { ok: 'Enrichment requested — admins have been notified', invalidate: ENRICH_KEYS, onDone })
  const toggle = (k: string) => setNeeds((n) => (n.includes(k) ? n.filter((x) => x !== k) : [...n, k]))
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate({ p_candidate: candidateId, p_needs: needs, p_note: note, p_priority: priority }) }}>
      <p className="text-sm text-slate-600">Ask an admin to find contact details for <b>{name}</b>. You'll be notified when it's approved and when it's done.</p>
      <div>
        <Label>What do you need?</Label>
        <div className="flex gap-2">
          {[['email', 'Email'], ['phone', 'Phone']].map(([k, l]) => (
            <button type="button" key={k} onClick={() => toggle(k)} className={cx('rounded-lg border px-3 py-1.5 text-sm', needs.includes(k) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600')}>{needs.includes(k) && '✓ '}{l}</button>
          ))}
        </div>
      </div>
      <div><Label hint="optional">Priority</Label><Select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="normal">Normal</option><option value="urgent">Urgent</option></Select></div>
      <div><Label hint="optional">Context for the admin</Label><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Strong fit for the Java Lead role, need to reach out today" /></div>
      <div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={onDone}>Cancel</Button><Button type="submit" loading={m.isPending} disabled={!needs.length}>Send request</Button></div>
    </form>
  )
}

export function DecideForm({ id, name, onDone }: { id: string; name: string; onDone: () => void }) {
  const [note, setNote] = useState('')
  const m = useRpc('decide_enrichment', { ok: 'Request rejected', invalidate: ENRICH_KEYS, onDone })
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); m.mutate({ p_id: id, p_approve: false, p_note: note }) }}>
      <p className="text-sm text-slate-600">Reject enrichment for <b>{name}</b>? The requester will see your reason.</p>
      <Textarea rows={3} autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" />
      <div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={onDone}>Back</Button><Button variant="danger" type="submit" loading={m.isPending}>Reject</Button></div>
    </form>
  )
}

export function CompleteForm({ id, name, needs, onDone }: { id: string; name: string; needs: string[]; onDone: () => void }) {
  const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [note, setNote] = useState('')
  const m = useRpc('complete_enrichment', { ok: 'Saved — requester notified', invalidate: ENRICH_KEYS, onDone })
  const send = (found: boolean) => m.mutate({ p_id: id, p_found: found, p_email: email, p_phone: phone, p_note: note })
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); send(true) }}>
      <p className="text-sm text-slate-600">Add the contact details you found for <b>{name}</b>. They are saved to the candidate and queued to sync to RecruitCRM.</p>
      <div className="grid grid-cols-2 gap-3">
        <div><Label hint={needs.includes('email') ? 'requested' : ''}>Email</Label><Input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></div>
        <div><Label hint={needs.includes('phone') ? 'requested' : ''}>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" /></div>
      </div>
      <div><Label hint="optional">Note to requester</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Source, confidence, anything they should know" /></div>
      <div className="flex justify-between gap-2">
        <Button variant="secondary" type="button" loading={m.isPending} onClick={() => send(false)}>Couldn't find</Button>
        <div className="flex gap-2"><Button variant="secondary" type="button" onClick={onDone}>Cancel</Button><Button type="submit" loading={m.isPending} disabled={!email.trim() && !phone.trim()}>Save details</Button></div>
      </div>
    </form>
  )
}
