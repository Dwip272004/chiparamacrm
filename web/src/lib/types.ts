export type Role = 'admin' | 'manager' | 'recruiter' | 'viewer'
export interface Member { user_id: string; email: string; full_name: string | null; role: Role; is_active: boolean }
export interface CandidateRow {
  id: string; full_name: string; email: string | null; phone: string | null; current_position: string | null
  current_organization: string | null; city: string | null; state: string | null; country: string | null
  skills: string[]; experience_years: number | null; rc_updated_at: string | null; sync_status: string; off_limit: boolean; has_resume?: boolean; has_linkedin?: boolean
}
export interface Candidate extends CandidateRow {
  first_name: string | null; last_name: string | null; linkedin_url: string | null; notice_period: string | null
  current_salary: number | null; expected_salary: number | null; source: string | null; rc_id: string | null
  raw?: { resume?: { filename: string; file_link: string } | null } | null
}
export interface Job {
  id: string; rc_id: string | null; name: string; status: string | null; company_name: string | null; company_rc_id: string | null
  description: string | null; city: string | null; state: string | null; country: string | null; work_mode: string | null
  employment_type: string | null; openings: number | null; min_experience: number | null; max_experience: number | null
  min_salary: number | null; max_salary: number | null; skills: string[]; pipeline_id: string | null; sync_status: string
  rc_updated_at: string | null; created_at: string; priority?: 'urgent' | 'high' | 'normal' | 'low'
  job_code?: string | null; open_date?: string | null; rc_created_at?: string | null; currency?: string | null
}
export interface Stage { id: string; pipeline_id: string; name: string; sort_order: number; rc_stage_id: string }
export interface JobCandidate {
  id: string; candidate_id: string; job_id: string; stage_id: string | null; stage_name: string | null
  stage_updated_at: string | null; sync_status: string
}
export interface Note {
  id: string; description: string; note_type: string | null; created_by_name: string | null; created_at: string
  rc_updated_at: string | null; sync_status: string; candidate_id: string | null; job_id: string | null
}
export interface Task {
  id: string; title: string; description: string | null; status: string; due_at: string | null; assigned_to: string | null
  candidate_id: string | null; job_id: string | null; completed_at: string | null
}
