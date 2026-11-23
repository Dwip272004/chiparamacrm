import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { Briefcase, CheckSquare, Phone, CloudUpload, LayoutDashboard, LogOut, MessageSquare, Moon, PanelLeftClose, PanelLeftOpen, Plus, RefreshCw, Search, Sparkles, Sun, Users, UserCog, ChevronsUpDown } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useCandidateSearch, useJobs, useDashboard, useChatUnread, useEnrichmentCounts } from '../lib/api'
import NotificationBell, { useRealtime } from './NotificationBell'
import { useDebounced, cx, place } from '../lib/util'
import { Avatar, Badge, Button, Menu, MenuItem, Modal } from './ui'
import { useTheme } from '../lib/theme'
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
  { to: '/calling', label: 'Calling', icon: Phone, key: 'p' },
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
  const theme = useTheme()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('nav') === '1')
  useEffect(() => { localStorage.setItem('nav', collapsed ? '1' : '0') }, [collapsed])

  const NavItem = ({ to, label, icon: Icon, end, k, count }: { to: string; label: string; icon: typeof Users; end?: boolean; k?: string; count?: number }) => (
    <NavLink to={to} end={end} title={collapsed ? label : undefined}
      className={({ isActive }) => cx('group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition', collapsed && 'justify-center px-0',
        isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}>
      {({ isActive }) => (<>
        {isActive && <i className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-brand-600" />}
        <Icon className={cx('h-[18px] w-[18px] shrink-0', isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600')} />
        {!collapsed && <span className="flex-1 truncate">{label}</span>}
        {!collapsed && (count ? <span className="rounded-full bg-brand-600 px-1.5 py-px text-[10px] font-semibold tabular-nums text-white">{count}</span>
          : k && <span className="hidden text-[10px] text-slate-300 opacity-0 transition group-hover:opacity-100 lg:block">g {k}</span>)}
        {collapsed && count ? <i className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white" /> : null}
      </>)}
    </NavLink>
  )
  const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-4"><div className={cx('px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400', collapsed && 'sr-only')}>{title}</div><div className="space-y-0.5">{children}</div></div>
  )
  const item = (n: (typeof nav)[number]) => <NavItem key={n.to} to={n.to} label={n.label} icon={n.icon} end={n.end} k={n.key} count={badge[n.to]} />

  return (
    <ShellCtx.Provider value={api}>
      <div className="flex h-full">
        <aside className={cx('flex shrink-0 flex-col border-r border-slate-200/80 bg-white transition-[width] duration-200', collapsed ? 'w-[68px]' : 'w-[244px]')}>
          <div className={cx('flex h-14 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand-500 to-violet-600 text-sm font-bold text-white shadow-[0_2px_6px_rgb(79_70_229/.35)]">C</div>
            {!collapsed && <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-sm font-semibold tracking-tight text-slate-900">Chiparama</div><div className="text-[11px] text-slate-500">Recruiting CRM</div></div>}
            {!collapsed && <button onClick={() => setCollapsed(true)} title="Collapse sidebar" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><PanelLeftClose className="h-4 w-4" /></button>}
          </div>
          <nav className={cx('flex-1 overflow-y-auto scroll-thin px-3 pb-3 pt-2', collapsed && 'px-2')}>
            <Group title="Workspace">{nav.slice(0, 5).map(item)}</Group>
            <Group title="Collaborate">{nav.slice(5).map(item)}</Group>
            {isManager && <Group title="Admin"><NavItem to="/team" label="Team" icon={UserCog} /><NavItem to="/sync" label="Sync status" icon={RefreshCw} count={pending} /></Group>}
          </nav>
          {collapsed && <button onClick={() => setCollapsed(false)} title="Expand sidebar" className="mx-auto mb-2 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><PanelLeftOpen className="h-4 w-4" /></button>}
          <div className="border-t border-slate-200/80 p-3">
            <Menu up align="left" width="w-60" trigger={(_o, toggle) => (
              <button onClick={toggle} className={cx('flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-slate-100', collapsed && 'justify-center')}>
                <Avatar name={member?.full_name || member?.email} size={8} />
                {!collapsed && <><div className="min-w-0 flex-1 leading-tight"><div className="truncate text-[13px] font-medium text-slate-900">{member?.full_name || member?.email}</div><div className="text-[11px] capitalize text-slate-500">{member?.role}</div></div><ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" /></>}
              </button>)}>
              {(close) => (<>
                <div className="px-2.5 pb-2 pt-1 text-xs text-slate-500">{member?.email}</div>
                <MenuItem icon={theme.dark ? <Sun /> : <Moon />} onClick={() => { theme.toggle(); close() }}>{theme.dark ? 'Light mode' : 'Dark mode'}</MenuItem>
                <MenuItem icon={<LogOut />} danger onClick={signOut}>Sign out</MenuItem>
              </>)}
            </Menu>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur">
            <button onClick={() => setPalette(true)} className="flex h-9 w-full max-w-md items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-sm text-slate-400 transition hover:border-slate-300 hover:bg-white">
              <Search className="h-4 w-4" /><span className="flex-1">Search candidates, jobs, commands…</span><span className="flex gap-0.5"><kbd>⌘</kbd><kbd>K</kbd></span>
            </button>
            <div className="ml-auto flex items-center gap-2">
              {pending > 0 && isManager && <NavLink to="/sync" className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200 md:flex"><CloudUpload className="h-3.5 w-3.5" />{pending} waiting to sync</NavLink>}
              {canWrite && (
                <Menu width="w-60" trigger={(_o, toggle) => <Button onClick={toggle}><Plus className="h-4 w-4" />New</Button>}>
                  {(close) => (<>
                    <MenuItem icon={<Users />} hint="N" onClick={() => { close(); api.newCandidate() }}>Candidate</MenuItem>
                    <MenuItem icon={<Briefcase />} onClick={() => { close(); api.newJob() }}>Job</MenuItem>
                    <MenuItem icon={<CheckSquare />} onClick={() => { close(); api.newTask() }}>Task</MenuItem>
                  </>)}
                </Menu>
              )}
              <NotificationBell />
              <button onClick={theme.toggle} title={theme.dark ? 'Light mode' : 'Dark mode'} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">{theme.dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}</button>
            </div>
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
