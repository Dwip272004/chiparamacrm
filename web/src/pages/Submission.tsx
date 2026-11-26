import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Copy, Download, FileText, Mail, Plus, RotateCcw, Search, Send, Trash2, X } from 'lucide-react'
import { useCandidateSearch } from '../lib/api'
import { useDebounced, cx } from '../lib/util'
import { blankDraft, emailBody, emailSubject, resumeFileName, resumeHtml, template, TEMPLATES, type Draft, type Pair, type Template } from '../lib/submissions'
import { Button, Card, Empty, Input, Label, PageHeader, Segmented, Select, Textarea, useToast } from '../components/ui'

const Section = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
  <Card className="p-5"><div className="mb-4"><h3 className="text-sm font-semibold text-slate-900">{title}</h3>{hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}</div><div className="space-y-3.5">{children}</div></Card>
)
const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => <div><Label hint={hint}>{label}</Label>{children}</div>

export default function Submission() {
  const { id } = useParams(); const t = template(id)
  if (!t) return <div className="p-10 text-center text-slate-500">Template not found. <Link className="text-brand-600 hover:underline" to="/submissions/broadcom">Open Broadcom</Link></div>
  if (!t.ready) return (
    <div className="mx-auto max-w-3xl p-8"><PageHeader title={t.name} subtitle="Final candidate submission: email + resume" />
      <Empty icon={<Send className="h-6 w-6" />} title={`${t.company} template is coming soon`} hint="Send the sample email and resume attachment for Rivian and it will be added here, the same way as Broadcom." action={<Link to="/submissions/broadcom"><Button variant="secondary">Open Broadcom template</Button></Link>} /></div>
  )
  return <Form key={t.id} t={t} />
}

