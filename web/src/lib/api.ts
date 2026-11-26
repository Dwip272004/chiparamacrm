import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from './supabase'
import type { Candidate, CandidateRow, Job, JobCandidate, Member, Note, Stage, Task } from './types'
import { useToast } from '../components/ui'

export const keys = {
  dash: ['dashboard'], cands: ['cands'], cand: (id: string) => ['cand', id], jobs: ['jobs'], job: (id: string) => ['job', id],
}

import { compileSkillQuery } from './boolean'
export interface SearchArgs { q?: string; city?: string; skill?: string; excludeJob?: string; limit?: number; offset?: number; contact?: string; hasSkills?: string; hasResume?: string; hasLinkedin?: string; hasEmail?: string; hasPhone?: string; stage?: string; place?: string; skillExact?: string }
export function useCandidateSearch(a: SearchArgs, enabled = true) {
  return useQuery({
    queryKey: [...keys.cands, a], enabled, placeholderData: (p) => p,
    queryFn: async () => unwrap<{ total: number; rows: CandidateRow[] }>(supabase.rpc('search_candidates', {
      p_q: a.q || null, p_city: a.city || null, p_skill_bool: compileSkillQuery(a.skill), p_exclude_job: a.excludeJob || null, p_limit: a.limit ?? 50, p_offset: a.offset ?? 0,
      p_contact: a.contact || null, p_has_skills: a.hasSkills || null, p_has_resume: a.hasResume || null, p_has_linkedin: a.hasLinkedin || null, p_has_email: a.hasEmail || null, p_has_phone: a.hasPhone || null,
      p_stage: a.stage || null, p_place: a.place || null, p_skill_exact: a.skillExact || null,
    })),
  })
}
export const useCandidate = (id?: string) => useQuery({
  queryKey: keys.cand(id ?? ''), enabled: !!id,
  queryFn: () => unwrap<Candidate>(supabase.from('candidates').select('*').eq('id', id!).single()),
})
export interface Assignment extends JobCandidate { jobs: { id: string; name: string; status: string | null; company_name: string | null; pipeline_id: string | null } }
export const useCandidateAssignments = (id?: string) => useQuery({
  queryKey: ['cand-assign', id], enabled: !!id,
  queryFn: () => unwrap<Assignment[]>(supabase.from('job_candidates').select('*, jobs(id,name,status,company_name,pipeline_id)').eq('candidate_id', id!).order('stage_updated_at', { ascending: false })),
})
export const useStages = (pipelineId?: string | null) => useQuery({
  queryKey: ['stages', pipelineId ?? 'all'],
  queryFn: () => unwrap<Stage[]>((pipelineId ? supabase.from('pipeline_stages').select('*').eq('pipeline_id', pipelineId) : supabase.from('pipeline_stages').select('*')).order('sort_order')),
  staleTime: 5 * 60_000,
})
export const useNotes = (f: { candidate?: string; job?: string }) => useQuery({
  queryKey: ['notes', f], enabled: !!(f.candidate || f.job),
  queryFn: () => unwrap<Note[]>(supabase.from('notes').select('*').match(f.candidate ? { candidate_id: f.candidate } : { job_id: f.job! }).order('created_at', { ascending: false }).limit(200)),
})
export const useTasks = (scope: 'mine' | 'all' | 'done', filter?: { candidate?: string; job?: string }, userId?: string) => useQuery({
  queryKey: ['tasks', scope, filter, userId],
  queryFn: () => {
    let q = supabase.from('tasks').select('*').order('due_at', { ascending: true, nullsFirst: false }).limit(300)
    if (filter?.candidate) q = q.eq('candidate_id', filter.candidate)
    if (filter?.job) q = q.eq('job_id', filter.job)
    if (scope === 'done') q = q.eq('status', 'done'); else q = q.neq('status', 'done')
    if (scope === 'mine' && userId) q = q.eq('assigned_to', userId)
    return unwrap<Task[]>(q)
  },
})
export const useJobs = () => useQuery({
  queryKey: keys.jobs,
  queryFn: () => unwrap<(Job & { job_candidates: { count: number }[] })[]>(supabase.from('jobs').select('*, job_candidates(count)').order('rc_updated_at', { ascending: false, nullsFirst: false }).limit(1000)),
})
export const useJob = (id?: string) => useQuery({ queryKey: keys.job(id ?? ''), enabled: !!id, queryFn: () => unwrap<Job>(supabase.from('jobs').select('*').eq('id', id!).single()) })
export interface BoardRow extends JobCandidate { candidates: CandidateRow }
export const useBoard = (jobId?: string) => useQuery({
  queryKey: ['board', jobId], enabled: !!jobId,
  queryFn: () => unwrap<BoardRow[]>(supabase.from('job_candidates').select('*, candidates(id,full_name,email,phone,current_position,current_organization,city,state,country,skills,experience_years,rc_updated_at,sync_status,off_limit)').eq('job_id', jobId!).limit(2000)),
})
export interface JobStat { job_id: string; total: number; last_move: string | null; stale: number; stages: { name: string; n: number }[]; people: { id: string; name: string }[] }
export const useJobStats = () => useQuery({
  queryKey: ['job-stats'], staleTime: 60_000,
  queryFn: async () => new Map((await unwrap<JobStat[]>(supabase.rpc('job_stats'))).map((s) => [s.job_id, s])),
})
export const useMembers = () => useQuery({ queryKey: ['members'], queryFn: () => unwrap<Member[]>(supabase.from('team_members').select('*').order('full_name')), staleTime: 60_000 })
export const useInsights = () => useQuery({ queryKey: ['insights'], queryFn: () => unwrap<any>(supabase.rpc('dashboard_insights')), staleTime: 5 * 60_000 })
export const useDashboard = () => useQuery({ queryKey: keys.dash, queryFn: () => unwrap<any>(supabase.rpc('dashboard')), refetchInterval: 60_000 })

