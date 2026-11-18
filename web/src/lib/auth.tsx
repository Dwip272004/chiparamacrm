import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Member, Role } from './types'

interface Ctx {
  session: Session | null; member: Member | null; role: Role | null; loading: boolean
  canWrite: boolean; isManager: boolean; isAdmin: boolean; signOut: () => Promise<void>; refresh: () => Promise<void>
}
const AuthCtx = createContext<Ctx>(null as unknown as Ctx)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadMember(s: Session | null) {
    if (!s) { setMember(null); return }
    await supabase.rpc('claim_membership') // turns a pending invite into membership
    const { data } = await supabase.from('team_members').select('*').eq('user_id', s.user.id).eq('is_active', true).maybeSingle()
    setMember((data as Member) ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => { setSession(data.session); await loadMember(data.session); setLoading(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); void loadMember(s) })
    return () => sub.subscription.unsubscribe()
  }, [])

  const role = member?.role ?? null
  const value: Ctx = {
    session, member, role, loading,
    canWrite: role === 'admin' || role === 'manager' || role === 'recruiter',
    isManager: role === 'admin' || role === 'manager', isAdmin: role === 'admin',
    signOut: async () => { await supabase.auth.signOut() }, refresh: () => loadMember(session),
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
