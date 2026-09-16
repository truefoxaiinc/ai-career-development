'use client';

import Link from 'next/link';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, FileText, FileUp,
  MapPin, ShieldCheck, Sparkles, UploadCloud, UserRound, WandSparkles
} from 'lucide-react';

import { api } from '@/lib/api';
import type { AsyncTask, Profile, ProfileEntry } from '@/lib/types';
import { AuthGuard } from '@/components/auth-guard';
import {
  Button, EmptyState, ErrorState, FieldError, Input, ProgressBar, Skeleton
} from '@/components/ui';
import { useToast } from '@/components/toast';

const err = (e: unknown) => e instanceof Error ? e.message : 'Request failed';

function OnboardingShell({
  step, title, description, children,
}: {
  step: 1 | 2 | 3 | 4;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const steps = [
    [1, 'Basics', UserRound],
    [2, 'Resume', FileUp],
    [3, 'Extraction', WandSparkles],
    [4, 'Verify', ShieldCheck],
  ] as const;

  return (
    <AuthGuard>
      <main className="relative min-h-screen overflow-hidden bg-canvas text-text-primary">
        <div className="pointer-events-none absolute inset-0">
          <div className="career-grid absolute inset-0 opacity-[0.24]" />
          <div className="career-orb career-orb-one opacity-40" />
          <div className="career-orb career-orb-two opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-canvas/20 to-canvas" />
        </div>

        <header className="relative z-20 border-b border-border bg-canvas/80 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-4 md:px-6">
            <Link href="/" className="group flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-[11px] bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-[0_8px_24px_rgba(79,70,229,.22)] transition group-hover:scale-[1.03]">
                <Sparkles size={15} />
              </div>
              <span className="text-15 font-semibold tracking-[-0.025em]">CareerPilot</span>
            </Link>

            <span className="hidden font-mono text-[10px] uppercase tracking-[0.08em] text-text-secondary sm:block">
              Candidate onboarding
            </span>
          </div>
        </header>

        <div className="relative z-10 mx-auto max-w-[1240px] px-4 py-7 md:px-6 md:py-10">
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="career-onboarding-sidebar rounded-[20px] border border-border p-4 shadow-sm backdrop-blur-xl">
                <div className="px-2 pt-1">
                  <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-indigo-400">
                    Step {step} of 4
                  </div>
                  <h2 className="mt-2 text-16 font-semibold">Build your trusted profile</h2>
                  <p className="mt-2 text-[10px] leading-5 text-text-secondary">
                    Only verified facts are used for matching and generated applications.
                  </p>
                </div>

                <div className="mt-5 space-y-1.5">
                  {steps.map(([n, label, Icon]) => {
                    const active = n === step;
                    const complete = n < step;

                    return (
                      <div
                        key={n}
                        className={`flex items-center gap-3 rounded-[12px] border px-3 py-3 ${
                          active
                            ? 'border-indigo-500/15 bg-indigo-500/[0.07]'
                            : complete
                              ? 'border-emerald-500/10 bg-emerald-500/[0.035]'
                              : 'border-transparent'
                        }`}
                      >
                        <div className={`flex size-8 items-center justify-center rounded-[9px] border ${
                          active
                            ? 'border-indigo-500/15 bg-indigo-500/10 text-indigo-400'
                            : complete
                              ? 'border-emerald-500/15 bg-emerald-500/10 text-emerald-400'
                              : 'border-border bg-surface-2 text-text-tertiary'
                        }`}>
                          {complete ? <Check size={13}/> : <Icon size={13}/>}
                        </div>

                        <div>
                          <div className={`text-11 font-medium ${active ? 'text-text-primary' : 'text-text-secondary'}`}>
                            {label}
                          </div>
                          <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.05em] text-text-tertiary">
                            {complete ? 'Complete' : active ? 'Current' : 'Next'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 rounded-[12px] border border-emerald-500/10 bg-emerald-500/[0.035] p-3">
                  <div className="flex items-start gap-2">
                    <ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-400"/>
                    <p className="text-[9px] leading-5 text-text-secondary">
                      Resume extraction never auto-verifies facts. You remain the approval gate.
                    </p>
                  </div>
                </div>
              </div>
            </aside>

            <section className="min-w-0">
              <div className="mb-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-indigo-400">
                  Step {step} / 4
                </div>
                <h1 className="mt-2 text-28 font-semibold tracking-[-0.04em] md:text-34">{title}</h1>
                <p className="mt-3 max-w-2xl text-12 leading-6 text-text-secondary">{description}</p>
              </div>

              <div className="career-onboarding-card overflow-hidden rounded-[22px] border border-border shadow-[0_24px_80px_rgba(0,0,0,.12)] backdrop-blur-xl">
                {children}
              </div>
            </section>
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}

export function CandidateOnboarding() {
  const router = useRouter();
  const client = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/profile'),
  });

  const [name, setName] = useState('');
  const [headline, setHeadline] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (data) {
      setName(data.name || '');
      setHeadline(data.headline || '');
      setLocation(data.location || '');
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.patch<Profile>('/profile', { name, headline, location }),
    onSuccess: d => {
      client.setQueryData(['profile'], d);
      router.push('/onboarding/resume');
    },
  });

  return (
    <OnboardingShell
      step={1}
      title="Start with the basics."
      description="These details identify you and frame your career profile. Resume-derived facts stay unverified until you review them."
    >
      <div className="border-b border-border px-5 py-5 md:px-7">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-[11px] border border-indigo-500/15 bg-indigo-500/10 text-indigo-400">
            <UserRound size={17}/>
          </div>
          <div>
            <h2 className="text-15 font-semibold">Candidate identity</h2>
            <p className="mt-1 text-[10px] leading-5 text-text-secondary">
              Add the information recruiters expect to see first.
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4 p-5 md:p-7">
          <Skeleton className="h-11 rounded-[10px]"/>
          <Skeleton className="h-11 rounded-[10px]"/>
          <Skeleton className="h-11 rounded-[10px]"/>
        </div>
      ) : error ? (
        <div className="p-5 md:p-7"><ErrorState message={err(error)}/></div>
      ) : (
        <form
          className="space-y-5 p-5 md:p-7"
          onSubmit={e => { e.preventDefault(); save.mutate(); }}
        >
          <Field label="Full name" icon={UserRound}>
            <Input className="h-11" required value={name} onChange={e => setName(e.target.value)} placeholder="Your full name"/>
          </Field>

          <Field label="Current or target headline" icon={FileText} hint="Optional">
            <Input className="h-11" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Backend Engineer · Platform"/>
          </Field>

          <Field label="Location" icon={MapPin} hint="Optional">
            <Input className="h-11" value={location} onChange={e => setLocation(e.target.value)} placeholder="City, country"/>
          </Field>

          {save.error && <FieldError>{err(save.error)}</FieldError>}

          <div className="flex items-center justify-between border-t border-border pt-5">
            <span className="hidden text-[10px] text-text-secondary sm:block">
              You can edit these details later.
            </span>
            <Button disabled={save.isPending}>
              {save.isPending ? 'Saving…' : <>Continue<ArrowRight size={14}/></>}
            </Button>
          </div>
        </form>
      )}
    </OnboardingShell>
  );
}

export function ResumeUpload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;

    setBusy(true);
    setError('');

    try {
      const form = new FormData();
      form.append('file', file);

      const out = await api.upload<{ task_id: string }>('/profile/resume', form);
      router.push(`/onboarding/resume/progress/${out.task_id}`);
    } catch (ex) {
      setError(err(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <OnboardingShell
      step={2}
      title="Upload your existing resume."
      description="CareerPilot extracts structured career facts from PDF or DOCX, but nothing becomes trusted evidence until you verify it."
    >
      <div className="grid gap-px bg-border lg:grid-cols-[1fr_290px]">
        <form className="bg-surface-1 p-5 md:p-7" onSubmit={submit}>
          <label className="career-upload-zone group block cursor-pointer rounded-[18px] border border-dashed border-border-strong p-6 text-center transition hover:border-indigo-500/30 md:p-9">
            <div className="mx-auto flex size-12 items-center justify-center rounded-[14px] border border-indigo-500/15 bg-indigo-500/10 text-indigo-400 transition group-hover:scale-[1.04]">
              <UploadCloud size={20}/>
            </div>

            <div className="mt-5 text-14 font-semibold">Choose a PDF or DOCX resume</div>
            <p className="mx-auto mt-2 max-w-md text-[10px] leading-5 text-text-secondary">
              The server validates size, MIME type, and file signature before extraction.
            </p>

            <input
              className="sr-only"
              type="file"
              required
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />

            {file && (
              <div className="mt-5 rounded-[12px] border border-emerald-500/15 bg-emerald-500/[0.055] p-3 text-left">
                <div className="flex items-center gap-2 text-11 font-medium text-emerald-400">
                  <CheckCircle2 size={13}/>File selected
                </div>
                <div className="mt-2 truncate font-mono text-[9px] text-text-secondary">{file.name}</div>
                <div className="mt-1 font-mono text-[9px] text-text-tertiary">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            )}
          </label>

          {error && <div className="mt-4"><FieldError>{error}</FieldError></div>}

          <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/dashboard/profile" className="text-10 font-medium text-text-secondary transition hover:text-indigo-400">
              Enter profile manually
            </Link>

            <Button disabled={!file || busy}>
              {busy ? 'Uploading…' : <><FileUp size={14}/>Upload and extract</>}
            </Button>
          </div>
        </form>

        <aside className="bg-surface-1 p-5 md:p-6">
          <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-tertiary">
            What happens next
          </div>

          <div className="mt-4 space-y-4">
            <InfoStep n="01" title="Validate file" text="Check size, MIME type, and file signature."/>
            <InfoStep n="02" title="Extract facts" text="Parse experience, education, skills, projects, and achievements."/>
            <InfoStep n="03" title="Isolate content" text="Treat uploaded text as data, not AI instructions."/>
            <InfoStep n="04" title="You verify" text="Only facts you approve become trusted evidence."/>
          </div>
        </aside>
      </div>
    </OnboardingShell>
  );
}

export function ResumeProgress({ taskId }: { taskId: string }) {
  const router = useRouter();

  const q = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.get<AsyncTask>(`/tasks/${taskId}`),
    refetchInterval: query =>
      ['succeeded', 'failed'].includes(query.state.data?.status || '') ? false : 700,
  });

  useEffect(() => {
    if (q.data?.status === 'succeeded') {
      router.replace('/onboarding/verify');
    }
  }, [q.data?.status, router]);

  const status = q.data?.status;

  return (
    <OnboardingShell
      step={3}
      title="Extracting your career evidence."
      description="CareerPilot is converting the resume into structured facts. The extraction job persists independently of this browser page."
    >
      <div className="p-5 md:p-8">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <div className={`flex size-16 items-center justify-center rounded-[18px] border ${
            status === 'failed'
              ? 'border-red-500/15 bg-red-500/10 text-red-400'
              : status === 'succeeded'
                ? 'border-emerald-500/15 bg-emerald-500/10 text-emerald-400'
                : 'border-indigo-500/15 bg-indigo-500/10 text-indigo-400'
          }`}>
            {status === 'failed'
              ? <CircleAlert size={24}/>
              : status === 'succeeded'
                ? <CheckCircle2 size={24}/>
                : <WandSparkles size={24}/>}
          </div>

          <h2 className="mt-5 text-18 font-semibold">
            {status === 'failed'
              ? 'Extraction could not be completed'
              : status === 'succeeded'
                ? 'Extraction complete'
                : 'Reading and structuring your resume'}
          </h2>

          <p className="mt-2 max-w-lg text-11 leading-5 text-text-secondary">
            Experience, education, skills, projects, achievements, and other facts are being prepared for review.
          </p>
        </div>

        {q.isLoading ? (
          <Skeleton className="mx-auto mt-8 h-16 max-w-2xl rounded-[14px]"/>
        ) : q.error ? (
          <div className="mx-auto mt-6 max-w-2xl">
            <ErrorState message={err(q.error)} retry={() => q.refetch()}/>
          </div>
        ) : q.data ? (
          <div className="mx-auto mt-8 max-w-2xl">
            <div className="rounded-[16px] border border-border bg-surface-2/45 p-5">
              <ProgressBar
                value={q.data.progress}
                label={q.data.status === 'failed' ? 'Extraction failed' : `Extraction · ${q.data.status}`}
              />
              <div className="mt-4 flex items-center justify-between font-mono text-[9px] text-text-tertiary">
                <span>Task {taskId.slice(0, 8)}…</span>
                <span>{q.data.progress}%</span>
              </div>
            </div>

            {q.data.status === 'failed' && (
              <div className="mt-5">
                <ErrorState
                  message={`Resume extraction failed${q.data.error_code ? ` (${q.data.error_code})` : ''}. You can retry with a valid PDF or DOCX.`}
                />
                <Link href="/onboarding/resume" className="mt-4 inline-flex items-center gap-1.5 text-10 text-text-secondary underline underline-offset-4">
                  <ArrowLeft size={11}/>Choose another resume
                </Link>
              </div>
            )}

            {q.data.status === 'succeeded' && (
              <div className="mt-5 flex justify-end">
                <Link href="/onboarding/verify">
                  <Button>Review extracted facts<ArrowRight size={14}/></Button>
                </Link>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </OnboardingShell>
  );
}

export function ExtractedVerification() {
  const router = useRouter();
  const { push } = useToast();
  const client = useQueryClient();

  const q = useQuery({
    queryKey: ['profile', 'extracted'],
    queryFn: () => api.get<ProfileEntry[]>('/profile/extracted'),
  });

  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (q.data) {
      setValues(Object.fromEntries(q.data.map(item => [item.id, item.label])));
    }
  }, [q.data]);

  const verify = useMutation({
    mutationFn: async () => {
      const decisions = (q.data || []).map(item => ({
        entry_id: item.id,
        action: values[item.id]?.trim() ? 'edit' : 'reject',
        label: values[item.id]?.trim() || undefined,
        structured_data: item.structured_data,
      }));

      return api.post('/profile/verify', { decisions });
    },

    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['profile'] });
      push('Verified facts saved');
      router.push('/dashboard/profile');
    },
  });

  const stats = useMemo(() => {
    const items = q.data || [];
    return {
      total: items.length,
      high: items.filter(item => item.confidence >= 0.7).length,
      low: items.filter(item => item.confidence < 0.7).length,
      rejected: items.filter(item => !values[item.id]?.trim()).length,
    };
  }, [q.data, values]);

  return (
    <OnboardingShell
      step={4}
      title="Verify every extracted fact."
      description="This is the trust gate. Only facts you confirm can be used for job matching, tailored resumes, cover letters, and interview preparation."
    >
      <div className="border-b border-border p-5 md:p-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Extracted" value={stats.total} tone="indigo"/>
          <Metric label="High confidence" value={stats.high} tone="positive"/>
          <Metric label="Review closely" value={stats.low} tone="warning"/>
          <Metric label="Rejected" value={stats.rejected} tone="negative"/>
        </div>
      </div>

      {q.isLoading ? (
        <div className="space-y-3 p-5 md:p-6">
          {[1,2,3].map(x => <Skeleton className="h-28 rounded-[16px]" key={x}/>)}
        </div>
      ) : q.error ? (
        <div className="p-5 md:p-6"><ErrorState message={err(q.error)}/></div>
      ) : !q.data?.length ? (
        <div className="p-5 md:p-6">
          <EmptyState
            title="No unverified facts remain"
            description="Your resume either produced no new fields or all extracted facts were already reviewed."
            action={<Link href="/dashboard/profile"><Button>Open career profile</Button></Link>}
          />
        </div>
      ) : (
        <form
          className="p-5 md:p-6"
          onSubmit={e => { e.preventDefault(); verify.mutate(); }}
        >
          <div className="space-y-3">
            {q.data.map(item => (
              <VerificationCard
                key={item.id}
                item={item}
                value={values[item.id] || ''}
                onChange={value => setValues(current => ({ ...current, [item.id]: value }))}
              />
            ))}
          </div>

          {verify.error && <div className="mt-4"><FieldError>{err(verify.error)}</FieldError></div>}

          <div className="sticky bottom-4 z-20 mt-6 flex flex-col gap-3 rounded-[16px] border border-border bg-canvas/85 p-3 shadow-[0_20px_60px_rgba(0,0,0,.18)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 px-2">
              <ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-400"/>
              <p className="max-w-xl text-[9px] leading-5 text-text-secondary">
                Every non-empty field becomes verified evidence. Empty fields are rejected.
              </p>
            </div>

            <Button disabled={verify.isPending}>
              {verify.isPending ? 'Saving…' : <>Confirm verified profile<ArrowRight size={14}/></>}
            </Button>
          </div>
        </form>
      )}
    </OnboardingShell>
  );
}

