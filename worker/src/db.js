// Minimal Supabase PostgREST client for the `crm` schema (service-role key, bypasses RLS).
const url = () => `${process.env.SUPABASE_URL}/rest/v1`;
const headers = (extra = {}) => ({
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Accept-Profile': 'crm', 'Content-Profile': 'crm',
  'Content-Type': 'application/json', ...extra,
});

async function call(path, init) {
  const res = await fetch(url() + path, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status} ${init.method} ${path.split('?')[0]}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
export const select = (table, query = '') => call(`/${table}?${query}`, { headers: headers() });
export const insert = (table, row) =>
  call(`/${table}`, { method: 'POST', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify(row) });
export const patch = (table, query, body) =>
  call(`/${table}?${query}`, { method: 'PATCH', headers: headers({ Prefer: 'return=minimal' }), body: JSON.stringify(body) });

// Upsert in chunks; returns [{id, rc_id|...}] for the select columns requested.
export async function upsert(table, rows, onConflict, returning = 'id') {
  const out = [];
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const r = await call(`/${table}?on_conflict=${onConflict}&select=${returning}`, {
      method: 'POST',
      headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(chunk),
    });
    out.push(...r);
  }
  return out;
}

const inList = (vals) => `in.(${vals.map((v) => `"${String(v).replace(/"/g, '')}"`).join(',')})`;

// Map rc_id -> uuid for a set of RecruitCRM ids.
export async function idMap(table, rcIds) {
  const map = new Map();
  const ids = [...new Set(rcIds.filter(Boolean))];
  for (let i = 0; i < ids.length; i += 100) {
    const rows = await select(table, `select=id,rc_id&rc_id=${encodeURIComponent(inList(ids.slice(i, i + 100)))}`);
    rows.forEach((r) => map.set(r.rc_id, r.id));
  }
  return map;
}

// rc_ids that have local un-pushed edits - the pull must not overwrite these.
export async function pendingRcIds(table, rcIds) {
  const set = new Set();
  const ids = [...new Set(rcIds.filter(Boolean))];
  for (let i = 0; i < ids.length; i += 100) {
    const rows = await select(table, `select=rc_id&sync_status=neq.synced&rc_id=${encodeURIComponent(inList(ids.slice(i, i + 100)))}`);
    rows.forEach((r) => set.add(r.rc_id));
  }
  return set;
}

// Calls a crm.* function (service role).
export const rpc = (fn, args) => call(`/rpc/${fn}`, { method: 'POST', headers: headers(), body: JSON.stringify(args) });