// Generic RPC mutation that refreshes whatever it touched and reports errors as toasts.
export function useRpc<A extends object>(fn: string, opts: { ok?: string; invalidate?: unknown[][]; onDone?: (r: any) => void } = {}) {
  const qc = useQueryClient(); const toast = useToast()
  return useMutation({
    mutationFn: (args: A) => unwrap<any>(supabase.rpc(fn, args as never)),
    onSuccess: (r) => {
      opts.ok && toast(opts.ok)
      ;(opts.invalidate ?? [['cands'], ['cand'], ['cand-assign'], ['board'], ['jobs'], ['job'], ['notes'], ['tasks'], ['dashboard'], ['job-stats']]).forEach((k) => qc.invalidateQueries({ queryKey: k }))
      opts.onDone?.(r)
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })
}

// ---------- Enrichment ----------
export type EnrichStatus = 'pending' | 'approved' | 'rejected' | 'enriched' | 'not_found' | 'cancelled'
export interface EnrichmentReq {
  id: string; candidate_id: string; requested_by: string; requested_by_name: string | null; needs: string[]; note: string | null
  priority: 'normal' | 'urgent'; status: EnrichStatus; decided_by_name: string | null; decision_note: string | null; decided_at: string | null
  completed_by_name: string | null; result_note: string | null; found_email: string | null; found_phone: string | null
  completed_at: string | null; created_at: string
  candidates: { id: string; full_name: string; email: string | null; phone: string | null; current_position: string | null; current_organization: string | null; city: string | null; country: string | null } | null
}
export interface EnrichEvent { id: number; request_id: string; actor_name: string | null; action: string; detail: string | null; created_at: string }
export const ENRICH_KEYS = [['enrich'], ['enrich-counts'], ['cand-enrich'], ['notifs'], ['cand'], ['cands'], ['board']]
export const useEnrichment = () => useQuery({
  queryKey: ['enrich'],
  queryFn: () => unwrap<EnrichmentReq[]>(supabase.from('enrichment_requests').select('*, candidates(id,full_name,email,phone,current_position,current_organization,city,country)').order('created_at', { ascending: false }).limit(500)),
})
export const useEnrichmentEvents = (id?: string) => useQuery({
  queryKey: ['enrich-events', id], enabled: !!id,
  queryFn: () => unwrap<EnrichEvent[]>(supabase.from('enrichment_events').select('*').eq('request_id', id!).order('created_at')),
})
export const useEnrichmentCounts = () => useQuery({ queryKey: ['enrich-counts'], queryFn: () => unwrap<Record<string, number>>(supabase.rpc('enrichment_counts')), refetchInterval: 60_000 })
export const useCandidateEnrichment = (candidateId?: string) => useQuery({
  queryKey: ['cand-enrich', candidateId], enabled: !!candidateId,
  queryFn: async () => {
    const { data, error } = await supabase.from('enrichment_requests').select('*').eq('candidate_id', candidateId!).order('created_at', { ascending: false }).limit(1)
    if (error) throw error
    return (data?.[0] ?? null) as Omit<EnrichmentReq, 'candidates'> | null
  },
})

// ---------- Notifications ----------
export interface Notif { id: string; kind: string; title: string; body: string | null; link: string | null; candidate_id: string | null; is_read: boolean; created_at: string }
export const useNotifications = () => useQuery({
  queryKey: ['notifs'],
  queryFn: () => unwrap<Notif[]>(supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(40)),
})

// ---------- Chat ----------
export interface ChatMsg { id: string; author_id: string; author_name: string | null; body: string; candidate_id: string | null; candidate_name: string | null; reply_to: string | null; created_at: string }
export const useChat = (candidate?: string | null) => useQuery({
  queryKey: ['chat', candidate ?? 'all'],
  queryFn: async () => {
    let q = supabase.from('chat_messages').select('*').order('created_at', { ascending: false }).limit(300)
    if (candidate) q = q.eq('candidate_id', candidate)
    return (await unwrap<ChatMsg[]>(q)).reverse()
  },
})
export const useChatUnread = () => useQuery({ queryKey: ['chat-unread'], queryFn: () => unwrap<number>(supabase.rpc('chat_unread')), refetchInterval: 120_000 })

// ---------- Calling (merged from the calling software) ----------
import type { CallRow, OutreachActivity } from './calling'
const CALL_SELECT = '*, job_candidates(id,job_id,candidate_id,stage_name,candidates(*),jobs(id,job_code,name,company_name,city,country,work_mode,employment_type,experience,compensation,openings,skills,summary,responsibilities,requirements,description)), candidate_batches(id,tag)'
async function fetchAllRows<T>(build: () => { range: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> }): Promise<T[]> {
  const size = 1000; let from = 0; let all: T[] = []
  for (;;) {
    const { data, error } = await build().range(from, from + size - 1)
    if (error) throw new Error(error.message)
    all = all.concat(data ?? [])
    if ((data ?? []).length < size) return all
    from += size
  }
}
/** The shared calling pool: every candidate on a calling list (callers and admins all see it; claimed ones show who has them). */
export const useCallList = () => useQuery({
  queryKey: ['call-list'], staleTime: 30_000,
  queryFn: () => fetchAllRows<CallRow>(() => supabase.from('outreach').select(CALL_SELECT).order('created_at', { ascending: false }).order('job_candidate_id') as never),
})
export const useCallers = (enabled = true) => useQuery({
  queryKey: ['callers'], enabled, staleTime: 60_000,
  queryFn: () => unwrap<Member[]>(supabase.from('team_members').select('*').in('role', ['manager', 'recruiter']).eq('is_active', true).order('full_name')),
})
export const useOutreachActivity = (id?: string) => useQuery({
  queryKey: ['outreach-activity', id], enabled: !!id,
  queryFn: () => unwrap<OutreachActivity[]>(supabase.from('outreach_activity').select('*').eq('job_candidate_id', id!).order('created_at', { ascending: false }).limit(50)),
})
