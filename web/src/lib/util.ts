import { useEffect, useState } from 'react'
export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')
export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export function ago(d?: string | null) {
  if (!d) return '—'
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`
  return fmtDate(d)
}
export const place = (c: { city?: string | null; state?: string | null; country?: string | null }) => [c.city, c.country].filter(Boolean).join(', ')
export const initials = (n?: string | null) => (n ?? '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
export const money = (n?: number | null) => (n ? n.toLocaleString() : '—')
export function useDebounced<T>(v: T, ms = 250): T {
  const [x, setX] = useState(v)
  useEffect(() => { const t = setTimeout(() => setX(v), ms); return () => clearTimeout(t) }, [v, ms])
  return x
}

// "Open" jobs include ones the calling software marks Active; Pending Review jobs are waiting for an admin.
export const isOpenStatus = (s?: string | null) => /^(open|active)$/i.test((s ?? '').trim())
export const isPendingStatus = (s?: string | null) => /pending/i.test(s ?? '')
