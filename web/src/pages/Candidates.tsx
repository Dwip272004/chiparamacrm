import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Search, Users } from 'lucide-react'
import { useCandidateSearch } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ago, cx, place, useDebounced } from '../lib/util'
import { Avatar, Badge, Button, Empty, Input, Spinner, SyncBadge } from '../components/ui'
import { useShell } from '../components/Shell'
import { PickJobModal } from '../components/AssignModal'

const PAGE = 50

export default function Candidates() {
  const shell = useShell(); const { canWrite } = useAuth()
  const [q, setQ] = useState(''); const [city, setCity] = useState(''); const [skill, setSkill] = useState('')
  const [page, setPage] = useState(0); const [sel, setSel] = useState<Set<string>>(new Set()); const [cursor, setCursor] = useState(-1)
  const [pick, setPick] = useState(false)
  const dq = useDebounced(q, 250), dc = useDebounced(city, 300), ds = useDebounced(skill, 300)
  useEffect(() => { setPage(0); setCursor(-1) }, [dq, dc, ds])
  const res = useCandidateSearch({ q: dq, city: dc, skill: ds, limit: PAGE, offset: page * PAGE })
  const rows = res.data?.rows ?? []; const total = res.data?.total ?? 0

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || e.metaKey || e.ctrlKey) return
      if (e.key === 'j') setCursor((c) => Math.min(c + 1, rows.length - 1))
      if (e.key === 'k') setCursor((c) => Math.max(c - 1, 0))
      if (e.key === 'Enter' && cursor >= 0 && rows[cursor]) shell.openCandidate(rows[cursor].id)
      if (e.key === 'x' && cursor >= 0 && rows[cursor]) toggle(rows[cursor].id)
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  })
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allOnPage = rows.length > 0 && rows.every((r) => sel.has(r.id))

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-4 flex items-end justify-between">
        <div><h1 className="text-xl font-semibold text-slate-900">Candidates</h1><p className="text-sm text-slate-500">{res.isLoading ? 'Loading…' : `${total.toLocaleString()} ${dq || dc || ds ? 'matching' : 'in your database'}`}</p></div>
        {canWrite && <Button onClick={shell.newCandidate}><Plus className="h-4 w-4" />New candidate</Button>}
      </div>

      <div className="mb-3 flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input data-search autoFocus className="pl-9" placeholder="Search name, email, phone, title, company, skill…   ( / )" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Input className="!w-44" placeholder="Location" value={city} onChange={(e) => setCity(e.target.value)} />
        <Input className="!w-40" placeholder="Skill" value={skill} onChange={(e) => setSkill(e.target.value)} />
      </div>

      {sel.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white shadow">
          <b>{sel.size} selected</b>
          {canWrite && <Button size="sm" variant="secondary" onClick={() => setPick(true)}>Add to job…</Button>}
          <button className="ml-auto text-xs underline" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-4 py-2.5"><input type="checkbox" checked={allOnPage} onChange={() => setSel(allOnPage ? new Set() : new Set(rows.map((r) => r.id)))} className="h-4 w-4 rounded accent-[#4f46e5]" /></th>
              <th className="py-2.5">Candidate</th><th>Current role</th><th>Location</th><th>Skills</th><th className="pr-4 text-right">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={c.id} onClick={() => shell.openCandidate(c.id)}
                className={cx('cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50', cursor === i && 'bg-brand-50/60 outline outline-1 -outline-offset-1 outline-brand-500/40')}>
                <td className="px-4" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 rounded accent-[#4f46e5]" /></td>
                <td className="py-2.5"><div className="flex items-center gap-3"><Avatar name={c.full_name} />
                  <div className="min-w-0"><div className="flex items-center gap-1.5 font-medium text-slate-900">{c.full_name || 'Unnamed'}<SyncBadge status={c.sync_status} />{c.off_limit && <Badge tone="red">Off limit</Badge>}</div>
                    <div className="truncate text-xs text-slate-500">{c.email || c.phone || '—'}</div></div></div></td>
                <td className="max-w-[220px]"><div className="truncate text-slate-800">{c.current_position || '—'}</div><div className="truncate text-xs text-slate-500">{c.current_organization}</div></td>
                <td className="text-slate-600">{place(c) || '—'}</td>
                <td className="max-w-[220px]"><div className="flex flex-wrap gap-1">{c.skills.slice(0, 3).map((s) => <Badge key={s}>{s}</Badge>)}{c.skills.length > 3 && <span className="text-xs text-slate-400">+{c.skills.length - 3}</span>}</div></td>
                <td className="pr-4 text-right text-xs text-slate-500">{ago(c.rc_updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {res.isLoading && <Spinner />}
        {!res.isLoading && !rows.length && <Empty icon={<Users className="h-10 w-10" />} title="No candidates found" hint="Try fewer words, or clear the location and skill filters." />}
      </div>

      {total > PAGE && (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
          <span>{page * PAGE + 1}–{Math.min((page + 1) * PAGE, total)} of {total.toLocaleString()}</span>
          <div className="flex gap-1"><Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" />Prev</Button>
            <Button size="sm" variant="secondary" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>Next<ChevronRight className="h-4 w-4" /></Button></div>
        </div>
      )}
      <div className="mt-4 text-center text-[11px] text-slate-400"><kbd>j</kbd> <kbd>k</kbd> move · <kbd>Enter</kbd> open · <kbd>x</kbd> select · <kbd>/</kbd> search · <kbd>N</kbd> new</div>
      {pick && <PickJobModal candidateIds={[...sel]} onClose={() => setPick(false)} onDone={() => setSel(new Set())} />}
    </div>
  )
}
