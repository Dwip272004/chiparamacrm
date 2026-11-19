import { createClient } from 'npm:@supabase/supabase-js@2'

// Streams a candidate's resume file to the browser so it can be previewed inline (Word files can't be shown by an iframe,
// and the storage host sends no CORS headers). Team members only. The URL comes from the database, never from the caller,
// and is checked to be a RecruitCRM resume link that redirects to RecruitCRM's own storage.
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const MAX = 10 * 1024 * 1024

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, db: { schema: 'crm' },
    })
    const { data: member } = await sb.rpc('is_member')
    if (!member) return json({ error: 'forbidden', message: 'Not allowed' }, 403)

    const { candidate_id } = await req.json().catch(() => ({}))
    if (!candidate_id) return json({ error: 'bad_request', message: 'candidate_id is required' }, 400)
    const { data: c } = await sb.from('candidates').select('raw').eq('id', candidate_id).maybeSingle()
    const link: string | undefined = c?.raw?.resume?.file_link
    if (!link) return json({ error: 'no_resume', message: 'No resume on file' }, 404)

    const u = new URL(link)
    if (u.protocol !== 'https:' || u.hostname !== 'api.recruitcrm.io' || !u.pathname.startsWith('/v1/candidates/')) return json({ error: 'bad_link', message: 'Unexpected resume link' }, 422)
    const first = await fetch(u, { redirect: 'manual' })
    let res = first
    if (first.status >= 300 && first.status < 400) {
      const loc = new URL(first.headers.get('location') ?? '', u)
      if (loc.protocol !== 'https:' || !/(^|\.)amazonaws\.com$/.test(loc.hostname)) return json({ error: 'bad_redirect', message: 'Unexpected file location' }, 502)
      res = await fetch(loc)
    }
    if (!res.ok) return json({ error: 'upstream', message: `Could not fetch the file (${res.status})` }, 502)
    const len = Number(res.headers.get('content-length') ?? 0)
    if (len > MAX) return json({ error: 'too_large', message: 'File is too large to preview' }, 413)
    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX) return json({ error: 'too_large', message: 'File is too large to preview' }, 413)
    return new Response(buf, { headers: { ...cors, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, max-age=300' } })
  } catch (e) {
    return json({ error: 'internal', message: String((e as Error)?.message ?? e) }, 500)
  }
})
