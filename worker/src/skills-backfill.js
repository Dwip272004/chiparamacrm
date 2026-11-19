// One-off backfill: find skills for candidates that have none, using SignalHire SEARCH only
// (public skills + job history, no contact details, no contact credits).
//   npm run skills:search -- --limit 100    look up + record proposals (does NOT change any candidate)
//   npm run skills:apply                    apply the recorded proposals (queues the change for RecruitCRM)
// A candidate is only proposed when the match is unambiguous: exact name AND a second signal
// (company / job title / location), a high score, and a clear gap to the runner-up.
import { mkdirSync, writeFileSync } from 'node:fs';
import * as db from './db.js';

const BASE = 'https://www.signalhire.com/api/v1/candidate';
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? Number(process.argv[i + 1]) : d; };
const mode = process.argv[2] ?? 'search';
// SignalHire's daily quota counts every profile RETURNED, so ask for as few as the match needs.
const SIZE1 = arg('size', 3), SIZE2 = arg('fallback-size', 5);
const LIMIT = arg('limit', 100), CONC = Math.min(arg('concurrency', 2), 3), MIN = arg('min-score', 70), MARGIN = arg('margin', 20), MAXSK = arg('max-skills', 30);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const norm = (s) => (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => norm(s).split(' ').filter((w) => w.length > 2);

class Quota extends Error {}
async function search(body) {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(`${BASE}/searchByQuery`, { method: 'POST', headers: { apikey: process.env.SIGNALHIRE_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const text = await r.text(); let d = null; try { d = JSON.parse(text); } catch { /* not json */ }
    if (r.status === 402) throw new Quota('SignalHire daily search limit reached');
    if (r.status === 401 || r.status === 403) throw new Error(`SignalHire rejected the API key (${r.status})`);
    if (r.status === 429 && attempt < 5) { await sleep(3000 * attempt); continue; }
    if (r.status === 422) return { profiles: [], bad: true };
    if (!r.ok) throw new Error(`SignalHire ${r.status}: ${text.slice(0, 200)}`);
    return { profiles: d?.profiles ?? [] };
  }
}

function score(c, p) {
  let s = 0; const why = [];
  if (norm(c.full_name) && norm(c.full_name) === norm(p.fullName)) { s += 45; why.push('Exact name'); }
  else { const a = new Set(words(c.full_name)); const b = words(p.fullName); const hit = b.filter((w) => a.has(w)).length; if (hit) { s += Math.round(30 * hit / Math.max(a.size, b.length, 1)); why.push('Similar name'); } }
  const orgWords = words(c.current_organization); const exp = p.experience ?? [];
  if (orgWords.length) {
    const cur = exp[0]?.company ? norm(exp[0].company) : '';
    if (cur && orgWords.some((w) => cur.includes(w))) { s += 30; why.push('Same current company'); }
    else if (exp.some((e) => orgWords.some((w) => norm(e.company).includes(w)))) { s += 18; why.push('Worked at same company'); }
  }
  const tw = words(c.current_position);
  if (tw.length && exp.some((e) => { const t = words(e.title); return tw.filter((w) => t.includes(w)).length >= Math.min(2, tw.length); })) { s += 15; why.push('Similar job title'); }
  const loc = norm(p.location);
  if (loc && [c.city, c.state, c.country].some((x) => x && loc.includes(norm(x)))) { s += 10; why.push('Same location'); }
  return { score: Math.min(s, 100), why };
}

async function lookup(c) {
  const org = (c.current_organization ?? '').split(/[/→,|&]| -> /)[0].replace(/["()]/g, ' ').trim();
  const place = [c.city, c.country].filter(Boolean).join(', ');
  let res = org ? await search({ fullName: c.full_name, currentPastCompany: `"${org}"`, size: SIZE1 }) : null;
  if ((!res || !res.profiles.length) && place) res = await search({ fullName: c.full_name, location: place, size: SIZE2 });
  if (!res || !res.profiles.length) res = await search({ fullName: c.full_name, size: SIZE2 });
  const scored = res.profiles.map((p) => ({ ...p, ...score(c, p) })).sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  const row = { candidate_id: c.id, searched_at: new Date().toISOString() };
  if (!best) return { ...row, status: 'no_match' };
  Object.assign(row, { signalhire_uid: best.uid, matched_name: best.fullName, matched_location: best.location ?? null, score: best.score, second_score: second?.score ?? null, reasons: best.why });
  if (!best.skills?.length) return { ...row, status: 'no_skills' };
  const corroborated = best.why.some((w) => !/name$/i.test(w));
  if (!best.why.includes('Exact name') || !corroborated || best.score < MIN) return { ...row, status: 'low_confidence' };
  if (second && best.score - second.score < MARGIN) return { ...row, status: 'ambiguous' };
  return { ...row, status: 'proposed', proposed_skills: best.skills.slice(0, MAXSK) };
}

async function runSearch() {
  if (!process.env.SIGNALHIRE_API_KEY) throw new Error('SIGNALHIRE_API_KEY missing (add it to .env.local)');
  const counts = {}; const preview = []; let done = 0, offset = 0, stop = false;
  while (done < LIMIT && !stop) {
    const cands = await db.select('candidates', `select=id,full_name,current_position,current_organization,city,state,country&skills=eq.%7B%7D&order=rc_updated_at.desc.nullslast,id.asc&limit=200&offset=${offset}`);
    if (!cands.length) break;
    offset += cands.length;
    const seen = new Set((await db.select('skill_lookups', `select=candidate_id&candidate_id=in.(${cands.map((c) => c.id).join(',')})`)).map((r) => r.candidate_id));
    const todo = cands.filter((c) => !seen.has(c.id) && c.full_name?.trim().split(/\s+/).length >= 2 && (c.current_organization || c.city || c.country));
    for (let i = 0; i < todo.length && done < LIMIT && !stop; i += CONC) {
      const group = todo.slice(i, Math.min(i + CONC, i + (LIMIT - done)));
      const rows = [];
      await Promise.all(group.map(async (c) => {
        try { const r = await lookup(c); rows.push(r); counts[r.status] = (counts[r.status] ?? 0) + 1; if (r.status === 'proposed') preview.push({ c, r }); }
        catch (e) { if (e instanceof Quota) { stop = true; log(e.message + ' - stopping; run again after it resets'); } else log(`  error ${c.full_name}: ${e.message}`); }
      }));
      const K = ['candidate_id', 'status', 'signalhire_uid', 'matched_name', 'matched_location', 'score', 'second_score', 'reasons', 'proposed_skills', 'searched_at'];
      if (rows.length) await db.upsert('skill_lookups', rows.map((r) => Object.fromEntries(K.map((k) => [k, r[k] ?? null]))), 'candidate_id', 'candidate_id');
      done += rows.length;
      if (done % 20 < CONC) log(`  ${done}/${LIMIT} looked up`, JSON.stringify(counts));
      await sleep(400);
    }
  }
  mkdirSync('../exports', { recursive: true });
  const q = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = ['candidate,company,location,matched_name,matched_location,score,reasons,skills', ...preview.map(({ c, r }) => [c.full_name, c.current_organization, [c.city, c.country].filter(Boolean).join(', '), r.matched_name, r.matched_location, r.score, r.reasons.join(' + '), r.proposed_skills.slice(0, 10).join('; ')].map(q).join(','))].join('\n');
  writeFileSync('../exports/skills_backfill_preview.csv', csv + '\n');
  log('done', JSON.stringify(counts), `| preview: exports/skills_backfill_preview.csv (${preview.length} proposed this run)`);
}

async function runApply() {
  let applied = 0, added = 0;
  for (;;) {
    const rows = await db.select('skill_lookups', 'select=candidate_id,signalhire_uid,proposed_skills&status=eq.proposed&limit=200');
    if (!rows.length) break;
    for (const r of rows) {
      try { added += await db.rpc('apply_looked_up_skills', { p_candidate: r.candidate_id, p_skills: r.proposed_skills, p_uid: r.signalhire_uid }); applied++; }
      catch (e) { log(`  failed ${r.candidate_id}: ${e.message}`); await db.patch('skill_lookups', `candidate_id=eq.${r.candidate_id}`, { status: 'skipped', note: String(e.message).slice(0, 200) }); }
    }
    log(`applied ${applied} candidates (${added} skills)`);
  }
  log('apply finished');
}

(mode === 'apply' ? runApply() : runSearch()).catch((e) => { console.error(e.message); process.exit(1); });
