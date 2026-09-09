'use client';

import Link from 'next/link';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, CheckCircle2, Clock3,
  Download, FilePlus2, FileText, Layers3, PenLine, ShieldAlert, ShieldCheck,
  Sparkles, WandSparkles
} from 'lucide-react';

import { api, downloadDocument } from '@/lib/api';
import type { AsyncTask, GeneratedDocument, Job } from '@/lib/types';
import {
  Button, EmptyState, ErrorState, FieldError, PageHeader, Panel,
  ProgressBar, Select, Skeleton, Textarea
} from '@/components/ui';
import { useToast } from '@/components/toast';

const err = (e: unknown) => e instanceof Error ? e.message : 'Request failed';

const kindLabel = (type: string) => type === 'resume' ? 'Resume' : 'Cover letter';
const kindRoute = (type: string) => type === 'resume' ? 'resume' : 'cover-letter';

function docState(doc: GeneratedDocument) {
  if (doc.approved_at) return 'approved';
  if (doc.claim_report.status !== 'passed' || doc.claim_report.unsupported_claims > 0) return 'blocked';
  return 'ready';
}

function DocumentsNav({ active }: { active: 'library' | 'resume' | 'cover-letter' }) {
  const items = [
    ['library', 'Library', '/dashboard/documents', Layers3],
    ['resume', 'New resume', '/dashboard/documents/resume/new', FileText],
    ['cover-letter', 'New cover letter', '/dashboard/documents/cover-letter/new', FilePlus2],
  ] as const;

  return (
    <div className="mb-5 overflow-x-auto hide-scrollbar">
      <div className="inline-flex min-w-full gap-1 rounded-[14px] border border-border bg-surface-1/80 p-1.5 backdrop-blur-xl sm:min-w-0">
        {items.map(([id, label, href, Icon]) => (
          <Link
            key={id}
            href={href}
            className={`inline-flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-11 font-medium transition ${
              active === id
                ? 'bg-text-primary text-canvas shadow-sm'
                : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
            }`}
          >
            <Icon size={13} />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function DocumentLibraryPage() {
  const q = useQuery({
    queryKey: ['documents'],
    queryFn: () => api.get<GeneratedDocument[]>('/documents'),
  });

  const metrics = useMemo(() => {
    const docs = q.data ?? [];
    return {
      total: docs.length,
      approved: docs.filter(x => !!x.approved_at).length,
      blocked: docs.filter(x => docState(x) === 'blocked').length,
    };
  }, [q.data]);

  return (
    <>
      <PageHeader
        eyebrow="Application studio"
        title="Document library"
        description="Create, verify, version, approve, and export tailored resumes and cover letters from one grounded workspace."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/documents/resume/new">
              <Button><FilePlus2 size={14}/>New resume</Button>
            </Link>
            <Link href="/dashboard/documents/cover-letter/new">
              <Button variant="secondary"><PenLine size={14}/>New cover letter</Button>
            </Link>
          </div>
        }
      />

      <DocumentsNav active="library" />

      <section className="career-docs-hero mb-5 overflow-hidden rounded-[22px] border border-indigo-500/15">
        <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-7">
          <div className="relative z-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-indigo-300">
              Grounded application materials
            </div>
            <h2 className="mt-3 max-w-2xl text-24 font-semibold tracking-[-0.035em] md:text-28">
              Every version has an evidence trail.
            </h2>
            <p className="mt-3 max-w-2xl text-12 leading-6 text-text-secondary">
              Generated claims are checked against your verified profile before approval and export.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-2">
            <MiniMetric value={q.data ? String(metrics.total) : '—'} label="documents" />
            <MiniMetric value={q.data ? String(metrics.approved) : '—'} label="approved" tone="positive" />
            <MiniMetric value={q.data ? String(metrics.blocked) : '—'} label="blocked" tone="negative" />
          </div>
        </div>
      </section>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <FeatureMetric icon={ShieldCheck} label="Grounding" value="Claim checked" color="emerald" />
        <FeatureMetric icon={Layers3} label="Versioning" value="Immutable" color="indigo" />
        <FeatureMetric icon={Download} label="Export" value="PDF + DOCX" color="cyan" />
      </div>

      {q.isLoading ? (
        <LibraryLoading />
      ) : q.error ? (
        <ErrorState message={err(q.error)} retry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState
          title="Your document library is empty"
          description="Generate a job-specific resume or cover letter using verified career evidence."
          action={<Link href="/dashboard/documents/resume/new"><Button>Generate a resume</Button></Link>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.map(doc => <DocumentCard key={doc.id} doc={doc} />)}
        </div>
      )}
    </>
  );
}

function DocumentCard({ doc }: { doc: GeneratedDocument }) {
  const state = docState(doc);
  const config = {
    approved: {
      label: 'Approved',
      icon: ShieldCheck,
      badge: 'border-emerald-500/15 bg-emerald-500/[0.08] text-emerald-400',
      line: 'from-emerald-400 via-cyan-400 to-transparent',
    },
    blocked: {
      label: 'Needs review',
      icon: ShieldAlert,
      badge: 'border-red-500/15 bg-red-500/[0.08] text-red-400',
      line: 'from-red-400 via-amber-400 to-transparent',
    },
    ready: {
      label: 'Ready to approve',
      icon: CheckCircle2,
      badge: 'border-indigo-500/15 bg-indigo-500/[0.08] text-indigo-400',
      line: 'from-indigo-400 via-cyan-400 to-transparent',
    },
  }[state];

  const Icon = config.icon;

  return (
    <Link
      href={`/dashboard/documents/${kindRoute(doc.document_type)}/${doc.id}`}
      className="career-document-card group overflow-hidden rounded-[20px] border border-border bg-surface-1 transition duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-[0_20px_70px_rgba(0,0,0,.10)]"
    >
      <div className={`h-[2px] bg-gradient-to-r ${config.line}`} />

      <div className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] border border-indigo-500/15 bg-indigo-500/[0.08] text-indigo-400">
              {doc.document_type === 'resume' ? <FileText size={16}/> : <PenLine size={16}/>}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-secondary">
                  {kindLabel(doc.document_type)}
                </span>
                <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[8px] text-text-secondary">
                  v{doc.version}
                </span>
              </div>
              <h2 className="mt-2 line-clamp-2 text-16 font-semibold leading-6 tracking-[-0.02em] transition group-hover:text-indigo-300">
                {doc.title}
              </h2>
            </div>
          </div>

          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-medium ${config.badge}`}>
            <Icon size={11}/>
            {config.label}
          </span>
        </div>

        <div className="mt-5 rounded-[12px] border border-border bg-surface-2/45 p-3.5">
          {doc.job ? (
            <>
              <div className="flex items-center gap-1.5 text-11 font-medium">
                <Building2 size={12} className="text-text-tertiary"/>
                {doc.job.company}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-text-secondary">
                <BriefcaseBusiness size={11}/>
                {doc.job.title}
              </div>
            </>
          ) : (
            <div className="text-10 text-text-secondary">General document · no linked job</div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Meta label="Claims" value={doc.claim_report.status}/>
          <Meta
            label="Unsupported"
            value={String(doc.claim_report.unsupported_claims)}
            warning={doc.claim_report.unsupported_claims > 0}
          />
          <Meta label="Created" value={new Date(doc.created_at).toLocaleDateString()}/>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border bg-surface-2/25 px-5 py-3 md:px-6">
        <span className="text-[10px] text-text-secondary">Open document workspace</span>
        <ArrowRight size={13} className="text-text-tertiary transition group-hover:translate-x-0.5 group-hover:text-indigo-400"/>
      </div>
    </Link>
  );
}

export function DocumentGeneratorPage({ type }: { type: 'resume' | 'cover_letter' }) {
  const { push } = useToast();
  const client = useQueryClient();

  const jobs = useQuery({
    queryKey: ['jobs', 'generator'],
    queryFn: () => api.get<{ items: Job[] }>('/jobs?page_size=100&sort=recent'),
  });

  const [jobId, setJobId] = useState('');
  const [template, setTemplate] = useState('ats');
  const [taskId, setTaskId] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: () => api.post<{ task_id: string }>('/documents/generate', {
      job_id: jobId,
      document_type: type,
      template,
    }),
    onSuccess: result => {
      setTaskId(result.task_id);
      push('Generation started', 'info');
    },
  });

  const task = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.get<AsyncTask>(`/tasks/${taskId}`),
    enabled: !!taskId,
    refetchInterval: q =>
      ['succeeded', 'failed'].includes(q.state.data?.status || '') ? false : 800,
  });

  const documentId = task.data?.result?.document_id as string | undefined;

  useEffect(() => {
    if (task.data?.status === 'succeeded') {
      client.invalidateQueries({ queryKey: ['documents'] });
    }
  }, [task.data?.status, client]);

  const selectedJob = useMemo(
    () => jobs.data?.items.find(job => job.id === jobId),
    [jobs.data?.items, jobId],
  );

  const isResume = type === 'resume';

  function submit(e: FormEvent) {
    e.preventDefault();
    generate.mutate();
  }

  return (
    <>
      <div className="mb-4">
        <Link
          href="/dashboard/documents"
          className="inline-flex items-center gap-1.5 text-11 font-medium text-text-secondary transition hover:text-indigo-400"
        >
          <ArrowLeft size={13}/>Back to library
        </Link>
      </div>

      <PageHeader
        eyebrow="Application studio"
        title={isResume ? 'Tailored resume' : 'Cover letter'}
        description={
          isResume
            ? 'Build a job-specific resume from verified evidence and review every factual claim before approval.'
            : 'Create a grounded cover letter that connects your real experience to the selected role.'
        }
      />

      <DocumentsNav active={isResume ? 'resume' : 'cover-letter'} />

      {jobs.isLoading ? (
        <GeneratorLoading />
      ) : jobs.error ? (
        <ErrorState message={err(jobs.error)} />
      ) : !jobs.data?.items.length ? (
        <EmptyState
          title="No jobs available"
          description="Search or add a job before generating tailored application documents."
          action={<Link href="/dashboard/jobs/search"><Button>Find a job</Button></Link>}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Panel className="career-generator-card overflow-hidden">
            <div className="border-b border-border px-5 py-5 md:px-6">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-[11px] border border-indigo-500/15 bg-indigo-500/10 text-indigo-400">
                  {isResume ? <FileText size={17}/> : <PenLine size={17}/>}
                </div>
                <div>
                  <h2 className="text-15 font-semibold">Configure document</h2>
                  <p className="mt-1 text-11 leading-5 text-text-secondary">
                    Choose a target role and CareerPilot will generate within verified profile constraints.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-6 p-5 md:p-6">
              <Field
                label="Target job"
                description="The selected role determines which verified evidence should be prioritized."
              >
                <Select
                  className="h-12"
                  required
                  value={jobId}
                  onChange={e => setJobId(e.target.value)}
                >
                  <option value="">Select a job</option>
                  {jobs.data.items.map(job => (
                    <option key={job.id} value={job.id}>
                      {job.company} · {job.title}
                    </option>
                  ))}
                </Select>
              </Field>

              {selectedJob && (
                <div className="rounded-[14px] border border-cyan-500/15 bg-cyan-500/[0.05] p-4">
                  <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-cyan-400">Selected role</div>
                  <h3 className="mt-2 text-13 font-semibold">{selectedJob.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-text-secondary">
                    <span className="flex items-center gap-1.5"><Building2 size={11}/>{selectedJob.company}</span>
                    {selectedJob.location && <span>{selectedJob.location}</span>}
                  </div>
                </div>
              )}

              {isResume && (
                <Field
                  label="Resume template"
                  description="Presentation changes; grounding rules stay the same."
                >
                  <Select
                    className="h-12"
                    value={template}
                    onChange={e => setTemplate(e.target.value)}
                  >
                    {['ats','professional','technical','academic','executive','research','minimal'].map(item => (
                      <option key={item} value={item}>
                        {item.replace(/^./, c => c.toUpperCase())}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              <div className="career-grounding-note rounded-[14px] border border-emerald-500/15 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-emerald-500/10 text-emerald-400">
                    <ShieldCheck size={15}/>
                  </div>
                  <div>
                    <div className="text-11 font-semibold">Anti-fabrication gate</div>
                    <p className="mt-1 text-[10px] leading-5 text-text-secondary">
                      Factual claims are compared against verified profile facts before approval or export.
                    </p>
                  </div>
                </div>
              </div>

              {generate.error && <FieldError>{err(generate.error)}</FieldError>}

              <div className="flex items-center justify-between border-t border-border pt-5">
                <p className="hidden text-[10px] text-text-secondary sm:block">
                  Grounding and claim verification run automatically.
                </p>

                <Button disabled={!jobId || generate.isPending || !!taskId}>
                  {generate.isPending ? 'Queuing…' : (
                    <><WandSparkles size={14}/>Generate {isResume ? 'resume' : 'cover letter'}</>
                  )}
                </Button>
              </div>
            </form>

            {taskId && (
              <div className="border-t border-border bg-surface-2/30 p-5 md:p-6">
                <div className="mb-4 flex items-center gap-2 text-11 font-semibold">
                  <Clock3 size={14} className="text-indigo-400"/>Generation status
                </div>

                {task.isLoading ? (
                  <Skeleton className="h-14 rounded-[12px]"/>
                ) : task.error ? (
                  <ErrorState message={err(task.error)}/>
                ) : task.data ? (
                  <>
                    <ProgressBar
                      value={task.data.progress}
                      label={`Generation · ${task.data.status}`}
                    />

                    {task.data.status === 'failed' && (
                      <div className="mt-4 rounded-[12px] border border-red-500/15 bg-red-500/[0.06] p-3 text-11 text-red-300">
                        Generation failed. Check verified profile facts and model configuration.
                      </div>
                    )}

                    {task.data.status === 'succeeded' && documentId && (
                      <div className="mt-4 flex items-center justify-between gap-4 rounded-[13px] border border-emerald-500/15 bg-emerald-500/[0.055] p-4">
                        <div>
                          <div className="flex items-center gap-2 text-11 font-semibold text-emerald-400">
                            <CheckCircle2 size={14}/>Draft ready
                          </div>
                          <p className="mt-1 text-[10px] text-text-secondary">Review claims before approval.</p>
                        </div>

                        <Link href={`/dashboard/documents/${kindRoute(type)}/${documentId}`}>
                          <Button>Review<ArrowRight size={13}/></Button>
                        </Link>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </Panel>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Panel className="career-generation-summary overflow-hidden">
              <div className="border-b border-border p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-[10px] border border-violet-500/15 bg-violet-500/10 text-violet-400">
                    <Sparkles size={15}/>
                  </div>
                  <div>
                    <h2 className="text-13 font-semibold">How generation works</h2>
                    <p className="mt-1 text-[10px] text-text-secondary">One grounded workflow.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <Step n="01" title="Read the role" text="Identify priority requirements and language."/>
                <Step n="02" title="Retrieve evidence" text="Pull relevant verified experience and skills."/>
                <Step n="03" title="Generate" text="Tailor content without inventing unsupported facts."/>
                <Step n="04" title="Verify claims" text="Block unsupported factual claims before approval."/>
              </div>
            </Panel>
          </aside>
        </div>
      )}
    </>
  );
}

export function DocumentEditorPage({ documentId }: { documentId: string }) {
  const client = useQueryClient();
  const { push } = useToast();

  const q = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => api.get<GeneratedDocument>(`/documents/${documentId}`),
  });

  const [content, setContent] = useState('');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    if (q.data) setContent(q.data.content);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => api.post<GeneratedDocument>(
      `/documents/${documentId}/versions`,
      { content, title: q.data?.title },
    ),
    onSuccess: doc => {
      client.setQueryData(['document', doc.id], doc);
      client.invalidateQueries({ queryKey: ['documents'] });
      push(`Saved version ${doc.version}`);
      window.location.href = `/dashboard/documents/${kindRoute(doc.document_type)}/${doc.id}`;
    },
  });

  const approve = useMutation({
    mutationFn: () => api.post<GeneratedDocument>(`/documents/${documentId}/approve`, {}),
    onSuccess: doc => {
      client.setQueryData(['document', documentId], doc);
      client.invalidateQueries({ queryKey: ['documents'] });
      push('Document approved');
    },
  });

  async function download(format: 'pdf' | 'docx') {
    try {
      await downloadDocument(documentId, format);
      push(`${format.toUpperCase()} download started`);
    } catch (e) {
      push(err(e), 'error');
    }
  }

  if (q.isLoading) return <EditorLoading/>;
  if (q.error) return <ErrorState message={err(q.error)}/>;

  const doc = q.data!;
  const claims = doc.claim_report.claims || [];
  const blocked =
    doc.claim_report.status !== 'passed' ||
    doc.claim_report.unsupported_claims > 0;
  const changed = content !== doc.content;

  return (
    <>
      <div className="mb-4">
        <Link
          href="/dashboard/documents"
          className="inline-flex items-center gap-1.5 text-11 font-medium text-text-secondary transition hover:text-indigo-400"
        >
          <ArrowLeft size={13}/>Back to library
        </Link>
      </div>

      <PageHeader
        eyebrow={`${kindLabel(doc.document_type)} · version ${doc.version}`}
        title={doc.title}
        description={doc.job ? `${doc.job.company} · ${doc.job.title}` : 'Generated document'}
        actions={
          <div className="flex flex-wrap gap-2">
            {doc.approved_at && (
              <>
                <Button variant="secondary" onClick={() => download('pdf')}><Download size={14}/>PDF</Button>
                <Button variant="secondary" onClick={() => download('docx')}><Download size={14}/>DOCX</Button>
              </>
            )}

            <Button
              disabled={blocked || !!doc.approved_at || approve.isPending}
              onClick={() => approve.mutate()}
            >
              {doc.approved_at ? (
                <><CheckCircle2 size={14}/>Approved</>
              ) : approve.isPending ? 'Approving…' : (
                <><ShieldCheck size={14}/>Approve version</>
              )}
            </Button>
          </div>
        }
      />

      <section className="career-editor-status mb-5 overflow-hidden rounded-[18px] border border-border">
        <div className="grid gap-px bg-border sm:grid-cols-4">
          <Status label="Version" value={`v${doc.version}`} icon={Layers3}/>
          <Status
            label="Claim check"
            value={blocked ? 'Needs review' : 'Passed'}
            icon={blocked ? ShieldAlert : ShieldCheck}
            tone={blocked ? 'negative' : 'positive'}
          />
          <Status
            label="Unsupported"
            value={String(doc.claim_report.unsupported_claims)}
            icon={ShieldAlert}
            tone={doc.claim_report.unsupported_claims > 0 ? 'negative' : 'positive'}
          />
          <Status
            label="Approval"
            value={doc.approved_at ? 'Approved' : 'Pending'}
            icon={doc.approved_at ? CheckCircle2 : Clock3}
            tone={doc.approved_at ? 'positive' : 'neutral'}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_380px]">
        <Panel className="career-document-editor overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="text-14 font-semibold">Document workspace</h2>
              <p className="mt-1 text-[10px] text-text-secondary">
                Editing creates a new immutable version and reruns verification.
              </p>
            </div>

            <div className="flex rounded-[10px] border border-border bg-surface-2 p-1">
              <ModeButton active={mode === 'edit'} onClick={() => setMode('edit')} icon={PenLine}>Edit</ModeButton>
              <ModeButton active={mode === 'preview'} onClick={() => setMode('preview')} icon={FileText}>Preview</ModeButton>
            </div>
          </div>

          <div className="p-5 md:p-6">
            {mode === 'edit' ? (
              <>
                <Textarea
                  className="min-h-[680px] resize-y font-mono text-[12px] leading-6"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                />

                {save.error && <div className="mt-4"><FieldError>{err(save.error)}</FieldError></div>}

                <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[10px] text-text-secondary">
                    {changed ? 'Unsaved changes' : 'No changes'}
                  </span>

                  <Button
                    variant="secondary"
                    disabled={save.isPending || !changed}
                    onClick={() => save.mutate()}
                  >
                    {save.isPending ? 'Verifying new version…' : 'Save as new version'}
                  </Button>
                </div>
              </>
            ) : (
              <Paper content={content}/>
            )}
          </div>
        </Panel>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Panel className="career-claims-panel overflow-hidden">
            <div className="border-b border-border p-5">
              <div className="flex items-start gap-3">
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${
                  blocked ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                }`}>
                  {blocked ? <ShieldAlert size={16}/> : <ShieldCheck size={16}/>}
                </div>

                <div>
                  <h2 className="text-14 font-semibold">Factual-claim verification</h2>
                  <p className="mt-1 text-[10px] leading-5 text-text-secondary">
                    Claims are compared against verified candidate evidence.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className={`rounded-[12px] border p-3.5 ${
                blocked
                  ? 'border-red-500/15 bg-red-500/[0.055]'
                  : 'border-emerald-500/15 bg-emerald-500/[0.055]'
              }`}>
                <div className={`text-11 font-semibold ${blocked ? 'text-red-400' : 'text-emerald-400'}`}>
                  {blocked
                    ? `${doc.claim_report.unsupported_claims} unsupported claim(s) block approval`
                    : 'All detected factual claims are supported'}
                </div>
                <p className="mt-1 text-[10px] leading-5 text-text-secondary">
                  {blocked
                    ? 'Correct unsupported claims, save a new version, and rerun verification.'
                    : 'This version can be approved when you are satisfied with the wording.'}
                </p>
              </div>

              {claims.length ? (
                <div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-1">
                  {claims.map((claim, i) => (
                    <div key={i} className="rounded-[12px] border border-border bg-surface-2/55 p-3.5">
                      <div className={`flex items-center gap-1.5 text-[10px] font-semibold ${
                        claim.supported ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {claim.supported ? <CheckCircle2 size={12}/> : <ShieldAlert size={12}/>}
                        {claim.supported ? 'Supported' : 'Unsupported'}
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-text-primary">{claim.claim}</p>
                      {claim.reason && (
                        <p className="mt-2 border-t border-border pt-2 text-[10px] leading-5 text-text-secondary">
                          {claim.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[10px] text-text-secondary">
                  No factual claims were extracted from this version.
                </p>
              )}
            </div>
          </Panel>

          {mode === 'edit' && (
            <Panel className="overflow-hidden">
              <div className="border-b border-border p-5">
                <h2 className="text-13 font-semibold">Quick preview</h2>
              </div>
              <div className="max-h-[410px] overflow-y-auto p-4">
                <Paper content={content} compact/>
              </div>
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}

function Paper({ content, compact = false }: { content: string; compact?: boolean }) {
  return (
    <div
      className={`career-paper-preview mx-auto bg-white text-slate-900 shadow-[0_18px_50px_rgba(0,0,0,.18)] ${
        compact
          ? 'min-h-[360px] p-5 text-[10px] leading-5'
          : 'min-h-[720px] max-w-[760px] p-8 text-[12px] leading-6 sm:p-10'
      }`}
    >
      <div className="whitespace-pre-wrap">{content}</div>
    </div>
  );
}

function FeatureMetric({
  icon: Icon, label, value, color,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  color: 'indigo' | 'cyan' | 'emerald';
}) {
  const styles = {
    indigo: 'border-indigo-500/15 bg-indigo-500/10 text-indigo-400',
    cyan: 'border-cyan-500/15 bg-cyan-500/10 text-cyan-400',
    emerald: 'border-emerald-500/15 bg-emerald-500/10 text-emerald-400',
  };

  return (
    <Panel className="group p-4 transition duration-200 hover:-translate-y-0.5 hover:border-border-strong">
      <div className="flex items-center gap-3">
        <div className={`flex size-9 items-center justify-center rounded-[10px] border ${styles[color]}`}>
          <Icon size={15}/>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-secondary">{label}</div>
          <div className="mt-1 text-13 font-semibold">{value}</div>
        </div>
      </div>
    </Panel>
  );
}

function MiniMetric({
  value, label, tone = 'neutral',
}: {
  value: string;
  label: string;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const styles = {
    neutral: 'border-border bg-surface-1/60 text-text-primary',
    positive: 'border-emerald-500/15 bg-emerald-500/[0.06] text-emerald-400',
    negative: 'border-red-500/15 bg-red-500/[0.06] text-red-400',
  };

  return (
    <div className={`min-w-[88px] rounded-[13px] border p-3 text-right ${styles[tone]}`}>
      <div className="text-20 font-semibold tracking-[-0.04em]">{value}</div>
      <div className="mt-1 text-[9px] text-text-secondary">{label}</div>
    </div>
  );
}

function Meta({
  label, value, warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-[10px] border border-border bg-surface-2/45 p-2.5">
      <div className="font-mono text-[8px] uppercase tracking-[0.05em] text-text-tertiary">{label}</div>
      <div className={`mt-1 truncate text-[10px] font-medium ${warning ? 'text-red-400' : 'text-text-primary'}`}>
        {value}
      </div>
    </div>
  );
}

function Field({
  label, description, children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2">
        <div className="text-12 font-medium">{label}</div>
        {description && <p className="mt-1 text-[10px] leading-5 text-text-secondary">{description}</p>}
      </div>
      {children}
    </label>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-border bg-surface-2 font-mono text-[9px] text-text-secondary">
        {n}
      </div>
      <div>
        <div className="text-11 font-semibold">{title}</div>
        <p className="mt-1 text-[10px] leading-5 text-text-secondary">{text}</p>
      </div>
    </div>
  );
}

function Status({
  label, value, icon: Icon, tone = 'neutral',
}: {
  label: string;
  value: string;
  icon: typeof Layers3;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const styles = {
    neutral: 'text-text-secondary',
    positive: 'text-emerald-400',
    negative: 'text-red-400',
  };

  return (
    <div className="bg-surface-1 p-4">
      <div className="flex items-center gap-2">
        <Icon size={13} className={styles[tone]}/>
        <span className="font-mono text-[9px] uppercase tracking-[0.05em] text-text-tertiary">{label}</span>
      </div>
      <div className={`mt-2 text-12 font-semibold ${styles[tone]}`}>{value}</div>
    </div>
  );
}

function ModeButton({
  active, onClick, icon: Icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof PenLine;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-[7px] px-2.5 text-[10px] font-medium transition ${
        active ? 'bg-text-primary text-canvas' : 'text-text-secondary hover:text-text-primary'
      }`}
    >
      <Icon size={11}/>{children}
    </button>
  );
}

function LibraryLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[1,2,3,4].map(x => <Skeleton key={x} className="h-[260px] rounded-[20px]"/>)}
    </div>
  );
}

function GeneratorLoading() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <Skeleton className="h-[570px] rounded-[20px]"/>
      <Skeleton className="h-[390px] rounded-[20px]"/>
    </div>
  );
}

function EditorLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[100px] rounded-[18px]"/>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_380px]">
        <Skeleton className="h-[820px] rounded-[20px]"/>
        <Skeleton className="h-[620px] rounded-[20px]"/>
      </div>
    </div>
  );
}
