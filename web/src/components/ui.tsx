import { createContext, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { cx } from '../lib/util'

export function Button({ variant = 'primary', size = 'md', loading, className, children, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; loading?: boolean }) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }[variant]
  return (
    <button {...p} disabled={p.disabled || loading}
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm', v, className)}>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{children}
    </button>
  )
}

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-100'
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(field, className)} />
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(field, className)} />
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(field, 'pr-8', className)} />
export const Label = ({ children, hint }: { children: ReactNode; hint?: string }) => (
  <label className="mb-1 block text-xs font-medium text-slate-600">{children}{hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}</label>
)

const tones: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700', green: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700', blue: 'bg-sky-100 text-sky-700', brand: 'bg-brand-100 text-brand-700',
}
export const Badge = ({ tone = 'slate', children, title }: { tone?: keyof typeof tones; children: ReactNode; title?: string }) => (
  <span title={title} className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', tones[tone])}>{children}</span>
)

export function SyncBadge({ status }: { status?: string }) {
  if (!status || status === 'synced') return null
  return <Badge tone={status === 'error' ? 'red' : 'amber'} title="Saved here; waiting to be pushed to RecruitCRM">{status === 'error' ? 'Sync error' : 'Pending sync'}</Badge>
}

export function Avatar({ name, size = 8 }: { name?: string | null; size?: number }) {
  const t = (name ?? '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  const hue = [...(name ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return <div style={{ background: `hsl(${hue} 70% 92%)`, color: `hsl(${hue} 55% 32%)`, width: size * 4, height: size * 4 }}
    className="flex shrink-0 items-center justify-center rounded-full text-xs font-semibold">{t}</div>
}

export const Spinner = () => <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
export const Empty = ({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center gap-2 py-14 text-center">
    {icon && <div className="text-slate-300">{icon}</div>}
    <div className="text-sm font-medium text-slate-700">{title}</div>
    {hint && <div className="max-w-sm text-xs text-slate-500">{hint}</div>}
    {action}
  </div>
)

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div className={cx('w-full rounded-xl bg-white shadow-xl', wide ? 'max-w-3xl' : 'max-w-lg')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{children}</div>
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
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onMouseDown={onClose}>
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>{children}</div>
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
    setList((l) => [...l, { id, msg, tone }]); setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), tone === 'err' ? 6000 : 2500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {list.map((t) => (
          <div key={t.id} className={cx('flex max-w-sm items-start gap-2 rounded-lg px-3.5 py-2.5 text-sm text-white shadow-lg', t.tone === 'err' ? 'bg-red-600' : 'bg-slate-900')}>
            {t.tone === 'ok' && <Check className="mt-0.5 h-4 w-4 text-emerald-400" />}{t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
