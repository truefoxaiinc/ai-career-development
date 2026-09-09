'use client';

import Link from 'next/link';
import { ReactNode, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  Compass,
  LineChart,
  ListChecks,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';

import { api } from '@/lib/api';
import {
  Button,
  EmptyState,
  ErrorState,
  FieldError,
  Input,
  PageHeader,
  Panel,
  Skeleton,
} from '@/components/ui';
import { useToast } from '@/components/toast';

const err = (e: unknown) => (e instanceof Error ? e.message : 'Request failed');

type Gap = {
  id: string;
  target_role: string;
  sample_size: number;
  skill_frequency: Record<string, number>;
  present_skills: string[];
  missing_skills: Array<{ skill: string; job_count: number; frequency_pct?: number }>;
  recommendations: Array<string | { skill?: string; priority?: string; reason?: string }>;
  created_at: string;
};

type SkillsMarket = {
  analysis_id?: string;
  target_role?: string;
  sample_size: number;
  skills: Array<{
    skill: string;
    job_count: number;
    frequency_pct: number;
    present: boolean;
  }>;
  message?: string;
};

type Roadmap = {
  id: string;
  analysis_id?: string;
  target_role: string;
  months: Array<{
    month: number;
    focus: string[];
    objectives: string[];
    evidence_gate: string;
  }>;
  status: string;
  created_at: string;
};

function CareerIntelligenceNav({ active }: { active: 'gaps' | 'skills' | 'roadmap' }) {
  const items = [
    { id: 'gaps', label: 'Gap analysis', href: '/dashboard/career/gaps', icon: Target },
    { id: 'skills', label: 'Skills market', href: '/dashboard/career/skills', icon: BarChart3 },
    { id: 'roadmap', label: 'Roadmap', href: '/dashboard/career/roadmap', icon: Compass },
  ] as const;

  return (
    <div className="mb-5 overflow-x-auto hide-scrollbar">
      <div className="inline-flex min-w-full items-center gap-1 rounded-[14px] border border-border bg-surface-1/80 p-1.5 shadow-sm backdrop-blur-xl sm:min-w-0">
        {items.map(item => {
          const Icon = item.icon;
          const selected = active === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`inline-flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-11 font-medium transition ${selected ? 'bg-text-primary text-canvas shadow-sm' : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'}`}
            >
              <Icon size={13} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function GapAnalysisPage() {
  const client = useQueryClient();
  const { push } = useToast();
  const q = useQuery({ queryKey: ['career', 'gaps'], queryFn: () => api.get<Gap[]>('/career/gaps') });
  const [role, setRole] = useState('');
  const [sample, setSample] = useState(50);

  const create = useMutation({
    mutationFn: () => api.post<Gap>('/career/gaps', { target_role: role, sample_size: sample }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['career'] });
      push('Career-gap analysis completed');
    },
  });

  const latest = q.data?.[0];
  const topGapFrequency = useMemo(() => {
    const values = latest?.missing_skills.map(skill =>
      skill.frequency_pct ?? (latest.sample_size ? Math.round((skill.job_count / latest.sample_size) * 100) : 0),
    ) ?? [];
    return values.length ? Math.max(...values) : 0;
  }, [latest]);

  return (
    <>
      <PageHeader
        eyebrow="Career intelligence"
        title="Career-gap analysis"
        description="Compare your verified skills with real job demand for a target role and identify the most important gaps to close."
        actions={
          <Link href="/dashboard/career/roadmap">
            <Button variant="secondary"><Compass size={14} />View roadmap</Button>
          </Link>
        }
      />

      <CareerIntelligenceNav active="gaps" />

      <section className="career-intelligence-hero mb-5 overflow-hidden rounded-[22px] border border-indigo-500/15">
        <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-7">
          <div className="relative z-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-indigo-300">Market-driven skill intelligence</div>
            <h2 className="mt-3 max-w-2xl text-24 font-semibold tracking-[-0.035em] md:text-28">See the distance between your profile and the role you want.</h2>
            <p className="mt-3 max-w-2xl text-12 leading-6 text-text-secondary">CareerPilot compares your verified skills against persisted job postings, then ranks missing skills by observed market demand.</p>
          </div>

          <div className="relative z-10 grid grid-cols-2 gap-2">
            <CareerMiniMetric value={latest ? String(latest.present_skills.length) : '—'} label="supported" tone="positive" />
            <CareerMiniMetric value={latest ? String(latest.missing_skills.length) : '—'} label="gaps" tone="warning" />
          </div>
        </div>
      </section>

      <Panel className="career-analysis-form mb-5 overflow-hidden">
        <form
          onSubmit={e => { e.preventDefault(); create.mutate(); }}
          className="grid gap-4 p-5 md:grid-cols-[1fr_180px_auto] md:items-end md:p-6"
        >
          <CareerField label="Target role" description="Use the role you actually want to compete for.">
            <Input className="h-11" required value={role} onChange={e => setRole(e.target.value)} placeholder="Platform Engineer" />
          </CareerField>
          <CareerField label="Job sample" description="5–100 jobs">
            <Input className="h-11" type="number" min={5} max={100} value={sample} onChange={e => setSample(Number(e.target.value))} />
          </CareerField>
          <Button disabled={create.isPending}>{create.isPending ? 'Analyzing…' : <><Sparkles size={14} />Run analysis</>}</Button>
        </form>
        {create.error && <div className="px-5 pb-5 md:px-6"><FieldError>{err(create.error)}</FieldError></div>}
      </Panel>

      {q.isLoading ? (
        <GapLoading />
      ) : q.error ? (
        <ErrorState message={err(q.error)} retry={() => q.refetch()} />
      ) : !latest ? (
        <EmptyState title="No gap analysis yet" description="Run an analysis after jobs have been ingested for the role you want to target." />
      ) : (
        <>
          <div className="mb-5 grid gap-3 md:grid-cols-4">
            <CareerMetric icon={Target} label="Target role" value={latest.target_role} color="indigo" />
            <CareerMetric icon={BarChart3} label="Jobs sampled" value={String(latest.sample_size)} color="cyan" />
            <CareerMetric icon={CheckCircle2} label="Verified skills" value={String(latest.present_skills.length)} color="emerald" />
            <CareerMetric icon={TrendingUp} label="Top gap frequency" value={`${topGapFrequency}%`} color="amber" />
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <Panel className="overflow-hidden">
              <div className="border-b border-border px-5 py-5 md:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-[10px] border border-emerald-500/15 bg-emerald-500/10 text-emerald-400"><ShieldCheck size={15} /></div>
                  <div><h2 className="text-15 font-semibold">Skills already supported</h2><p className="mt-1 text-[10px] text-text-secondary">Verified skills that overlap with sampled market demand.</p></div>
                </div>
              </div>
              <div className="p-5 md:p-6">
                {latest.present_skills.length ? (
                  <div className="flex flex-wrap gap-2">
                    {latest.present_skills.map(skill => (
                      <span key={skill} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.06] px-2.5 py-1.5 text-10 font-medium text-emerald-400"><CheckCircle2 size={11} />{skill}</span>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[13px] border border-amber-500/15 bg-amber-500/[0.05] p-4 text-11 leading-5 text-text-secondary">No sampled market skills are currently verified in your profile.</div>
                )}
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-5 py-5 md:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-[10px] border border-amber-500/15 bg-amber-500/10 text-amber-400"><TrendingUp size={15} /></div>
                  <div><h2 className="text-15 font-semibold">Prioritized skill gaps</h2><p className="mt-1 text-[10px] text-text-secondary">Ranked by observed frequency in the sampled jobs.</p></div>
                </div>
                <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 font-mono text-[9px] text-text-secondary">top 12</span>
              </div>

              <div className="divide-y divide-border">
                {latest.missing_skills.length ? latest.missing_skills.slice(0, 12).map((skill, index) => {
                  const frequency = skill.frequency_pct ?? Math.round((skill.job_count / latest.sample_size) * 100);
                  return <GapRow key={skill.skill} rank={index + 1} skill={skill.skill} count={skill.job_count} frequency={frequency} />;
                }) : <div className="p-5 text-11 text-text-secondary">No missing skills identified in this sample.</div>}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border bg-surface-2/30 p-4 md:px-6">
                <Link href="/dashboard/career/skills"><Button variant="secondary"><BarChart3 size={14} />Market frequencies</Button></Link>
                <Link href="/dashboard/career/roadmap"><Button><Compass size={14} />Build roadmap</Button></Link>
              </div>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

export function SkillsMarketPage() {
  const q = useQuery({ queryKey: ['career', 'skills-market'], queryFn: () => api.get<SkillsMarket>('/career/skills-market') });
  const presentCount = q.data?.skills.filter(skill => skill.present).length ?? 0;
  const gapCount = q.data?.skills.filter(skill => !skill.present).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Career intelligence"
        title="Skills-market analysis"
        description="Understand which skills appear most often in the jobs behind your latest career-gap analysis."
        actions={<Link href="/dashboard/career/gaps"><Button variant="secondary"><Target size={14} />Gap analysis</Button></Link>}
      />
      <CareerIntelligenceNav active="skills" />

      {q.isLoading ? <MarketLoading /> : q.error ? <ErrorState message={err(q.error)} /> : !q.data?.skills.length ? (
        <EmptyState title="No market analysis yet" description={q.data?.message || 'Run a career-gap analysis first.'} action={<Link href="/dashboard/career/gaps"><Button>Run gap analysis</Button></Link>} />
      ) : (
        <>
          <section className="career-market-hero mb-5 overflow-hidden rounded-[22px] border border-cyan-500/15">
            <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-7">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-cyan-300">Market frequency</div>
                <h2 className="mt-3 text-24 font-semibold tracking-[-0.035em] md:text-28">{q.data.target_role}</h2>
                <p className="mt-3 max-w-2xl text-12 leading-6 text-text-secondary">Frequency represents how often each skill appeared across the {q.data.sample_size} sampled job postings.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <CareerMiniMetric value={String(q.data.sample_size)} label="jobs" tone="neutral" />
                <CareerMiniMetric value={String(presentCount)} label="verified" tone="positive" />
                <CareerMiniMetric value={String(gapCount)} label="gaps" tone="warning" />
              </div>
            </div>
          </section>

          <Panel className="overflow-hidden">
            <div className="border-b border-border px-5 py-4 md:px-6">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-[10px] border border-cyan-500/15 bg-cyan-500/10 text-cyan-400"><LineChart size={15} /></div>
                <div><h2 className="text-14 font-semibold">Skill demand ranking</h2><p className="mt-1 text-[10px] text-text-secondary">Higher frequency means the skill appears in more of the sampled jobs.</p></div>
              </div>
            </div>
            <div className="divide-y divide-border">
              {q.data.skills.map((skill, index) => <MarketSkillRow key={skill.skill} rank={index + 1} skill={skill.skill} count={skill.job_count} frequency={skill.frequency_pct} present={skill.present} />)}
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

export function RoadmapPage() {
  const client = useQueryClient();
  const { push } = useToast();
  const q = useQuery({ queryKey: ['career', 'roadmaps'], queryFn: () => api.get<Roadmap[]>('/career/roadmaps') });
  const [months, setMonths] = useState(6);
  const create = useMutation({
    mutationFn: () => api.post<Roadmap>('/career/roadmaps', { analysis_id: null, months }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['career', 'roadmaps'] });
      push('Development roadmap created');
    },
  });

  const latest = q.data?.[0];
  const objectiveCount = latest?.months.reduce((total, month) => total + month.objectives.length, 0) ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Career intelligence"
        title="Career development roadmap"
        description="Turn market gaps into a month-by-month development plan, while keeping verification separate from learning."
        actions={
          <div className="flex gap-2">
            <Input className="w-20" type="number" min={1} max={12} value={months} onChange={e => setMonths(Number(e.target.value))} />
            <Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? 'Building…' : <><Plus size={14} />Build roadmap</>}</Button>
          </div>
        }
      />
      <CareerIntelligenceNav active="roadmap" />

      {create.error && <div className="mb-5"><ErrorState message={err(create.error)} /></div>}

      {q.isLoading ? <RoadmapLoading /> : q.error ? <ErrorState message={err(q.error)} /> : !latest ? (
        <EmptyState title="No roadmap yet" description="Run a career-gap analysis first, then generate a development roadmap." action={<Link href="/dashboard/career/gaps"><Button>Run gap analysis</Button></Link>} />
      ) : (
        <>
          <section className="career-roadmap-hero mb-5 overflow-hidden rounded-[22px] border border-violet-500/15">
            <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-7">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-violet-300">Development plan</div>
                <h2 className="mt-3 text-24 font-semibold tracking-[-0.035em] md:text-28">{latest.target_role}</h2>
                <p className="mt-3 max-w-2xl text-12 leading-6 text-text-secondary">Each month focuses on market-relevant gaps. New skills only become verified after you can provide real evidence.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <CareerMiniMetric value={String(latest.months.length)} label="months" tone="neutral" />
                <CareerMiniMetric value={String(objectiveCount)} label="objectives" tone="positive" />
                <CareerMiniMetric value={latest.status} label="status" tone="violet" />
              </div>
            </div>
          </section>

          <div className="career-roadmap-timeline relative space-y-4">
            {latest.months.map((month, index) => <RoadmapMonth key={month.month} month={month} isLast={index === latest.months.length - 1} />)}
          </div>
        </>
      )}
    </>
  );
}

function CareerField({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return <label className="block"><div className="mb-2"><div className="text-12 font-medium">{label}</div>{description && <p className="mt-1 text-[10px] text-text-secondary">{description}</p>}</div>{children}</label>;
}

function CareerMetric({ icon: Icon, label, value, color }: { icon: typeof Target; label: string; value: string; color: 'indigo' | 'cyan' | 'emerald' | 'amber' }) {
  const styles = {
    indigo: 'border-indigo-500/15 bg-indigo-500/10 text-indigo-400',
    cyan: 'border-cyan-500/15 bg-cyan-500/10 text-cyan-400',
    emerald: 'border-emerald-500/15 bg-emerald-500/10 text-emerald-400',
    amber: 'border-amber-500/15 bg-amber-500/10 text-amber-400',
  };
  return <Panel className="group p-4 transition duration-200 hover:-translate-y-0.5 hover:border-border-strong"><div className="flex items-start gap-3"><div className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] border ${styles[color]}`}><Icon size={15} /></div><div className="min-w-0"><div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-secondary">{label}</div><div className="mt-1 truncate text-13 font-semibold">{value}</div></div></div></Panel>;
}

function CareerMiniMetric({ value, label, tone }: { value: string; label: string; tone: 'neutral' | 'positive' | 'warning' | 'violet' }) {
  const styles = {
    neutral: 'border-border bg-surface-1/60 text-text-primary',
    positive: 'border-emerald-500/15 bg-emerald-500/[0.06] text-emerald-400',
    warning: 'border-amber-500/15 bg-amber-500/[0.06] text-amber-400',
    violet: 'border-violet-500/15 bg-violet-500/[0.06] text-violet-400',
  };
  return <div className={`min-w-[92px] rounded-[13px] border p-3 text-right ${styles[tone]}`}><div className="truncate text-20 font-semibold tracking-[-0.04em]">{value}</div><div className="mt-1 text-[9px] text-text-secondary">{label}</div></div>;
}

function GapRow({ rank, skill, count, frequency }: { rank: number; skill: string; count: number; frequency: number }) {
  return <div className="p-4 md:px-6"><div className="grid gap-3 sm:grid-cols-[36px_1fr_auto] sm:items-center"><div className="flex size-8 items-center justify-center rounded-[9px] border border-border bg-surface-2 font-mono text-[9px] text-text-secondary">{String(rank).padStart(2, '0')}</div><div><div className="flex items-center justify-between gap-3"><span className="text-12 font-medium">{skill}</span><span className="font-mono text-[9px] text-amber-400">{frequency}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-indigo-500" style={{ width: `${Math.max(3, Math.min(100, frequency))}%` }} /></div></div><div className="font-mono text-[9px] text-text-secondary">{count} jobs</div></div></div>;
}

function MarketSkillRow({ rank, skill, count, frequency, present }: { rank: number; skill: string; count: number; frequency: number; present: boolean }) {
  return <div className="grid gap-4 p-4 md:grid-cols-[42px_1fr_120px_110px] md:items-center md:px-6"><div className="hidden size-8 items-center justify-center rounded-[9px] border border-border bg-surface-2 font-mono text-[9px] text-text-secondary md:flex">{String(rank).padStart(2, '0')}</div><div><div className="flex items-center justify-between gap-3"><div className="text-12 font-medium">{skill}</div><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-medium md:hidden ${present ? 'border-emerald-500/15 bg-emerald-500/[0.06] text-emerald-400' : 'border-amber-500/15 bg-amber-500/[0.06] text-amber-400'}`}>{present ? <CheckCircle2 size={10} /> : <CircleAlert size={10} />}{present ? 'Verified' : 'Gap'}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"><div className={`h-full rounded-full bg-gradient-to-r ${present ? 'from-emerald-400 to-cyan-400' : 'from-cyan-400 to-indigo-500'}`} style={{ width: `${Math.max(3, Math.min(100, frequency))}%` }} /></div></div><div className="font-mono text-[10px] text-text-secondary">{count} postings</div><div className="hidden text-right md:block"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[9px] ${present ? 'border-emerald-500/15 bg-emerald-500/[0.06] text-emerald-400' : 'border-amber-500/15 bg-amber-500/[0.06] text-amber-400'}`}>{frequency}% · {present ? 'verified' : 'gap'}</span></div></div>;
}

function RoadmapMonth({ month, isLast }: { month: Roadmap['months'][number]; isLast: boolean }) {
  return <div className="relative grid gap-4 md:grid-cols-[90px_minmax(0,1fr)] md:gap-6"><div className="relative"><div className="career-roadmap-node relative z-10 flex size-14 flex-col items-center justify-center rounded-[16px] border border-violet-500/20 bg-violet-500/[0.08] text-violet-300 shadow-sm"><span className="font-mono text-[8px] uppercase tracking-[0.05em]">Month</span><span className="mt-0.5 text-20 font-semibold">{month.month}</span></div>{!isLast && <div className="absolute left-7 top-14 hidden h-[calc(100%+18px)] w-px bg-gradient-to-b from-violet-500/30 to-border md:block" />}</div><Panel className="career-roadmap-card overflow-hidden"><div className="border-b border-border p-5 md:px-6"><div className="flex flex-wrap items-center gap-2">{month.focus.map(focus => <span key={focus} className="rounded-full border border-violet-500/15 bg-violet-500/[0.07] px-2.5 py-1 text-[10px] font-medium text-violet-300">{focus}</span>)}</div></div><div className="grid gap-5 p-5 md:grid-cols-[1fr_280px] md:p-6"><div><div className="flex items-center gap-2"><ListChecks size={14} className="text-cyan-400" /><h3 className="text-12 font-semibold">Objectives</h3></div><ul className="mt-3 space-y-3">{month.objectives.map(objective => <li key={objective} className="flex items-start gap-2.5 text-11 leading-5 text-text-secondary"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-400" />{objective}</li>)}</ul></div><div className="rounded-[13px] border border-amber-500/15 bg-amber-500/[0.05] p-4"><div className="flex items-center gap-2 text-11 font-semibold text-amber-400"><BookOpenCheck size={13} />Evidence gate</div><p className="mt-2 text-[10px] leading-5 text-text-secondary">{month.evidence_gate}</p></div></div></Panel></div>;
}

function GapLoading() { return <div className="space-y-5"><div className="grid gap-3 md:grid-cols-4">{[1,2,3,4].map(item => <Skeleton key={item} className="h-[92px] rounded-[16px]" />)}</div><div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-[330px] rounded-[20px]" /><Skeleton className="h-[430px] rounded-[20px]" /></div></div>; }
function MarketLoading() { return <div className="space-y-5"><Skeleton className="h-[220px] rounded-[22px]" /><Skeleton className="h-[620px] rounded-[20px]" /></div>; }
function RoadmapLoading() { return <div className="space-y-4"><Skeleton className="h-[220px] rounded-[22px]" />{[1,2,3].map(item => <Skeleton key={item} className="h-[260px] rounded-[20px]" />)}</div>; }
