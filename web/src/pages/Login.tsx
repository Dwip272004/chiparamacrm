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
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">C</div>
          <div><div className="font-semibold text-slate-900">Chiparama CRM</div><div className="text-xs text-slate-500">{mode === 'in' ? 'Sign in to your team workspace' : 'Create your account'}</div></div>
        </div>
        <div className="space-y-3.5">
          <div><Label>Work email</Label><Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@chiparama.com" /></div>
          <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        </div>
        {msg && <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${msg.t === 'err' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg.s}</div>}
        <Button type="submit" loading={busy} className="mt-5 w-full">{mode === 'in' ? 'Sign in' : 'Create account'}</Button>
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <button type="button" className="hover:text-brand-600" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null) }}>{mode === 'in' ? 'New teammate? Create account' : 'Have an account? Sign in'}</button>
          {mode === 'in' && <button type="button" className="hover:text-brand-600" onClick={reset}>Forgot password?</button>}
        </div>
        {mode === 'up' && <p className="mt-3 text-[11px] text-slate-400">Your admin must invite your email first. Access is granted automatically once you sign in with an invited email.</p>}
      </form>
    </div>
  )
}
