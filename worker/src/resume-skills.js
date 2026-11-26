// Backfill skills from resumes: download each candidate's resume (PDF / DOCX) from RecruitCRM, pull out the text
// and match it against the skill vocabulary already used in the database (plus a few common extras).
// No AI service and no credits are used; it only ever ADDS skills to candidates that have none.
//   npm run skills:resume -- --limit 100     parse + record proposals (does NOT change any candidate)
//   npm run skills:resume:apply              apply the recorded proposals (queues the change for RecruitCRM)
import { mkdirSync, writeFileSync } from 'node:fs';
import * as db from './db.js';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? Number(process.argv[i + 1]) : d; };
const mode = process.argv[2] ?? 'run';
const LIMIT = arg('limit', 100), CONC = Math.min(arg('concurrency', 5), 8), MINFREQ = arg('min-freq', 15), MAXSK = arg('max-skills', 25);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// Too generic to say anything about a person.
const GENERIC = new Set(['communication', 'engineering', 'architecture', 'programming', 'testing', 'leadership', 'problem solving', 'information technology', 'electronics', 'algorithms', 'databases', 'scripting', 'simulations', 'microsoft office', 'project management', 'data analysis', 'debugging', 'software debugging', 'teamwork', 'management', 'research', 'analysis', 'design', 'software', 'hardware', 'technology', 'computer science', 'electrical engineering', 'test planning', 'ic', 'semiconductors', 'integrated circuit design', 'microsoft excel', 'microsoft word', 'microsoft powerpoint', 'customer service', 'time management', 'planning', 'training', 'sales', 'english', 'engineer', 'development', 'tools', 'system', 'systems', 'computer', 'computers', 'networking', 'security', 'documentation', 'validation', 'verification', 'simulation', 'embedded', 'automation', 'coding', 'electrical', 'mathematics', 'physics', 'c', 'performance', 'power', 'business', 'workflows', 'workflow', 'regression', 'metrics', 'compliance', 'strategy', 'can', 'ip', 'debug', 'optimization', 'modeling', 'analytics', 'collaboration', 'scheduling', 'maintenance', 'packaging', 'governance', 'reliability', 'manufacturing', 'infrastructure', 'banking', 'protocol', 'peripherals', 'silicon', 'business development', 'marketing', 'dashboards', 'troubleshooting', 'windows', 'mobile devices', 'communication skills', 'adaptability', 'decision-making', 'cross-functional collaboration', 'continuous improvement', 'process improvement', 'enterprise software', 'software systems', 'machine', 'operations', 'quality', 'support', 'process', 'data', 'cloud', 'network', 'mobile', 'web', 'sdk', 'api']);
const EXTRA = ['SystemVerilog', 'Verilog', 'VHDL', 'UVM', 'RTL Design', 'Static Timing Analysis', 'Physical Design', 'Synopsys', 'Cadence', 'Mentor Graphics', 'Primetime', 'Innovus', 'Design Compiler', 'ICC2', 'Calibre', 'DFT', 'Python', 'C++', 'Perl', 'TCL', 'Linux', 'PCIe', 'DDR', 'AMBA', 'AXI', 'AHB', 'APB', 'SPI', 'UART', 'I2C', 'USB', 'FPGA', 'ASIC', 'SoC', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'React', 'Node.js', 'TypeScript', 'JavaScript', 'Java', 'SQL', 'Git'];

