import { createClient } from 'npm:@supabase/supabase-js@2'

// Looks up a candidate's public profile (skills, job history) on SignalHire WITHOUT revealing contacts.
// Uses the search API only: no contact credits are spent. The API key lives only in this function's secrets.
const BASE = 'https://www.signalhire.com/api/v1/candidate'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const norm = (s?: string | null) => (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
const words = (s?: string | null) => norm(s).split(' ').filter((w) => w.length > 2)

interface Cand { full_name: string; current_position: string | null; current_organization: string | null; city: string | null; state: string | null; country: string | null }
interface Profile { uid: string; fullName: string; location?: string; openToWork?: boolean; skills?: string[]; experience?: { company?: string; title?: string }[] }

async function search(key: string, body: Record<string, unknown>): Promise<{ status: number; profiles: Profile[]; total: number; msg?: string }> {
  const r = await fetch(`${BASE}/searchByQuery`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const text = await r.text()
  let data: any = null
  try { data = JSON.parse(text) } catch { /* not json */ }
  if (!r.ok) return { status: r.status, profiles: [], total: 0, msg: data?.error || data?.message || text.slice(0, 200) }
  return { status: r.status, profiles: data?.profiles ?? [], total: data?.total ?? 0 }
}

function score(c: Cand, p: Profile) {
  let s = 0; const why: string[] = []
  const cn = norm(c.full_name), pn = norm(p.fullName)
  if (cn && cn === pn) { s += 45; why.push('Exact name') }
  else { const a = new Set(words(c.full_name)); const b = words(p.fullName); const hit = b.filter((w) => a.has(w)).length; if (hit) { s += Math.round(30 * hit / Math.max(a.size, b.length, 1)); why.push('Similar name') } }
  const orgWords = words(c.current_organization)
  const exp = p.experience ?? []
  if (orgWords.length) {
    const cur = exp[0]?.company ? norm(exp[0].company) : ''
    const anyPast = exp.some((e) => orgWords.some((w) => norm(e.company).includes(w)))
    if (cur && orgWords.some((w) => cur.includes(w))) { s += 30; why.push('Same current company') }
    else if (anyPast) { s += 18; why.push('Worked at same company') }
  }
  const tw = words(c.current_position)
  if (tw.length && exp.some((e) => { const t = words(e.title); return tw.filter((w) => t.includes(w)).length >= Math.min(2, tw.length) })) { s += 15; why.push('Similar job title') }
  const loc = norm(p.location)
  if (loc && [c.city, c.state, c.country].some((x) => x && loc.includes(norm(x)))) { s += 10; why.push('Same location') }
  return { score: Math.min(s, 100), why }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const key = Deno.env.get('SIGNALHIRE_API_KEY')
    if (!key) return json({ error: 'not_configured', message: 'SignalHire is not set up yet. An admin needs to add the SIGNALHIRE_API_KEY secret.' }, 503)

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, db: { schema: 'crm' },
    })
    const { data: ok } = await sb.rpc('can_write')
    if (!ok) return json({ error: 'forbidden', message: 'You do not have permission to do this.' }, 403)

    const { candidate_id } = await req.json().catch(() => ({}))
    if (!candidate_id) return json({ error: 'bad_request', message: 'candidate_id is required' }, 400)
    const { data: c } = await sb.from('candidates').select('full_name,current_position,current_organization,city,state,country').eq('id', candidate_id).maybeSingle()
    if (!c) return json({ error: 'not_found', message: 'Candidate not found' }, 404)
    const name = (c.full_name ?? '').trim()
    if (!name) return json({ error: 'no_name', message: 'This candidate has no name to search with.' }, 422)

    // 1) name + company (company may be stale, so match past employers too); 2) fall back to name only
    const org = (c.current_organization ?? '').split(/[\/→,|&]| -> /)[0].replace(/["()]/g, ' ').trim()
    let res = org ? await search(key, { fullName: name, currentPastCompany: `"${org}"`, size: 10 }) : null
    if (!res || res.status === 422 || !res.profiles.length) res = await search(key, { fullName: name, size: 10 })
    if (res.status === 402) return json({ error: 'quota', message: 'SignalHire daily search limit reached. It resets daily.' }, 429)
    if (res.status === 429) return json({ error: 'rate_limit', message: 'SignalHire is busy. Wait a few seconds and try again.' }, 429)
    if (res.status === 401 || res.status === 403) return json({ error: 'auth', message: 'SignalHire rejected the API key.' }, 502)
    if (res.status >= 400) return json({ error: 'upstream', message: res.msg || `SignalHire error ${res.status}` }, 502)

    const matches = res.profiles.map((p) => ({ ...p, ...score(c as Cand, p) })).sort((a, b) => b.score - a.score).slice(0, 6)
    return json({ matches, total: res.total, searched: name })
  } catch (e) {
    return json({ error: 'internal', message: String((e as Error)?.message ?? e) }, 500)
  }
})
