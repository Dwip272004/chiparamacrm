# Merging the calling software into the CRM portal

Source: `Dwip272004/chiparama_recruiting_software` (React + Vite + Supabase, `public` schema).
Target: this portal (`web/`, TypeScript + Tailwind, Supabase `crm` schema). Both live in the same Supabase project and share logins.

Rule for the data move: **copy, never move.** The old `public.*` tables stay untouched until you sign off.

## Where each calling feature lands

| Calling software | Portal | Status |
|---|---|---|
| Roles (super_admin / admin / recruiting_manager) | CRM roles: `admin` = full admin, `manager`/`recruiter` = callers; `team_members.is_owner` marks the single super admin | done |
| Candidates (+ phone 2/3, alt email, recruiter profile, open to work) | `crm.candidates` (matched on email → phone → LinkedIn, no duplicates created) | done |
| Jobs / JD intake | `crm.jobs` (`origin = 'calling'`, JD fields kept) + `crm.job_statuses`; `submit_jd` and `review_job` | done |
| Upload lots | `crm.candidate_batches` + `create_candidate_batch`, `add_candidates_to_batch`, `delete_candidate_lot` | done |
| Calling workflow (status, attempts, assignment, notes) | `crm.outreach` (1:1 with `crm.job_candidates`), `crm.outreach_activity`, `log_call`, `assign_job_calling`, `job_calling_summary` | done |
| Calling list + call profile | `/calling`, `/calling/:id` | done |
| Job calling assignment panel, lots upload, JD submit/review | job page → Calling tab (admins), Jobs → Submit a JD, Review & publish | done |
| Notes | job notes → `crm.notes` (job); candidate notes → `crm.notes` (candidate) | done |
| Email outreach (Outlook), InMail requests, open positions, feedback, online presence, notifications, dashboards | — | pending |

## Access rules (enforced in the database)
- Admins (`crm.is_super()`) see and manage every calling row.
- Shared pool: every caller (manager/recruiter) sees the whole calling list. The first caller to open a candidate claims them (`claim_call`, atomic); nobody else can open or call that person, and the list shows who has them. Admins can open anything and never claim by viewing. Candidates already assigned in the old calling app stay with their callers.
- All writes go through functions; there are no direct write policies.

## Decisions taken (change any of them)
- Calling pipeline stage → RecruitCRM stage: sourced/contacted → Assigned, interested → Screening Invite, shortlisted → Ready to Submit, submitted → Submitted to Client, interview_* → Interview Scheduled, offered → Offer Extended, joined → Placed, rejected → Client Rejected, withdrawn → Withdrawn, on_hold → Nurture - Not Now.
- Candidates created by calling uploads are marked synced (not pushed to RecruitCRM). Blank details filled on existing RecruitCRM candidates are queued in the sync outbox (dry-run until you switch it live).
- Job status labels from the calling software are kept (Pending Review, Open, Active, On Hold, Filled, Closed, Cancelled). "Open" in counts and filters includes Active.
- Sign-up accepts emails invited through the CRM as well as the calling app's allow-list.
