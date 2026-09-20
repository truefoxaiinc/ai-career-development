'use client';

import Link from 'next/link';
import {
  FormEvent,
  ReactNode,
  useEffect,
  useState,
} from 'react';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Filter,
  Globe2,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';

import { api } from '@/lib/api';

import type {
  MatchResult,
} from '@/lib/types';

import {
  Button,
  EmptyState,
  ErrorState,
  FieldError,
  Input,
  MatchScoreRadial,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui';

import {
  useDiscoverJobs,
  useJobs,
  useJobSources,
  useRecommendations,
  useSavedJobs,
  type GlobalJob,
} from '@/hooks/useJobs';

import { useToast } from '@/components/toast';

/* =========================================================
   HELPERS
   ========================================================= */

const err = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Request failed';

function useDebouncedValue<T>(
  value: T,
  delay = 400,
) {
  const [
    debouncedValue,
    setDebouncedValue,
  ] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        setDebouncedValue(value);
      },
      delay,
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}


const cleanText = (value?: string | null) =>
  value
    ? value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : '';


type TriState = '' | 'true' | 'false';


const triStateBoolean = (
  value: TriState,
): boolean | null =>
  value === ''
    ? null
    : value === 'true';


const formatAvailability = (
  value?: boolean | null,
) =>
  value === true
    ? 'Yes'
    : value === false
      ? 'No'
      : 'Not specified';


const formatSalary = (
  job: GlobalJob,
) => {
  const currency =
    job.salary_currency?.toUpperCase();

  if (
    job.salary_min == null &&
    job.salary_max == null
  ) {
    return 'Not specified';
  }

  const formatNumber = (
    value: number,
  ) =>
    value.toLocaleString();

  const prefix =
    currency
      ? `${currency} `
      : '';

  if (
    job.salary_min != null &&
    job.salary_max != null
  ) {
    return `${prefix}${formatNumber(
      job.salary_min,
    )} – ${formatNumber(
      job.salary_max,
    )}`;
  }

  if (job.salary_min != null) {
    return `${prefix}${formatNumber(
      job.salary_min,
    )}+`;
  }

  return `Up to ${prefix}${formatNumber(
    job.salary_max!,
  )}`;
};


const formatSource = (source: string) =>
  source.replaceAll('_', ' ');

type MatchTone = 'strong' | 'good' | 'weak' | 'neutral';

function matchTone(score?: number): MatchTone {
  if (typeof score !== 'number') return 'neutral';
  if (score >= 80) return 'strong';
  if (score >= 60) return 'good';
  return 'weak';
}

function matchLabel(score?: number) {
  if (typeof score !== 'number') return 'Not scored';
  if (score >= 85) return 'Excellent fit';
  if (score >= 75) return 'Strong fit';
  if (score >= 60) return 'Good potential';
  return 'Some gaps';
}

/* =========================================================
   SHARED JOB WORKSPACE NAV
   ========================================================= */

