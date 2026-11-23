// Offline demo client: an in-memory stand-in for supabase-js with FICTIONAL data.
// Enabled only with `npm run dev:demo` (VITE_DEMO=1). Never bundled into a normal build.
/* eslint-disable @typescript-eslint/no-explicit-any */

let seed = 7
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
const uid = (p: string, i: number) => `${p}-0000-4000-8000-${String(i).padStart(12, '0')}`
const day = 86400_000
const iso = (ms: number) => new Date(Date.now() - ms).toISOString()

const FIRST = ['Aarav', 'Priya', 'Rohan', 'Sana', 'Dev', 'Isha', 'Meera', 'Karan', 'Neha', 'Vikram', 'Ananya', 'Arjun', 'Kavya', 'Rahul', 'Tanvi', 'Nikhil', 'Pooja', 'Siddharth', 'Riya', 'Aditya', 'Divya', 'Manav', 'Shruti', 'Yash', 'Ira', 'Kabir', 'Naina', 'Harsh']
const LAST = ['Mehta', 'Nair', 'Iyer', 'Qureshi', 'Malhotra', 'Verma', 'Kapoor', 'Joshi', 'Das', 'Rao', 'Shah', 'Singh', 'Gupta', 'Menon', 'Reddy', 'Bose', 'Kulkarni', 'Pillai', 'Sharma', 'Desai']
const ROLES = [['Senior Java Developer', ['Java', 'Spring Boot', 'Kafka', 'AWS', 'Microservices']], ['Product Designer', ['Figma', 'UX Research', 'Prototyping', 'Design Systems']], ['QA Engineer', ['Selenium', 'Test Automation', 'Cypress', 'API Testing']], ['Data Analyst', ['SQL', 'Python', 'Tableau', 'Excel', 'Power BI']], ['DevOps Engineer', ['Kubernetes', 'Docker', 'Terraform', 'AWS', 'CI/CD']], ['HR Business Partner', ['Talent Acquisition', 'Employee Relations', 'HRIS']], ['Frontend Engineer', ['React', 'TypeScript', 'CSS', 'Next.js']], ['Marketing Manager', ['SEO', 'Content Strategy', 'Google Analytics', 'Branding']], ['Verilog RTL Designer', ['Verilog', 'SystemVerilog', 'UVM', 'FPGA']], ['Sales Lead', ['B2B Sales', 'CRM', 'Negotiation', 'Account Management']]] as const
const ORGS = ['Northwind Labs', 'Lumen Co', 'Brightpath', 'Orbit', 'Fieldwork', 'Cloudnine', 'Helio Systems', 'Quanta Works', 'Bluepeak', 'Marigold']
const CITIES = [['Pune', 'India'], ['Mumbai', 'India'], ['Bengaluru', 'India'], ['Hyderabad', 'India'], ['Chennai', 'India'], ['Delhi', 'India'], ['Ahmedabad', 'India'], ['San Jose', 'United States']]

const ME = 'u-me'
const team = [
  { user_id: ME, email: 'you@demo.test', full_name: 'Dwip Lahare', role: 'admin', is_active: true },
  { user_id: 'u-sana', email: 'sana@demo.test', full_name: 'Sana Qureshi', role: 'recruiter', is_active: true },
  { user_id: 'u-rohan', email: 'rohan@demo.test', full_name: 'Rohan Iyer', role: 'manager', is_active: true },
  { user_id: 'u-dev', email: 'dev@demo.test', full_name: 'Dev Malhotra', role: 'recruiter', is_active: true },
]