const acro = (s) => /^[A-Z0-9][A-Za-z0-9+#.\-]{1,9}$/.test(s);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function buildVocab() {
  const freq = new Map(); let offset = 0;
  for (;;) {
    const rows = await db.select('candidates', `select=skills&skills=neq.%7B%7D&order=id.asc&limit=1000&offset=${offset}`);
    if (!rows.length) break; offset += rows.length;
    for (const r of rows) for (const s of r.skills ?? []) { const t = s.trim(); if (t) freq.set(t, (freq.get(t) ?? 0) + 1); }
  }
  // "Universal Verification Methodology (UVM)", "Python (Programming Language)" -> base + alias, merged into one skill
  const parent = new Map(); const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { if (!parent.has(a)) parent.set(a, a); if (!parent.has(b)) parent.set(b, b); parent.set(find(a), find(b)); };
  const acroBases = new Map();
  for (const s of freq.keys()) { const m = s.match(/^(.*?)\s*\(([^)]+)\)\s*$/); if (m && acro(m[2].trim()) && !/programming language/i.test(m[2])) { const k = m[2].trim().toLowerCase(); (acroBases.get(k) ?? acroBases.set(k, new Set()).get(k)).add(m[1].trim().toLowerCase()); } }
  const counts = new Map(); // lowercased key -> {form: count}
  const add = (form, n) => { const k = form.toLowerCase(); if (!parent.has(k)) parent.set(k, k); const m = counts.get(k) ?? {}; m[form] = (m[form] ?? 0) + n; counts.set(k, m); };
  for (const [s, n] of freq) {
    const m = s.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (m && /programming language/i.test(m[2])) { add(m[1], n); continue; }
    if (m && acro(m[2].trim())) { add(m[1].trim(), n); add(m[2].trim(), n); if (acroBases.get(m[2].trim().toLowerCase()).size === 1) union(m[1].trim().toLowerCase(), m[2].trim().toLowerCase()); continue; }
    add(s, n);
  }
  for (const e of EXTRA) add(e, 0);
  const groups = new Map();
  for (const [k, forms] of counts) { const g = find(k); const cur = groups.get(g) ?? { forms: {}, total: 0 }; for (const [f, n] of Object.entries(forms)) { cur.forms[f] = (cur.forms[f] ?? 0) + n; cur.total += n; } groups.set(g, cur); }
  const vocab = [];
  for (const { forms, total } of groups.values()) {
    if (total < MINFREQ && !Object.keys(forms).some((f) => EXTRA.includes(f))) continue;
    const names = Object.keys(forms).sort((a, b) => forms[b] - forms[a] || a.length - b.length);
    // canonical = most common spelling; prefer the plain base over the long "Foo (Bar)" style
    const canonical = names[0];
    const pats = names.filter((n) => !GENERIC.has(n.toLowerCase()) && n.length >= 2).map((n) => {
      const body = esc(n).replace(/\s+/g, '\\s+');
      const caseSens = n.length <= 4 && n === n.toUpperCase();
      return new RegExp(`(?<![A-Za-z0-9+#])${body}(?![A-Za-z0-9+#])`, caseSens ? '' : 'i');
    });
    if (!pats.length || GENERIC.has(canonical.toLowerCase())) continue;
    vocab.push({ name: canonical, pats, total });
  }
  // "C" on its own needs a skills-list context ("C, C++", "C/C++", "C programming")
  vocab.push({ name: 'C', pats: [/(?<![A-Za-z0-9+#.])C(?=\s*[,/|;•·]|\s+(?:programming|language)\b)/], total: freq.get('C') ?? 0 });
  return vocab;
}

function extract(text, vocab) {
  const found = [];
  for (const v of vocab) {
    let n = 0; for (const p of v.pats) { const m = text.match(new RegExp(p.source, p.flags + 'g')); if (m) n += m.length; }
    if (n) found.push({ name: v.name, n });
  }
  return found.sort((a, b) => b.n - a.n).slice(0, MAXSK).map((f) => f.name);
}

async function readText(buf, filename) {
  const ext = (filename.split('.').pop() ?? '').toLowerCase();
  if (buf.slice(0, 4).toString('latin1') === '%PDF' || ext === 'pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  if (buf.slice(0, 2).toString('latin1') === 'PK' || ext === 'docx') {
    const mammoth = (await import('mammoth')).default;
    return (await mammoth.extractRawText({ buffer: buf })).value;
  }
  return null; // .doc / .rtf / images
}

async function one(c, vocab) {
  const row = { candidate_id: c.id, filename: c.resume?.filename ?? null, parsed_at: new Date().toISOString() };
  try {
    const res = await fetch(c.resume.file_link, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return { ...row, status: 'failed', note: `download ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 12e6) return { ...row, status: 'skipped', note: 'file too large' };
    const text = await readText(buf, row.filename ?? '');
    if (text == null) return { ...row, status: 'unreadable', note: 'unsupported file type' };
    if (text.replace(/\s+/g, '').length < 150) return { ...row, status: 'unreadable', chars: text.length, note: 'no readable text (scanned?)' };
    const skills = extract(text, vocab);
    return skills.length ? { ...row, status: 'proposed', chars: text.length, proposed_skills: skills } : { ...row, status: 'no_skills', chars: text.length };
  } catch (e) { return { ...row, status: 'failed', note: String(e.message).slice(0, 200) }; }
}

async function runParse() {
  const vocab = await buildVocab(); log(`vocabulary: ${vocab.length} skills`);
  const counts = {}; const preview = []; let done = 0, offset = 0;
  while (done < LIMIT) {
    const cands = await db.select('candidates', `select=id,full_name,resume:raw->resume&resume_url=not.is.null&or=(skills.is.null,skills.eq.%7B%7D)&order=id.asc&limit=200&offset=${offset}`);
    if (!cands.length) break; offset += cands.length;
    const seen = new Set((await db.select('resume_skill_runs', `select=candidate_id&candidate_id=in.(${cands.map((c) => c.id).join(',')})`)).map((r) => r.candidate_id));
    const todo = cands.filter((c) => !seen.has(c.id) && c.resume?.file_link && !/^~\$/.test(c.resume.filename ?? ''));
    for (let i = 0; i < todo.length && done < LIMIT; i += CONC) {
      const group = todo.slice(i, Math.min(i + CONC, i + (LIMIT - done)));
      const rows = await Promise.all(group.map((c) => one(c, vocab)));
      rows.forEach((r, k) => { counts[r.status] = (counts[r.status] ?? 0) + 1; if (r.status === 'proposed') preview.push({ c: group[k], r }); });
      const K = ['candidate_id', 'status', 'filename', 'chars', 'proposed_skills', 'note', 'parsed_at'];
      await db.upsert('resume_skill_runs', rows.map((r) => Object.fromEntries(K.map((k) => [k, r[k] ?? null]))), 'candidate_id', 'candidate_id');
      done += rows.length; if (done % 50 < CONC) log(`  ${done}/${LIMIT}`, JSON.stringify(counts));
    }
  }
  mkdirSync('../exports', { recursive: true });
  const q = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  writeFileSync('../exports/resume_skills_preview.csv', ['candidate,file,skills', ...preview.map(({ c, r }) => [c.full_name, r.filename, r.proposed_skills.join('; ')].map(q).join(','))].join('\n') + '\n');
  log('done', JSON.stringify(counts), '| preview: exports/resume_skills_preview.csv');
}

async function runApply() {
  let applied = 0, added = 0;
  for (;;) {
    const rows = await db.select('resume_skill_runs', 'select=candidate_id,proposed_skills&status=eq.proposed&limit=200');
    if (!rows.length) break;
    for (const r of rows) {
      try { added += await db.rpc('apply_resume_skills', { p_candidate: r.candidate_id, p_skills: r.proposed_skills }); applied++; }
      catch (e) { log(`  failed ${r.candidate_id}: ${e.message}`); await db.patch('resume_skill_runs', `candidate_id=eq.${r.candidate_id}`, { status: 'skipped', note: String(e.message).slice(0, 200) }); }
    }
    log(`applied ${applied} candidates (${added} skills)`);
  }
  log('apply finished');
}

(mode === 'apply' ? runApply() : runParse()).catch((e) => { console.error(e.message); process.exit(1); });