function JobsWorkspaceNav({
  active,
}: {
  active:
    | 'recommendations'
    | 'search'
    | 'saved';
}) {
  const items = [
    {
      id: 'recommendations',
      label: 'For you',
      href: '/dashboard/jobs/recommendations',
      icon: Sparkles,
    },
    {
      id: 'search',
      label: 'Search',
      href: '/dashboard/jobs/search',
      icon: Search,
    },
    {
      id: 'saved',
      label: 'Saved',
      href: '/dashboard/jobs/saved',
      icon: Bookmark,
    },
  ] as const;

  return (
    <div className="mb-5 overflow-x-auto hide-scrollbar">
      <div className="inline-flex min-w-full items-center gap-1 rounded-[14px] border border-border bg-surface-1/80 p-1.5 shadow-sm backdrop-blur-xl sm:min-w-0">
        {items.map((item) => {
          const Icon = item.icon;
          const selected = active === item.id;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`group inline-flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-11 font-medium transition ${
                selected
                  ? 'bg-text-primary text-canvas shadow-sm'
                  : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
              }`}
            >
              <Icon
                size={13}
                className={
                  selected
                    ? ''
                    : 'transition group-hover:text-indigo-400'
                }
              />

              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   JOB CARD
   ========================================================= */

function JobCard({
  job,
  showMatch = true,
}: {
  job: GlobalJob;
  showMatch?: boolean;
}) {
  const client = useQueryClient();
  const { push } = useToast();

  const score = job.match?.score;
  const tone = matchTone(score);

  const toneClasses: Record<
    MatchTone,
    {
      line: string;
      badge: string;
      glow: string;
    }
  > = {
    strong: {
      line:
        'from-emerald-400 via-cyan-400 to-transparent',
      badge:
        'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-400',
      glow:
        'group-hover:shadow-[0_20px_70px_rgba(52,211,153,.08)]',
    },
    good: {
      line:
        'from-cyan-400 via-indigo-500 to-transparent',
      badge:
        'border-cyan-500/20 bg-cyan-500/[0.08] text-cyan-400',
      glow:
        'group-hover:shadow-[0_20px_70px_rgba(34,211,238,.07)]',
    },
    weak: {
      line:
        'from-amber-400 via-indigo-500/40 to-transparent',
      badge:
        'border-amber-500/20 bg-amber-500/[0.08] text-amber-400',
      glow:
        'group-hover:shadow-[0_20px_70px_rgba(251,191,36,.06)]',
    },
    neutral: {
      line:
        'from-indigo-500/60 to-transparent',
      badge:
        'border-border bg-surface-2 text-text-secondary',
      glow:
        'group-hover:shadow-[0_20px_70px_rgba(99,102,241,.06)]',
    },
  };

  const style = toneClasses[tone];

  const save = useMutation({
    mutationFn: () =>
      job.saved
        ? api.delete(
            `/jobs/${job.id}/save`,
          )
        : api.post(
            `/jobs/${job.id}/save`,
            { note: '' },
          ),

    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['jobs'],
        }),
        client.invalidateQueries({
          queryKey: [
            'jobs',
            'recommendations',
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            'jobs',
            'saved',
          ],
        }),
      ]);

      push(
        job.saved
          ? 'Job removed from saved list'
          : 'Job saved',
      );
    },
  });

  return (
    <article
      className={`career-job-card group relative overflow-hidden rounded-[20px] border border-border bg-surface-1 transition duration-300 hover:-translate-y-1 hover:border-border-strong ${style.glow}`}
    >
      <div
        className={`h-[2px] w-full bg-gradient-to-r ${style.line}`}
      />

      <div className="p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[12px] border border-border bg-surface-2 text-14 font-semibold text-text-secondary shadow-sm transition duration-300 group-hover:border-indigo-500/20 group-hover:bg-indigo-500/[0.07] group-hover:text-indigo-400">
            {job.company
              ?.trim()
              ?.slice(0, 1)
              ?.toUpperCase() || (
              <Building2 size={16} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border bg-surface-2 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.06em] text-text-secondary">
                {formatSource(job.source)}
              </span>

              {job.remote_mode && (
                <span className="rounded-full border border-cyan-500/10 bg-cyan-500/[0.07] px-2 py-1 text-[9px] font-medium text-cyan-400">
                  {job.remote_mode}
                </span>
              )}

              {job.category && (
                <span className="rounded-full border border-violet-500/10 bg-violet-500/[0.07] px-2 py-1 text-[9px] font-medium text-violet-400">
                  {job.category}
                </span>
              )}

              {job.visa_sponsorship ===
                true && (
                <span className="rounded-full border border-emerald-500/10 bg-emerald-500/[0.07] px-2 py-1 text-[9px] font-medium text-emerald-400">
                  Visa sponsorship
                </span>
              )}

              {typeof score ===
                'number' && (
                <span
                  className={`rounded-full border px-2 py-1 font-mono text-[9px] font-medium ${style.badge}`}
                >
                  {Math.round(score)}% match
                </span>
              )}
            </div>

            <Link
              href={`/dashboard/jobs/${job.id}`}
              className="mt-3 block max-w-3xl text-[18px] font-semibold leading-6 tracking-[-0.025em] transition group-hover:text-indigo-300"
            >
              {job.title}
            </Link>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-11 text-text-secondary">
              <span className="flex items-center gap-1.5">
                <Building2 size={12} />
                {job.company}
              </span>

              <span className="flex items-center gap-1.5">
                <MapPin size={12} />
                {job.location ||
                  'Location not provided'}
              </span>

              {job.country && (
                <span className="flex items-center gap-1.5">
                  <Globe2 size={12} />
                  {job.country}
                </span>
              )}

              {job.employment_type && (
                <span className="flex items-center gap-1.5">
                  <BriefcaseBusiness
                    size={12}
                  />
                  {job.employment_type}
                </span>
              )}
            </div>

            {job.description && (
              <p className="mt-4 line-clamp-2 max-w-3xl text-12 leading-6 text-text-secondary">
                {cleanText(
                  job.description,
                )}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {showMatch &&
              typeof score ===
                'number' &&
              score >= 60 ? (
                <Link
                  href={`/dashboard/jobs/${job.id}/match`}
                  className="career-primary-button group/action inline-flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-11 font-semibold text-white"
                >
                  See why you match

                  <ArrowRight
                    size={12}
                    className="transition-transform group-hover/action:translate-x-0.5"
                  />
                </Link>
              ) : (
                <Link
                  href={`/dashboard/jobs/${job.id}`}
                >
                  <Button variant="secondary">
                    View job
                    <ArrowRight size={13} />
                  </Button>
                </Link>
              )}

              {showMatch &&
                !(
                  typeof score ===
                    'number' &&
                  score >= 60
                ) && (
                  <Link
                    href={`/dashboard/jobs/${job.id}/match`}
                  >
                    <Button variant="ghost">
                      <Target size={13} />
                      Analyze match
                    </Button>
                  </Link>
                )}

              {showMatch &&
                typeof score ===
                  'number' &&
                score >= 60 && (
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                  >
                    <Button variant="ghost">
                      View details
                    </Button>
                  </Link>
                )}

              <Button
                variant="ghost"
                disabled={save.isPending}
                onClick={() =>
                  save.mutate()
                }
              >
                {job.saved ? (
                  <BookmarkCheck
                    size={14}
                    className="text-indigo-400"
                  />
                ) : (
                  <Bookmark
                    size={14}
                  />
                )}

                {job.saved
                  ? 'Saved'
                  : 'Save'}
              </Button>
            </div>
          </div>

          {typeof score ===
            'number' && (
            <div className="hidden w-[96px] shrink-0 text-center sm:block">
              <div className="mx-auto w-fit">
                <MatchScoreRadial
                  value={Math.round(
                    score,
                  )}
                  size={72}
                  label="match"
                />
              </div>

              <div
                className={`mt-2 text-[9px] font-semibold ${
                  tone === 'strong'
                    ? 'text-emerald-400'
                    : tone === 'good'
                      ? 'text-cyan-400'
                      : 'text-amber-400'
                }`}
              >
                {matchLabel(score)}
              </div>
            </div>
          )}
        </div>
      </div>

      {typeof score ===
        'number' && (
        <div className="flex items-center justify-between border-t border-border bg-surface-2/25 px-5 py-2.5 md:px-6">
          <span className="text-[10px] text-text-secondary">
            Ranked using your verified
            profile
          </span>

          <span className="flex items-center gap-1.5 text-[9px] text-emerald-400">
            <ShieldCheck size={11} />
            Evidence-based
          </span>
        </div>
      )}
    </article>
  );
}

/* =========================================================
   RECOMMENDATIONS
   ========================================================= */

export function RecommendationsPage() {
  const q =
    useRecommendations();

  const discover =
    useDiscoverJobs();

  const client =
    useQueryClient();

  const { push } =
    useToast();

  async function refreshOpportunities() {
    try {
      const task =
        await discover.mutateAsync();

      await client.invalidateQueries({
        queryKey: ['jobs'],
      });

      const found =
        Number(
          task.result?.found ?? 0,
        ) || 0;

      push(
        found
          ? `Discovered ${found} matching jobs`
          : 'Discovery finished with no new matching jobs',
      );
    } catch (error) {
      push(err(error));
    }
  }

  const strongCount =
    q.data?.filter(
      (job) =>
        typeof job.match?.score ===
          'number' &&
        job.match.score >= 80,
    ).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Job discovery"
        title="Opportunities picked for you"
        description="CareerPilot ranks roles using your verified experience, education, skills, and preferences — not just keywords."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={refreshOpportunities}
              disabled={discover.isPending}
            >
              <Sparkles size={14} />
              {discover.isPending
                ? 'Finding jobs...'
                : 'Find new jobs'}
            </Button>

            <Link href="/dashboard/preferences">
              <Button variant="secondary">
                <SlidersHorizontal
                  size={14}
                />
                Tune preferences
              </Button>
            </Link>
          </div>
        }
      />

      <JobsWorkspaceNav active="recommendations" />

      <section className="career-jobs-hero mb-5 overflow-hidden rounded-[22px] border border-indigo-500/15">
        <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-7">
          <div className="relative z-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-indigo-300">
              Personalized discovery
            </div>

            <h2 className="mt-3 max-w-2xl text-24 font-semibold tracking-[-0.035em] md:text-28">
              Spend time on the roles that
              deserve it.
            </h2>

            <p className="mt-3 max-w-2xl text-12 leading-6 text-text-secondary">
              Each recommendation is scored
              against your real profile so
              you can quickly understand fit,
              gaps, and the strongest evidence
              to use in your application.
            </p>
          </div>

          <div className="relative z-10 flex gap-3">
            <MiniMetric
              value={
                q.data?.length
                  ? String(
                      q.data.length,
                    )
                  : '—'
              }
              label="recommended"
            />

            <MiniMetric
              value={
                q.data
                  ? String(
                      strongCount,
                    )
                  : '—'
              }
              label="strong fits"
              accent
            />
          </div>
        </div>
      </section>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <JobMetric
          icon={Sparkles}
          label="Ranking"
          value="Personalized"
          description="Verified evidence shapes relevance"
          color="indigo"
        />

        <JobMetric
          icon={Globe2}
          label="Coverage"
          value="Local + global"
          description="Across configured job providers"
          color="cyan"
        />

        <JobMetric
          icon={Target}
          label="Reasoning"
          value="Explainable"
          description="See why every score exists"
          color="emerald"
        />
      </div>

      {q.isLoading ? (
        <JobListLoading />
      ) : q.error ? (
        <ErrorState
          message={err(q.error)}
          retry={() => q.refetch()}
        />
      ) : !q.data?.length ? (
        <EmptyState
          title="No recommendations yet"
          description="Complete your verified profile and job preferences, then return here for ranked opportunities."
          action={
            <Link href="/dashboard/jobs/search">
              <Button>
                Search jobs
                <ArrowRight size={14} />
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {q.data.map((job) => (
            <JobCard
              key={job.id}
              job={{
                ...job,
                saved:
                  job.saved ??
                  false,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* =========================================================
   SEARCH
   ========================================================= */

export function JobSearchPage() {
  const [query, setQuery] =
    useState('');

  const [location, setLocation] =
    useState('');

  const [country, setCountry] =
    useState('');

  const [category, setCategory] =
    useState('');

  const [workMode, setWorkMode] =
    useState('');

  const [
    employmentType,
    setEmploymentType,
  ] = useState('');

  const [salaryMin, setSalaryMin] =
    useState('');

  const [currency, setCurrency] =
    useState('');

  const [
    visaSponsorship,
    setVisaSponsorship,
  ] = useState<TriState>('');

  const [
    relocationSupport,
    setRelocationSupport,
  ] = useState<TriState>('');

  const [
    workAuthorization,
    setWorkAuthorization,
  ] = useState('');

  const [source, setSource] =
    useState('');

  const [sort, setSort] =
    useState('recent');

  const [page, setPage] =
    useState(1);

  const [manual, setManual] =
    useState(false);

  const deferredQuery =
    useDebouncedValue(
      query,
      400,
    );

  const deferredLocation =
    useDebouncedValue(
      location,
      400,
    );

  const deferredCountry =
    useDebouncedValue(
      country,
      400,
    );

  const deferredCategory =
    useDebouncedValue(
      category,
      400,
    );

  const deferredAuthorization =
    useDebouncedValue(
      workAuthorization,
      400,
    );

  const normalizedSalaryMin =
    salaryMin
      ? Number(salaryMin)
      : undefined;

  const jobs = useJobs({
    q: deferredQuery,
    location: deferredLocation,
    country: deferredCountry,
    category: deferredCategory,
    work_mode: workMode,
    employment_type:
      employmentType,
    salary_min:
      Number.isFinite(
        normalizedSalaryMin,
      )
        ? normalizedSalaryMin
        : undefined,
    currency:
      currency.trim().toUpperCase(),
    visa_sponsorship:
      visaSponsorship === ''
        ? undefined
        : visaSponsorship ===
          'true',
    relocation_support:
      relocationSupport === ''
        ? undefined
        : relocationSupport ===
          'true',
    work_authorization:
      deferredAuthorization,
    source,
    sort,
    page,
  });

  const sources =
    useJobSources();

  const client =
    useQueryClient();

  const { push } =
    useToast();

  type ManualJobDraft = {
    title: string;
    company: string;
    location: string;
    country: string;
    city: string;
    category: string;
    occupation: string;
    remote_mode: string;
    salary_min: string;
    salary_max: string;
    salary_currency: string;
    employment_type: string;
    visa_sponsorship: TriState;
    relocation_support: TriState;
    work_authorization: string;
    description: string;
    apply_url: string;
  };

  const emptyManualJob =
    (): ManualJobDraft => ({
      title: '',
      company: '',
      location: '',
      country: '',
      city: '',
      category: '',
      occupation: '',
      remote_mode: '',
      salary_min: '',
      salary_max: '',
      salary_currency: '',
      employment_type: '',
      visa_sponsorship: '',
      relocation_support: '',
      work_authorization: '',
      description: '',
      apply_url: '',
    });

  const [
    manualData,
    setManualData,
  ] = useState<ManualJobDraft>(
    emptyManualJob,
  );

  const add = useMutation({
    mutationFn: () =>
      api.post<GlobalJob>(
        '/jobs/manual',
        {
          ...manualData,
          remote_mode:
            manualData.remote_mode ||
            null,
          salary_min:
            manualData.salary_min
              ? Number(
                  manualData.salary_min,
                )
              : null,
          salary_max:
            manualData.salary_max
              ? Number(
                  manualData.salary_max,
                )
              : null,
          salary_currency:
            manualData.salary_currency
              .trim()
              .toUpperCase() ||
            null,
          employment_type:
            manualData.employment_type
              .trim() ||
            null,
          visa_sponsorship:
            triStateBoolean(
              manualData.visa_sponsorship,
            ),
          relocation_support:
            triStateBoolean(
              manualData.relocation_support,
            ),
          work_authorization:
            manualData.work_authorization
              .trim() ||
            null,
        },
      ),

    onSuccess: async () => {
      push(
        'Job description added',
      );

      setManual(false);
      setManualData(
        emptyManualJob(),
      );

      await client.invalidateQueries({
        queryKey: ['jobs'],
      });
    },
  });

  const hasFilters =
    Boolean(
      query ||
        location ||
        country ||
        category ||
        workMode ||
        employmentType ||
        salaryMin ||
        currency ||
        visaSponsorship ||
        relocationSupport ||
        workAuthorization ||
        source ||
        sort !== 'recent',
    );

  function submitManual(
    e: FormEvent,
  ) {
    e.preventDefault();
    add.mutate();
  }

  function resetFilters() {
    setQuery('');
    setLocation('');
    setCountry('');
    setCategory('');
    setWorkMode('');
    setEmploymentType('');
    setSalaryMin('');
    setCurrency('');
    setVisaSponsorship('');
    setRelocationSupport('');
    setWorkAuthorization('');
    setSource('');
    setSort('recent');
    setPage(1);
  }

  return (
    <>
      <PageHeader
        eyebrow="Job discovery"
        title="Search opportunities"
        description="Search normalized jobs across local and international sources, or add a vacancy privately for analysis."
        actions={
          <Button
            onClick={() =>
              setManual(
                (value) =>
                  !value,
              )
            }
            variant={
              manual
                ? 'primary'
                : 'secondary'
            }
          >
            {manual ? (
              <X size={14} />
            ) : (
              <Plus size={14} />
            )}

            {manual
              ? 'Close'
              : 'Add private job'}
          </Button>
        }
      />

      <JobsWorkspaceNav active="search" />

      {manual && (
        <Panel className="career-manual-job mb-5 overflow-hidden border-indigo-500/20">
          <div className="flex items-start justify-between border-b border-border px-5 py-5 md:px-6">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-[11px] border border-indigo-500/15 bg-indigo-500/10 text-indigo-400">
                <Plus size={17} />
              </div>

              <div>
                <h2 className="text-15 font-semibold">
                  Add a private vacancy
                </h2>

                <p className="mt-1 max-w-xl text-11 leading-5 text-text-secondary">
                  Paste a role you found
                  outside your configured job
                  sources. Add only details
                  stated by the vacancy; unknown
                  visa or relocation information
                  can stay unspecified.
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={
              submitManual
            }
            className="grid gap-5 p-5 md:grid-cols-2 md:p-6"
          >
            <SearchField label="Job title">
              <Input
                required
                value={
                  manualData.title
                }
                onChange={(e) =>
                  setManualData(
                    (current) => ({
                      ...current,
                      title:
                        e.target.value,
                    }),
                  )
                }
                placeholder="Registered Nurse"
                className="h-11"
              />
            </SearchField>

            <SearchField label="Company">
              <Input
                required
                value={
                  manualData.company
                }
                onChange={(e) =>
                  setManualData(
                    (current) => ({
                      ...current,
                      company:
                        e.target.value,
                    }),
                  )
                }
                placeholder="Company name"
                className="h-11"
              />
            </SearchField>

            <SearchField label="Location">
              <Input
                value={
                  manualData.location
                }
                onChange={(e) =>
                  setManualData(
                    (current) => ({
                      ...current,
                      location:
                        e.target.value,
                    }),
                  )
                }
                placeholder="Toronto, Canada · Hybrid"
                className="h-11"
              />
            </SearchField>

            <SearchField label="Country">
              <Input
                value={
                  manualData.country
                }
                onChange={(e) =>
                  setManualData(
                    (current) => ({
                      ...current,
                      country:
                        e.target.value,
                    }),
                  )
                }
                placeholder="Canada"
                className="h-11"
              />
            </SearchField>

            <SearchField label="City">
              <Input
                value={
                  manualData.city
                }
                onChange={(e) =>
                  setManualData(
                    (current) => ({
                      ...current,
                      city:
                        e.target.value,
                    }),
                  )
                }
                placeholder="Toronto"
                className="h-11"
              />
            </SearchField>

            <SearchField label="Job category">
              <Input
                value={
                  manualData.category
                }
                onChange={(e) =>
                  setManualData(
                    (current) => ({
                      ...current,
                      category:
                        e.target.value,
                    }),
                  )
                }
                placeholder="Healthcare"
                className="h-11"
              />
            </SearchField>

            <SearchField label="Occupation">
              <Input
                value={
                  manualData.occupation
                }
                onChange={(e) =>
                  setManualData(
                    (current) => ({
                      ...current,
                      occupation:
                        e.target.value,
                    }),
                  )
                }
                placeholder="Registered Nurse"
                className="h-11"
              />
            </SearchField>

            <SearchField label="Work mode">
              <Select
                value={
                  manualData.remote_mode
                }
                onChange={(e) =>
                  setManualData(
                    (current) => ({
                      ...current,
                      remote_mode:
                        e.target.value,
                    }),
                  )
                }
                className="h-11"
              >
                <option value="">
                  Not specified
                </option>
                <option value="remote">
                  Remote
                </option>
                <option value="hybrid">
                  Hybrid
                </option>
                <option value="onsite">
                  On-site
                </option>
              </Select>
            </SearchField>

            <SearchField label="Employment type">
              <Input
                value={
                  manualData.employment_type
                }
                onChange={(e) =>
                  setManualData(
                    (current) => ({
                      ...current,
                      employment_type:
                        e.target.value,
                    }),
                  )
                }
                placeholder="Full-time"
                className="h-11"
              />
            </SearchField>

            <SearchField label="Currency">
              <Input
                maxLength={8}
                value={
                  manualData.salary_currency
                }
                onChange={(e) =>
                  setManualData(
                    (current) => ({
                      ...current,
                      salary_currency:
                        e.target.value,
                    }),
                  )
                }
                placeholder="CAD"
                className="h-11 uppercase"
              />
            </SearchField>

            <SearchField label="Minimum salary">
              <Input
                type="number"
                min="0"
                value={
                  manualData.salary_min
                }
                onChange={(e) =>
                  setManualData(
                    (current) => ({
                      ...current,
                      salary_min:
                        e.target.value,
                    }),
                  )
                }
                placeholder="80000"
                className="h-11"
              />
            </SearchField>

            <SearchField label="Maximum salary">
              <Input
                type="number"
                min="0"
                value={
                  manualData.salary_max
                }
                onChange={(e) =>
                  setManualData(
                    (current) => ({
                      ...current,
                      salary_max:
                        e.target.value,
                    }),
                  )
                }
                placeholder="100000"
                className="h-11"
              />
            </SearchField>

            <SearchField label="Visa sponsorship">
              <Select
                value={
                  manualData.visa_sponsorship
                }
                onChange={(e) =>
                  setManualData(
                    (current) => ({
                      ...current,
                      visa_sponsorship:
                        e.target
                          .value as TriState,
                    }),
                  )
                }
                className="h-11"
              >
                <option value="">
                  Unknown / not stated
                </option>
                <option value="true">
                  Available
                </option>
                <option value="false">
                  Not available
                </option>
              </Select>
            </SearchField>

            <SearchField label="Relocation support">
              <Select
                value={
                  manualData.relocation_support
                }
                onChange={(e) =>
                  setManualData(
                    (current) => ({
                      ...current,
                      relocation_support:
                        e.target
                          .value as TriState,
                    }),
                  )
                }
                className="h-11"
              >
                <option value="">
                  Unknown / not stated
                </option>
                <option value="true">
                  Available
                </option>
                <option value="false">
                  Not available
                </option>
              </Select>
            </SearchField>

            <SearchField label="Work authorization">
              <Input
                value={
                  manualData.work_authorization
                }
                onChange={(e) =>
                  setManualData(
                    (current) => ({
                      ...current,
                      work_authorization:
                        e.target.value,
                    }),
                  )
                }
                placeholder="Must be authorized to work in Canada"
                className="h-11"
              />
            </SearchField>

            <SearchField label="Official application URL">
              <Input
                type="url"
                required
                value={
                  manualData.apply_url
                }
                onChange={(e) =>
                  setManualData(
                    (current) => ({
                      ...current,
                      apply_url:
                        e.target.value,
                    }),
                  )
                }
                placeholder="https://..."
                className="h-11"
              />
            </SearchField>

            <div className="md:col-span-2">
              <SearchField label="Job description">
                <Textarea
                  required
                  value={
                    manualData.description
                  }
                  onChange={(e) =>
                    setManualData(
                      (current) => ({
                        ...current,
                        description:
                          e.target
                            .value,
                      }),
                    )
                  }
                  placeholder="Paste the complete job description..."
                  className="min-h-[190px]"
                />
              </SearchField>
            </div>

            {add.error && (
              <div className="md:col-span-2">
                <FieldError>
                  {err(add.error)}
                </FieldError>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-5 md:col-span-2">
              <p className="hidden text-10 text-text-secondary sm:block">
                External job text is treated
                as untrusted input during AI
                analysis.
              </p>

              <Button
                disabled={
                  add.isPending
                }
              >
                {add.isPending
                  ? 'Adding…'
                  : 'Add private job'}
              </Button>
            </div>
          </form>
        </Panel>
      )}

      <section className="career-search-hero mb-5 rounded-[22px] border border-border p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SearchField
            label="What are you looking for?"
            icon={Search}
          >
            <Input
              value={query}
              onChange={(e) => {
                setQuery(
                  e.target.value,
                );
                setPage(1);
              }}
              placeholder="Role, company, skill"
              className="h-12"
            />
          </SearchField>

          <SearchField
            label="City or location"
            icon={MapPin}
          >
            <Input
              value={location}
              onChange={(e) => {
                setLocation(
                  e.target.value,
                );
                setPage(1);
              }}
              placeholder="Kochi, Toronto, Remote"
              className="h-12"
            />
          </SearchField>

          <SearchField
            label="Country"
            icon={Globe2}
          >
            <Input
              value={country}
              onChange={(e) => {
                setCountry(
                  e.target.value,
                );
                setPage(1);
              }}
              placeholder="India, CA, Germany"
              className="h-12"
            />
          </SearchField>

          <SearchField label="Work mode">
            <Select
              className="h-12"
              value={workMode}
              onChange={(e) => {
                setWorkMode(
                  e.target.value,
                );
                setPage(1);
              }}
            >
              <option value="">
                Any work mode
              </option>
              <option value="remote">
                Remote
              </option>
              <option value="hybrid">
                Hybrid
              </option>
              <option value="onsite">
                On-site
              </option>
            </Select>
          </SearchField>

          <SearchField label="Job category">
            <Input
              value={category}
              onChange={(e) => {
                setCategory(
                  e.target.value,
                );
                setPage(1);
              }}
              placeholder="Technology, Healthcare"
              className="h-12"
            />
          </SearchField>

          <SearchField label="Employment type">
            <Input
              value={
                employmentType
              }
              onChange={(e) => {
                setEmploymentType(
                  e.target.value,
                );
                setPage(1);
              }}
              placeholder="Full-time, Contract"
              className="h-12"
            />
          </SearchField>

          <SearchField label="Source">
            <Select
              className="h-12"
              value={source}
              onChange={(e) => {
                setSource(
                  e.target.value,
                );

                setPage(1);
              }}
            >
              <option value="">
                All sources
              </option>

              {sources.data?.map(
                (provider) => (
                  <option
                    key={provider}
                    value={provider}
                  >
                    {formatSource(
                      provider,
                    )}
                  </option>
                ),
              )}
            </Select>
          </SearchField>

          <SearchField label="Sort by">
            <Select
              className="h-12"
              value={sort}
              onChange={(e) => {
                setSort(
                  e.target.value,
                );
                setPage(1);
              }}
            >
              <option value="recent">
                Most recent
              </option>

              <option value="title">
                Title A–Z
              </option>
            </Select>
          </SearchField>

          <SearchField label="Minimum salary">
            <Input
              type="number"
              min="0"
              value={salaryMin}
              onChange={(e) => {
                setSalaryMin(
                  e.target.value,
                );
                setPage(1);
              }}
              placeholder="100000"
              className="h-12"
            />
          </SearchField>

          <SearchField label="Currency">
            <Input
              maxLength={8}
              value={currency}
              onChange={(e) => {
                setCurrency(
                  e.target.value,
                );
                setPage(1);
              }}
              placeholder="USD, INR, CAD"
              className="h-12 uppercase"
            />
          </SearchField>

          <SearchField label="Visa sponsorship">
            <Select
              className="h-12"
              value={visaSponsorship}
              onChange={(e) => {
                setVisaSponsorship(
                  e.target
                    .value as TriState,
                );
                setPage(1);
              }}
            >
              <option value="">
                Any / unknown
              </option>
              <option value="true">
                Sponsorship available
              </option>
              <option value="false">
                No sponsorship
              </option>
            </Select>
          </SearchField>

          <SearchField label="Relocation support">
            <Select
              className="h-12"
              value={relocationSupport}
              onChange={(e) => {
                setRelocationSupport(
                  e.target
                    .value as TriState,
                );
                setPage(1);
              }}
            >
              <option value="">
                Any / unknown
              </option>
              <option value="true">
                Support available
              </option>
              <option value="false">
                No support
              </option>
            </Select>
          </SearchField>

          <div className="md:col-span-2 xl:col-span-4">
            <SearchField
              label="Work authorization"
              icon={ShieldCheck}
            >
              <Input
                value={workAuthorization}
                onChange={(e) => {
                  setWorkAuthorization(
                    e.target.value,
                  );
                  setPage(1);
                }}
                placeholder="e.g. authorized to work in Canada, US citizen, EU"
                className="h-12"
              />
            </SearchField>
          </div>
        </div>

        <div className="mt-4 rounded-[12px] border border-border bg-surface-2/45 px-4 py-3 text-[10px] leading-5 text-text-secondary">
          Visa sponsorship, relocation support, and work-authorization filters only match jobs where the provider supplied that information. Unknown provider data is not treated as “No”.
        </div>

        {hasFilters && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <div className="mr-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.07em] text-text-tertiary">
              <Filter size={10} />
              Active
            </div>

            {query && (
              <FilterChip
                label={`"${query}"`}
                onRemove={() => {
                  setQuery('');
                  setPage(1);
                }}
              />
            )}

            {location && (
              <FilterChip
                label={`Location: ${location}`}
                onRemove={() => {
                  setLocation('');
                  setPage(1);
                }}
              />
            )}

            {country && (
              <FilterChip
                label={`Country: ${country}`}
                onRemove={() => {
                  setCountry('');
                  setPage(1);
                }}
              />
            )}

            {category && (
              <FilterChip
                label={`Category: ${category}`}
                onRemove={() => {
                  setCategory('');
                  setPage(1);
                }}
              />
            )}

            {workMode && (
              <FilterChip
                label={`Work: ${workMode}`}
                onRemove={() => {
                  setWorkMode('');
                  setPage(1);
                }}
              />
            )}

            {employmentType && (
              <FilterChip
                label={`Employment: ${employmentType}`}
                onRemove={() => {
                  setEmploymentType('');
                  setPage(1);
                }}
              />
            )}

            {salaryMin && (
              <FilterChip
                label={`Salary ≥ ${currency ? `${currency.toUpperCase()} ` : ''}${salaryMin}`}
                onRemove={() => {
                  setSalaryMin('');
                  setPage(1);
                }}
              />
            )}

            {currency && (
              <FilterChip
                label={`Currency: ${currency.toUpperCase()}`}
                onRemove={() => {
                  setCurrency('');
                  setPage(1);
                }}
              />
            )}

            {visaSponsorship && (
              <FilterChip
                label={`Visa: ${
                  visaSponsorship ===
                  'true'
                    ? 'Available'
                    : 'Not available'
                }`}
                onRemove={() => {
                  setVisaSponsorship('');
                  setPage(1);
                }}
              />
            )}

            {relocationSupport && (
              <FilterChip
                label={`Relocation: ${
                  relocationSupport ===
                  'true'
                    ? 'Available'
                    : 'Not available'
                }`}
                onRemove={() => {
                  setRelocationSupport('');
                  setPage(1);
                }}
              />
            )}

            {workAuthorization && (
              <FilterChip
                label={`Authorization: ${workAuthorization}`}
                onRemove={() => {
                  setWorkAuthorization('');
                  setPage(1);
                }}
              />
            )}

            {source && (
              <FilterChip
                label={`Source: ${formatSource(source)}`}
                onRemove={() => {
                  setSource('');
                  setPage(1);
                }}
              />
            )}

            {sort !== 'recent' && (
              <FilterChip
                label="Title A–Z"
                onRemove={() => {
                  setSort('recent');
                  setPage(1);
                }}
              />
            )}

            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto text-[10px] font-medium text-text-secondary transition hover:text-indigo-400"
            >
              Clear all
            </button>
          </div>
        )}
      </section>

      {jobs.isLoading ? (
        <JobListLoading />
      ) : jobs.error ? (
        <ErrorState
          message={err(
            jobs.error,
          )}
          retry={() =>
            jobs.refetch()
          }
        />
      ) : !jobs.data?.items
          .length ? (
        <EmptyState
          title="No imported jobs match these filters"
          description="Search filters jobs already collected into CareerPilot. Use For you → Find new jobs to import fresh opportunities, then broaden country, location, or sponsorship filters if needed."
        />
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-11 text-text-secondary">
              <span className="font-semibold text-text-primary">
                {jobs.data.total}
              </span>{' '}
              opportunities found
            </div>

            <span className="font-mono text-[9px] text-text-tertiary">
              page{' '}
              {jobs.data.page}/
              {jobs.data.pages}
            </span>
          </div>

          <div className="space-y-3">
            {jobs.data.items.map(
              (job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  showMatch={false}
                />
              ),
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-[16px] border border-border bg-surface-1/80 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <span className="pl-2 font-mono text-[10px] text-text-secondary">
              Page{' '}
              {jobs.data.page} of{' '}
              {jobs.data.pages} ·{' '}
              {jobs.data.total}{' '}
              jobs
            </span>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() =>
                  setPage(
                    (current) =>
                      current - 1,
                  )
                }
              >
                <ChevronLeft
                  size={14}
                />
                Previous
              </Button>

              <Button
                variant="secondary"
                disabled={
                  page >=
                  jobs.data.pages
                }
                onClick={() =>
                  setPage(
                    (current) =>
                      current + 1,
                  )
                }
              >
                Next
                <ChevronRight
                  size={14}
                />
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}


/* =========================================================
   SAVED JOBS
   ========================================================= */

export function SavedJobsPage() {
  const q =
    useSavedJobs();

  return (
    <>
      <PageHeader
        eyebrow="Job discovery"
        title="Your shortlist"
        description="Keep promising roles in one place while you compare fit, prepare applications, and decide where to focus."
        actions={
          <Link href="/dashboard/jobs/recommendations">
            <Button variant="secondary">
              Browse recommendations
              <ArrowRight size={14} />
            </Button>
          </Link>
        }
      />

      <JobsWorkspaceNav active="saved" />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <JobMetric
          icon={BookmarkCheck}
          label="Shortlist"
          value={
            q.data
              ? `${q.data.length} saved`
              : 'Loading'
          }
          description="Private to your account"
          color="indigo"
        />

        <JobMetric
          icon={Target}
          label="Next step"
          value="Compare fit"
          description="Analyze before you apply"
          color="cyan"
        />

        <JobMetric
          icon={ShieldCheck}
          label="Evidence"
          value="Connected"
          description="Use the same verified profile"
          color="emerald"
        />
      </section>

      {q.isLoading ? (
        <JobListLoading />
      ) : q.error ? (
        <ErrorState
          message={err(q.error)}
        />
      ) : !q.data?.length ? (
        <EmptyState
          title="Your shortlist is empty"
          description="Save promising roles from recommendations or search so you can compare them later."
          action={
            <Link href="/dashboard/jobs/recommendations">
              <Button>
                Browse recommendations
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {q.data.map((job) => (
            <JobCard
              key={job.id}
              job={{
                ...job,
                saved: true,
              }}
              showMatch={false}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* =========================================================
   JOB DETAIL
   ========================================================= */

export function JobDetailPage({
  jobId,
}: {
  jobId: string;
}) {
  const q = useQuery({
    queryKey: [
      'job',
      jobId,
    ],

    queryFn: () =>
      api.get<GlobalJob>(
        `/jobs/${jobId}`,
      ),
  });

  const client =
    useQueryClient();

  const { push } =
    useToast();

  const save = useMutation({
    mutationFn: () =>
      q.data?.saved
        ? api.delete(
            `/jobs/${jobId}/save`,
          )
        : api.post(
            `/jobs/${jobId}/save`,
            { note: '' },
          ),

    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({
          queryKey: [
            'job',
            jobId,
          ],
        }),
        client.invalidateQueries({
          queryKey: ['jobs'],
        }),
      ]);

      push(
        q.data?.saved
          ? 'Removed from saved jobs'
          : 'Job saved',
      );
    },
  });

  if (q.isLoading) {
    return <JobDetailLoading />;
  }

  if (q.error) {
    return (
      <ErrorState
        message={err(q.error)}
      />
    );
  }

  if (!q.data) return null;

  const job = q.data;

  return (
    <>
      <div className="mb-4">
        <Link
          href="/dashboard/jobs/recommendations"
          className="inline-flex items-center gap-1.5 text-11 font-medium text-text-secondary transition hover:text-indigo-400"
        >
          <ArrowLeft size={13} />
          Back to jobs
        </Link>
      </div>

      <section className="career-job-detail-hero mb-5 overflow-hidden rounded-[24px] border border-indigo-500/15">
        <div className="relative p-6 md:p-8">
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-[15px] border border-white/10 bg-white/[0.05] text-20 font-semibold shadow-xl">
                {job.company
                  ?.trim()
                  ?.slice(0, 1)
                  ?.toUpperCase()}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-indigo-500/20 bg-indigo-500/[0.10] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.06em] text-indigo-300">
                    {formatSource(
                      job.source,
                    )}
                  </span>

                  {job.remote_mode && (
                    <span className="rounded-full border border-cyan-500/15 bg-cyan-500/[0.08] px-2.5 py-1 text-[9px] font-medium text-cyan-300">
                      {job.remote_mode}
                    </span>
                  )}

                  {job.category && (
                    <span className="rounded-full border border-violet-500/15 bg-violet-500/[0.08] px-2.5 py-1 text-[9px] font-medium text-violet-300">
                      {job.category}
                    </span>
                  )}

                  {job.visa_sponsorship ===
                    true && (
                    <span className="rounded-full border border-emerald-500/15 bg-emerald-500/[0.08] px-2.5 py-1 text-[9px] font-medium text-emerald-300">
                      Visa sponsorship
                    </span>
                  )}
                </div>

                <h1 className="mt-4 max-w-4xl text-28 font-semibold leading-[1.05] tracking-[-0.04em] md:text-36">
                  {job.title}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-11 text-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <Building2
                      size={12}
                    />
                    {job.company}
                  </span>

                  <span className="flex items-center gap-1.5">
                    <MapPin size={12} />
                    {job.location ||
                      'Location not provided'}
                  </span>

                  {job.country && (
                    <span className="flex items-center gap-1.5">
                      <Globe2 size={12} />
                      {job.country}
                    </span>
                  )}

                  {job.employment_type && (
                    <span className="flex items-center gap-1.5">
                      <BriefcaseBusiness
                        size={12}
                      />
                      {
                        job.employment_type
                      }
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={
                  save.isPending
                }
                onClick={() =>
                  save.mutate()
                }
              >
                {job.saved ? (
                  <BookmarkCheck
                    size={14}
                  />
                ) : (
                  <Bookmark
                    size={14}
                  />
                )}

                {job.saved
                  ? 'Saved'
                  : 'Save'}
              </Button>

              <Link
                href={`/dashboard/jobs/${jobId}/match`}
              >
                <Button>
                  <Target size={14} />
                  Analyze match
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <Panel className="career-job-description overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 md:px-6">
            <div>
              <h2 className="text-14 font-semibold">
                Job description
              </h2>

              <p className="mt-1 text-[10px] text-text-secondary">
                Original content from the
                job source.
              </p>
            </div>

            <ShieldCheck
              size={15}
              className="text-emerald-400"
            />
          </div>

          <div className="p-5 md:p-7">
            <div className="whitespace-pre-wrap text-13 leading-7 text-text-secondary">
              {cleanText(
                job.description,
              ) ||
                'No job description was provided.'}
            </div>
          </div>
        </Panel>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Panel className="career-job-action-panel overflow-hidden border-indigo-500/15">
            <div className="p-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.07em] text-indigo-400">
                CareerPilot
              </div>

              <h3 className="mt-2 text-15 font-semibold">
                Is this role worth your time?
              </h3>

              <p className="mt-2 text-11 leading-5 text-text-secondary">
                Compare this vacancy against
                your verified profile before
                tailoring your CV.
              </p>

              <Link
                href={`/dashboard/jobs/${jobId}/match`}
              >
                <Button className="mt-5 w-full">
                  <Target size={14} />
                  Analyze my match
                </Button>
              </Link>

              {job.apply_url && (
                <a
                  href={job.apply_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block"
                >
                  <Button
                    variant="secondary"
                    className="w-full"
                  >
                    Official job page
                    <ExternalLink
                      size={14}
                    />
                  </Button>
                </a>
              )}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="border-b border-border p-5">
              <h2 className="text-13 font-semibold">
                Job facts
              </h2>
            </div>

            <dl className="space-y-4 p-5">
              <FactLine
                label="Source"
                value={formatSource(
                  job.source,
                )}
              />

              <FactLine
                label="Country"
                value={
                  job.country ||
                  'Not specified'
                }
              />

              <FactLine
                label="City"
                value={
                  job.city ||
                  'Not specified'
                }
              />

              <FactLine
                label="Category"
                value={
                  job.category ||
                  'Not specified'
                }
              />

              <FactLine
                label="Occupation"
                value={
                  job.occupation ||
                  'Not specified'
                }
              />

              <FactLine
                label="Employment"
                value={
                  job.employment_type ||
                  'Not specified'
                }
              />

              <FactLine
                label="Salary"
                value={
                  formatSalary(job)
                }
              />

              <FactLine
                label="Visa sponsorship"
                value={
                  formatAvailability(
                    job.visa_sponsorship,
                  )
                }
              />

              <FactLine
                label="Relocation support"
                value={
                  formatAvailability(
                    job.relocation_support,
                  )
                }
              />

              <FactLine
                label="Work authorization"
                value={
                  job.work_authorization ||
                  'Not specified'
                }
              />

              <FactLine
                label="Posted"
                value={
                  job.posted_at
                    ? new Date(
                        job.posted_at,
                      ).toLocaleDateString()
                    : 'Not provided'
                }
              />

              {job.remote_mode && (
                <FactLine
                  label="Work mode"
                  value={
                    job.remote_mode
                  }
                />
              )}
            </dl>
          </Panel>

          {job.ingestion_meta
            ?.prompt_injection_flags ? (
            <div className="rounded-[14px] border border-amber-500/20 bg-amber-500/[0.06] p-4">
              <div className="flex items-start gap-3">
                <CircleAlert
                  size={16}
                  className="mt-0.5 shrink-0 text-amber-400"
                />

                <div>
                  <div className="text-11 font-semibold text-amber-300">
                    Suspicious instructions isolated
                  </div>

                  <p className="mt-1 text-[10px] leading-5 text-text-secondary">
                    Prompt-like instructions
                    were detected in this
                    external listing and are
                    prevented from becoming AI
                    instructions.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[14px] border border-emerald-500/15 bg-emerald-500/[0.05] p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  size={16}
                  className="mt-0.5 shrink-0 text-emerald-400"
                />

                <div>
                  <div className="text-11 font-semibold">
                    External content isolated
                  </div>

                  <p className="mt-1 text-[10px] leading-5 text-text-secondary">
                    The job listing is treated
                    as untrusted content during
                    CareerPilot analysis.
                  </p>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

/* =========================================================
   JOB MATCH
   ========================================================= */

export function JobMatchPage({
  jobId,
}: {
  jobId: string;
}) {
  const q = useQuery({
    queryKey: [
      'job',
      jobId,
      'match',
    ],

    queryFn: () =>
      api.get<MatchResult>(
        `/jobs/${jobId}/match`,
      ),
  });

  if (q.isLoading) {
    return <JobMatchLoading />;
  }

  if (q.error) {
    return (
      <ErrorState
        message={err(q.error)}
      />
    );
  }

  if (!q.data) return null;

  const match = q.data;
  const roundedScore =
    Math.round(match.score);

  return (
    <>
      <div className="mb-4">
        <Link
          href={`/dashboard/jobs/${jobId}`}
          className="inline-flex items-center gap-1.5 text-11 font-medium text-text-secondary transition hover:text-indigo-400"
        >
          <ArrowLeft size={13} />
          Back to job
        </Link>
      </div>

      <PageHeader
        eyebrow="Explainable matching"
        title={`${match.role} · ${match.company}`}
        description="See exactly where your verified profile aligns, where evidence is transferable, and what the role still asks for."
        actions={
          <Link
            href={`/dashboard/applications/prepare/${jobId}`}
            className="career-primary-button group inline-flex h-10 items-center gap-2 rounded-[10px] px-4 text-11 font-semibold text-white"
          >
            Prepare application

            <ArrowRight
              size={13}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        }
      />

      <section className="career-match-hero mb-5 overflow-hidden rounded-[24px] border border-indigo-500/15">
        <div className="relative grid gap-7 p-6 md:grid-cols-[150px_1fr_auto] md:items-center md:p-8">
          <div className="relative z-10">
            <MatchScoreRadial
              value={roundedScore}
              size={122}
              label="overall match"
            />
          </div>

          <div className="relative z-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-indigo-300">
              Match summary
            </div>

            <h2 className="mt-3 text-24 font-semibold tracking-[-0.035em] md:text-28">
              {roundedScore >= 80
                ? 'You have strong evidence for this role.'
                : roundedScore >= 60
                  ? 'There is a credible fit, with a few gaps.'
                  : 'The role is possible, but the gaps matter.'}
            </h2>

            <p className="mt-3 max-w-2xl text-12 leading-6 text-text-secondary">
              {match.explanation}
            </p>
          </div>

          <div className="relative z-10 hidden text-right lg:block">
            <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-tertiary">
              Recommended action
            </div>

            <div className="mt-2 text-12 font-semibold text-indigo-300">
              {roundedScore >= 60
                ? 'Tailor and apply'
                : 'Review gaps first'}
            </div>
          </div>
        </div>
      </section>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <MatchStat
          icon={CheckCircle2}
          label="Strong evidence"
          value={match.strong.length}
          tone="positive"
        />

        <MatchStat
          icon={TrendingUp}
          label="Transferable"
          value={match.partial.length}
          tone="caution"
        />

        <MatchStat
          icon={XCircle}
          label="Missing"
          value={match.missing.length}
          tone="negative"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[310px_minmax(0,1fr)]">
        <Panel className="h-fit overflow-hidden">
          <div className="border-b border-border p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-[10px] border border-indigo-500/15 bg-indigo-500/10 text-indigo-400">
                <Target size={15} />
              </div>

              <div>
                <h2 className="text-14 font-semibold">
                  Match overview
                </h2>

                <p className="mt-1 text-[10px] text-text-secondary">
                  Fast summary of the role fit.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <MatchSummaryLine
              icon={CheckCircle2}
              label="Strong matches"
              value={match.strong.length}
              tone="positive"
            />

            <MatchSummaryLine
              icon={TrendingUp}
              label="Partial matches"
              value={match.partial.length}
              tone="caution"
            />

            <MatchSummaryLine
              icon={XCircle}
              label="Missing requirements"
              value={match.missing.length}
              tone="negative"
            />

            <div className="border-t border-border pt-4">
              <p className="text-[10px] leading-5 text-text-secondary">
                Match weights are
                configurable. Scores should
                guide prioritization, not be
                treated as hiring guarantees.
              </p>
            </div>

            <Link
              href={`/dashboard/applications/prepare/${jobId}`}
            >
              <Button className="w-full">
                Prepare application
                <ArrowRight size={13} />
              </Button>
            </Link>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-border px-5 py-5 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-[10px] border border-cyan-500/15 bg-cyan-500/10 text-cyan-400">
                <TrendingUp
                  size={15}
                />
              </div>

              <div>
                <h2 className="text-15 font-semibold">
                  Factor breakdown
                </h2>

                <p className="mt-1 text-[10px] text-text-secondary">
                  See how each configured
                  factor contributed to the
                  final score.
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-border">
            {Object.entries(
              match.factor_breakdown,
            ).map(
              ([name, factor]) => (
                <MatchFactor
                  key={name}
                  name={name}
                  score={
                    factor.score
                  }
                  weight={
                    factor.weight
                  }
                />
              ),
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <MatchGroup
          icon={CheckCircle2}
          title="Strong matches"
          description="Requirements clearly supported by your verified profile."
          items={match.strong}
          tone="positive"
        />

        <MatchGroup
          icon={TrendingUp}
          title="Transferable evidence"
          description="Related experience that may support the requirement without overstating your background."
          items={match.partial}
          tone="caution"
        />

        <MatchGroup
          icon={XCircle}
          title="Missing requirements"
          description="Requirements that are not currently supported by verified evidence."
          items={match.missing}
          tone="negative"
        />
      </div>

      <section className="career-match-cta mt-5 overflow-hidden rounded-[20px] border border-indigo-500/15 p-6 md:p-7">
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.07em] text-indigo-300">
              Next step
            </div>

            <h3 className="mt-2 text-18 font-semibold tracking-[-0.02em]">
              Turn this match into a tailored application.
            </h3>

            <p className="mt-2 max-w-2xl text-11 leading-5 text-text-secondary">
              CareerPilot can emphasize the
              strongest verified evidence,
              adapt your resume to the role,
              and prepare the cover letter
              without inventing experience.
            </p>
          </div>

          <Link
            href={`/dashboard/applications/prepare/${jobId}`}
            className="career-primary-button group inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[11px] px-5 text-12 font-semibold text-white"
          >
            Prepare application

            <ArrowRight
              size={14}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </section>
    </>
  );
}

/* =========================================================
   SMALL COMPONENTS
   ========================================================= */

function JobMetric({
  icon: Icon,
  label,
  value,
  description,
  color,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  description: string;
  color:
    | 'indigo'
    | 'cyan'
    | 'emerald';
}) {
  const styles = {
    indigo:
      'border-indigo-500/15 bg-indigo-500/10 text-indigo-400',
    cyan:
      'border-cyan-500/15 bg-cyan-500/10 text-cyan-400',
    emerald:
      'border-emerald-500/15 bg-emerald-500/10 text-emerald-400',
  };

  return (
    <Panel className="group p-4 transition duration-200 hover:-translate-y-0.5 hover:border-border-strong">
      <div className="flex items-start gap-3">
        <div
          className={`flex size-9 items-center justify-center rounded-[10px] border ${styles[color]}`}
        >
          <Icon size={15} />
        </div>

        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-secondary">
            {label}
          </div>

          <div className="mt-1 text-13 font-semibold">
            {value}
          </div>

          <p className="mt-1 text-[10px] text-text-secondary">
            {description}
          </p>
        </div>
      </div>
    </Panel>
  );
}

function MiniMetric({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`min-w-[105px] rounded-[14px] border p-3 text-right ${
        accent
          ? 'border-emerald-500/15 bg-emerald-500/[0.06]'
          : 'border-border bg-surface-1/60'
      }`}
    >
      <div
        className={`text-22 font-semibold tracking-[-0.04em] ${
          accent
            ? 'text-emerald-400'
            : ''
        }`}
      >
        {value}
      </div>

      <div className="mt-1 text-[9px] text-text-secondary">
        {label}
      </div>
    </div>
  );
}

function SearchField({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: typeof Search;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium text-text-secondary">
        {Icon && (
          <Icon size={11} />
        )}

        {label}
      </div>

      {children}
    </label>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="group inline-flex items-center gap-1.5 rounded-full border border-indigo-500/15 bg-indigo-500/[0.07] px-2.5 py-1.5 text-[10px] font-medium text-indigo-300 transition hover:border-indigo-500/30 hover:bg-indigo-500/[0.12]"
    >
      <span className="max-w-[180px] truncate">
        {label}
      </span>

      <X
        size={11}
        className="opacity-70 transition group-hover:opacity-100"
      />
    </button>
  );
}

function FactLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-10 text-text-secondary">
        {label}
      </dt>

      <dd className="max-w-[180px] text-right text-11 font-medium">
        {value}
      </dd>
    </div>
  );
}

function MatchSummaryLine({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  tone:
    | 'positive'
    | 'caution'
    | 'negative';
}) {
  const colors = {
    positive:
      'bg-emerald-500/10 text-emerald-400',
    caution:
      'bg-amber-500/10 text-amber-400',
    negative:
      'bg-red-500/10 text-red-400',
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span
          className={`flex size-7 items-center justify-center rounded-[8px] ${colors[tone]}`}
        >
          <Icon size={13} />
        </span>

        <span className="text-11 text-text-secondary">
          {label}
        </span>
      </div>

      <span className="font-mono text-11 font-semibold">
        {value}
      </span>
    </div>
  );
}

function MatchStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  tone:
    | 'positive'
    | 'caution'
    | 'negative';
}) {
  const styles = {
    positive:
      'border-emerald-500/15 bg-emerald-500/[0.055] text-emerald-400',
    caution:
      'border-amber-500/15 bg-amber-500/[0.055] text-amber-400',
    negative:
      'border-red-500/15 bg-red-500/[0.055] text-red-400',
  };

  return (
    <div
      className={`rounded-[16px] border p-4 ${styles[tone]}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex size-8 items-center justify-center rounded-[9px] border border-current/10">
          <Icon size={14} />
        </div>

        <div className="text-24 font-semibold tracking-[-0.04em]">
          {value}
        </div>
      </div>

      <div className="mt-3 text-[10px] font-medium">
        {label}
      </div>
    </div>
  );
}

function MatchFactor({
  name,
  score,
  weight,
}: {
  name: string;
  score: number;
  weight: number;
}) {
  const clamped =
    Math.max(
      0,
      Math.min(100, score),
    );

  const tone =
    score >= 80
      ? 'from-emerald-400 to-cyan-400'
      : score >= 60
        ? 'from-cyan-400 to-indigo-500'
        : 'from-amber-400 to-indigo-500';

  return (
    <div className="p-5 md:px-6">
      <div className="flex items-center justify-between gap-4">
        <span className="text-12 font-medium capitalize">
          {name.replaceAll(
            '_',
            ' ',
          )}
        </span>

        <span className="font-mono text-[10px] text-text-secondary">
          {Math.round(score)}%
          {' · '}
          {Math.round(weight)}%
          {' weight'}
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className={`career-factor-bar h-full rounded-full bg-gradient-to-r ${tone}`}
          style={{
            width: `${clamped}%`,
          }}
        />
      </div>
    </div>
  );
}

function MatchGroup({
  icon: Icon,
  title,
  description,
  items,
  tone,
}: {
  icon: typeof CheckCircle2;
  title: string;
  description: string;
  items: Array<{
    label: string;
  }>;
  tone:
    | 'positive'
    | 'caution'
    | 'negative';
}) {
  const styles = {
    positive: {
      icon:
        'border-emerald-500/15 bg-emerald-500/10 text-emerald-400',
      dot: 'bg-emerald-400',
    },
    caution: {
      icon:
        'border-amber-500/15 bg-amber-500/10 text-amber-400',
      dot: 'bg-amber-400',
    },
    negative: {
      icon:
        'border-red-500/15 bg-red-500/10 text-red-400',
      dot: 'bg-red-400',
    },
  };

  const style =
    styles[tone];

  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-border p-5">
        <div className="flex items-start gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] border ${style.icon}`}
          >
            <Icon size={15} />
          </div>

          <div>
            <h2 className="text-13 font-semibold">
              {title}
            </h2>

            <p className="mt-1 text-[10px] leading-5 text-text-secondary">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {items.length ? (
          <ul className="space-y-3">
            {items.map(
              (item, index) => (
                <li
                  key={`${item.label}-${index}`}
                  className="flex items-start gap-2.5 text-11 leading-5 text-text-secondary"
                >
                  <span
                    className={`mt-2 size-1.5 shrink-0 rounded-full ${style.dot}`}
                  />

                  {item.label}
                </li>
              ),
            )}
          </ul>
        ) : (
          <p className="text-11 text-text-secondary">
            None identified.
          </p>
        )}
      </div>
    </Panel>
  );
}

/* =========================================================
   LOADING
   ========================================================= */

function JobListLoading() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(
        (item) => (
          <Skeleton
            key={item}
            className="h-[205px] rounded-[20px]"
          />
        ),
      )}
    </div>
  );
}

function JobDetailLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[220px] rounded-[24px]" />

      <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
        <Skeleton className="h-[620px] rounded-[20px]" />
        <div className="space-y-4">
          <Skeleton className="h-[220px] rounded-[20px]" />
          <Skeleton className="h-[230px] rounded-[20px]" />
        </div>
      </div>
    </div>
  );
}

function JobMatchLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[240px] rounded-[24px]" />

      <div className="grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map(
          (item) => (
            <Skeleton
              key={item}
              className="h-[105px] rounded-[16px]"
            />
          ),
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[310px_1fr]">
        <Skeleton className="h-[370px] rounded-[20px]" />
        <Skeleton className="h-[370px] rounded-[20px]" />
      </div>
    </div>
  );
}
