import { rc, pages, RcError } from './rc.js';
import * as db from './db.js';
import { mapUser, mapCandidate, mapJob, mapNote, mapTask, mapPlacement } from './mappers.js';

const OVERLAP_MS = 10 * 60 * 1000; // re-read a safety window so nothing slips between runs
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// Walk a list endpoint newest-updated first. With a watermark, stop as soon as a page is entirely older.
async function* pull(path, since) {
  for await (const rows of pages(path, { params: '&sort_by=updatedon&sort_order=desc' })) {
    const fresh = since ? rows.filter((r) => !r.updated_on || new Date(r.updated_on) >= since) : rows;
    if (fresh.length) yield fresh;
    if (since && fresh.length < rows.length) return;
  }
}

async function upsertGuarded(table, rows) {
  if (!rows.length) return [];
  const pending = await db.pendingRcIds(table, rows.map((r) => r.rc_id));
  const safe = rows.filter((r) => !pending.has(r.rc_id)); // never clobber un-pushed local edits
  if (pending.size) log(`  ${table}: skipped ${pending.size} rows with pending local edits`);
  return db.upsert(table, safe, 'rc_id', 'id,rc_id');
}

const syncers = {
  async users() {
    const list = await rc('/users');
    const rows = (Array.isArray(list) ? list : list.data ?? []).map(mapUser);
    await db.upsert('rc_users', rows, 'rc_id');
    return { fetched: rows.length, upserted: rows.length };
  },

  async pipelines() {
    const list = await rc('/hiring-pipelines');
    const ps = Array.isArray(list) ? list : list.data ?? [];
    const saved = await db.upsert('pipelines', ps.map((p) => ({ rc_id: String(p.id), name: p.name, is_default: p.id === 0, raw: p })), 'rc_id', 'id,rc_id');
    let stages = 0;
    for (const p of saved) {
      const st = await rc(`/hiring-pipelines/${p.rc_id}`);
      const rows = (Array.isArray(st) ? st : st.data ?? []).map((x, i) => ({
        pipeline_id: p.id, rc_stage_id: String(x.status_id), name: x.label, sort_order: i, raw: x,
      }));
      await db.upsert('pipeline_stages', rows, 'pipeline_id,rc_stage_id');
      stages += rows.length;
    }
    return { fetched: ps.length + stages, upserted: ps.length + stages };
  },

  async candidates({ since }) {
    let fetched = 0, upserted = 0;
    for await (const rows of pull('/candidates', since)) {
      fetched += rows.length;
      upserted += (await upsertGuarded('candidates', rows.filter((r) => r.slug).map(mapCandidate))).length;
      log(`  candidates ${fetched}`);
    }
    return { fetched, upserted };
  },

  async jobs({ since }) {
    const pmap = new Map((await db.select('pipelines', 'select=id,rc_id')).map((p) => [p.rc_id, p.id]));
    let fetched = 0, upserted = 0;
    for await (const rows of pull('/jobs', since)) {
      fetched += rows.length;
      upserted += (await upsertGuarded('jobs', rows.filter((r) => r.slug).map((j) => mapJob(j, pmap)))).length;
    }
    return { fetched, upserted };
  },

  // Assignments change independently of job.updated_on, so refresh every open job each run.
  async job_candidates() {
    const jobs = await db.select('jobs', 'select=id,rc_id,status,pipeline_id,pipelines(rc_id)&limit=5000');
    const stages = await db.select('pipeline_stages', 'select=id,rc_stage_id,pipelines(rc_id)&limit=5000');
    const stageMap = new Map(stages.map((s) => [`${s.pipelines.rc_id}:${s.rc_stage_id}`, s.id]));
    let fetched = 0, upserted = 0;
    for (const job of jobs.filter((j) => !j.status || !/clos|cancel|fill|lost/i.test(j.status))) {
      const pipe = job.pipelines?.rc_id ?? '0';
      for await (const rows of pages(`/jobs/${job.rc_id}/assigned-candidates`)) {
        fetched += rows.length;
        const cands = await upsertGuarded('candidates', rows.map((r) => r.candidate).filter((c) => c?.slug).map(mapCandidate));
        const cmap = new Map(cands.map((c) => [c.rc_id, c.id]));
        const links = rows.filter((r) => cmap.has(r.candidate?.slug)).map((r) => ({
          candidate_id: cmap.get(r.candidate.slug), job_id: job.id,
          stage_id: stageMap.get(`${pipe}:${r.status?.status_id}`) ?? null,
          stage_name: r.status?.label ?? null, status: r.status?.label ?? null,
          stage_updated_at: r.stage_date ?? null, raw: { status: r.status, stage_date: r.stage_date },
          sync_status: 'synced', synced_at: new Date().toISOString(),
        }));
        await db.upsert('job_candidates', links, 'candidate_id,job_id');
        upserted += links.length;
      }
    }
    return { fetched, upserted };
  },

  async notes({ since }) {
    let fetched = 0, upserted = 0;
    for await (const rows of pull('/notes', since)) {
      fetched += rows.length;
      const ids = {
        candidates: await db.idMap('candidates', rows.filter((r) => /candidate/i.test(r.related_to_type)).map((r) => r.related_to)),
        jobs: await db.idMap('jobs', rows.filter((r) => /job/i.test(r.related_to_type)).map((r) => r.related_to)),
      };
      upserted += (await upsertGuarded('notes', rows.map((r) => mapNote(r, ids)))).length;
    }
    return { fetched, upserted };
  },

  async tasks({ since }) {
    let fetched = 0, upserted = 0;
    for await (const rows of pull('/tasks', since)) {
      fetched += rows.length;
      const ids = {
        candidates: await db.idMap('candidates', rows.filter((r) => /candidate/i.test(r.related_to_type)).map((r) => r.related_to)),
        jobs: await db.idMap('jobs', rows.filter((r) => /job/i.test(r.related_to_type)).map((r) => r.related_to)),
      };
      upserted += (await upsertGuarded('tasks', rows.map((r) => mapTask(r, ids)))).length;
    }
    return { fetched, upserted };
  },

  async placements({ since }) {
    let fetched = 0, upserted = 0;
    try {
      for await (const rows of pull('/placements', since)) {
        fetched += rows.length;
        const ids = {
          candidates: await db.idMap('candidates', rows.map((r) => r.candidate_slug)),
          jobs: await db.idMap('jobs', rows.map((r) => r.job_slug)),
        };
        upserted += (await upsertGuarded('placements', rows.map((r) => mapPlacement(r, ids)))).length;
      }
    } catch (e) {
      if (e instanceof RcError && e.status === 404) { log('  placements not available on this account, skipping'); return { fetched: 0, upserted: 0 }; }
      throw e;
    }
    return { fetched, upserted };
  },
};

