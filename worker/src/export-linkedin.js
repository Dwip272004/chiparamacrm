// Exports every candidate with their LinkedIn link so contacts can be enriched elsewhere.
// Output goes to ../exports (git-ignored: contains personal data).
import { mkdirSync, writeFileSync } from 'node:fs';
import { select } from './db.js';

const cols = 'id,rc_id,full_name,linkedin_url,email,phone,current_position,current_organization,city,country,raw->resume->>file_link';
const rows = [];
for (let off = 0; ; off += 1000) {
  const page = await select('candidates', `select=${encodeURIComponent(cols)}&order=full_name.asc,id.asc&limit=1000&offset=${off}`);
  rows.push(...page);
  if (page.length < 1000) break;
}
const clean = (u) => { const t = (u ?? '').trim(); if (!t) return ''; return /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`; };
const q = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const has = (v) => !!(v ?? '').trim();

const list = rows.map((r) => {
  const missing = [!has(r.email) && 'email', !has(r.phone) && 'phone'].filter(Boolean).join('+');
  return { ...r, linkedin: clean(r.linkedin_url), missing };
}).sort((a, b) => (!!b.linkedin - !!a.linkedin) || (b.missing === 'email+phone') - (a.missing === 'email+phone') || (!!b.missing - !!a.missing));

const head = ['full_name', 'linkedin_url', 'missing_contact', 'email', 'phone', 'current_position', 'current_organization', 'city', 'country', 'portal_id', 'recruitcrm_id'];
const csv = [head.join(','), ...list.map((r) => [r.full_name, r.linkedin, r.missing, r.email, r.phone, r.current_position, r.current_organization, r.city, r.country, r.id, r.rc_id].map(q).join(','))].join('\n');

mkdirSync('../exports', { recursive: true });
writeFileSync('../exports/candidates_linkedin.csv', csv + '\n');
const urls = [...new Set(list.filter((r) => r.linkedin && r.missing).map((r) => r.linkedin))];
writeFileSync('../exports/linkedin_urls_missing_contact.txt', urls.join('\n') + '\n');

const n = (f) => list.filter(f).length;
console.log(JSON.stringify({ total: list.length, with_linkedin: n((r) => r.linkedin), without_linkedin: n((r) => !r.linkedin),
  missing_both: n((r) => r.missing === 'email+phone'), missing_any_with_linkedin: n((r) => r.linkedin && r.missing), unique_urls_missing_contact: urls.length }));

// ---- Upload-sized chunks (each file < 190 KB, one link per row, header "linkedin_url") ----
import { rmSync } from 'node:fs';
const LIMIT = 190_000;
const norm = (u) => { try { const x = new URL(u); if (/\/in\//.test(x.pathname)) return `https://www.linkedin.com${x.pathname.replace(/\/+$/, '')}`; } catch { /* keep as is */ } return u; };
const groups = { in: [], recruiter: [], other: [] };
for (const u of new Set(urls.map(norm))) (/linkedin\.com\/in\//i.test(u) ? groups.in : /linkedin\.com\/talent\//i.test(u) ? groups.recruiter : groups.other).push(u);
rmSync('../exports/signalhire', { recursive: true, force: true });
mkdirSync('../exports/signalhire', { recursive: true });
const made = [];
for (const [kind, arr] of Object.entries(groups)) {
  let part = 1, buf = [], size = 'linkedin_url\n'.length;
  const flush = () => { if (!buf.length) return; const f = `${kind}_${String(part++).padStart(2, '0')}.csv`; writeFileSync(`../exports/signalhire/${f}`, 'linkedin_url\n' + buf.join('\n') + '\n'); made.push(`${f}: ${buf.length} links, ${Math.round(size / 1000)} KB`); buf = []; size = 'linkedin_url\n'.length; };
  for (const u of arr) { if (size + u.length + 1 > LIMIT) flush(); buf.push(u); size += u.length + 1; }
  flush();
}
console.log(made.join('\n'));
