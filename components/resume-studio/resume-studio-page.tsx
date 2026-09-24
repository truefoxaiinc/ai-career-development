'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, FileText, MessageCircle, Save, Sparkles } from 'lucide-react';
import { ErrorState, PageHeader, Panel, Skeleton, Textarea, Button } from '@/components/ui';
import { useStudioOverview } from '@/hooks/useResumeStudio';
import { ResumeUpload } from './resume-upload';
import { FactReview } from './fact-review';
import { Suggestions } from './suggestions';
import { TargetAndTemplates } from './target-and-templates';
import { studioApi } from '@/lib/resume-studio';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { ResumePaper } from './resume-paper';

export function ResumeStudioPage() {
  const q = useStudioOverview();
  const qc = useQueryClient();
  const { push } = useToast();
  const [selected, setSelected] = useState<string>();
  const [content, setContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const docs = useQuery({ queryKey: ['resume-studio', 'documents'], queryFn: studioApi.documents });
  const latest = useMemo(() => docs.data?.find(d => d.document_type === 'resume' && (!selected || d.source_file_id === selected)) || docs.data?.find(d => d.document_type === 'resume'), [docs.data, selected]);
  useEffect(() => { if (!selected && q.data?.resumes[0]) setSelected(q.data.resumes[0].id); }, [q.data, selected]);
  useEffect(() => { setContent(latest?.content || ''); }, [latest?.id, latest?.content]);
  if (q.isLoading) return <Skeleton className="h-[520px]"/>;
  if (q.error) return <ErrorState message={q.error.message} retry={() => q.refetch()}/>;

  async function save() {
    if (!latest || content === latest.content) return;
    try {
      const saved = await api.post<typeof latest>(`/documents/${latest.id}/versions`, { content, title: latest.title });
      await qc.invalidateQueries({ queryKey: ['resume-studio', 'documents'] });
      push(`Saved version ${saved.version}`);
    } catch (e) { push(e instanceof Error ? e.message : 'Could not save changes', 'error'); }
  }

  return <>
    <PageHeader eyebrow="AI Resume Studio" title="Make your experience stand out" description="Build a clear, tailored resume. Edit every line, ask AI for focused improvements, and choose a style that feels like you."/>
    <div className="space-y-5">
      <Panel className="overflow-hidden border-accent/20 bg-gradient-to-br from-accent/10 via-surface-1 to-surface-1 p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-medium text-accent"><Sparkles size={13}/> Your resume, with a copilot</div><h2 className="text-2xl font-semibold tracking-tight">A stronger story starts here.</h2><p className="mt-2 text-13 leading-6 text-text-secondary">Bring in your current resume, confirm the details, then shape it for the roles you want. Your facts stay yours; every AI edit is yours to review.</p></div>
          <div className="hidden size-20 items-center justify-center rounded-3xl border border-accent/20 bg-accent/10 text-accent sm:flex"><FileText size={34}/></div>
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-3"><Step n="01" title="Add your resume" text="Upload a PDF or DOCX"/><Step n="02" title="Review your details" text="Confirm what the AI found"/><Step n="03" title="Polish and personalize" text="Edit, chat, pick a theme"/></div>
      </Panel>
      <ResumeUpload resumes={q.data?.resumes || []} maxBytes={q.data?.max_upload_bytes || 10*1024*1024} onSelect={setSelected}/>
      <FactReview fileId={selected}/>
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><h2 className="text-18 font-semibold">Your resume workspace</h2><p className="mt-1 text-13 text-text-secondary">Make direct edits or get a second pair of eyes from AI.</p></div>{latest && <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-[11px] text-text-secondary">Draft · v{latest.version}</span>}</div>
        {latest ? <div className="grid gap-0 xl:grid-cols-[1fr_340px]">
          <div className="p-5"><label htmlFor="resume-content" className="mb-2 block text-13 font-medium">Resume content</label><Textarea id="resume-content" aria-label="Edit resume content" value={content} onChange={e=>setContent(e.target.value)} className="min-h-[480px] resize-y font-mono text-[12px] leading-6"/><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-[11px] text-text-secondary">Edits save as a new version and are checked before approval.</span><Button onClick={save} disabled={content===latest.content}><Save size={14}/>Save changes</Button></div></div>
          <aside className="border-t border-border bg-surface-2/40 p-5 xl:border-l xl:border-t-0"><h3 className="text-14 font-semibold">Live preview</h3><div className="mt-3 max-h-[540px] overflow-auto rounded-lg bg-slate-200 p-3"><ResumePaper content={content || 'Your resume preview will appear here.'} template={latest?.template_key} compact/></div></aside>
        </div> : <div className="p-5"><div className="rounded-card border border-dashed border-border p-8 text-center"><FileText className="mx-auto text-text-tertiary"/><h3 className="mt-3 text-14 font-semibold">Your editable draft will appear here</h3><p className="mt-1 text-13 text-text-secondary">Generate a resume from a target role below after uploading and confirming your details.</p></div></div>}
      </Panel>
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-18 font-semibold">Improve your draft with AI</h2><p className="mt-1 text-13 text-text-secondary">Review suggestions and decide what belongs in your resume.</p></div><Button variant="secondary" onClick={()=>setChatOpen(v=>!v)}><MessageCircle size={15}/>{chatOpen?'Close AI chat':'Open AI chat'}</Button></div>
      {chatOpen && <Panel className="border-accent/20 p-5"><div className="flex items-center gap-2 text-14 font-semibold"><Sparkles size={16} className="text-accent"/>Resume copilot</div><p className="mt-2 text-13 leading-5 text-text-secondary">Ask for clearer, more concise wording or role-specific emphasis. AI suggestions are shown below for your review before they are applied.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><Textarea aria-label="Message resume copilot" placeholder="e.g. Help me make my experience section more concise" value={prompt} onChange={e=>setPrompt(e.target.value)} className="min-h-20"/><Button className="sm:self-end" disabled={!selected||!prompt.trim()} onClick={()=>{setPrompt('');document.getElementById('ai-review')?.scrollIntoView({behavior:'smooth'});push('Use Analyze all sections to create grounded suggestions for your resume.')}}><ArrowRight size={14}/>Get suggestions</Button></div><p className="mt-2 text-[11px] text-text-tertiary">Suggestions use your verified profile and resume; review each one before applying.</p></Panel>}
      <div id="ai-review"><Suggestions fileId={selected}/></div>
      <TargetAndTemplates fileId={selected}/>
    </div>
  </>;
}

function Step({n,title,text}:{n:string;title:string;text:string}) { return <div className="flex items-center gap-3 rounded-card border border-border/70 bg-surface-1/60 p-3"><span className="font-mono text-[11px] text-accent">{n}</span><div><p className="text-12 font-medium">{title}</p><p className="mt-0.5 text-[11px] text-text-secondary">{text}</p></div></div>; }
