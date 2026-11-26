import logo from '../assets/chiparama-logo.png?inline'
// Final candidate submission templates. A submission = a covering EMAIL + the formatted RESUME file (PDF),
// both built from the same details, so the name / role / summary only have to be typed once.

export interface Pair { label: string; text: string }
export interface Job { company: string; location: string; title: string; dates: string; bullets: string } // bullets: one per line
export interface Draft {
  // used by BOTH the email and the resume
  name: string; degree: string; phone: string; email: string; availability: string
  role: string; roleLocation: string
  // email
  to: string; greeting: string; emailSummary: string
  interviewing: 'No' | 'Yes'; interviewingNote: string
  onsite: 'Agreed' | 'Not agreed'; onsiteNote: string
  workStatus: string
  // resume
  execSummary: string; competencies: Pair[]; experience: Job[]; education: string; awards: Pair[]
}

export const blankDraft = (t: Template): Draft => ({
  name: '', degree: '', phone: '', email: '', availability: 'Open for Relocation and Immediate Joiner',
  role: '', roleLocation: t.defaultRoleLocation,
  to: '', greeting: 'Hi Sir,', emailSummary: '',
  interviewing: 'No', interviewingNote: '',
  onsite: 'Agreed', onsiteNote: t.defaultOnsiteNote,
  workStatus: '',
  execSummary: '', competencies: [{ label: '', text: '' }, { label: '', text: '' }, { label: '', text: '' }],
  experience: [{ company: '', location: '', title: '', dates: '', bullets: '' }],
  education: '', awards: [{ label: 'Technical Publications', text: '' }, { label: 'Awards & Recognition', text: '' }],
})

export interface Template {
  id: string; name: string; company: string; short: string; ready: boolean
  defaultRoleLocation: string; defaultOnsiteNote: string
  checklist: (d: Draft) => string[]
}

export const TEMPLATES: Template[] = [
  {
    id: 'broadcom', name: 'Broadcom Submission', company: 'Broadcom', short: 'BRCM', ready: true,
    defaultRoleLocation: 'San Jose, CA', defaultOnsiteNote: 'Relocate to San Jose, CA – Immediate joiner',
    checklist: (d) => [
      `1. Currently being interviewed at BRCM: ${d.interviewing}${d.interviewing === 'Yes' && d.interviewingNote.trim() ? ` – ${d.interviewingNote.trim()}` : ''}`,
      `2. BRCM is 5 days working from office, no remote work entertained: ${d.onsite === 'Agreed' ? 'YES, Agreed' : 'NO, Not agreed'}${d.onsiteNote.trim() ? ` (${d.onsiteNote.trim()})` : ''}`,
      `3. Status of employment (like if sponsorship needed): ${d.workStatus.trim()}`,
    ],
  },
  { id: 'rivian', name: 'Rivian Submission', company: 'Rivian', short: 'Rivian', ready: false, defaultRoleLocation: '', defaultOnsiteNote: '', checklist: () => [] },
]
export const template = (id?: string) => TEMPLATES.find((t) => t.id === id)

const clean = (s: string) => s.trim()

export function emailSubject(t: Template, d: Draft) {
  return `${clean(d.name) || 'Candidate'} – ${t.company} ${clean(d.role) || 'role'}${d.roleLocation.trim() ? ` (${d.roleLocation.trim()})` : ''}`
}

export function emailBody(t: Template, d: Draft) {
  const where = d.roleLocation.trim() ? ` (${d.roleLocation.trim()})` : ''
  return [
    d.greeting.trim() || 'Hi Sir,',
    `Please find attached the resume of ${clean(d.name) || '[Candidate name]'} submitted for the ${t.company} ${clean(d.role) || '[Role]'} role${where}.`,
    `Summary: ${clean(d.emailSummary) || '[Summary]'}`,
    'Checklist Answers:\n\n' + t.checklist(d).join('\n'),
  ].join('\n')
}

