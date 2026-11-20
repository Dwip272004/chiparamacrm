import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Input, Label } from '../components/ui'

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ t: 'err' | 'ok'; s: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const r = mode === 'in' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (r.error) setMsg({ t: 'err', s: r.error.message })
    else if (mode === 'up' && !r.data.session) setMsg({ t: 'ok', s: 'Check your email to confirm your account, then sign in.' })
  }
  async function reset() {
    if (!email) return setMsg({ t: 'err', s: 'Enter your email first.' })
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    setMsg(error ? { t: 'err', s: error.message } : { t: 'ok', s: 'Password reset email sent.' })
  }

  return (
    <div className="grid min-h-full lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-violet-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <i className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" /><i className="absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-violet-400/30 blur-3xl" />
        <div className="relative flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg font-bold ring-1 ring-white/30 backdrop-blur">C</div><div className="font-semibold tracking-tight">Chiparama Recruiting CRM</div></div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">Your whole hiring team, in one place.</h2>
          <ul className="mt-8 space-y-4 text-[15px] text-white/85">
            {['Every candidate from RecruitCRM, searchable in a click', 'Move people through stages without scrolling', 'Request contact enrichment and see its status live', 'Chat about a candidate right next to their profile'].map((t) => (
              <li key={t} className="flex items-start gap-3"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs">✓</span>{t}</li>))}
          </ul>
        </div>
        <div className="relative text-xs text-white/60">Synced with RecruitCRM · Built for your team</div>
      </aside>
      <main className="flex items-center justify-center bg-slate-50 p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-lg font-bold text-white">C</div><div className="font-semibold text-slate-900">Chiparama CRM</div></div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{mode === 'in' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-1 text-sm text-slate-500">{mode === 'in' ? 'Sign in to your team workspace' : 'Use the email your admin invited'}</p>
          <div className="mt-7 space-y-4">
            <div><Label>Work email</Label><Input type="email" required autoFocus className="!h-11" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@chiparama.com" /></div>
            <div><Label>Password</Label><Input type="password" required minLength={6} className="!h-11" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          </div>
          {msg && <div className={`mt-4 rounded-lg px-3 py-2.5 text-sm ${msg.t === 'err' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg.s}</div>}
          <Button type="submit" size="lg" loading={busy} className="mt-6 w-full">{mode === 'in' ? 'Sign in' : 'Create account'}</Button>
          <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
            <button type="button" className="font-medium hover:text-brand-600" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null) }}>{mode === 'in' ? 'New teammate? Create account' : 'Have an account? Sign in'}</button>
            {mode === 'in' && <button type="button" className="hover:text-brand-600" onClick={reset}>Forgot password?</button>}
          </div>
          {mode === 'up' && <p className="mt-4 text-xs text-slate-400">Your admin must invite your email first. Access is granted automatically once you sign in with an invited email.</p>}
        </form>
      </main>
    </div>
  )
}
