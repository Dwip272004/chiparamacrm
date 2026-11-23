// Calling workflow (merged in from the Chiparama calling software): statuses, queue rules and row types.
import type { Candidate } from './types'

export type Tone = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'brand'
export interface StatusDef { key: string; label: string; tone: Tone }

export const CALL_STATUSES: StatusDef[] = [
  { key: 'not_called', label: 'Not called', tone: 'slate' },
  { key: 'no_answer', label: 'No answer', tone: 'amber' },
  { key: 'voicemail', label: 'Voicemail', tone: 'amber' },
  { key: 'busy', label: 'Busy', tone: 'amber' },
  { key: 'call_back_later', label: 'Call back later', tone: 'blue' },
  { key: 'connected_interested', label: 'Connected: interested', tone: 'green' },
  { key: 'connected_not_interested', label: 'Connected: not interested', tone: 'slate' },
  { key: 'wrong_number', label: 'Wrong number', tone: 'red' },
  { key: 'do_not_call', label: 'Do not call', tone: 'red' },
]
export const CALL_OUTCOMES = CALL_STATUSES.filter((s) => s.key !== 'not_called')

export const MSG_STATUSES: StatusDef[] = [
  { key: 'not_started', label: 'Not started', tone: 'slate' }, { key: 'queued', label: 'Queued', tone: 'amber' }, { key: 'sent', label: 'Sent', tone: 'blue' },
  { key: 'delivered', label: 'Delivered', tone: 'brand' }, { key: 'replied', label: 'Replied', tone: 'green' }, { key: 'interested', label: 'Interested', tone: 'green' },
  { key: 'not_interested', label: 'Not interested', tone: 'amber' }, { key: 'failed', label: 'Failed / bounced', tone: 'red' }, { key: 'opted_out', label: 'Opted out', tone: 'red' },
]
export const CHANNELS = [
  { key: 'rcs', col: 'rcs_status', label: 'RCS' }, { key: 'email', col: 'email_status', label: 'Email' },
  { key: 'linkedin', col: 'linkedin_status', label: 'LinkedIn' }, { key: 'call', col: 'call_status', label: 'Calling' },
] as const

export const statusMeta = (channel: string, key?: string | null): StatusDef | undefined => (channel === 'call' ? CALL_STATUSES : MSG_STATUSES).find((s) => s.key === key)

export interface CallJob {
  id: string; job_code: string | null; name: string; company_name: string | null; city: string | null; country: string | null; work_mode: string | null; employment_type: string | null
  experience: string | null; compensation: string | null; openings: number | null; skills: string[]; summary: string | null; responsibilities: string | null; requirements: string | null; description: string | null
}
export interface CallRow {
  job_candidate_id: string; batch_id: string | null
  rcs_status: string; email_status: string; linkedin_status: string; call_status: string
  call_assigned_to: string | null; call_attempts: number; last_called_at: string | null; call_notes: string | null; interview_at: string | null; created_at: string; updated_at: string
  job_candidates: { id: string; job_id: string; candidate_id: string; stage_name: string | null; candidates: Candidate & { phone_2?: string | null; phone_3?: string | null; alt_email?: string | null; recruiter_profile_url?: string | null; open_to_work?: boolean | null }; jobs: CallJob | null }
  candidate_batches: { id: string; tag: string } | null
}
export interface OutreachActivity { id: string; job_candidate_id: string; channel: string; from_status: string | null; to_status: string | null; note: string | null; actor_name: string | null; created_at: string }

// Queue buckets: callbacks first, then never-called, then retries (oldest attempt first)
export type Bucket = 'new' | 'callback' | 'retry' | 'done'
export function callBucket(r: Pick<CallRow, 'call_status'>): Bucket {
  const s = r.call_status
  if (s === 'not_called') return 'new'
  if (s === 'call_back_later') return 'callback'
  if (['no_answer', 'voicemail', 'busy'].includes(s)) return 'retry'
  return 'done'
}
const ORDER: Record<Bucket, number> = { callback: 0, new: 1, retry: 2, done: 3 }
export function sortForCalling(a: CallRow, b: CallRow) {
  const d = ORDER[callBucket(a)] - ORDER[callBucket(b)]
  if (d) return d
  return (a.last_called_at ? +new Date(a.last_called_at) : 0) - (b.last_called_at ? +new Date(b.last_called_at) : 0)
}
// Shared pool: anyone can open a free candidate; the first caller to open one claims it.
export type Claim = 'free' | 'mine' | 'taken'
export const claimOf = (r: Pick<CallRow, 'call_assigned_to'>, me?: string): Claim => (!r.call_assigned_to ? 'free' : r.call_assigned_to === me ? 'mine' : 'taken')
export const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—')