function Field({
  label, icon: Icon, hint, children,
}: {
  label: string;
  icon: typeof UserRound;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-12 font-medium">
          <Icon size={12} className="text-text-tertiary"/>
          {label}
        </span>
        {hint && <span className="text-[9px] text-text-tertiary">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function InfoStep({ n, title, text }: { n: string; title: string; text: string }) {
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

function Metric({
  label, value, tone,
}: {
  label: string;
  value: number;
  tone: 'indigo' | 'positive' | 'warning' | 'negative';
}) {
  const styles = {
    indigo: 'border-indigo-500/15 bg-indigo-500/[0.06] text-indigo-400',
    positive: 'border-emerald-500/15 bg-emerald-500/[0.06] text-emerald-400',
    warning: 'border-amber-500/15 bg-amber-500/[0.06] text-amber-400',
    negative: 'border-red-500/15 bg-red-500/[0.06] text-red-400',
  };

  return (
    <div className={`rounded-[12px] border p-3 ${styles[tone]}`}>
      <div className="text-20 font-semibold tracking-[-0.04em]">{value}</div>
      <div className="mt-1 text-[9px] text-text-secondary">{label}</div>
    </div>
  );
}

function VerificationCard({
  item, value, onChange,
}: {
  item: ProfileEntry;
  value: string;
  onChange: (value: string) => void;
}) {
  const confidence = Math.round(item.confidence * 100);
  const high = item.confidence >= 0.7;
  const rejected = !value.trim();

  return (
    <div className={`career-verification-card rounded-[16px] border p-4 md:p-5 ${
      rejected
        ? 'border-red-500/15 bg-red-500/[0.035]'
        : high
          ? 'border-border bg-surface-2/40'
          : 'border-amber-500/15 bg-amber-500/[0.04]'
    }`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-tertiary">
            {item.entry_type.replaceAll('_', ' ')}
          </div>
          <div className="mt-1 text-11 font-medium">Extracted fact</div>
        </div>

        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[9px] ${
          rejected
            ? 'border-red-500/15 bg-red-500/[0.06] text-red-400'
            : high
              ? 'border-emerald-500/15 bg-emerald-500/[0.06] text-emerald-400'
              : 'border-amber-500/15 bg-amber-500/[0.06] text-amber-400'
        }`}>
          {rejected ? <CircleAlert size={10}/> : high ? <CheckCircle2 size={10}/> : <CircleAlert size={10}/>}
          {rejected ? 'Will reject' : `${confidence}% confidence`}
        </span>
      </div>

      <Input className="mt-4 h-11" value={value} onChange={e => onChange(e.target.value)}/>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[9px] leading-5 text-text-secondary">
          Edit to correct it. Clear the field to reject it.
        </p>

        <span className={`font-mono text-[9px] ${rejected ? 'text-red-400' : 'text-emerald-400'}`}>
          {rejected ? 'Excluded from profile' : 'Will become verified evidence'}
        </span>
      </div>
    </div>
  );
}