const candidates: any[] = Array.from({ length: 64 }, (_, i) => {
  const [position, skills] = pick(ROLES as unknown as [string, string[]][])
  const [city, country] = pick(CITIES as unknown as [string, string][])
  const fn = FIRST[i % FIRST.length], ln = LAST[(i * 3 + 1) % LAST.length]
  const hasE = rnd() > 0.28, hasP = rnd() > 0.35
  const noSkills = rnd() < 0.18
  const resume = rnd() > 0.4
  return {
    id: uid('c', i + 1), rc_id: `RC${1000 + i}`, first_name: fn, last_name: ln, full_name: `${fn} ${ln}`,
    email: hasE ? `${fn}.${ln}@${pick(ORGS).toLowerCase().replace(/ /g, '')}.example`.toLowerCase() : null,
    phone: hasP ? `+91 9${String(Math.floor(rnd() * 1e9)).padStart(9, '0')}`.replace(/(\d{5})(\d{5})$/, '$1 $2') : null,
    current_position: position, current_organization: pick(ORGS), city, state: null, country,
    skills: noSkills ? [] : skills.slice(0, 2 + Math.floor(rnd() * (skills.length - 1))),
    experience_years: Math.floor(1 + rnd() * 14), notice_period: pick(['Immediate', '15 days', '30 days', '60 days']),
    current_salary: 600000 + Math.floor(rnd() * 25) * 100000, expected_salary: 900000 + Math.floor(rnd() * 25) * 100000,
    source: pick(['LinkedIn', 'Referral', 'Job board', 'Careers page']), linkedin_url: rnd() > 0.5 ? `linkedin.com/in/${fn}-${ln}`.toLowerCase() : null,
    rc_updated_at: iso(Math.floor(rnd() * 40) * day), rc_created_at: iso(Math.floor(rnd() * 90) * day), created_at: iso(Math.floor(rnd() * 90) * day),
    sync_status: i % 17 === 0 ? 'pending_push' : 'synced', off_limit: i % 29 === 0,
    raw: { resume: resume ? { filename: `${fn}_${ln}_CV.pdf`, file_link: '#' } : null },
  }
})
candidates.forEach((c) => { c.has_resume = !!c.raw.resume; c.has_linkedin = !!c.linkedin_url })

