// RecruitCRM payload -> crm.* row. Every row keeps the full payload in `raw`.
const s = (v) => (v === undefined || v === null || v === '' ? null : String(v));
const n = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const d = (v) => (v ? String(v).slice(0, 10) : null);
const csv = (v) => (v ? String(v).split(',').map((x) => x.trim()).filter(Boolean) : []);
const now = () => new Date().toISOString();

export const mapUser = (u) => ({
  rc_id: String(u.id), first_name: s(u.first_name), last_name: s(u.last_name), email: s(u.email),
  role: s(u.role?.name ?? u.role), team: s(Array.isArray(u.teams) ? u.teams.map((t) => t.name ?? t).join(', ') : u.teams),
  is_active: u.status === undefined ? true : ['active', 1, '1', true].includes(typeof u.status === 'string' ? u.status.toLowerCase() : u.status),
  raw: u, synced_at: now(),
});

export const mapCandidate = (c) => ({
  rc_id: c.slug, first_name: s(c.first_name), last_name: s(c.last_name), email: s(c.email),
  phone: s(c.contact_number), phone_digits: (c.contact_number || '').replace(/\D/g, '') || null,
  linkedin_url: s(c.linkedin), current_position: s(c.position), current_organization: s(c.current_organization),
  city: s(c.city), state: s(c.state), country: s(c.country), locality: s(c.locality),
  experience_years: n(c.work_ex_year), notice_period: s(c.notice_period),
  current_salary: n(c.current_salary), expected_salary: n(c.salary_expectation), salary_type: s(c.salary_type),
  currency: s(c.currency_id), skills: csv(c.skill), source: s(c.source), available_from: d(c.available_from),
  resume_url: s(c.resume?.file_link ?? c.resume?.url ?? c.resume?.link),
  off_limit: c.off_limit_status_id != null && Number(c.off_limit_status_id) > 0 && !!c.off_limit_reason,
  owner_rc_user_id: s(c.owner), custom_fields: c.custom_fields ?? [], raw: c,
  sync_status: 'synced', synced_at: now(), rc_created_at: c.created_on ?? null, rc_updated_at: c.updated_on ?? null,
});

export const mapJob = (j, pipelineIds) => ({
  rc_id: j.slug, job_code: s(j.job_code), name: j.name || '(untitled)', status: s(j.job_status?.label),
  company_rc_id: s(j.company_slug), contact_rc_id: s(j.contact_slug), description: s(j.job_description_text),
  city: s(j.city), state: s(j.state), country: s(j.country), work_mode: s(j.job_location_type), employment_type: s(j.job_type),
  openings: n(j.number_of_openings), min_experience: n(j.minimum_experience), max_experience: n(j.maximum_experience),
  min_salary: n(j.min_annual_salary), max_salary: n(j.max_annual_salary), salary_type: s(j.salary_type), currency: s(j.currency_id),
  skills: csv(j.job_skill), pipeline_id: pipelineIds.get(String(j.hiring_pipeline_id ?? 0)) ?? null,
  owner_rc_user_id: s(j.owner),
  collaborators: (j.collaborator_users ?? []).map((u) => String(u.id ?? u)),
  custom_fields: j.custom_fields ?? [], raw: j,
  sync_status: 'synced', synced_at: now(), rc_created_at: j.created_on ?? null, rc_updated_at: j.updated_on ?? null,
});

const label = (v) => (v && typeof v === 'object' ? s(v.label ?? v.name) : s(v));

export const mapNote = (x, ids) => {
  const type = String(x.related_to_type ?? '').toLowerCase();
  const kind = ['candidate', 'job', 'contact', 'company'].includes(type) ? type : null;
  return {
    rc_id: String(x.id), note_type: label(x.note_type), related_to_type: kind, related_rc_id: s(x.related_to),
    candidate_id: kind === 'candidate' ? ids.candidates.get(x.related_to) ?? null : null,
    job_id: kind === 'job' ? ids.jobs.get(x.related_to) ?? null : null,
    description: x.description ?? '', raw: x,
    sync_status: 'synced', synced_at: now(), rc_updated_at: x.updated_on ?? x.created_on ?? null,
  };
};

// Task shape was empty on the sample account, so field names are matched defensively.
export const mapTask = (t, ids) => {
  const type = String(t.related_to_type ?? '').toLowerCase();
  return {
    rc_id: String(t.id), title: s(t.title ?? t.name ?? t.description) ?? '(task)', description: s(t.description),
    task_type: label(t.task_type), status: s(t.status?.label ?? t.status) ?? 'open',
    due_at: t.due_date ?? t.start_date ?? null, completed_at: t.completed_on ?? null,
    assigned_rc_user_id: s(t.assigned_to ?? t.owner),
    candidate_id: type === 'candidate' ? ids.candidates.get(t.related_to) ?? null : null,
    job_id: type === 'job' ? ids.jobs.get(t.related_to) ?? null : null,
    related_to_type: s(type), related_rc_id: s(t.related_to), raw: t,
    sync_status: 'synced', synced_at: now(), rc_updated_at: t.updated_on ?? t.created_on ?? null,
  };
};

export const mapPlacement = (p, ids) => ({
  rc_id: String(p.id ?? p.slug), candidate_id: ids.candidates.get(p.candidate_slug) ?? null, job_id: ids.jobs.get(p.job_slug) ?? null,
  status: label(p.status), start_date: d(p.start_date), end_date: d(p.end_date),
  fee: n(p.fee ?? p.placement_fee), revenue: n(p.revenue), currency: s(p.currency_id), raw: p,
  sync_status: 'synced', synced_at: now(), rc_updated_at: p.updated_on ?? null,
});
