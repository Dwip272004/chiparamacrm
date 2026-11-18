// Pushes portal edits (crm.sync_outbox) to RecruitCRM. DRY-RUN by default: nothing is written to the
// live CRM unless --live is passed. Endpoint shapes below follow the RecruitCRM v1 docs but have not
// been exercised against the real account yet - test one row of each kind with --live before relying on it.
import { rc } from './rc.js';
import * as db from './db.js';

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const routes = {
  'candidates:create': (r) => ({ method: 'POST', path: '/candidates', body: r.payload }),
  'candidates:update': (r) => ({ method: 'POST', path: `/candidates/${r.rc_ref}`, body: r.payload }),
  'jobs:create': (r) => ({ method: 'POST', path: '/jobs', body: r.payload }),
  'jobs:update': (r) => ({ method: 'POST', path: `/jobs/${r.rc_ref}`, body: r.payload }),
  'notes:create': (r) => ({ method: 'POST', path: '/notes', body: r.payload }),
  'notes:update': (r) => ({ method: 'POST', path: `/notes/${r.rc_ref}`, body: r.payload }),
  'tasks:create': (r) => ({ method: 'POST', path: '/tasks', body: r.payload }),
  'tasks:update': (r) => ({ method: 'POST', path: `/tasks/${r.rc_ref}`, body: r.payload }),
  // payload: { job_slug } / { job_slug, status_id }; rc_ref = candidate slug
  'job_candidates:assign': (r) => ({ method: 'POST', path: `/candidates/${r.rc_ref}/assign?job_slug=${r.payload.job_slug}` }),
  'job_candidates:unassign': (r) => ({ method: 'POST', path: `/candidates/${r.rc_ref}/unassign?job_slug=${r.payload.job_slug}` }),
  'job_candidates:stage': (r) => ({ method: 'POST', path: `/candidates/${r.rc_ref}/hiring-stages/${r.payload.job_slug}?status_id=${r.payload.status_id}` }),
};
const TABLE = { candidates: 'candidates', jobs: 'jobs', notes: 'notes', tasks: 'tasks', job_candidates: 'job_candidates' };

export async function runOutbox({ live = false, batch = 25 } = {}) {
  const due = await db.select('sync_outbox',
    `select=*&status=in.(pending,failed)&attempts=lt.6&next_attempt_at=lte.${encodeURIComponent(new Date().toISOString())}&order=created_at.asc&limit=${batch}`);
  log(`outbox: ${due.length} due (${live ? 'LIVE' : 'dry-run'})`);
  for (const row of due) {
    const key = `${row.entity}:${row.op === 'action' ? row.payload?.action : row.op}`;
    const route = routes[key]?.(row);
    if (!route) { await db.patch('sync_outbox', `id=eq.${row.id}`, { status: 'failed', attempts: 6, last_error: `no route for ${key}` }); continue; }
    if (!live) { log(`  [dry-run] ${route.method} ${route.path}`, route.body ? JSON.stringify(route.body).slice(0, 120) : ''); continue; }
    await db.patch('sync_outbox', `id=eq.${row.id}`, { status: 'processing', attempts: row.attempts + 1 });
    try {
      const res = await rc(route.path, { method: route.method, body: route.body, tries: 2 });
      const slug = res?.slug ?? res?.data?.slug ?? res?.id;
      if (row.local_id && TABLE[row.entity]) {
        await db.patch(TABLE[row.entity], `id=eq.${row.local_id}`, {
          sync_status: 'synced', synced_at: new Date().toISOString(), ...(row.op === 'create' && slug ? { rc_id: String(slug) } : {}),
        });
      }
      await db.patch('sync_outbox', `id=eq.${row.id}`, { status: 'done', processed_at: new Date().toISOString(), last_error: null });
      log(`  ok ${key}`);
    } catch (e) {
      const backoff = Math.min(2 ** row.attempts * 60_000, 3_600_000);
      await db.patch('sync_outbox', `id=eq.${row.id}`, { status: 'failed', last_error: String(e.message).slice(0, 500), next_attempt_at: new Date(Date.now() + backoff).toISOString() });
      if (row.local_id && TABLE[row.entity]) await db.patch(TABLE[row.entity], `id=eq.${row.local_id}`, { sync_status: 'error' });
      log(`  FAILED ${key}: ${e.message}`);
    }
  }
}
