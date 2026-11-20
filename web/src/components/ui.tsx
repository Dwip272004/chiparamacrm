import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { AlertCircle, BadgeCheck, Check, Loader2, X } from 'lucide-react'
import { cx } from '../lib/util'

export function Button({ variant = 'primary', size = 'md', loading, className, children, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  const v = {
    primary: 'bg-brand-600 text-white shadow-[0_1px_2px_rgb(16_24_40/.12),inset_0_1px_0_rgb(255_255_255/.14)] hover:bg-brand-700 active:bg-brand-800',
    secondary: 'border border-slate-200 bg-white text-slate-700 shadow-card hover:border-slate-300 hover:bg-slate-50',
    soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    danger: 'bg-red-600 text-white shadow-card hover:bg-red-700',
  }[variant]
  const s = { sm: 'h-7 gap-1 px-2.5 text-xs', md: 'h-9 gap-1.5 px-3.5 text-sm', lg: 'h-11 gap-2 px-5 text-sm' }[size]
  return (
    <button {...p} disabled={p.disabled || loading}
      className={cx('inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-medium transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50', s, v, className)}>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{children}
    </button>
  )
}

const field = 'w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-[0_1px_2px_rgb(16_24_40/.04)] transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 disabled:bg-slate-100 disabled:text-slate-500'
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(field, 'h-9', className)} />
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(field, 'py-2 leading-relaxed', className)} />
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(field, 'h-9 pr-8', className)} />
export const Label = ({ children, hint }: { children: ReactNode; hint?: string }) => (
  <label className="mb-1.5 block text-xs font-medium text-slate-700">{children}{hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}</label>
)

const tones: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-600 ring-slate-200', green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200', blue: 'bg-sky-50 text-sky-700 ring-sky-200', brand: 'bg-brand-50 text-brand-700 ring-brand-200',
}
const dots: Record<string, string> = { slate: 'bg-slate-400', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', blue: 'bg-sky-500', brand: 'bg-brand-500' }
export const Badge = ({ tone = 'slate', children, title, dot }: { tone?: keyof typeof tones; children: ReactNode; title?: string; dot?: boolean }) => (
  <span title={title} className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', tones[tone])}>
    {dot && <i className={cx('h-1.5 w-1.5 rounded-full', dots[tone])} />}{children}
  </span>
)

export function SyncBadge({ status }: { status?: string }) {
  if (!status || status === 'synced') return null
  return <Badge tone={status === 'error' ? 'red' : 'amber'} dot title="Saved here; waiting to be pushed to RecruitCRM">{status === 'error' ? 'Sync error' : 'Pending sync'}</Badge>
}

const gradients = ['#6366f1,#8b5cf6', '#0ea5e9,#6366f1', '#10b981,#0ea5e9', '#f59e0b,#ef4444', '#ec4899,#8b5cf6', '#14b8a6,#3b82f6', '#f97316,#ec4899', '#84cc16,#10b981']
export function Avatar({ name, size = 8, className }: { name?: string | null; size?: number; className?: string }) {
  const t = (name ?? '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  const h = [...(name ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0)
  return <div style={{ background: `linear-gradient(135deg, ${gradients[h % gradients.length].split(',').join(', ')})`, width: size * 4, height: size * 4, fontSize: Math.max(10, size * 1.5) }}
    className={cx('flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/.2)]', className)}>{t}</div>
}

export const Spinner = () => <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
export const Empty = ({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
    {icon && <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 [&>svg]:h-7 [&>svg]:w-7">{icon}</div>}
    <div className="text-sm font-semibold text-slate-800">{title}</div>
    {hint && <div className="max-w-sm text-sm text-slate-500">{hint}</div>}
    {action && <div className="mt-2">{action}</div>}
  </div>
)

/** Standard page title row. */
export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>{subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}</div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
)

/** Standard white surface. */
export const Card = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cx('rounded-xl border border-slate-200/80 bg-white shadow-card', className)}>{children}</div>
)

/** Segmented control. */
export function Segmented<T extends string>({ value, onChange, options, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number }[]; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={cx('inline-flex items-center gap-1.5 rounded-md font-medium transition', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]', value === o.value ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500 hover:text-slate-800')}>
          {o.label}{o.count != null && <span className={cx('rounded-full px-1.5 text-[10px] tabular-nums', value === o.value ? 'bg-slate-100 text-slate-600' : 'text-slate-400')}>{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** Click-outside popover menu. */
export function Menu({ trigger, children, align = 'right', width = 'w-56', up }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; width?: string; up?: boolean }) {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const d = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', d); document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', d); document.removeEventListener('keydown', k) }
  }, [open])
  return (
    <div ref={ref} className="relative">
      {trigger(open, () => setOpen((o) => !o))}
      {open && <div className={cx('absolute z-50 animate-pop rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop', width, up ? 'bottom-full mb-2' : 'top-full mt-2', align === 'right' ? 'right-0' : 'left-0')}>{children(() => setOpen(false))}</div>}
    </div>
  )
}
export const MenuItem = ({ icon, children, hint, onClick, danger }: { icon?: ReactNode; children: ReactNode; hint?: string; onClick?: () => void; danger?: boolean }) => (
  <button onClick={onClick} className={cx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition', danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100')}>
    {icon && <span className="text-slate-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}<span className="flex-1">{children}</span>{hint && <kbd>{hint}</kbd>}
  </button>
)

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean | 'xl' }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex animate-fade items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[7vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className={cx('w-full animate-pop rounded-2xl border border-slate-200/70 bg-white shadow-pop', wide === 'xl' ? 'max-w-6xl' : wide ? 'max-w-3xl' : 'max-w-lg')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pb-1 pt-5">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 pb-6 pt-3">{children}</div>
      </div>
    </div>
  )
}

export function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && !(e.target instanceof HTMLTextAreaElement) && onClose()
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex animate-fade justify-end bg-slate-900/30 backdrop-blur-[1px]" onMouseDown={onClose}>
      <div className="flex h-full w-full max-w-[720px] animate-slide flex-col border-l border-slate-200/70 bg-white shadow-pop" onMouseDown={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}

// ---- toasts ----
type T = { id: number; msg: string; tone: 'ok' | 'err' }
const ToastCtx = createContext<(msg: string, tone?: 'ok' | 'err') => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<T[]>([])
  const push = useCallback((msg: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random()
    setList((l) => [...l, { id, msg, tone }]); setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), tone === 'err' ? 6000 : 2800)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
        {list.map((t) => (
          <div key={t.id} className="flex max-w-md animate-pop items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-slate-50 shadow-pop dark:bg-slate-200 dark:text-slate-900">
            {t.tone === 'ok' ? <Check className="h-4 w-4 shrink-0 text-emerald-400" /> : <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />}{t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// Instagram-style tick: blue = email AND phone on file, grey = only one, nothing = no contact details.
export function Verified({ email, phone, className }: { email?: string | null; phone?: string | null; className?: string }) {
  const e = !!email?.trim(), p = !!phone?.trim()
  if (!e && !p) return null
  const full = e && p
  return (
    <span title={full ? 'Verified contact: email and phone on file' : `Partial contact: only ${e ? 'email' : 'phone'} on file`} className={cx('inline-flex shrink-0', className)}>
      <BadgeCheck className={cx('h-4 w-4 text-white', full ? 'fill-sky-500' : 'fill-slate-300')} />
    </span>
  )
}
