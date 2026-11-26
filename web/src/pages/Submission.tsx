import { Link, useParams } from 'react-router-dom'
import { Copy, Download, Send } from 'lucide-react'
import { template } from '../lib/submissions'
import { Button, Card, Empty, PageHeader, useToast } from '../components/ui'

// Copy-and-fill templates: replace everything in [brackets].
const EMAIL: Record<string, { subject: string; body: string; docx?: string }> = {
  broadcom: {
    subject: '[Candidate Name] – Broadcom [Role] ([Location])',
    body: `Hi Sir,
Please find attached the resume of [Candidate Name] submitted for the Broadcom [Role] role ([Location, e.g. San Jose, CA]).
Summary: [2-3 lines: years of experience, key skills, domain highlights]
Checklist Answers:

1. Currently being interviewed at BRCM: [No / Yes – details]
2. BRCM is 5 days working from office, no remote work entertained: [YES, Agreed (Relocate to San Jose, CA – Immediate joiner) / NO, Not agreed]
3. Status of employment (like if sponsorship needed): [e.g. I140 approved, H1B]`,
    docx: '/templates/Broadcom_Resume_Template.docx',
  },
}

export default function Submission() {
  const { id } = useParams(); const t = template(id); const toast = useToast()
  const e = t && EMAIL[t.id]
  if (!t) return <div className="p-10 text-center text-slate-500">Template not found. <Link className="text-brand-600 hover:underline" to="/submissions/broadcom">Open Broadcom</Link></div>
  if (!e) return (
    <div className="mx-auto max-w-3xl p-8"><PageHeader title={t.name} subtitle="Email + resume templates" />
      <Empty icon={<Send className="h-6 w-6" />} title={`${t.company} template is coming soon`} hint="It will be added here the same way as Broadcom." action={<Link to="/submissions/broadcom"><Button variant="secondary">Open Broadcom template</Button></Link>} /></div>
  )
  const copy = (text: string, what: string) => { void navigator.clipboard.writeText(text); toast(`Copied ${what}`) }
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <PageHeader title={t.name} subtitle="Copy the templates, replace the [brackets] and send." />
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">Email template</h3>
          <div className="flex gap-2"><Button variant="secondary" onClick={() => copy(e.subject, 'subject')}><Copy className="h-4 w-4" /> Copy subject</Button>
            <Button onClick={() => copy(e.body, 'email')}><Copy className="h-4 w-4" /> Copy email</Button></div></div>
        <p className="mb-2 text-xs text-slate-500">Subject: <span className="font-medium text-slate-700">{e.subject}</span></p>
        <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">{e.body}</pre>
      </Card>
      <Card className="p-5">
        <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-slate-900">Resume template</h3>
          <p className="mt-0.5 text-xs text-slate-500">Editable Word file in the Chiparama format. Fill it in, then File → Save as PDF and name it Name_Chiparama.</p></div>
          <a href={e.docx} download><Button><Download className="h-4 w-4" /> Download .docx</Button></a></div>
      </Card>
    </div>
  )
}