const pipeline = 'p-1'
const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'].map((name, i) => ({ id: uid('s', i + 1), pipeline_id: pipeline, name, sort_order: i, rc_stage_id: String(i) }))
const jobs: any[] = [
  ['Senior Java Developer', 'Northwind Labs', 'Pune', 'Open', ['Java', 'Spring Boot', 'Kafka']], ['Product Designer', 'Lumen Co', 'Mumbai', 'Open', ['Figma', 'UX Research']],
  ['QA Automation Lead', 'Brightpath', 'Chennai', 'Open', ['Selenium', 'Cypress']], ['Data Analyst', 'Fieldwork', 'Hyderabad', 'Open', ['SQL', 'Tableau']],
  ['DevOps Engineer', 'Cloudnine', 'Bengaluru', 'Open', ['Kubernetes', 'Terraform']], ['Verilog RTL Designer', 'Quanta Works', 'San Jose', 'Open', ['Verilog', 'UVM']],
  ['Marketing Manager', 'Orbit', 'Delhi', 'Closed', ['SEO', 'Branding']], ['HR Business Partner', 'Marigold', 'Ahmedabad', 'Closed', ['HRIS']], ['Frontend Engineer', 'Helio Systems', 'Pune', 'Open', ['React', 'TypeScript']],
].map(([name, company, city, status, skills], i) => ({
  id: uid('j', i + 1), rc_id: `J${i}`, job_code: `CHP-${1001 + i}`, name, status, company_name: company, company_rc_id: null, city, state: null, country: city === 'San Jose' ? 'United States' : 'India',
  description: `<p>We are looking for a <b>${name}</b> to join ${company}.</p><ul><li>Own delivery end-to-end</li><li>Work with a friendly cross-functional team</li><li>Grow into a lead role</li></ul>`,
  work_mode: pick(['Hybrid', 'Onsite', 'Remote']), employment_type: 'Full time', openings: 1 + (i % 3), min_experience: 3, max_experience: 9, min_salary: 1500000, max_salary: 3000000,
  skills, pipeline_id: pipeline, priority: ['urgent', 'high', 'normal', 'normal', 'high', 'low', 'normal', 'low', 'normal'][i], sync_status: 'synced', rc_updated_at: iso(i * 2 * day), created_at: iso(i * 5 * day), rc_created_at: iso(i * 5 * day),
}))
const jobCands: any[] = []
candidates.slice(0, 46).forEach((c, i) => {
  const j = jobs[i % jobs.length]; const st = stages[Math.min(4, Math.floor(rnd() * rnd() * 5.5))]
  jobCands.push({ id: uid('jc', i + 1), candidate_id: c.id, job_id: j.id, stage_id: st.id, stage_name: st.name, stage_updated_at: iso(Math.floor(rnd() * 30) * day), sync_status: 'synced', created_at: iso(30 * day) })
})
const tasks: any[] = [
  ['Call Priya about the Java offer', 0, 'u-me'], ['Send JD to Lumen Co', 1, 'u-me'], ['Collect references for Aarav', -1, 'u-me'], ['Schedule technical round', 2, 'u-sana'], ['Follow up with Fieldwork on feedback', -3, 'u-me'], ['Update salary bands', 5, 'u-rohan'],
].map(([title, d, who], i) => ({ id: uid('t', i + 1), title, description: null, status: 'open', due_at: iso(-(d as number) * day), assigned_to: who, candidate_id: candidates[i].id, job_id: null, completed_at: null }))
const notes: any[] = candidates.slice(0, 6).map((c, i) => ({ id: uid('n', i + 1), description: `<p>Spoke with ${c.first_name}. Strong on <b>${c.skills[0] ?? 'fundamentals'}</b>; open to a hybrid role.</p>`, note_type: 'Note', created_by_name: team[i % 4].full_name, created_at: iso((i + 1) * day), rc_updated_at: iso((i + 1) * day), sync_status: 'synced', candidate_id: c.id, job_id: null }))
const chat: any[] = [
  ['u-sana', 'Sana Qureshi', 'Anyone free to screen the Java candidates today?', null], ['u-rohan', 'Rohan Iyer', 'On it, sending my shortlist over.', null],
  ['u-dev', 'Dev Malhotra', 'Strong profile, check this one out', candidates[1]], ['u-sana', 'Sana Qureshi', 'Thanks! Can someone find their phone number?', candidates[1]],
].map(([a, n, b, c], i) => ({ id: uid('m', i + 1), author_id: a, author_name: n, body: b, candidate_id: (c as any)?.id ?? null, candidate_name: (c as any)?.full_name ?? null, reply_to: null, created_at: iso((5 - i) * 3600_000) }))
const enrich: any[] = [candidates[2], candidates[3], candidates[4]].map((c, i) => ({
  id: uid('e', i + 1), candidate_id: c.id, requested_by: i === 0 ? ME : 'u-sana', requested_by_name: i === 0 ? 'Dwip Lahare' : 'Sana Qureshi', needs: ['email', 'phone'], note: null, priority: i === 1 ? 'urgent' : 'normal',
  status: ['pending', 'pending', 'enriched'][i], decided_by_name: null, decision_note: null, decided_at: null, completed_by_name: i === 2 ? 'Rohan Iyer' : null, result_note: null, found_email: null, found_phone: null,
  completed_at: null, created_at: iso((i + 1) * 4 * 3600_000), candidates: c,
}))
const notifs: any[] = [
  { id: uid('x', 1), kind: 'enrichment_done', title: 'Enriched: ' + candidates[4].full_name, body: 'Contact details were added to the candidate.', link: '/enrichment', candidate_id: candidates[4].id, is_read: false, created_at: iso(3600_000) },
  { id: uid('x', 2), kind: 'enrichment_requested', title: 'Enrichment requested: ' + candidates[3].full_name, body: 'Sana Qureshi needs email & phone', link: '/enrichment', candidate_id: candidates[3].id, is_read: true, created_at: iso(6 * 3600_000) },
]
const CALLS = ['not_called', 'not_called', 'no_answer', 'call_back_later', 'connected_interested', 'voicemail', 'not_called', 'busy', 'connected_not_interested', 'not_called']
const outreach: any[] = jobCands.slice(0, 30).map((jc, i) => ({
  job_candidate_id: jc.id, batch_id: i % 2 ? 'b-1' : 'b-2', rcs_status: 'not_started', email_status: i % 5 === 0 ? 'sent' : 'not_started', linkedin_status: 'not_started',
  call_status: CALLS[i % CALLS.length], call_assigned_to: i % 7 === 6 ? 'u-sana' : ME, call_attempts: CALLS[i % CALLS.length] === 'not_called' ? 0 : 1 + (i % 3),
  last_called_at: CALLS[i % CALLS.length] === 'not_called' ? null : iso((i % 6) * 3600_000), call_notes: i % 4 === 0 ? 'Asked to call after 6pm.' : null, interview_at: null, created_at: iso(i * 3600_000), updated_at: iso(i * 3600_000),
}))
const outreachActivity: any[] = outreach.filter((o) => o.call_status !== 'not_called').map((o, i) => ({ id: uid('oa', i + 1), job_candidate_id: o.job_candidate_id, channel: 'call', from_status: 'not_called', to_status: o.call_status, note: i % 2 ? 'Left a message, will retry tomorrow.' : null, actor_name: 'Dwip Lahare', created_at: o.last_called_at }))
const candidate_batches: any[] = [{ id: 'b-1', job_id: jobs[0].id, tag: 'LinkedIn Recruiter – Nov batch 1', source: 'LinkedIn Recruiter', created_by_name: 'Dwip Lahare', created_at: iso(5 * day) }, { id: 'b-2', job_id: jobs[0].id, tag: 'Referrals', source: 'Team referrals', created_by_name: 'Prashant', created_at: iso(2 * day) }]
const job_statuses = ['Pending Review', 'Open', 'Active', 'On Hold', 'Filled', 'Closed', 'Cancelled'].map((label, i) => ({ key: label.toLowerCase().replace(/ /g, '_'), label, color: 'gray', sort_order: i * 10, is_active: true }))
const tables: Record<string, any[]> = {
  candidate_batches, job_statuses, outreach, outreach_activity: outreachActivity,
  team_members: team, candidates, jobs, job_candidates: jobCands, pipeline_stages: stages, tasks, notes, chat_messages: chat, enrichment_requests: enrich, enrichment_events: [], notifications: notifs,
  team_invites: [], sync_state: [{ entity: 'candidates', last_synced_at: iso(8 * 60_000), last_status: 'ok' }, { entity: 'jobs', last_synced_at: iso(9 * 60_000), last_status: 'ok' }], sync_runs: [], sync_outbox: [],
}