export const resumeFileName = (d: Draft) => `${(clean(d.name) || 'Candidate').replace(/[^\w\-. ]+/g, '').trim()}_Chiparama`

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const lines = (s: string) => s.split('\n').map((l) => l.replace(/^\s*[•\-*]\s*/, '').trim()).filter(Boolean)
// "Heading: rest of the sentence" -> bold heading, like the Chiparama resume format
const lead = (l: string) => { const m = l.match(/^([^:]{2,70}):\s+(.*)$/); return m ? `<b>${esc(m[1])}:</b> ${esc(m[2])}` : esc(l) }

export function resumeHtml(d: Draft, forPrint = false) {
  const contact = [d.phone.trim(), d.email.trim()].filter(Boolean).map(esc).join(' | ')
  const sec = (title: string, body: string) => (body.trim() ? `<h2>${title}</h2>${body}` : '')
  const comp = d.competencies.filter((c) => c.text.trim()).map((c) => `<li>${c.label.trim() ? `<b>${esc(c.label.trim())}:</b> ` : ''}${esc(c.text.trim())}</li>`).join('')
  const exp = d.experience.filter((j) => j.company.trim() || j.title.trim() || j.bullets.trim()).map((j) => `
    <div class="job"><div class="row"><b>${esc(j.company.trim().toUpperCase())}</b><span>${esc(j.location.trim())}</span></div>
    <div class="row"><b><i>${esc(j.title.trim())}</i></b><span><b>${esc(j.dates.trim())}</b></span></div>
    <ul>${lines(j.bullets).map((l) => `<li>${lead(l)}</li>`).join('')}</ul></div>`).join('')
  const edu = lines(d.education).map((l) => `<li>${esc(l)}</li>`).join('')
  const aw = d.awards.filter((a) => a.text.trim()).map((a) => `<li>${a.label.trim() ? `<b>${esc(a.label.trim())}:</b> ` : ''}${esc(a.text.trim())}</li>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(resumeFileName(d))}</title><style>
  @page { size: Letter; margin: 0.55in 0.6in; }
  * { box-sizing: border-box; }
  body { font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 10pt; line-height: 1.28; color: #111; margin: ${forPrint ? '0' : '0.55in 0.6in'}; }
  body { position: relative; }
  .logo { position: absolute; top: -6pt; right: 42pt; width: 54pt; height: 54pt; object-fit: contain; }
  .name { text-align: center; font-size: 16pt; font-weight: 700; letter-spacing: .02em; }
  .sub { text-align: center; margin-top: 2px; }
  .sub i { display: block; margin-top: 1px; }
  h2 { font-size: 10.5pt; letter-spacing: .04em; margin: 11px 0 4px; padding-bottom: 2px; border-bottom: 1px solid #222; break-after: avoid; }
  p { margin: 0; text-align: justify; }
  ul { margin: 2px 0 0; padding-left: 16px; } li { margin: 1.5px 0; text-align: justify; }
  .job { margin-bottom: 7px; break-inside: avoid-page; } .row { display: flex; justify-content: space-between; gap: 12px; }
  </style></head><body>
  <img class="logo" src="${logo}" alt="Chiparama">
  <div class="name">${esc(d.name.trim().toUpperCase())}${d.degree.trim() ? ` (${esc(d.degree.trim().toUpperCase())})` : ''}</div>
  <div class="sub">${contact}${d.availability.trim() ? `<i>${esc(d.availability.trim())}</i>` : ''}</div>
  ${sec('EXECUTIVE SUMMARY', d.execSummary.trim() ? `<p>${esc(d.execSummary.trim())}</p>` : '')}
  ${sec('CORE TECHNICAL COMPETENCIES', comp && `<ul>${comp}</ul>`)}
  ${sec('PROFESSIONAL EXPERIENCE', exp)}
  ${sec('EDUCATION', edu && `<ul>${edu}</ul>`)}
  ${sec('PUBLICATIONS &amp; AWARDS', aw && `<ul>${aw}</ul>`)}
  </body></html>`
}