function Form({ t }: { t: Template }) {
  const toast = useToast(); const key = `submission:${t.id}`
  const [d, setD] = useState<Draft>(() => { try { return { ...blankDraft(t), ...JSON.parse(localStorage.getItem(key) ?? '{}') } } catch { return blankDraft(t) } })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(d)) }, [d, key])
  const [view, setView] = useState<'email' | 'resume'>('email')
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))
  const bind = (k: 'name' | 'degree' | 'phone' | 'email' | 'availability' | 'role' | 'roleLocation' | 'to' | 'greeting' | 'interviewingNote' | 'onsiteNote' | 'workStatus' | 'education') => ({ value: d[k], onChange: (e: { target: { value: string } }) => set(k, e.target.value) })

  const body = emailBody(t, d); const subject = emailSubject(t, d)
  const missing = [!d.name.trim() && 'candidate name', !d.role.trim() && 'role', !d.emailSummary.trim() && 'email summary', !d.workStatus.trim() && 'work status'].filter(Boolean) as string[]

  const copy = (text: string, what: string) => { void navigator.clipboard.writeText(text); toast(`Copied ${what}`) }
  const printRef = useRef<HTMLIFrameElement | null>(null)
  const download = () => {
    if (!d.name.trim()) { toast('Add the candidate name first', 'err'); return }
    printRef.current?.remove()
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'; f.srcdoc = resumeHtml(d, true)
    f.onload = () => { const w = f.contentWindow!; w.document.title = resumeFileName(d); w.focus(); w.print() }
    document.body.appendChild(f); printRef.current = f
    toast('Choose “Save as PDF” in the print dialog')
  }
  const mailto = `mailto:${encodeURIComponent(d.to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  const reset = () => { if (confirm('Clear this submission and start a new one?')) setD(blankDraft(t)) }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200/80 bg-white px-8 py-5">
        <PageHeader title={t.name} subtitle="Fill the details once. The email and the resume file are both built from them." actions={<>
          <Button variant="ghost" onClick={reset}><RotateCcw className="h-3.5 w-3.5" />New submission</Button>
          <Button variant="secondary" onClick={() => copy(body, 'email')}><Copy className="h-3.5 w-3.5" />Copy email</Button>
          <a href={mailto}><Button variant="secondary" type="button"><Mail className="h-3.5 w-3.5" />Open in mail app</Button></a>
          <Button onClick={download}><Download className="h-3.5 w-3.5" />Download resume PDF</Button></>} />
        <div className="-mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          {TEMPLATES.map((x) => <Link key={x.id} to={`/submissions/${x.id}`} className={cx('rounded-full px-2.5 py-1 font-medium', x.id === t.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-100')}>{x.company}{!x.ready && ' · soon'}</Link>)}
          {!!missing.length && <span className="ml-3 text-amber-600">Still needed: {missing.join(', ')}</span>}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-auto p-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:overflow-hidden">
        <div className="space-y-5 xl:overflow-auto xl:pr-2 scroll-thin">
          <Section title="Candidate & role" hint="Used in both the email and the resume">
            <Pick onPick={(c) => setD((x) => ({ ...x, name: c.full_name ?? x.name, phone: c.phone ?? x.phone, email: c.email ?? x.email }))} />
            <div className="grid grid-cols-[1fr_120px] gap-3"><Field label="Candidate name"><Input {...bind('name')} placeholder="Satish Kumar Gupta" /></Field><Field label="Degree" hint="optional"><Input {...bind('degree')} placeholder="M.Tech" /></Field></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Phone"><Input {...bind('phone')} placeholder="(+1) 000-000-0000" /></Field><Field label="Email"><Input {...bind('email')} placeholder="name@example.com" /></Field></div>
            <Field label="Availability line" hint="shown under the contact line on the resume"><Input {...bind('availability')} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label={`${t.company} role`}><Input {...bind('role')} placeholder="Sr Physical Verification Engineer" /></Field><Field label="Role location"><Input {...bind('roleLocation')} placeholder="San Jose, CA" /></Field></div>
          </Section>

          <Section title="Email" hint="The covering message sent with the resume">
            <div className="grid grid-cols-2 gap-3"><Field label="Send to" hint="optional, for Open in mail app"><Input {...bind('to')} placeholder="hiring.manager@example.com" /></Field><Field label="Greeting"><Input {...bind('greeting')} /></Field></div>
            <Field label="Summary" hint="the short paragraph in the email"><Textarea rows={7} value={d.emailSummary} onChange={(e) => set('emailSummary', e.target.value)} placeholder="12+ years at … in … with hands-on expertise in …" />
              {!!d.execSummary.trim() && !d.emailSummary.trim() && <button className="mt-1 text-xs font-medium text-brand-600 hover:underline" onClick={() => set('emailSummary', d.execSummary)}>Use the resume’s executive summary</button>}</Field>
            <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-inset ring-slate-200/70"><div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{t.short} checklist answers</div>
              <div className="space-y-3">
                <Field label="1. Currently being interviewed at BRCM?"><div className="flex gap-2"><Select className="!w-28" value={d.interviewing} onChange={(e) => set('interviewing', e.target.value as Draft['interviewing'])}><option>No</option><option>Yes</option></Select>{d.interviewing === 'Yes' && <Input {...bind('interviewingNote')} placeholder="Stage / team (optional)" />}</div></Field>
                <Field label="2. 5 days from office, no remote work"><div className="flex gap-2"><Select className="!w-36" value={d.onsite} onChange={(e) => set('onsite', e.target.value as Draft['onsite'])}><option>Agreed</option><option>Not agreed</option></Select><Input {...bind('onsiteNote')} placeholder="Relocate to San Jose, CA – Immediate joiner" /></div></Field>
                <Field label="3. Status of employment" hint="sponsorship needed?"><Input {...bind('workStatus')} placeholder="I140 approved, H1B" /></Field>
              </div></div>
          </Section>

          <Section title="Resume · summary & skills" hint="Appears in the attached resume file">
            <Field label="Executive summary"><Textarea rows={7} {...{ value: d.execSummary, onChange: (e: { target: { value: string } }) => set('execSummary', e.target.value) }} /></Field>
            <Pairs title="Core technical competencies" rows={d.competencies} onChange={(v) => set('competencies', v)} labelPh="Physical Verification & Sign-Off" textPh="Full-chip DRC, LVS, ERC, Antenna, …" />
          </Section>

          <Section title="Resume · experience" hint="One bullet per line. Start a bullet with “Heading: …” to bold the heading.">
            {d.experience.map((j, i) => {
              const up = (patch: Partial<typeof j>) => set('experience', d.experience.map((x, k) => (k === i ? { ...x, ...patch } : x)))
              return (
                <div key={i} className="rounded-xl border border-slate-200/80 p-3.5">
                  <div className="grid grid-cols-2 gap-2.5"><Input value={j.company} onChange={(e) => up({ company: e.target.value })} placeholder="Company" /><Input value={j.location} onChange={(e) => up({ location: e.target.value })} placeholder="City, Country" /><Input value={j.title} onChange={(e) => up({ title: e.target.value })} placeholder="Title" /><Input value={j.dates} onChange={(e) => up({ dates: e.target.value })} placeholder="Apr 2022 – current" /></div>
                  <Textarea className="mt-2.5" rows={5} value={j.bullets} onChange={(e) => up({ bullets: e.target.value })} placeholder={'Signoff baseline: owned the centralized …\nLVS debug: resolved port-recognition failures …'} />
                  {d.experience.length > 1 && <button onClick={() => set('experience', d.experience.filter((_, k) => k !== i))} className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600"><Trash2 className="h-3 w-3" />Remove this role</button>}
                </div>)
            })}
            <Button variant="soft" size="sm" onClick={() => set('experience', [...d.experience, { company: '', location: '', title: '', dates: '', bullets: '' }])}><Plus className="h-3.5 w-3.5" />Add role</Button>
          </Section>

          <Section title="Resume · education & awards">
            <Field label="Education" hint="one per line"><Textarea rows={3} {...bind('education')} placeholder="M.Tech in Microelectronics, BITS Pilani, India (2015–2017) | CGPA: 8.05/10" /></Field>
            <Pairs title="Publications & awards" rows={d.awards} onChange={(v) => set('awards', v)} labelPh="Awards" textPh="…" />
          </Section>
        </div>

        <div className="flex min-h-[560px] flex-col xl:min-h-0">
          <div className="mb-3 flex items-center justify-between"><Segmented value={view} onChange={setView} options={[{ value: 'email', label: <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />Email</span> }, { value: 'resume', label: <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Resume file</span> }]} />
            <span className="text-xs text-slate-400">{view === 'email' ? 'Preview of the message' : `${resumeFileName(d)}.pdf`}</span></div>
          {view === 'email' ? (
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-3 text-sm"><span className="text-slate-400">Subject </span><span className="font-medium text-slate-800">{subject}</span><button onClick={() => copy(subject, 'subject')} className="ml-2 align-middle text-slate-300 hover:text-slate-600" title="Copy subject"><Copy className="inline h-3.5 w-3.5" /></button></div>
              <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-5 font-sans text-sm leading-relaxed text-slate-800 scroll-thin">{body}</pre>
              <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500"><FileText className="h-3.5 w-3.5 text-slate-400" />Attach: <b className="font-medium text-slate-700">{resumeFileName(d)}.pdf</b> (use Download resume PDF)</div>
            </Card>
          ) : <ResumePreview d={d} />}
        </div>
      </div>
    </div>
  )
}

function ResumePreview({ d }: { d: Draft }) {
  const ref = useRef<HTMLIFrameElement>(null); const [h, setH] = useState(1100)
  const fit = () => { const b = ref.current?.contentDocument?.body; if (b) setH(Math.max(1056, b.scrollHeight + 90)) }
  return (
    <Card className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4 scroll-thin"><div className="mx-auto w-[816px] max-w-full origin-top bg-white shadow-card" style={{ zoom: 0.8 }}>
      <iframe ref={ref} title="Resume preview" onLoad={fit} srcDoc={resumeHtml(d)} className="block w-[816px] border-0" style={{ height: h }} /></div></Card>
  )
}

function Pairs({ title, rows, onChange, labelPh, textPh }: { title: string; rows: Pair[]; onChange: (r: Pair[]) => void; labelPh: string; textPh: string }) {
  return (
    <div><Label>{title}</Label><div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-start gap-2"><Input className="!w-44 shrink-0" value={r.label} onChange={(e) => onChange(rows.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} placeholder={labelPh} />
          <Textarea rows={2} value={r.text} onChange={(e) => onChange(rows.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} placeholder={textPh} />
          <button onClick={() => onChange(rows.filter((_, k) => k !== i))} title="Remove" className="mt-2 rounded-md p-1 text-slate-300 hover:bg-slate-100 hover:text-red-600"><X className="h-4 w-4" /></button></div>))}
      <Button variant="soft" size="sm" onClick={() => onChange([...rows, { label: '', text: '' }])}><Plus className="h-3.5 w-3.5" />Add row</Button></div></div>
  )
}

function Pick({ onPick }: { onPick: (c: { full_name: string | null; phone: string | null; email: string | null }) => void }) {
  const [q, setQ] = useState(''); const dq = useDebounced(q, 250)
  const res = useCandidateSearch({ q: dq, limit: 6 }, dq.trim().length > 1)
  return (
    <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Fill from a candidate in the CRM (optional) – search by name, email, phone…" />
      {dq.trim().length > 1 && q && !!res.data?.rows.length && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop">
          {res.data.rows.map((c) => <button key={c.id} onClick={() => { onPick(c); setQ('') }} className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm hover:bg-slate-50"><span className="font-medium text-slate-800">{c.full_name}</span><span className="truncate text-xs text-slate-500">{c.current_position}{c.current_organization ? ` · ${c.current_organization}` : ''}</span></button>)}
        </div>)}
    </div>
  )
}