/* ---------- tiny query builder ---------- */
class Q {
  private ops: ((rows: any[]) => any[])[] = []; private one: null | 'single' | 'maybe' = null; private sel = '*'; private count = false
  constructor(private table: string, private mutate?: string) {}
  select(cols = '*') { this.sel = cols; return this }
  eq(c: string, v: any) { this.ops.push((r) => r.filter((x) => x[c] === v)); return this }
  neq(c: string, v: any) { this.ops.push((r) => r.filter((x) => x[c] !== v)); return this }
  in(c: string, v: any[]) { this.ops.push((r) => r.filter((x) => v.includes(x[c]))); return this }
  match(o: Record<string, any>) { Object.entries(o).forEach(([k, v]) => this.eq(k, v)); return this }
  order(c: string, o: any = {}) { const asc = o.ascending !== false; this.ops.push((r) => [...r].sort((a, b) => { const x = a[c], y = b[c]; if (x == null) return o.nullsFirst ? -1 : 1; if (y == null) return o.nullsFirst ? 1 : -1; return (x > y ? 1 : x < y ? -1 : 0) * (asc ? 1 : -1) })); return this }
  not(c: string, _op: string, v: any) { this.ops.push((r) => r.filter((x) => (v === null ? x[c] !== null : x[c] !== v))); return this }
  range(a: number, b: number) { this.ops.push((r) => r.slice(a, b + 1)); return this }
  limit(n: number) { this.ops.push((r) => r.slice(0, n)); return this }
  single() { this.one = 'single'; return this }
  maybeSingle() { this.one = 'maybe'; return this }
  update() { return this } upsert() { return this } delete() { return this } insert() { return this }
  private run() {
    if (this.mutate) return { data: null, error: null }
    let rows = tables[this.table] ?? []
    this.ops.forEach((f) => { rows = f(rows) })
    rows = rows.map((r) => this.expand(r))
    if (this.one) return { data: rows[0] ?? null, error: this.one === 'single' && !rows[0] ? { message: 'Not found' } : null }
    return { data: rows, error: null }
  }
  private expand(r: any) {
    const out = { ...r }
    if (this.table === 'outreach') {
      const jc = jobCands.find((x) => x.id === r.job_candidate_id)
      out.job_candidates = jc ? { id: jc.id, job_id: jc.job_id, candidate_id: jc.candidate_id, stage_name: jc.stage_name, candidates: candidates.find((c) => c.id === jc.candidate_id), jobs: jobs.find((j) => j.id === jc.job_id) ? { ...jobs.find((j) => j.id === jc.job_id), experience: '5-9 years', compensation: '15-30 LPA', summary: 'Own delivery end to end in a friendly team.', responsibilities: null, requirements: 'Strong fundamentals, good communication.' } : null } : null
      out.candidate_batches = { id: r.batch_id, tag: r.batch_id === 'b-1' ? 'Lot A' : 'Lot B' }
      return out
    }
    for (const m of this.sel.matchAll(/(\w+)\(([^)]*)\)/g)) {
      const [, rel, inner] = m
      if (rel === 'job_candidates' && inner.trim() === 'count') out.job_candidates = [{ count: jobCands.filter((x) => x.job_id === r.id).length }]
      else if (rel === 'outreach' && inner.trim() === 'count') out.outreach = [{ count: outreach.filter((o) => o.batch_id === r.id).length }]
      else if (rel === 'candidates') out.candidates = candidates.find((c) => c.id === r.candidate_id) ?? r.candidates
      else if (rel === 'jobs') out.jobs = jobs.find((j) => j.id === r.job_id)
    }
    return out
  }
  then(res: any, rej: any) { return Promise.resolve(this.run()).then(res, rej) }
}

