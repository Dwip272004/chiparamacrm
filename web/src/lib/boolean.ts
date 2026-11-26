// Boolean skill search:  python AND (verilog OR "system verilog") NOT matlab   ·   a, b  (comma = AND)
// Compiled to "any of these clauses": each clause = skills that must all be present (p) and none present (n).
export interface Clause { p: string[]; n: string[] }

type Node = { t: 'term'; v: string } | { t: 'and' | 'or'; a: Node; b: Node } | { t: 'not'; a: Node }
type Tok = { k: 'term' | 'AND' | 'OR' | 'NOT' | '(' | ')'; v?: string }

function tokenize(src: string): Tok[] {
  const out: Tok[] = []; let word: string[] = []
  const flush = () => { if (word.length) { out.push({ k: 'term', v: word.join(' ') }); word = [] } }
  const re = /"([^"]*)"|\(|\)|,|&&|\|\||[^\s(),"]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const s = m[0]
    if (m[1] !== undefined) { flush(); if (m[1].trim()) out.push({ k: 'term', v: m[1].trim() }) }
    else if (s === '(' || s === ')') { flush(); out.push({ k: s }) }
    else if (s === ',' || s === '&&' || /^and$/i.test(s)) { flush(); out.push({ k: 'AND' }) }
    else if (s === '||' || /^or$/i.test(s)) { flush(); out.push({ k: 'OR' }) }
    else if (/^not$/i.test(s)) { flush(); out.push({ k: 'NOT' }) }
    else word.push(s) // unquoted neighbouring words form one phrase: static timing analysis
  }
  flush(); return out
}

function parse(toks: Tok[]): Node | null {
  let i = 0
  const peek = () => toks[i]
  const atom = (): Node | null => {
    const t = peek(); if (!t) return null
    if (t.k === 'term') { i++; return { t: 'term', v: t.v! } }
    if (t.k === '(') { i++; const n = or(); if (peek()?.k === ')') i++; return n }
    return null
  }
  const not = (): Node | null => { if (peek()?.k === 'NOT') { i++; const a = not(); return a ? { t: 'not', a } : null } return atom() }
  const and = (): Node | null => {
    let l = not()
    while (l) {
      const k = peek()?.k
      if (k === 'AND') i++
      else if (!(k === 'term' || k === '(' || k === 'NOT')) break // implicit AND between groups
      const r = not(); if (!r) break
      l = { t: 'and', a: l, b: r }
    }
    return l
  }
  const or = (): Node | null => {
    let l = and()
    while (l && peek()?.k === 'OR') { i++; const r = and(); if (!r) break; l = { t: 'or', a: l, b: r } }
    return l
  }
  return or()
}

// push NOT down to the terms (De Morgan), then expand to OR-of-ANDs
function dnf(n: Node, neg = false): Clause[] {
  if (n.t === 'term') return [neg ? { p: [], n: [n.v] } : { p: [n.v], n: [] }]
  if (n.t === 'not') return dnf(n.a, !neg)
  const isOr = (n.t === 'or') !== neg
  const A = dnf(n.a, neg), B = dnf(n.b, neg)
  if (isOr) return [...A, ...B]
  const out: Clause[] = []
  for (const x of A) for (const y of B) { out.push({ p: [...x.p, ...y.p], n: [...x.n, ...y.n] }); if (out.length > 60) return out }
  return out
}

const esc = (s: string) => s.replace(/[\\%_]/g, '\\$&')

/** null = nothing to filter on. Clauses that contradict themselves (a AND NOT a) are dropped. */
export function compileSkillQuery(src?: string | null): Clause[] | null {
  const text = (src ?? '').trim(); if (!text) return null
  const tree = parse(tokenize(text)); if (!tree) return null
  const seen = new Set<string>(); const out: Clause[] = []
  for (const c of dnf(tree)) {
    const p = [...new Set(c.p.map((x) => x.toLowerCase()))], n = [...new Set(c.n.map((x) => x.toLowerCase()))]
    if (p.some((x) => n.includes(x))) continue
    const key = JSON.stringify([p.sort(), n.sort()]); if (seen.has(key)) continue; seen.add(key)
    out.push({ p: p.map(esc), n: n.map(esc) })
  }
  return out.length ? out.slice(0, 50) : [{ p: ['\\u0000nomatch'], n: [] }]
}

export const isBooleanQuery = (s: string) => /["()]|\b(and|or|not)\b|&&|\|\|/i.test(s)
