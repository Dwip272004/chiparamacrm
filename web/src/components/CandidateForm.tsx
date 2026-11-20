import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase, unwrap } from '../lib/supabase'
import { useRpc } from '../lib/api'
import type { Candidate } from '../lib/types'
import { Button, Input, Label } from './ui'
import { useQuery } from '@tanstack/react-query'

const blank = { first_name: '', last_name: '', email: '', phone: '', current_position: '', current_organization: '', city: '', state: '', country: '', linkedin_url: '', skills: '', experience_years: '', notice_period: '', current_salary: '', expected_salary: '', source: '' }

export default function CandidateForm({ initial, onDone }: { initial?: Candidate; onDone: (id?: string) => void }) {
  const [f, setF] = useState(() => initial ? {
    ...blank, ...Object.fromEntries(Object.entries(initial).filter(([k]) => k in blank).map(([k, v]) => [k, v == null ? '' : String(v)])), skills: (initial.skills ?? []).join(', '),
  } : blank)
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const save = useRpc<{ p_id: string | null; p: object }>('save_candidate', { ok: initial ? 'Candidate saved' : 'Candidate created', onDone: (id) => onDone(id) })

  // Duplicate guard: same email or phone already in the database.
  const digits = f.phone.replace(/\D/g, '')
  const dup = useQuery({
    queryKey: ['dup', f.email.toLowerCase(), digits], enabled: f.email.includes('@') || digits.length >= 7,
    queryFn: async () => {
      const ors = [f.email.includes('@') && `email.ilike.${f.email.trim()}`, digits.length >= 7 && `phone_digits.eq.${digits}`].filter(Boolean).join(',')
      const r = await unwrap<{ id: string; full_name: string }[]>(supabase.from('candidates').select('id,full_name').or(ors).limit(3))
      return r.filter((x) => x.id !== initial?.id)
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.first_name.trim() && !f.last_name.trim()) return
    save.mutate({
      p_id: initial?.id ?? null,
      p: { ...f, skills: f.skills.split(',').map((s) => s.trim()).filter(Boolean) },
    })
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {!!dup.data?.length && (
        <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>Possible duplicate: {dup.data.map((d) => d.full_name).join(', ')} already has this email or phone.</div>
        </div>
      )}
      <Section title="Basics">
        <div><Label>First name</Label><Input autoFocus required={!f.last_name} value={f.first_name} onChange={set('first_name')} /></div>
        <div><Label>Last name</Label><Input value={f.last_name} onChange={set('last_name')} /></div>
        <div><Label>Email</Label><Input type="email" value={f.email} onChange={set('email')} placeholder="name@company.com" /></div>
        <div><Label>Phone</Label><Input value={f.phone} onChange={set('phone')} placeholder="+91 98765 43210" /></div>
        <div><Label>LinkedIn</Label><Input value={f.linkedin_url} onChange={set('linkedin_url')} placeholder="linkedin.com/in/…" /></div>
        <div><Label>Source</Label><Input value={f.source} onChange={set('source')} placeholder="Referral, LinkedIn…" /></div>
      </Section>
      <Section title="Role & location">
        <div><Label>Current title</Label><Input value={f.current_position} onChange={set('current_position')} /></div>
        <div><Label>Current company</Label><Input value={f.current_organization} onChange={set('current_organization')} /></div>
        <div><Label>City</Label><Input value={f.city} onChange={set('city')} /></div>
        <div className="grid grid-cols-2 gap-3"><div><Label>State</Label><Input value={f.state} onChange={set('state')} /></div><div><Label>Country</Label><Input value={f.country} onChange={set('country')} /></div></div>
        <div className="col-span-2"><Label hint="comma separated">Skills</Label><Input value={f.skills} onChange={set('skills')} placeholder="React, Node.js, AWS" /></div>
      </Section>
      <Section title="Experience & compensation">
        <div><Label>Experience (years)</Label><Input type="number" step="0.5" value={f.experience_years} onChange={set('experience_years')} /></div>
        <div><Label>Notice period</Label><Input value={f.notice_period} onChange={set('notice_period')} placeholder="30 days" /></div>
        <div><Label>Current salary</Label><Input type="number" value={f.current_salary} onChange={set('current_salary')} /></div>
        <div><Label>Expected salary</Label><Input type="number" value={f.expected_salary} onChange={set('expected_salary')} /></div>
      </Section>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={() => onDone()}>Cancel</Button><Button type="submit" loading={save.isPending}>{initial ? 'Save changes' : 'Create candidate'}</Button></div>
    </form>
  )
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset><legend className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</legend><div className="grid grid-cols-2 gap-3">{children}</div></fieldset>
)