// Dependency order matters: pipelines before jobs, candidates+jobs before assignments/notes.
export const ORDER = ['users', 'pipelines', 'candidates', 'jobs', 'job_candidates', 'notes', 'tasks', 'placements'];

export async function runSync(entities = ORDER, { full = false, triggeredBy = null } = {}) {
  for (const entity of entities) {
    if (!syncers[entity]) throw new Error(`Unknown entity ${entity}`);
    const [state] = await db.select('sync_state', `select=*&entity=eq.${entity}`);
    if (state?.status === 'running' && Date.now() - new Date(state.updated_at) < 30 * 60 * 1000) {
      log(`${entity}: another sync is running, skipping`); continue;
    }
    const startedAt = new Date();
    const since = !full && state?.last_synced_at ? new Date(new Date(state.last_synced_at) - OVERLAP_MS) : null;
    const mode = since ? 'incremental' : 'full';
    log(`${entity}: ${mode}${since ? ` since ${since.toISOString()}` : ''}`);
    const [run] = await db.insert('sync_runs', { entity, mode, triggered_by: triggeredBy });
    await db.patch('sync_state', `entity=eq.${entity}`, { status: 'running', last_error: null });
    try {
      const res = await syncers[entity]({ since });
      await db.patch('sync_runs', `id=eq.${run.id}`, { status: 'success', finished_at: new Date().toISOString(), fetched: res.fetched, upserted: res.upserted });
      await db.patch('sync_state', `entity=eq.${entity}`, {
        status: 'idle', last_synced_at: startedAt.toISOString(), ...(mode === 'full' ? { last_full_sync_at: startedAt.toISOString() } : {}),
      });
      log(`${entity}: done fetched=${res.fetched} upserted=${res.upserted}`);
    } catch (e) {
      await db.patch('sync_runs', `id=eq.${run.id}`, { status: 'failed', finished_at: new Date().toISOString(), error: String(e.message).slice(0, 1000) });
      await db.patch('sync_state', `entity=eq.${entity}`, { status: 'error', last_error: String(e.message).slice(0, 1000) });
      log(`${entity}: FAILED ${e.message}`);
      throw e;
    }
  }
}