/* ---------- rpc ---------- */
const stageCounts = () => stages.map((s) => ({ stage: s.name, n: new Set(jobCands.filter((j) => j.stage_name === s.name).map((j) => j.candidate_id)).size })).sort((a, b) => b.n - a.n)
function search(a: any) {
  const q = (a.p_q ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  const csv = (s?: string) => (s ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
  let rows = candidates.filter((c) => {
    const hay = [c.full_name, c.email, c.current_position, c.current_organization, c.city, ...c.skills].join(' ').toLowerCase()
    if (!q.every((t: string) => hay.includes(t))) return false
    if (!csv(a.p_city).every((t) => [c.city, c.state, c.country].join(' ').toLowerCase().includes(t))) return false
    if (!csv(a.p_skill).every((t) => c.skills.some((s: string) => s.toLowerCase().includes(t)))) return false
    const e = !!c.email, p = !!c.phone
    if (a.p_contact === 'verified' && !(e && p)) return false
    if (a.p_contact === 'partial' && e === p) return false
    if (a.p_contact === 'none' && (e || p)) return false
    for (const [k, f] of [['p_has_email', e], ['p_has_phone', p], ['p_has_skills', c.skills.length > 0], ['p_has_resume', c.has_resume], ['p_has_linkedin', c.has_linkedin]] as const) { if (a[k] === 'with' && !f) return false; if (a[k] === 'without' && f) return false }
    if (a.p_stage && !jobCands.some((j) => j.candidate_id === c.id && j.stage_name.toLowerCase() === a.p_stage.toLowerCase())) return false
    if (a.p_place && (c.city ?? '').toLowerCase() !== a.p_place.toLowerCase()) return false
    if (a.p_skill_exact && !c.skills.some((s: string) => s.toLowerCase() === a.p_skill_exact.toLowerCase())) return false
    if (a.p_exclude_job && jobCands.some((j) => j.job_id === a.p_exclude_job && j.candidate_id === c.id)) return false
    return true
  }).sort((x, y) => +new Date(y.rc_updated_at) - +new Date(x.rc_updated_at))
  const total = rows.length; rows = rows.slice(a.p_offset ?? 0, (a.p_offset ?? 0) + (a.p_limit ?? 50))
  return { total, rows }
}
const topBy = (f: (c: any) => string[], n: number, key: string) => { const m = new Map<string, number>(); candidates.forEach((c) => new Set(f(c)).forEach((v) => m.set(v, (m.get(v) ?? 0) + 1))); return [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ [key]: k, n: v })) }
const series = (f: (d: number) => number) => Array.from({ length: 14 }, (_, i) => ({ d: new Date(Date.now() - (13 - i) * day).toISOString().slice(0, 10), n: f(i) }))
const rpcs: Record<string, (a: any) => any> = {
  search_candidates: search,
  dashboard: () => ({
    candidates: 12480, open_jobs: jobs.filter((j) => j.status === 'Open').length, my_open_tasks: tasks.length, my_overdue: 2, my_due_today: 1, pending_push: 3, last_sync: iso(8 * 60_000),
    in_pipeline: new Set(jobCands.map((j) => j.candidate_id)).size * 190, active_assignments: jobCands.length * 12, by_stage: stageCounts().map((s) => ({ ...s, n: s.n * 85 })),
    jobs_by_status: [{ status: 'Open', n: 28 }, { status: 'Closed', n: 112 }],
    recent: [['Sana Qureshi', 'stage', { candidate: 'Priya Nair', to: 'Interview', job: 'Senior Java Developer' }], ['Rohan Iyer', 'assign', { candidate: 'Aarav Mehta', job: 'Product Designer' }], ['Dev Malhotra', 'create', {}], ['Dwip Lahare', 'stage', { candidate: 'Isha Verma', to: 'Offer', job: 'QA Automation Lead' }]]
      .map(([actor_name, action, detail], i) => ({ id: i, actor_name, entity: 'candidate', entity_id: null, action, detail, created_at: iso((i + 1) * 3 * 3600_000) })),
  }),
  dashboard_insights: () => ({
    new_candidates_7d: 86, new_candidates_30d: 312, unworked: 4210, moves_7d: 41, notes_7d: 63, jobs_no_candidates: 2, stale_count: 36,
    empty_jobs: jobs.slice(5, 7).map((j) => ({ id: j.id, name: j.name, company_name: j.company_name })),
    stale: jobCands.slice(0, 5).map((x) => ({ candidate_id: x.candidate_id, job_id: x.job_id, full_name: candidates.find((c) => c.id === x.candidate_id)!.full_name, stage_name: x.stage_name, job_name: jobs.find((j) => j.id === x.job_id)!.name, days: 14 + Math.floor(rnd() * 30) })),
    busiest_jobs: jobs.slice(0, 5).map((j, i) => ({ id: j.id, name: j.name, company_name: j.company_name, n: 38 - i * 6 })),
    top_skills: topBy((c) => c.skills.map((s: string) => s.toLowerCase()), 10, 'skill').map((x) => ({ ...x, n: (x.n as number) * 90 })),
    top_locations: topBy((c) => [c.city], 8, 'place').map((x) => ({ ...x, n: (x.n as number) * 140 })),
    leaderboard: team.map((m, i) => ({ name: m.full_name, n: 34 - i * 7 })),
    moves_by_day: series((i) => [3, 5, 2, 8, 6, 1, 0, 4, 7, 9, 5, 6, 8, 11][i]), added_by_day: series((i) => [8, 12, 6, 15, 22, 4, 2, 14, 18, 25, 11, 16, 20, 9][i]),
  }),
  enrichment_counts: () => ({ pending: 2, approved: 0, enriched: 1, not_found: 0, rejected: 0, mine_open: 1 }),
  chat_unread: () => 2,
  claim_membership: () => null,
  job_stats: () => jobs.map((j) => {
    const rows = jobCands.filter((x) => x.job_id === j.id)
    return {
      job_id: j.id, total: rows.length, last_move: rows.map((r) => r.stage_updated_at).sort().pop() ?? null, stale: rows.filter((r) => Date.now() - +new Date(r.stage_updated_at) > 14 * day).length,
      stages: stages.map((s) => ({ name: s.name, n: rows.filter((r) => r.stage_id === s.id).length })).filter((s) => s.n),
      people: rows.slice(0, 4).map((r) => ({ id: r.candidate_id, name: candidates.find((c) => c.id === r.candidate_id)!.full_name })),
    }
  }).filter((x) => x.total),
  job_calling_summary: () => ({ total: 46, in_scope: 30, unassigned: 7, uncalled: 21, callers: team.filter((m) => m.role !== 'admin').map((m, i) => ({ id: m.user_id, name: m.full_name, assigned: 12 + i * 5, not_called: 6 + i * 2 })) }),
  assign_job_calling: () => ({ assigned: 7, per_caller: [] }),
  submit_jd: () => jobs[0].id,
  review_job: () => null,
  set_job_priority: (a) => { const j = jobs.find((x) => x.id === a.p_id); if (j) j.priority = a.p_priority; return null },
  move_stage: (a) => { const jc = jobCands.find((x) => x.id === a.p_job_candidate); const st = stages.find((s) => s.id === a.p_stage); if (jc && st) { jc.stage_id = st.id; jc.stage_name = st.name; jc.stage_updated_at = new Date().toISOString() } return null },
  set_task_done: (a) => { const t = tasks.find((x) => x.id === a.p_id); if (t) t.status = a.p_done ? 'done' : 'open'; return null },
  send_message: (a) => { const c = candidates.find((x) => x.id === a.p_candidate); chat.push({ id: uid('m', chat.length + 1), author_id: ME, author_name: 'Dwip Lahare', body: a.p_body, candidate_id: c?.id ?? null, candidate_name: c?.full_name ?? null, reply_to: a.p_reply_to ?? null, created_at: new Date().toISOString() }); return null },
}

const session = { user: { id: ME, email: 'you@demo.test' } }
export const demoClient: any = {
  from: (t: string) => ({ select: (c?: string) => new Q(t).select(c), update: () => new Q(t, 'u'), upsert: () => new Q(t, 'u'), delete: () => new Q(t, 'd'), insert: () => new Q(t, 'i') }),
  rpc: (fn: string, args: any) => Promise.resolve({ data: rpcs[fn] ? rpcs[fn](args ?? {}) : null, error: null }),
  auth: {
    getSession: async () => ({ data: { session: location.search.includes('signedout') ? null : session } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() { /* none */ } } } }),
    signOut: async () => ({ error: null }), signUp: async () => ({ error: null }), signInWithPassword: async () => ({ error: null }), resetPasswordForEmail: async () => ({ error: null }),
  },
  channel: () => { const c: any = { on: () => c, subscribe: () => c }; return c }, removeChannel: async () => 'ok',
  functions: { invoke: async () => ({ data: { skills: [] }, error: null }) },
}
