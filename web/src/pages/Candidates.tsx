import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, FileText, Mail, MapPin, Phone, Plus, Search, SlidersHorizontal, Users, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useCandidateSearch } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ago, cx, place, useDebounced } from '../lib/util'
import { Avatar, Badge, Button, Card, Empty, Input, PageHeader, Spinner, SyncBadge, Verified } from '../components/ui'
import { useShell } from '../components/Shell'
import { PickJobModal } from '../components/AssignModal'

const PAGE = 50

export default function Candidates() {
  const shell = useShell(); const { canWrite } = useAuth()
  const [sp] = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? ''); const [city, setCity] = useState(sp.get('city') ?? ''); const [skill, setSkill] = useState(sp.get('skill') ?? '')
  // exact drill-down filters (from dashboard clicks): shown as removable chips
  const [stage, setStage] = useState(sp.get('stage') ?? ''); const [locExact, setLocExact] = useState(sp.get('place') ?? ''); const [skillExact, setSkillExact] = useState(sp.get('skillx') ?? '')
  useEffect(() => { setQ(sp.get('q') ?? ''); setCity(sp.get('city') ?? ''); setSkill(sp.get('skill') ?? ''); setStage(sp.get('stage') ?? ''); setLocExact(sp.get('place') ?? ''); setSkillExact(sp.get('skillx') ?? '') }, [sp])
  const [contact, setContact] = useState(''); const [hasEmail, setHasEmail] = useState(''); const [hasPhone, setHasPhone] = useState(''); const [hasSkills, setHasSkills] = useState(''); const [hasResume, setHasResume] = useState(''); const [hasLinkedin, setHasLinkedin] = useState('')
  const [page, setPage] = useState(0); const [sel, setSel] = useState<Set<string>>(new Set()); const [cursor, setCursor] = useState(-1)
  const [pick, setPick] = useState(false); const [more, setMore] = useState(false)
  const dq = useDebounced(q, 250), dc = useDebounced(city, 300), ds = useDebounced(skill, 300)
  useEffect(() => { setPage(0); setCursor(-1) }, [dq, dc, ds, contact, hasEmail, hasPhone, hasSkills, hasResume, hasLinkedin, stage, locExact, skillExact])
  const res = useCandidateSearch({ q: dq, city: dc, skill: ds, contact, hasEmail, hasPhone, hasSkills, hasResume, hasLinkedin, stage, place: locExact, skillExact, limit: PAGE, offset: page * PAGE })
  const filtered = !!(dq || dc || ds || stage || locExact || skillExact || contact || hasEmail || hasPhone || hasSkills || hasResume || hasLinkedin)
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

  const activeMore = [hasEmail, hasPhone, hasSkills, hasResume, hasLinkedin].filter(Boolean).length
  const clearAll = () => { setQ(''); setCity(''); setSkill(''); setContact(''); setHasEmail(''); setHasPhone(''); setHasSkills(''); setHasResume(''); setHasLinkedin(''); setStage(''); setLocExact(''); setSkillExact('') }
  const Dot = ({ on, icon: Icon, label }: { on: boolean; icon: typeof Mail; label: string }) => (
    <span title={`${label}: ${on ? 'yes' : 'missing'}`} className={cx('flex h-6 w-6 items-center justify-center rounded-md', on ? 'bg-brand-50 text-brand-600' : 'bg-slate-50 text-slate-300')}><Icon className="h-3.5 w-3.5" /></span>
  )

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-7">
      <PageHeader title="Candidates" subtitle={res.isLoading ? 'Loading…' : <><b className="font-semibold text-slate-700">{total.toLocaleString()}</b> {filtered ? 'matching your filters' : 'people in your database'}</>}
        actions={canWrite && <Button onClick={shell.newCandidate}><Plus className="h-4 w-4" />New candidate</Button>} />

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[280px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input data-search autoFocus className="h-10 pl-9 pr-16" placeholder="Search name, email, phone, title, company, skill…" value={q} onChange={(e) => setQ(e.target.value)} />
            {q ? <button onClick={() => setQ('')} className="absolute right-2.5 top-2.5 rounded p-0.5 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button> : <kbd className="absolute right-3 top-2.5">/</kbd>}</div>
          <div className="relative w-52"><MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="h-10 pl-9" placeholder="Location" title="Several locations separated by commas: must match all" value={city} onChange={(e) => setCity(e.target.value)} /></div>
          <Input className="!h-10 !w-52" placeholder="Skills (a, b = both)" title="Separate several skills with commas: candidates must have all of them" value={skill} onChange={(e) => setSkill(e.target.value)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
            {([
              ['All', !contact && !hasEmail && !hasPhone, () => { setContact(''); setHasEmail(''); setHasPhone('') }, null],
              ['Verified', !contact && hasEmail === 'with' && hasPhone === 'with', () => { setContact(''); setHasEmail('with'); setHasPhone('with') }, <Verified key="v" email="x" phone="x" />],
              ['Partial', contact === 'partial', () => { setContact('partial'); setHasEmail(''); setHasPhone('') }, <Verified key="p" email="x" />],
              ['No contact', !contact && hasEmail === 'without' && hasPhone === 'without', () => { setContact(''); setHasEmail('without'); setHasPhone('without') }, null],
            ] as const).map(([l, on, run, icon]) => (
              <button key={l} onClick={run} className={cx('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition', on ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500 hover:text-slate-800')}>{icon}{l}</button>))}
          </div>
          <button onClick={() => setMore(!more)} className={cx('inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition', more || activeMore ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
            <SlidersHorizontal className="h-3.5 w-3.5" />More filters{activeMore > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">{activeMore}</span>}</button>
          {!!(stage || locExact || skillExact) && ([['In stage', stage, setStage], ['Location', locExact, setLocExact], ['Skill', skillExact, setSkillExact]] as const).filter(([, v]) => v).map(([l, v, set]) => (
            <span key={l} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 pl-3 pr-1.5 text-[13px] font-medium text-white">{l}: <b className="font-semibold capitalize">{v}</b>
              <button onClick={() => set('')} title="Remove filter" className="rounded p-1 hover:bg-white/20"><X className="h-3 w-3" /></button></span>))}
          {filtered && <button onClick={clearAll} className="ml-auto text-[13px] font-medium text-brand-600 hover:underline">Clear all</button>}
        </div>
        {(more || activeMore > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {([['Email', hasEmail, setHasEmail], ['Phone', hasPhone, setHasPhone], ['Skills', hasSkills, setHasSkills], ['Resume', hasResume, setHasResume], ['LinkedIn', hasLinkedin, setHasLinkedin]] as const).map(([label, val, set]) => (
              <select key={label} value={val} onChange={(e) => { if (label === 'Email' || label === 'Phone') setContact(''); set(e.target.value) }} className={cx('h-8 rounded-lg border py-0 pl-3 pr-7 text-[13px] font-medium', val ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600')}>
                <option value="">{label}: any</option><option value="with">{label}: has</option><option value="without">{label}: missing</option>
              </select>))}
          </div>
        )}
      </Card>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-slate-200/80 bg-slate-50/95 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur">
              <th className="w-12 rounded-tl-xl px-4 py-3"><input type="checkbox" checked={allOnPage} onChange={() => setSel(allOnPage ? new Set() : new Set(rows.map((r) => r.id)))} className="h-4 w-4 rounded accent-[#4f46e5]" /></th>
              <th className="py-3">Candidate</th><th>Current role</th><th>Location</th><th>Skills</th><th>Contact</th><th className="rounded-tr-xl pr-5 text-right">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={c.id} onClick={() => shell.openCandidate(c.id)}
                className={cx('group cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-brand-50/40', sel.has(c.id) && 'bg-brand-50/60', cursor === i && 'bg-brand-50/60 outline outline-1 -outline-offset-1 outline-brand-500/40')}>
                <td className="px-4" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 rounded accent-[#4f46e5]" /></td>
                <td className="py-3 pr-4"><div className="flex items-center gap-3"><Avatar name={c.full_name} size={9} />
                  <div className="min-w-0"><div className="flex items-center gap-1.5 font-semibold text-slate-900">{c.full_name || 'Unnamed'}<Verified email={c.email} phone={c.phone} /><SyncBadge status={c.sync_status} />{c.off_limit && <Badge tone="red">Off limit</Badge>}</div>
                    <div className="truncate text-xs text-slate-500">{c.email || c.phone || <span className="text-slate-400">No contact details</span>}</div></div></div></td>
                <td className="max-w-[220px] pr-4"><div className="truncate font-medium text-slate-700">{c.current_position || '—'}</div><div className="truncate text-xs text-slate-500">{c.current_organization}</div></td>
                <td className="pr-4 text-slate-600">{place(c) || '—'}</td>
                <td className="max-w-[240px] pr-4"><div className="flex flex-wrap gap-1">{c.skills.slice(0, 3).map((s) => <Badge key={s}>{s}</Badge>)}{c.skills.length > 3 && <span className="self-center text-xs text-slate-400">+{c.skills.length - 3}</span>}{!c.skills.length && <span className="text-xs text-slate-300">No skills</span>}</div></td>
                <td className="pr-4"><div className="flex gap-1"><Dot on={!!c.email} icon={Mail} label="Email" /><Dot on={!!c.phone} icon={Phone} label="Phone" /><Dot on={!!c.has_resume} icon={FileText} label="Resume" /></div></td>
                <td className="whitespace-nowrap pr-5 text-right text-xs text-slate-500">{ago(c.rc_updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {res.isLoading && <Spinner />}
        {!res.isLoading && !rows.length && <Empty icon={<Users />} title="No candidates found" hint="Try fewer words, or clear some filters." action={filtered ? <Button variant="secondary" size="sm" onClick={clearAll}>Clear all filters</Button> : undefined} />}
        {total > PAGE && (
          <div className="flex items-center justify-between rounded-b-xl border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-sm text-slate-600">
            <span>Showing <b className="font-semibold text-slate-800">{page * PAGE + 1}–{Math.min((page + 1) * PAGE, total)}</b> of {total.toLocaleString()}</span>
            <div className="flex gap-1.5"><Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" />Prev</Button>
              <Button size="sm" variant="secondary" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>Next<ChevronRight className="h-4 w-4" /></Button></div>
          </div>
        )}
      </Card>
      <div className="mt-4 text-center text-[11px] text-slate-400"><kbd>j</kbd> <kbd>k</kbd> move · <kbd>Enter</kbd> open · <kbd>x</kbd> select · <kbd>/</kbd> search · <kbd>N</kbd> new</div>

      {sel.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 animate-pop items-center gap-3 rounded-2xl bg-slate-900 py-2.5 pl-5 pr-3 text-sm text-slate-50 shadow-pop dark:bg-slate-200 dark:text-slate-900">
          <span><b className="font-semibold">{sel.size}</b> selected</span>
          {canWrite && <Button size="sm" onClick={() => setPick(true)}>Add to job…</Button>}
          <button className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10" title="Clear selection" onClick={() => setSel(new Set())}><X className="h-4 w-4" /></button>
        </div>
      )}
      {pick && <PickJobModal candidateIds={[...sel]} onClose={() => setPick(false)} onDone={() => setSel(new Set())} />}
    </div>
  )
}
