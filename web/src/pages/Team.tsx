import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Trash2 } from 'lucide-react'
import { supabase, unwrap } from '../lib/supabase'
import { useMembers } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Role } from '../lib/types'
import { Avatar, Badge, Button, Input, Select, Spinner, useToast, PageHeader } from '../components/ui'

const ROLES: { v: Role; d: string }[] = [
  { v: 'admin', d: 'Everything, incl. team management' }, { v: 'manager', d: 'Read/write/delete, sees sync status' },
  { v: 'recruiter', d: 'Read and write' }, { v: 'viewer', d: 'Read only' },
]

export default function Team() {
  const { isAdmin, member } = useAuth(); const toast = useToast(); const qc = useQueryClient()
  const members = useMembers()
  const invites = useQuery({ queryKey: ['invites'], queryFn: () => unwrap<{ email: string; role: Role; full_name: string | null }[]>(supabase.from('team_invites').select('*').order('created_at')), enabled: isAdmin })
  const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [role, setRole] = useState<Role>('recruiter')
  const ok = (m: string) => { toast(m); qc.invalidateQueries({ queryKey: ['members'] }); qc.invalidateQueries({ queryKey: ['invites'] }) }
  const err = (e: Error) => toast(e.message, 'err')
  const invite = useMutation({ mutationFn: () => unwrap(supabase.from('team_invites').upsert({ email: email.trim().toLowerCase(), role, full_name: name || null, invited_by: member?.user_id })), onSuccess: () => { ok('Invite saved'); setEmail(''); setName('') }, onError: err })
  const upd = useMutation({ mutationFn: (a: { id: string; patch: object }) => unwrap(supabase.from('team_members').update(a.patch).eq('user_id', a.id)), onSuccess: () => ok('Updated'), onError: err })
  const rm = useMutation({ mutationFn: (e: string) => unwrap(supabase.from('team_invites').delete().eq('email', e)), onSuccess: () => ok('Invite removed'), onError: err })

  return (
    <div className="mx-auto max-w-4xl px-8 py-7">
      <PageHeader title="Team" subtitle="Who can use the portal and what they can do" />
      {isAdmin && (
        <section className="mb-6 rounded-xl border border-slate-200/80 bg-white p-5 shadow-card shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Invite a teammate</h2>
          <p className="mb-3 text-xs text-slate-500">They go to the portal, choose “Create account” with this email, and are added automatically.</p>
          <form onSubmit={(e) => { e.preventDefault(); invite.mutate() }} className="flex flex-wrap gap-2">
            <Input className="!w-44" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input className="!w-64" type="email" required placeholder="email@chiparama.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Select className="!w-36" value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r.v} value={r.v}>{r.v}</option>)}</Select>
            <Button type="submit" loading={invite.isPending}><Mail className="h-4 w-4" />Invite</Button>
          </form>
          {!!invites.data?.length && <div className="mt-4 space-y-1.5"><div className="text-xs font-medium text-slate-500">Pending invites</div>
            {invites.data.map((i) => <div key={i.email} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm"><span className="flex-1">{i.full_name ? `${i.full_name} · ` : ''}{i.email}</span><Badge>{i.role}</Badge>
              <button onClick={() => rm.mutate(i.email)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}</div>}
        </section>
      )}
      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
        {members.isLoading ? <Spinner /> : members.data?.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
            <Avatar name={m.full_name || m.email} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate-900">{m.full_name || m.email}{m.user_id === member?.user_id && <span className="ml-2 text-xs text-slate-400">(you)</span>}</div><div className="truncate text-xs text-slate-500">{m.email}</div></div>
            {!m.is_active && <Badge tone="red">Deactivated</Badge>}
            {isAdmin && m.user_id !== member?.user_id ? (
              <>
                <Select className="!w-36 !py-1.5 text-xs" value={m.role} onChange={(e) => upd.mutate({ id: m.user_id, patch: { role: e.target.value } })}>{ROLES.map((r) => <option key={r.v} value={r.v}>{r.v}</option>)}</Select>
                <Button size="sm" variant="secondary" onClick={() => upd.mutate({ id: m.user_id, patch: { is_active: !m.is_active } })}>{m.is_active ? 'Deactivate' : 'Reactivate'}</Button>
              </>
            ) : <Badge tone="brand">{m.role}</Badge>}
          </div>
        ))}
      </section>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">{ROLES.map((r) => <div key={r.v}><b className="capitalize text-slate-700">{r.v}</b> — {r.d}</div>)}</div>
    </div>
  )
}
