import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { Briefcase, CheckSquare, CloudUpload, LayoutDashboard, LogOut, MessageSquare, Plus, RefreshCw, Search, Sparkles, Users, UserCog } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useCandidateSearch, useJobs, useDashboard, useChatUnread, useEnrichmentCounts } from '../lib/api'
import NotificationBell, { useRealtime } from './NotificationBell'
import { useDebounced, cx, place } from '../lib/util'
import { Avatar, Badge, Modal } from './ui'
import CandidateDrawer from './CandidateDrawer'
import CandidateForm from './CandidateForm'
import JobForm from './JobForm'
import TaskForm from './TaskForm'

interface Shell { newCandidate: () => void; newJob: () => void; newTask: (p?: { candidate_id?: string; job_id?: string }) => void; openCandidate: (id: string) => void; openPalette: () => void }
const ShellCtx = createContext<Shell>(null as unknown as Shell)
export const useShell = () => useContext(ShellCtx)

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, key: 'd' },
  { to: '/candidates', label: 'Candidates', icon: Users, key: 'c' },
  { to: '/jobs', label: 'Jobs', icon: Briefcase, key: 'j' },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare, key: 't' },
  { to: '/enrichment', label: 'Enrichment', icon: Sparkles, key: 'e' },
  { to: '/chat', label: 'Team chat', icon: MessageSquare, key: 'm' },
]

function typing(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t.isContentEditable
}