/* ---------- CSV / pasted-table parsing for lot uploads ---------- */
export function parseDelimited(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const delim = first.includes('\t') ? '\t' : ','
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let inQ = false
  const pushRow = () => { row.push(cell); cell = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = [] }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else inQ = false } else cell += c }
    else if (c === '"') inQ = true
    else if (c === delim) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; pushRow() }
    else cell += c
  }
  if (cell !== '' || row.length) pushRow()
  return rows
}
const ALIASES: Record<string, string[]> = {
  full_name: ['name', 'full name', 'full_name', 'candidate', 'candidate name'], first_name: ['first name', 'first_name', 'firstname'], last_name: ['last name', 'last_name', 'lastname', 'surname'],
  email: ['work email', 'email', 'email address', 'e-mail', 'mail'], alt_email: ['personal email', 'alternate email', 'alt email', 'email 2', 'other email'],
  phone: ['direct phone 1', 'direct phone', 'phone 1', 'phone', 'mobile', 'phone number', 'contact', 'contact number', 'mobile number', 'cell'], phone_2: ['phone 2', 'direct phone 2', 'alternate phone', 'mobile 2'], phone_3: ['phone 3', 'direct phone 3', 'mobile 3'],
  recruiter_profile_url: ['recruiter profile', 'recruiter profile url', 'linkedin recruiter', 'recruiter link'], open_to_work: ['open to work', 'open_to_work', 'opentowork'],
  experience_years: ['experience years', 'experience', 'years of experience', 'yoe', 'total experience'], linkedin_url: ['linkedin', 'linkedin url', 'linkedin_url', 'profile', 'profile url', 'linkedin profile', 'linkedin link'],
  current_title: ['title', 'current title', 'designation', 'job title', 'position', 'headline'], current_company: ['company', 'current company', 'employer', 'organization', 'organisation'], location: ['location', 'city', 'current location', 'region'],
}
const digits = (s?: string) => (s ?? '').replace(/\D/g, '')
const liKey = (s?: string) => (s ?? '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '')
export type UploadRow = Record<string, string>
export interface Mapped { valid: UploadRow[]; invalid: { line: number; name?: string; reason: string }[]; dupes: number; recognised: string[]; ignored: string[] }
export function mapTable(table: string[][]): Mapped {
  if (table.length < 2) return { valid: [], invalid: [], dupes: 0, recognised: [], ignored: [] }
  const header = table[0].map((h) => h.replace(/^\uFEFF/, '').trim().toLowerCase())
  const idx: Record<string, number> = {}; const recognised: string[] = []
  Object.entries(ALIASES).forEach(([f, names]) => { const i = header.findIndex((h) => names.includes(h)); if (i >= 0) { idx[f] = i; recognised.push(header[i]) } })
  const ignored = table[0].filter((_, i) => !Object.values(idx).includes(i))
  const valid: UploadRow[] = []; const invalid: Mapped['invalid'] = []; const seen = new Set<string>(); let dupes = 0
  table.slice(1).forEach((cells, n) => {
    const get = (f: string) => (idx[f] !== undefined ? (cells[idx[f]] ?? '').trim() : '')
    const r: UploadRow = { full_name: get('full_name') || [get('first_name'), get('last_name')].filter(Boolean).join(' '), email: get('email').toLowerCase(), alt_email: get('alt_email').toLowerCase(), phone: get('phone'), phone_2: get('phone_2'), phone_3: get('phone_3'),
      linkedin_url: get('linkedin_url'), recruiter_profile_url: get('recruiter_profile_url'), current_title: get('current_title'), current_company: get('current_company'), location: get('location'), open_to_work: get('open_to_work'), experience_years: get('experience_years') }
    if (!r.email && r.alt_email) { r.email = r.alt_email; r.alt_email = '' }
    const phones = [r.phone, r.phone_2, r.phone_3].filter(Boolean); r.phone = phones[0] ?? ''; r.phone_2 = phones[1] ?? ''; r.phone_3 = phones[2] ?? ''
    const line = n + 2
    if (!r.full_name) { invalid.push({ line, reason: 'No name' }); return }
    if (!r.email && !r.linkedin_url && !r.recruiter_profile_url && digits(r.phone).length < 7) { invalid.push({ line, name: r.full_name, reason: 'No phone, email or profile link' }); return }
    const keys = [r.email && `e:${r.email}`, r.alt_email && `e:${r.alt_email}`, r.linkedin_url && `l:${liKey(r.linkedin_url)}`, r.recruiter_profile_url && `r:${r.recruiter_profile_url.toLowerCase()}`, digits(r.phone).length >= 7 && `p:${digits(r.phone)}`].filter(Boolean) as string[]
    if (keys.some((k) => seen.has(k))) { dupes++; return }
    keys.forEach((k) => seen.add(k)); valid.push(r)
  })
  return { valid, invalid, dupes, recognised, ignored }
}
export const TEMPLATE_HEADERS = ['name', 'current title', 'company', 'location', 'open to work', 'experience years', 'Direct phone 1', 'phone 2', 'phone 3', 'work email', 'personal email', 'recruiter profile']
export function downloadTemplate() {
  const sample = ['Asha Rao', 'Senior DFT Engineer', 'Broadcom', 'Bangalore', 'Yes', '8', '+919876543210', '', '', 'asha.rao@company.com', 'asha.rao@gmail.com', 'https://www.linkedin.com/talent/profile/…']
  const csv = [TEMPLATE_HEADERS, sample].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'outreach-list-template.csv'; a.click(); URL.revokeObjectURL(a.href)
}
