import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Shell from './components/Shell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Candidates from './pages/Candidates'
import Jobs from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import Tasks from './pages/Tasks'
import Enrichment from './pages/Enrichment'
import Chat from './pages/Chat'
import Team from './pages/Team'
import SyncStatus from './pages/SyncStatus'
import { Button, Spinner } from './components/ui'

export default function App() {
  const { session, member, loading, signOut, refresh } = useAuth()
  if (loading) return <div className="pt-40"><Spinner /></div>
  if (!session) return <Login />
  if (!member) {
    return (
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
          <div className="mb-1 text-lg font-semibold text-slate-900">Waiting for access</div>
          <p className="text-sm text-slate-600">You're signed in as <b>{session.user.email}</b>, but this email hasn't been added to the team yet. Ask an admin to invite it under <i>Team → Invite</i>, then check again.</p>
          <div className="mt-5 flex justify-center gap-2"><Button onClick={() => refresh()}>Check again</Button><Button variant="secondary" onClick={signOut}>Sign out</Button></div>
        </div>
      </div>
    )
  }
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="candidates" element={<Candidates />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="jobs/:id" element={<JobDetail />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="enrichment" element={<Enrichment />} />
        <Route path="chat" element={<Chat />} />
        <Route path="team" element={<Team />} />
        <Route path="sync" element={<SyncStatus />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