export default function Shell() {
  const { member, signOut, canWrite, isManager } = useAuth()
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [palette, setPalette] = useState(false)
  const [form, setForm] = useState<null | 'candidate' | 'job' | { task: { candidate_id?: string; job_id?: string } }>(null)
  const dash = useDashboard()
  useRealtime()
  const unreadChat = useChatUnread().data ?? 0
  const enr = useEnrichmentCounts().data
  const badge: Record<string, number> = { '/chat': unreadChat, '/enrichment': isManager ? (enr?.pending ?? 0) : (enr?.mine_open ?? 0) }
  const gPressed = useRef(0)

  const api: Shell = useMemo(() => ({
    newCandidate: () => canWrite && setForm('candidate'),
    newJob: () => canWrite && setForm('job'),
    newTask: (p = {}) => canWrite && setForm({ task: p }),
    openCandidate: (id) => { const n = new URLSearchParams(sp); n.set('c', id); setSp(n) },
    openPalette: () => setPalette(true),
  }), [canWrite, sp, setSp])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); return }
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'g') { gPressed.current = Date.now(); return }
      if (Date.now() - gPressed.current < 900) {
        const hit = nav.find((n) => n.key === e.key)
        if (hit) { navigate(hit.to); gPressed.current = 0; return }
      }
      if (e.key === '/') { e.preventDefault(); const el = document.querySelector<HTMLInputElement>('[data-search]'); el ? el.focus() : setPalette(true) }
      if (e.key === 'n' && canWrite) { e.preventDefault(); setForm('candidate') }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [navigate, canWrite])

  const openId = sp.get('c')
  const closeDrawer = () => { const n = new URLSearchParams(sp); n.delete('c'); setSp(n) }
  const pending = dash.data?.pending_push ?? 0

  return (
    <ShellCtx.Provider value={api}>
      <div className="flex h-full">
        <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="flex items-center gap-2 px-4 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">C</div>
            <div className="text-sm font-semibold leading-tight text-slate-900">Chiparama<div className="text-[11px] font-normal text-slate-500">Recruiting CRM</div></div>
          </div>
          <button onClick={() => setPalette(true)} className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-500 hover:border-slate-300">
            <Search className="h-3.5 w-3.5" /> Search anything <span className="ml-auto flex gap-0.5"><kbd>⌘</kbd><kbd>K</kbd></span>
          </button>
          <nav className="flex-1 space-y-0.5 px-3 py-2">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium', isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100')}>
                <n.icon className="h-4 w-4" />{n.label}{badge[n.to] > 0 ? <span className="ml-auto"><Badge tone="brand">{badge[n.to]}</Badge></span> : <span className="ml-auto hidden text-[10px] text-slate-400 lg:block">g {n.key}</span>}
              </NavLink>
            ))}
            {isManager && <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Admin</div>}
            {isManager && [{ to: '/team', label: 'Team', icon: UserCog }, { to: '/sync', label: 'Sync status', icon: RefreshCw }].map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cx('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium', isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100')}>
                <n.icon className="h-4 w-4" />{n.label}{n.to === '/sync' && pending > 0 && <span className="ml-auto"><Badge tone="amber">{pending}</Badge></span>}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-slate-200 p-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={member?.full_name || member?.email} size={8} />
              <div className="min-w-0 flex-1"><div className="truncate text-xs font-medium text-slate-800">{member?.full_name || member?.email}</div><div className="text-[11px] capitalize text-slate-500">{member?.role}</div></div>
              <button title="Sign out" onClick={signOut} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><LogOut className="h-4 w-4" /></button>
            </div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-end gap-2 border-b border-slate-200 bg-white px-6 py-2.5">
            {pending > 0 && isManager && <NavLink to="/sync" className="mr-auto flex items-center gap-1.5 text-xs text-amber-700"><CloudUpload className="h-3.5 w-3.5" />{pending} change{pending > 1 ? 's' : ''} waiting to sync to RecruitCRM</NavLink>}
            <NotificationBell />
            {canWrite && (
              <div className="flex gap-2">
                <button onClick={() => api.newTask()} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">+ Task</button>
                <button onClick={() => api.newJob()} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">+ Job</button>
                <button onClick={() => api.newCandidate()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-700"><Plus className="h-3.5 w-3.5" />Candidate <kbd className="border-brand-500 bg-brand-500 text-white">N</kbd></button>
              </div>
            )}
          </header>
          <main className="min-h-0 flex-1 overflow-auto scroll-thin"><Outlet /></main>
        </div>
      </div>

      <CandidateDrawer id={openId} onClose={closeDrawer} />
      <Modal open={form === 'candidate'} onClose={() => setForm(null)} title="New candidate" wide>
        <CandidateForm onDone={(id) => { setForm(null); id && api.openCandidate(id) }} />
      </Modal>
      <Modal open={form === 'job'} onClose={() => setForm(null)} title="New job" wide>
        <JobForm onDone={(id) => { setForm(null); id && navigate(`/jobs/${id}`) }} />
      </Modal>
      <Modal open={typeof form === 'object' && form !== null} onClose={() => setForm(null)} title="New task">
        {typeof form === 'object' && form !== null && <TaskForm preset={form.task} onDone={() => setForm(null)} />}
      </Modal>
      {palette && <Palette onClose={() => setPalette(false)} api={api} />}
    </ShellCtx.Provider>
  )
}

function Palette({ onClose, api }: { onClose: () => void; api: Shell }) {
  const navigate = useNavigate()
  const { canWrite } = useAuth()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const dq = useDebounced(q, 200)
  const cands = useCandidateSearch({ q: dq, limit: 6 }, dq.trim().length > 1)
  const jobs = useJobs()

  const items = useMemo(() => {
    const t = q.trim().toLowerCase()
    const acts = [
      ...nav.map((n) => ({ label: `Go to ${n.label}`, hint: `g ${n.key}`, run: () => navigate(n.to) })),
      ...(canWrite ? [
        { label: 'New candidate', hint: 'N', run: api.newCandidate }, { label: 'New job', hint: '', run: api.newJob }, { label: 'New task', hint: '', run: () => api.newTask() },
      ] : []),
    ].filter((a) => !t || a.label.toLowerCase().includes(t))
    const js = t.length > 1 ? (jobs.data ?? []).filter((j) => j.name.toLowerCase().includes(t)).slice(0, 5).map((j) => ({
      label: j.name, sub: [j.company_name, j.status].filter(Boolean).join(' · '), kind: 'Job', run: () => navigate(`/jobs/${j.id}`),
    })) : []
    const cs = (dq.trim().length > 1 ? cands.data?.rows ?? [] : []).map((c) => ({
      label: c.full_name, sub: [c.current_position, c.current_organization, place(c)].filter(Boolean).join(' · '), kind: 'Candidate', run: () => api.openCandidate(c.id),
    }))
    return [...cs, ...js, ...acts.map((a) => ({ ...a, kind: 'Action', sub: a.hint }))]
  }, [q, dq, cands.data, jobs.data, canWrite, api, navigate])

  useEffect(() => setI(0), [q])
  const go = (k: number) => { const it = items[k]; if (it) { onClose(); it.run() } }

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center bg-slate-900/40 p-4 pt-[12vh]" onMouseDown={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-200 px-4">
          <Search className="h-4 w-4 text-slate-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search candidates, jobs, or type a command…"
            className="w-full py-3.5 text-sm outline-none placeholder:text-slate-400"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(x + 1, items.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)) }
              if (e.key === 'Enter') go(i)
              if (e.key === 'Escape') onClose()
            }} />
        </div>
        <div className="max-h-[50vh] overflow-auto scroll-thin py-1">
          {items.length === 0 && <div className="px-4 py-8 text-center text-sm text-slate-500">{cands.isFetching ? 'Searching…' : 'No results'}</div>}
          {items.map((it, k) => (
            <button key={k} onMouseEnter={() => setI(k)} onClick={() => go(k)} className={cx('flex w-full items-center gap-3 px-4 py-2 text-left', k === i && 'bg-brand-50')}>
              <span className="w-[72px] shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{it.kind}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm text-slate-800">{it.label}</span>{it.sub && it.kind !== 'Action' && <span className="block truncate text-xs text-slate-500">{it.sub}</span>}</span>
              {it.kind === 'Action' && it.sub && <kbd>{it.sub}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
