import { useEffect, useMemo, useRef, useState } from 'react'
import { CornerUpLeft, ExternalLink, Mail, MessageSquare, Paperclip, Phone, Send, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCandidate, useCandidateSearch, useChat, useRpc, type ChatMsg } from '../lib/api'
import { ago, cx, place, useDebounced } from '../lib/util'
import { Avatar, Badge, Button, Input, Spinner, Verified } from '../components/ui'
import { useShell } from '../components/Shell'

const dayLabel = (d: string) => new Date(d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
const time = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function Chat() {
  const [sp, setSp] = useSearchParams()
  const ref = sp.get('ref')
  const { session } = useAuth()
  const me = session?.user.id
  const qc = useQueryClient()
  const { openCandidate } = useShell()
  const chat = useChat(ref)
  const [body, setBody] = useState('')
  const [attach, setAttach] = useState<{ id: string; name: string } | null>(null)
  const [reply, setReply] = useState<ChatMsg | null>(null)
  const [picker, setPicker] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)
  const msgs = chat.data ?? []
  const byId = useMemo(() => new Map(msgs.map((m) => [m.id, m])), [msgs])

  // when viewing a candidate thread, new messages attach to that candidate by default
  useEffect(() => { if (ref) { const m = msgs.find((x) => x.candidate_id === ref); setAttach((a) => a?.id === ref ? a : { id: ref, name: m?.candidate_name ?? '' }) } else setAttach(null) }, [ref]) // eslint-disable-line
  const refCand = useCandidate(ref ?? undefined)
  useEffect(() => { if (ref && refCand.data) setAttach({ id: ref, name: refCand.data.full_name }) }, [ref, refCand.data])

  const read = () => { void supabase.rpc('mark_chat_read').then(() => qc.invalidateQueries({ queryKey: ['chat-unread'] })) }
  useEffect(() => { read() }, [msgs.length]) // eslint-disable-line
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [msgs.length, ref])

  const send = useRpc<{ p_body: string; p_candidate: string | null; p_reply_to: string | null }>('send_message', {
    invalidate: [['chat']], onDone: () => { setBody(''); setReply(null); if (!ref) setAttach(null) },
  })
  const submit = () => { if (body.trim()) send.mutate({ p_body: body, p_candidate: attach?.id ?? null, p_reply_to: reply?.id ?? null }) }

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-5 py-3">
          <MessageSquare className="h-5 w-5 text-brand-600" />
          <h1 className="text-base font-semibold text-slate-900">Team chat</h1>
          {ref ? (
            <button onClick={() => setSp({})} className="ml-2 flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">About {refCand.data?.full_name ?? 'candidate'} <X className="h-3 w-3" /></button>
          ) : <span className="text-xs text-slate-500">Everyone on the team · tag a candidate to keep context</span>}
        </div>
        <div className="min-h-0 flex-1 overflow-auto scroll-thin bg-slate-50 px-5 py-4">
          {chat.isLoading ? <Spinner /> : msgs.length === 0 ? (
            <div className="py-20 text-center text-sm text-slate-500">{ref ? 'No messages about this candidate yet.' : 'No messages yet — say hi 👋'}</div>
          ) : msgs.map((m, i) => {
            const prev = msgs[i - 1]
            const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()
            const grouped = !newDay && prev.author_id === m.author_id && !m.reply_to && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000
            const mine = m.author_id === me
            const parent = m.reply_to ? byId.get(m.reply_to) : null
            return (
              <div key={m.id}>
                {newDay && <div className="my-3 text-center text-[11px] font-medium text-slate-400">{dayLabel(m.created_at)}</div>}
                <div className={cx('group flex gap-2.5', grouped ? 'mt-0.5' : 'mt-3')}>
                  <div className="w-8 shrink-0">{!grouped && <Avatar name={m.author_name} size={8} />}</div>
                  <div className="min-w-0 flex-1">
                    {!grouped && <div className="flex items-baseline gap-2"><span className="text-sm font-semibold text-slate-900">{mine ? 'You' : m.author_name}</span><span className="text-[11px] text-slate-400" title={new Date(m.created_at).toLocaleString()}>{time(m.created_at)}</span></div>}
                    {parent && <div className="mb-0.5 truncate border-l-2 border-slate-300 pl-2 text-xs text-slate-500">↳ {parent.author_name}: {parent.body}</div>}
                    <div className="flex items-start gap-1">
                      <div className="whitespace-pre-wrap break-words text-sm text-slate-800">{m.body}</div>
                      <button title="Reply" onClick={() => setReply(m)} className="ml-1 rounded p-1 text-slate-300 opacity-0 hover:bg-slate-200 hover:text-slate-600 group-hover:opacity-100"><CornerUpLeft className="h-3.5 w-3.5" /></button>
                    </div>
                    {m.candidate_id && (
                      <div className="mt-1 flex items-center gap-1">
                        <button onClick={() => openCandidate(m.candidate_id!)} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"><Paperclip className="h-3 w-3" />{m.candidate_name ?? 'Candidate'}<ExternalLink className="h-3 w-3 opacity-60" /></button>
                        {!ref && <button onClick={() => setSp({ ref: m.candidate_id! })} className="text-[11px] text-slate-400 hover:text-brand-700">view thread</button>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottom} />
        </div>
        <div className="relative border-t border-slate-200 bg-white p-3">
          {picker && <CandidatePicker onPick={(c) => { setAttach(c); setPicker(false) }} onClose={() => setPicker(false)} />}
          {(reply || attach) && (
            <div className="mb-2 flex flex-wrap gap-2">
              {reply && <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600"><CornerUpLeft className="h-3 w-3" />Replying to {reply.author_name}<button onClick={() => setReply(null)}><X className="h-3 w-3" /></button></span>}
              {attach && <span className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700"><Paperclip className="h-3 w-3" />{attach.name || 'Candidate'}{!ref && <button onClick={() => setAttach(null)}><X className="h-3 w-3" /></button>}</span>}
            </div>
          )}
          <div className="flex items-end gap-2">
            <button title="Reference a candidate" onClick={() => setPicker((p) => !p)} className={cx('rounded-lg border p-2.5', attach ? 'border-brand-300 text-brand-600' : 'border-slate-300 text-slate-500 hover:bg-slate-50')}><Paperclip className="h-4 w-4" /></button>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={1} placeholder="Message the team…  (Enter to send, Shift+Enter for a new line)"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
            <Button onClick={submit} loading={send.isPending} disabled={!body.trim()}><Send className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
      {ref && <CandidatePanel id={ref} />}
    </div>
  )
}

function CandidatePicker({ onPick, onClose }: { onPick: (c: { id: string; name: string }) => void; onClose: () => void }) {
  const [q, setQ] = useState(''); const dq = useDebounced(q, 250)
  const res = useCandidateSearch({ q: dq, limit: 8 }, dq.trim().length > 1)
  return (
    <div className="absolute bottom-full left-3 z-20 mb-2 w-96 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
      <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && onClose()} placeholder="Search candidate to reference…" />
      <div className="mt-1 max-h-60 overflow-auto scroll-thin">
        {(res.data?.rows ?? []).map((c) => (
          <button key={c.id} onClick={() => onPick({ id: c.id, name: c.full_name })} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50">
            <Avatar name={c.full_name} size={7} /><div className="min-w-0"><div className="truncate text-sm text-slate-800">{c.full_name}</div><div className="truncate text-xs text-slate-500">{[c.current_position, c.current_organization].filter(Boolean).join(' · ')}</div></div>
          </button>
        ))}
        {dq.trim().length <= 1 && <div className="p-4 text-center text-xs text-slate-500">Type a name, skill or company</div>}
      </div>
    </div>
  )
}

function CandidatePanel({ id }: { id: string }) {
  const c = useCandidate(id)
  const { openCandidate } = useShell()
  if (!c.data) return <aside className="w-72 shrink-0 border-l border-slate-200 bg-white"><Spinner /></aside>
  const d = c.data
  return (
    <aside className="w-72 shrink-0 overflow-auto scroll-thin border-l border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3"><Avatar name={d.full_name} size={10} /><div className="min-w-0"><div className="flex items-center gap-1 text-sm font-semibold text-slate-900"><span className="truncate">{d.full_name}</span><Verified email={d.email} phone={d.phone} /></div><div className="truncate text-xs text-slate-500">{[d.current_position, d.current_organization].filter(Boolean).join(' at ')}</div></div></div>
      <div className="mt-3 space-y-1.5 text-xs text-slate-600">
        <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400" />{d.email ?? <Badge tone="amber">no email</Badge>}</div>
        <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" />{d.phone ?? <Badge tone="amber">no phone</Badge>}</div>
        {place(d) && <div className="text-slate-500">{place(d)}</div>}
        {d.experience_years != null && <div>{d.experience_years} yrs experience</div>}
        {d.notice_period && <div>Notice: {d.notice_period}</div>}
      </div>
      {!!d.skills?.length && <div className="mt-3 flex flex-wrap gap-1">{d.skills.slice(0, 12).map((s) => <Badge key={s}>{s}</Badge>)}</div>}
      <div className="mt-2 text-[11px] text-slate-400">Updated {ago(d.rc_updated_at)}</div>
      <Button className="mt-4 w-full" variant="secondary" size="sm" onClick={() => openCandidate(id)}>Open full profile</Button>
    </aside>
  )
}
