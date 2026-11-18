import { useEffect, useRef, useState } from 'react'
import { Bell, Check, MessageSquare, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useNotifications, useRpc, type Notif } from '../lib/api'
import { ago, cx } from '../lib/util'
import { useToast } from './ui'

// One realtime channel for the whole app: keeps notifications, chat, enrichment live.
export function useRealtime() {
  const { session } = useAuth(); const qc = useQueryClient(); const toast = useToast(); const uid = session?.user.id
  useEffect(() => {
    if (!uid) return
    const ch = supabase.channel('crm-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'crm', table: 'notifications', filter: `user_id=eq.${uid}` }, (p) => {
        qc.invalidateQueries({ queryKey: ['notifs'] }); qc.invalidateQueries({ queryKey: ['enrich'] }); qc.invalidateQueries({ queryKey: ['enrich-counts'] }); qc.invalidateQueries({ queryKey: ['cand-enrich'] })
        toast((p.new as Notif).title)
      })
      .on('postgres_changes', { event: '*', schema: 'crm', table: 'enrichment_requests' }, () => {
        qc.invalidateQueries({ queryKey: ['enrich'] }); qc.invalidateQueries({ queryKey: ['enrich-counts'] }); qc.invalidateQueries({ queryKey: ['cand-enrich'] }); qc.invalidateQueries({ queryKey: ['enrich-events'] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'crm', table: 'chat_messages' }, () => {
        qc.invalidateQueries({ queryKey: ['chat'] }); qc.invalidateQueries({ queryKey: ['chat-unread'] })
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [uid, qc, toast])
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const q = useNotifications()
  const mark = useRpc<{ p_ids: string[] | null }>('mark_notifications_read', { invalidate: [['notifs']] })
  const list = q.data ?? []
  const unread = list.filter((n) => !n.is_read).length
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  const go = (n: Notif) => { if (!n.is_read) mark.mutate({ p_ids: [n.id] }); setOpen(false); if (n.link) navigate(n.link) }
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Notifications">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5"><span className="text-sm font-semibold text-slate-800">Notifications</span>
            {unread > 0 && <button onClick={() => mark.mutate({ p_ids: null })} className="flex items-center gap-1 text-xs text-brand-600 hover:underline"><Check className="h-3 w-3" />Mark all read</button>}</div>
          <div className="max-h-96 overflow-auto scroll-thin">
            {list.length === 0 && <div className="px-4 py-10 text-center text-sm text-slate-500">You're all caught up</div>}
            {list.map((n) => (
              <button key={n.id} onClick={() => go(n)} className={cx('flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50', !n.is_read && 'bg-brand-50/50')}>
                <div className="mt-0.5 text-brand-600">{n.kind.startsWith('chat') ? <MessageSquare className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}</div>
                <div className="min-w-0 flex-1"><div className="text-sm font-medium text-slate-800">{n.title}</div>{n.body && <div className="text-xs text-slate-500">{n.body}</div>}<div className="mt-0.5 text-[11px] text-slate-400">{ago(n.created_at)}</div></div>
                {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
