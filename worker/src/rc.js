// RecruitCRM API client: bearer auth, pagination, rate-limit aware, retries.
const BASE = 'https://api.recruitcrm.io/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class RcError extends Error {
  constructor(status, body, path) { super(`RecruitCRM ${status} on ${path}: ${String(body).slice(0, 200)}`); this.status = status; }
}

export async function rc(path, { method = 'GET', body, tries = 5 } = {}) {
  const key = process.env.RECRUITCRM_API_KEY;
  if (!key) throw new Error('RECRUITCRM_API_KEY missing');
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(BASE + path, {
      method,
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const remaining = Number(res.headers.get('x-ratelimit-remaining'));
    const reset = Number(res.headers.get('x-ratelimit-reset'));
    if (res.status === 429 || (Number.isFinite(remaining) && remaining <= 3 && reset)) {
      const wait = Math.max(1000, reset * 1000 - Date.now() + 500);
      if (res.status === 429 && attempt >= tries) throw new RcError(429, 'rate limited', path);
      await sleep(Math.min(wait, 70_000));
      if (res.status === 429) continue;
    }
    if (res.status >= 500 && attempt < tries) { await sleep(1000 * attempt ** 2); continue; }
    const text = await res.text();
    if (!res.ok) throw new RcError(res.status, text, path);
    try { return text ? JSON.parse(text) : null; } catch { return text; }
  }
}

// Yields pages (arrays of rows). Handles both {data:[...]} and bare-array responses.
export async function* pages(path, { limit = 100, params = '' } = {}) {
  for (let page = 1; ; page++) {
    const sep = path.includes('?') ? '&' : '?';
    let r;
    try { r = await rc(`${path}${sep}limit=${limit}&page=${page}${params}`); }
    catch (e) { if (page > 1 && e.status === 404) return; throw e; } // API 404s on an empty trailing page
    const rows = Array.isArray(r) ? r : r?.data ?? [];
    if (!rows.length) return;
    yield rows;
    if (!Array.isArray(r) && !r.next_page_url) return;
    if (rows.length < limit && Array.isArray(r)) return;
  }
}
