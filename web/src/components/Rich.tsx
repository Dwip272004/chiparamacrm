import { useEffect, useRef } from 'react'
import DOMPurify from 'dompurify'
import { Bold, Italic, List, ListOrdered } from 'lucide-react'
import { cx } from '../lib/util'

DOMPurify.addHook('afterSanitizeAttributes', (n) => {
  if (n.tagName === 'A') { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener noreferrer nofollow') }
})
const CFG = {
  ALLOWED_TAGS: ['p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'a', 'blockquote', 'hr', 'table', 'thead', 'tbody', 'tr', 'td', 'th'],
  ALLOWED_ATTR: ['href'],
}
const looksLikeHtml = (s: string) => /<\/?[a-z][^>]*>/i.test(s)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Safe HTML for display: sanitised RecruitCRM HTML, or plain text with line breaks preserved.
export const toSafeHtml = (s?: string | null) => (!s ? '' : DOMPurify.sanitize(looksLikeHtml(s) ? s : esc(s).replace(/\n/g, '<br>'), CFG) as unknown as string)
export const stripHtml = (s?: string | null) => (s ? s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : '')

export function RichText({ html, className, empty }: { html?: string | null; className?: string; empty?: string }) {
  const safe = toSafeHtml(html)
  if (!safe) return <div className="text-sm text-slate-400">{empty ?? '—'}</div>
  return <div className={cx('rich', className)} dangerouslySetInnerHTML={{ __html: safe }} />
}

export function RichEditor({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current) ref.current.innerHTML = toSafeHtml(value) }, []) // set once; the user edits the DOM directly
  const cmd = (c: string) => { ref.current?.focus(); document.execCommand(c) ; push() }
  const push = () => onChange(DOMPurify.sanitize(ref.current?.innerHTML ?? '', CFG) as unknown as string)
  const Btn = ({ c, children, t }: { c: string; children: React.ReactNode; t: string }) => (
    <button type="button" title={t} onMouseDown={(e) => { e.preventDefault(); cmd(c) }} className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800">{children}</button>
  )
  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
      <div className="flex gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1">
        <Btn c="bold" t="Bold"><Bold className="h-3.5 w-3.5" /></Btn><Btn c="italic" t="Italic"><Italic className="h-3.5 w-3.5" /></Btn>
        <Btn c="insertUnorderedList" t="Bullets"><List className="h-3.5 w-3.5" /></Btn><Btn c="insertOrderedList" t="Numbered list"><ListOrdered className="h-3.5 w-3.5" /></Btn>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning data-placeholder={placeholder} onInput={push} className="rich max-h-80 min-h-40 overflow-auto px-3 py-2 outline-none scroll-thin" />
    </div>
  )
}
