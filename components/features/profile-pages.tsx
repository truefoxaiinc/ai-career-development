'use client';

import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';

import Link from 'next/link';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  FileBadge2,
  FileText,
  FolderGit2,
  Globe2,
  GraduationCap,
  Languages,
  MapPin,
  Phone,
  Plus,
  Save,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  UploadCloud,
  UserRound,
  WandSparkles,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

import { api } from '@/lib/api';

import type {
  Preferences,
  Profile,
  ProfileEntry,
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

import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/components/toast';


/* =========================================================
   HELPERS
   ========================================================= */

const err = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Request failed';


const split = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);


type FactStyle = {
  icon: LucideIcon;
  label: string;
  color: string;
  iconColor: string;
};


const factMeta: Record<string, FactStyle> = {
  experience: {
    icon: BriefcaseBusiness,
    label: 'Experience',
    color:
      'border-indigo-500/15 bg-indigo-500/[0.06]',
    iconColor:
      'border-indigo-500/15 bg-indigo-500/10 text-indigo-400',
  },

  education: {
    icon: GraduationCap,
    label: 'Education',
    color:
      'border-blue-500/15 bg-blue-500/[0.055]',
    iconColor:
      'border-blue-500/15 bg-blue-500/10 text-blue-400',
  },

  skill: {
    icon: Sparkles,
    label: 'Skills',
    color:
      'border-cyan-500/15 bg-cyan-500/[0.055]',
    iconColor:
      'border-cyan-500/15 bg-cyan-500/10 text-cyan-400',
  },

  certification: {
    icon: FileBadge2,
    label: 'Certifications',
    color:
      'border-violet-500/15 bg-violet-500/[0.055]',
    iconColor:
      'border-violet-500/15 bg-violet-500/10 text-violet-400',
  },

  project: {
    icon: FolderGit2,
    label: 'Projects',
    color:
      'border-emerald-500/15 bg-emerald-500/[0.055]',
    iconColor:
      'border-emerald-500/15 bg-emerald-500/10 text-emerald-400',
  },

  publication: {
    icon: BookOpen,
    label: 'Publications',
    color:
      'border-sky-500/15 bg-sky-500/[0.055]',
    iconColor:
      'border-sky-500/15 bg-sky-500/10 text-sky-400',
  },

  achievement: {
    icon: Award,
    label: 'Achievements',
    color:
      'border-amber-500/15 bg-amber-500/[0.055]',
    iconColor:
      'border-amber-500/15 bg-amber-500/10 text-amber-400',
  },

  language: {
    icon: Languages,
    label: 'Languages',
    color:
      'border-fuchsia-500/15 bg-fuchsia-500/[0.055]',
    iconColor:
      'border-fuchsia-500/15 bg-fuchsia-500/10 text-fuchsia-400',
  },

  personal: {
    icon: UserRound,
    label: 'Personal',
    color:
      'border-border bg-surface-2/60',
    iconColor:
      'border-border bg-surface-3 text-text-secondary',
  },
};


function getFactMeta(type: string): FactStyle {
  return (
    factMeta[type] ?? {
      icon: FileText,
      label:
        type.charAt(0).toUpperCase() +
        type.slice(1),
      color:
        'border-border bg-surface-2/55',
      iconColor:
        'border-border bg-surface-3 text-text-secondary',
    }
  );
}


/* =========================================================
   MASTER PROFILE
   ========================================================= */

export function MasterProfilePage() {
  const q = useProfile();

  const client = useQueryClient();
  const { push } = useToast();

  const [showAdd, setShowAdd] =
    useState(false);

  const [kind, setKind] =
    useState('skill');

  const [label, setLabel] =
    useState('');

  const [details, setDetails] =
    useState('');

  const [basics, setBasics] =
    useState({
      name: '',
      headline: '',
      location: '',
      phone: '',
      profile_summary: '',
    });


  useEffect(() => {
    if (!q.data) return;

    setBasics({
      name: q.data.name || '',
      headline: q.data.headline || '',
      location: q.data.location || '',
      phone: q.data.phone || '',
      profile_summary:
        q.data.profile_summary || '',
    });
  }, [q.data]);


  const patch = useMutation({
    mutationFn: () =>
      api.patch<Profile>(
        '/profile',
        basics,
      ),

    onSuccess: (data) => {
      client.setQueryData(
        ['profile'],
        data,
      );

      push('Profile updated');
    },
  });


  const add = useMutation({
    mutationFn: () =>
      api.post(
        '/profile/entries',
        {
          entry_type: kind,
          label,
          source_text:
            details || undefined,
          structured_data: {},
        },
      ),

    onSuccess: () => {
      setLabel('');
      setDetails('');
      setShowAdd(false);

      client.invalidateQueries({
        queryKey: ['profile'],
      });

      push('Verified fact added');
    },
  });


  const remove = useMutation({
    mutationFn: (id: string) =>
      api.delete(
        `/profile/entries/${id}`,
      ),

    onSuccess: () => {
      client.invalidateQueries({
        queryKey: ['profile'],
      });

      push('Profile fact removed');
    },
  });


  const grouped = useMemo(() => {
    const output:
      Record<string, ProfileEntry[]> = {};

    for (
      const entry of q.data?.entries || []
    ) {
      (
        output[entry.entry_type] ??= []
      ).push(entry);
    }

    return output;
  }, [q.data]);


  if (q.isLoading) {
    return <ProfileLoading />;
  }


  if (q.error) {
    return (
      <ErrorState
        message={err(q.error)}
        retry={() => q.refetch()}
      />
    );
  }


  const profile = q.data!;

  const entries =
    profile.entries || [];

  const verifiedCount =
    entries.filter(
      (entry) => entry.verified,
    ).length;

  const categoryCount =
    Object.keys(grouped).length;


  function submitBasics(
    e: FormEvent,
  ) {
    e.preventDefault();
    patch.mutate();
  }


  function submitFact(
    e: FormEvent,
  ) {
    e.preventDefault();

    if (!label.trim()) return;

    add.mutate();
  }


  return (
    <>
      <PageHeader
        eyebrow="Career profile"
        title="Your career evidence"
        description="This verified profile is the source CareerPilot uses for job matching, resume tailoring, cover letters, and interview preparation."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/onboarding/resume">
              <Button variant="secondary">
                <UploadCloud size={14} />
                Upload resume
              </Button>
            </Link>

            <Button
              onClick={() =>
                setShowAdd(
                  (value) => !value,
                )
              }
            >
              <Plus size={14} />
              Add fact
            </Button>
          </div>
        }
      />


      {/* Profile overview */}
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProfileMetric
          icon={BadgeCheck}
          label="Verified facts"
          value={String(verifiedCount)}
          detail={`${entries.length} total facts`}
          color="emerald"
        />

        <ProfileMetric
          icon={FileText}
          label="Evidence areas"
          value={String(categoryCount)}
          detail="Career categories"
          color="indigo"
        />

        <ProfileMetric
          icon={Target}
          label="Profile completion"
          value={`${Math.round(
            profile.profile_completion,
          )}%`}
          detail="Used for recommendations"
          color="cyan"
        />

        <ProfileMetric
          icon={WandSparkles}
          label="Evidence status"
          value={
            verifiedCount > 0
              ? 'Ready'
              : 'Start'
          }
          detail={
            verifiedCount > 0
              ? 'AI grounding available'
              : 'Add verified career facts'
          }
          color="violet"
        />
      </section>


      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
        {/* Main content */}
        <div className="space-y-5">
          {/* Identity */}
          <Panel className="profile-section-card overflow-hidden">
            <div className="border-b border-border px-5 py-5 md:px-6">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] border border-indigo-500/15 bg-indigo-500/10 text-indigo-400">
                  <UserRound size={17} />
                </div>

                <div>
                  <h2 className="text-16 font-semibold tracking-[-0.02em]">
                    Identity and summary
                  </h2>

                  <p className="mt-1 text-12 leading-5 text-text-secondary">
                    Keep this information current. It becomes the foundation for your applications and recommendations.
                  </p>
                </div>
              </div>
            </div>


            <form
              onSubmit={submitBasics}
              className="grid gap-5 p-5 md:grid-cols-2 md:p-6"
            >
              <ProfileField
                label="Full name"
                icon={UserRound}
              >
                <Input
                  value={basics.name}
                  onChange={(e) =>
                    setBasics(
                      (current) => ({
                        ...current,
                        name:
                          e.target.value,
                      }),
                    )
                  }
                  placeholder="Your full name"
                  className="h-11"
                />
              </ProfileField>


              <ProfileField
                label="Professional headline"
                icon={BriefcaseBusiness}
              >
                <Input
                  value={
                    basics.headline
                  }
                  onChange={(e) =>
                    setBasics(
                      (current) => ({
                        ...current,
                        headline:
                          e.target.value,
                      }),
                    )
                  }
                  placeholder="Senior Product Engineer"
                  className="h-11"
                />
              </ProfileField>


              <ProfileField
                label="Location"
                icon={MapPin}
              >
                <Input
                  value={
                    basics.location
                  }
                  onChange={(e) =>
                    setBasics(
                      (current) => ({
                        ...current,
                        location:
                          e.target.value,
                      }),
                    )
                  }
                  placeholder="Colombo, Sri Lanka"
                  className="h-11"
                />
              </ProfileField>


              <ProfileField
                label="Phone"
                icon={Phone}
              >
                <Input
                  value={basics.phone}
                  onChange={(e) =>
                    setBasics(
                      (current) => ({
                        ...current,
                        phone:
                          e.target.value,
                      }),
                    )
                  }
                  placeholder="+94..."
                  className="h-11"
                />
              </ProfileField>


              <div className="md:col-span-2">
                <ProfileField
                  label="Professional summary"
                  icon={FileText}
                >
                  <Textarea
                    value={
                      basics.profile_summary
                    }
                    onChange={(e) =>
                      setBasics(
                        (current) => ({
                          ...current,
                          profile_summary:
                            e.target
                              .value,
                        }),
                      )
                    }
                    placeholder="Summarize your experience, strengths, and the kind of impact you create..."
                    className="min-h-[130px] resize-y"
                  />
                </ProfileField>

                <div className="mt-2 flex justify-end">
                  <span className="font-mono text-[10px] text-text-tertiary">
                    {
                      basics
                        .profile_summary
                        .length
                    }{' '}
                    characters
                  </span>
                </div>
              </div>


              {patch.error && (
                <div className="md:col-span-2">
                  <FieldError>
                    {err(patch.error)}
                  </FieldError>
                </div>
              )}


              <div className="flex items-center justify-between border-t border-border pt-5 md:col-span-2">
                <p className="hidden text-11 text-text-secondary sm:block">
                  Changes update your master profile immediately.
                </p>

                <Button
                  disabled={
                    patch.isPending
                  }
                >
                  {patch.isPending ? (
                    'Saving…'
                  ) : (
                    <>
                      <Save size={14} />
                      Save changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Panel>


          {/* Add fact */}
          {showAdd && (
            <Panel className="profile-add-fact overflow-hidden border-indigo-500/20">
              <div className="flex items-start justify-between border-b border-border px-5 py-5 md:px-6">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-[11px] border border-indigo-500/15 bg-indigo-500/10 text-indigo-400">
                    <Plus size={17} />
                  </div>

                  <div>
                    <h2 className="text-16 font-semibold">
                      Add a verified fact
                    </h2>

                    <p className="mt-1 text-12 text-text-secondary">
                      Add evidence that CareerPilot can safely use in matching and generated documents.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowAdd(false)
                  }
                  className="text-11 text-text-secondary transition hover:text-text-primary"
                >
                  Close
                </button>
              </div>


              <form
                onSubmit={submitFact}
                className="grid gap-5 p-5 md:grid-cols-2 md:p-6"
              >
                <ProfileField label="Fact type">
                  <Select
                    value={kind}
                    onChange={(e) =>
                      setKind(
                        e.target.value,
                      )
                    }
                    className="h-11"
                  >
                    {Object.keys(
                      factMeta,
                    ).map((type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {
                          getFactMeta(
                            type,
                          ).label
                        }
                      </option>
                    ))}
                  </Select>
                </ProfileField>


                <ProfileField label="Fact label">
                  <Input
                    required
                    value={label}
                    onChange={(e) =>
                      setLabel(
                        e.target.value,
                      )
                    }
                    placeholder="e.g. PostgreSQL"
                    className="h-11"
                  />
                </ProfileField>


                <div className="md:col-span-2">
                  <ProfileField label="Supporting detail">
                    <Textarea
                      value={details}
                      onChange={(e) =>
                        setDetails(
                          e.target.value,
                        )
                      }
                      placeholder="Add evidence, context, result, dates, or details that support this fact."
                      className="min-h-[110px]"
                    />
                  </ProfileField>
                </div>


                {add.error && (
                  <div className="md:col-span-2">
                    <FieldError>
                      {err(add.error)}
                    </FieldError>
                  </div>
                )}


                <div className="flex justify-end md:col-span-2">
                  <Button
                    disabled={
                      add.isPending ||
                      !label.trim()
                    }
                  >
                    {add.isPending ? (
                      'Adding…'
                    ) : (
                      <>
                        <Check size={14} />
                        Add verified fact
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Panel>
          )}


          {/* Facts */}
          {Object.keys(grouped).length ===
          0 ? (
            <EmptyState
              title="Build your career evidence"
              description="Upload your resume or add your experience, education, skills, achievements, projects, and certifications manually."
            />
          ) : (
            <div className="space-y-4">
              {Object.entries(
                grouped,
              ).map(
                ([
                  type,
                  groupEntries,
                ]) => (
                  <FactSection
                    key={type}
                    type={type}
                    entries={
                      groupEntries
                    }
                    removing={
                      remove.isPending
                    }
                    onDelete={(
                      entry,
                    ) => {
                      if (
                        window.confirm(
                          `Delete "${entry.label}" from your profile?`,
                        )
                      ) {
                        remove.mutate(
                          entry.id,
                        );
                      }
                    }}
                  />
                ),
              )}
            </div>
          )}
        </div>


        {/* Sidebar */}
        <aside className="space-y-4">
          <Panel className="sticky top-24 overflow-hidden">
            <div className="profile-completion-bg p-6 text-center">
              <div className="mx-auto w-fit rounded-full bg-canvas/70 p-2 shadow-xl backdrop-blur">
                <MatchScoreRadial
                  value={
                    profile.profile_completion
                  }
                  size={94}
                  label="complete"
                />
              </div>

              <h3 className="mt-5 text-15 font-semibold">
                Profile health
              </h3>

              <p className="mt-2 text-11 leading-5 text-text-secondary">
                A more complete verified profile improves job matching and gives CareerPilot stronger evidence for tailored applications.
              </p>
            </div>


            <div className="border-t border-border p-5">
              <div className="space-y-4">
                <ProfileHealthRow
                  label="Verified evidence"
                  value={`${verifiedCount}/${entries.length || 0}`}
                  positive={
                    verifiedCount > 0
                  }
                />

                <ProfileHealthRow
                  label="Career categories"
                  value={String(
                    categoryCount,
                  )}
                  positive={
                    categoryCount >= 3
                  }
                />

                <ProfileHealthRow
                  label="Professional summary"
                  value={
                    basics.profile_summary
                      ? 'Added'
                      : 'Missing'
                  }
                  positive={Boolean(
                    basics.profile_summary,
                  )}
                />
              </div>


              <Link href="/dashboard/profile/analysis">
                <Button
                  variant="secondary"
                  className="mt-6 w-full"
                >
                  <Target size={14} />
                  Analyze career fit
                </Button>
              </Link>


              <Link href="/dashboard/preferences">
                <button
                  type="button"
                  className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-[10px] text-12 font-medium text-text-secondary transition hover:bg-surface-2 hover:text-text-primary"
                >
                  <SlidersHorizontal
                    size={14}
                  />
                  Job preferences
                </button>
              </Link>
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}


/* =========================================================
   FACT SECTION
   ========================================================= */

function FactSection({
  type,
  entries,
  onDelete,
  removing,
}: {
  type: string;
  entries: ProfileEntry[];
  onDelete: (
    entry: ProfileEntry,
  ) => void;
  removing: boolean;
}) {
  const meta =
    getFactMeta(type);

  const Icon = meta.icon;

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4 md:px-6">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-9 items-center justify-center rounded-[10px] border ${meta.iconColor}`}
          >
            <Icon size={15} />
          </div>

          <div>
            <h2 className="text-14 font-semibold">
              {meta.label}
            </h2>

            <p className="mt-0.5 text-[10px] text-text-secondary">
              Verified career evidence
            </p>
          </div>
        </div>

        <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 font-mono text-[9px] text-text-secondary">
          {entries.length}{' '}
          {entries.length === 1
            ? 'entry'
            : 'entries'}
        </span>
      </div>


      <div className="divide-y divide-border">
        {entries.map((entry) => (
          <FactRow
            key={entry.id}
            entry={entry}
            onDelete={() =>
              onDelete(entry)
            }
            removing={removing}
          />
        ))}
      </div>
    </Panel>
  );
}


/* =========================================================
   FACT ROW
   ========================================================= */

function FactRow({
  entry,
  onDelete,
  removing,
}: {
  entry: ProfileEntry;
  onDelete: () => void;
  removing: boolean;
}) {
  const confidence =
    Math.round(
      entry.confidence * 100,
    );

  return (
    <div className="group px-5 py-4 transition hover:bg-surface-2/45 md:px-6">
      <div className="flex items-start gap-3.5">
        <div
          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
            entry.verified
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-amber-500/10 text-amber-400'
          }`}
        >
          <CheckCircle2
            size={14}
          />
        </div>


        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-13 font-semibold">
              {entry.label}
            </div>

            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.05em] ${
                entry.verified
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-amber-500/10 text-amber-400'
              }`}
            >
              {entry.verified
                ? 'Verified'
                : 'Pending'}
            </span>
          </div>


          {entry.source_text && (
            <p className="mt-2 max-w-3xl text-12 leading-5 text-text-secondary">
              {entry.source_text}
            </p>
          )}


          <div className="mt-3 max-w-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.05em] text-text-tertiary">
                Source confidence
              </span>

              <span className="font-mono text-[9px] text-text-secondary">
                {confidence}%
              </span>
            </div>

            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className={`h-full rounded-full ${
                  confidence >= 80
                    ? 'bg-emerald-400'
                    : confidence >=
                        60
                      ? 'bg-cyan-400'
                      : 'bg-amber-400'
                }`}
                style={{
                  width: `${Math.max(
                    3,
                    confidence,
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>


        <button
          type="button"
          disabled={removing}
          onClick={onDelete}
          aria-label={`Delete ${entry.label}`}
          className="flex size-8 shrink-0 items-center justify-center rounded-[9px] text-text-tertiary opacity-50 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}


/* =========================================================
   PROFILE ANALYSIS
   ========================================================= */

export function ProfileAnalysisPage() {
  const q = useQuery({
    queryKey: [
      'profile',
      'analysis',
    ],

    queryFn: () =>
      api.get<{
        primary: {
          category: string;
          fit: number;
          reason: string;
        };

        adjacent: Array<{
          category: string;
          fit: number;
          reason: string;
        }>;

        verified_entry_count: number;
        method: string;
      }>('/profile/analysis'),
  });


  return (
    <>
      <PageHeader
        eyebrow="Career intelligence"
        title="Career profile analysis"
        description="See how your verified experience and skills align with different career paths."
        actions={
          <Link href="/dashboard/jobs">
            <Button>
              Find matching jobs
              <ArrowRight size={14} />
            </Button>
          </Link>
        }
      />


      {q.isLoading ? (
        <ProfileAnalysisLoading />
      ) : q.error ? (
        <ErrorState
          message={err(q.error)}
          retry={() => q.refetch()}
        />
      ) : (
        q.data && (
          <div className="space-y-5">
            {/* Primary result */}
            <div className="career-analysis-hero overflow-hidden rounded-[22px] border border-indigo-500/15">
              <div className="relative grid gap-8 p-6 md:grid-cols-[auto_1fr_auto] md:items-center md:p-8">
                <div className="relative z-10">
                  <MatchScoreRadial
                    value={
                      q.data.primary.fit
                    }
                    size={112}
                    label="career fit"
                  />
                </div>


                <div className="relative z-10">
                  <div className="font-mono text-[10px] uppercase tracking-[0.09em] text-indigo-300">
                    Strongest career alignment
                  </div>

                  <h2 className="mt-3 text-26 font-semibold tracking-[-0.035em] md:text-32">
                    {
                      q.data.primary
                        .category
                    }
                  </h2>

                  <p className="mt-3 max-w-2xl text-13 leading-6 text-text-secondary">
                    {
                      q.data.primary
                        .reason
                    }
                  </p>
                </div>


                <div className="relative z-10 hidden rounded-[14px] border border-white/10 bg-white/[0.04] p-4 text-right md:block">
                  <div className="font-mono text-[9px] uppercase tracking-[0.07em] text-text-secondary">
                    Evidence used
                  </div>

                  <div className="mt-2 text-24 font-semibold">
                    {
                      q.data
                        .verified_entry_count
                    }
                  </div>

                  <div className="mt-1 text-[10px] text-text-secondary">
                    verified facts
                  </div>
                </div>
              </div>
            </div>


            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
              {/* Adjacent */}
              <Panel className="overflow-hidden">
                <div className="border-b border-border px-5 py-5 md:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-[10px] border border-cyan-500/15 bg-cyan-500/10 text-cyan-400">
                      <Globe2 size={15} />
                    </div>

                    <div>
                      <h2 className="text-15 font-semibold">
                        Adjacent career paths
                      </h2>

                      <p className="mt-1 text-11 text-text-secondary">
                        Other categories supported by your existing evidence.
                      </p>
                    </div>
                  </div>
                </div>


                {q.data.adjacent.length ? (
                  <div className="divide-y divide-border">
                    {q.data.adjacent.map(
                      (
                        path,
                        index,
                      ) => (
                        <AdjacentCareerCard
                          key={
                            path.category
                          }
                          category={
                            path.category
                          }
                          fit={
                            path.fit
                          }
                          reason={
                            path.reason
                          }
                          rank={
                            index + 2
                          }
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <div className="p-6">
                    <EmptyState
                      title="No adjacent paths yet"
                      description="Add more verified skills, experience, and achievements to reveal additional career directions."
                    />
                  </div>
                )}
              </Panel>


              {/* Method */}
              <Panel className="h-fit overflow-hidden">
                <div className="border-b border-border p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-[10px] border border-violet-500/15 bg-violet-500/10 text-violet-400">
                      <Sparkles size={15} />
                    </div>

                    <h3 className="text-14 font-semibold">
                      How this was calculated
                    </h3>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <AnalysisDetail
                    label="Method"
                    value={
                      q.data.method
                    }
                  />

                  <AnalysisDetail
                    label="Verified facts"
                    value={String(
                      q.data
                        .verified_entry_count,
                    )}
                  />

                  <AnalysisDetail
                    label="Primary fit"
                    value={`${Math.round(
                      q.data.primary.fit,
                    )}%`}
                  />

                  <div className="border-t border-border pt-4">
                    <p className="text-11 leading-5 text-text-secondary">
                      Career fit is directional guidance based on your current verified profile. It is not a guarantee of hiring outcomes.
                    </p>
                  </div>

                  <Link href="/dashboard/profile">
                    <Button
                      variant="secondary"
                      className="w-full"
                    >
                      Improve profile evidence
                    </Button>
                  </Link>
                </div>
              </Panel>
            </div>
          </div>
        )
      )}
    </>
  );
}


/* =========================================================
   PREFERENCES
   ========================================================= */

export function PreferencesPage() {
  const client =
    useQueryClient();

  const { push } =
    useToast();


  const q = useQuery({
    queryKey: ['preferences'],

    queryFn: () =>
      api.get<Preferences>(
        '/preferences',
      ),
  });


  const [form, setForm] =
    useState<Preferences | null>(
      null,
    );


  useEffect(() => {
    if (q.data) {
      setForm(q.data);
    }
  }, [q.data]);


  const save = useMutation({
    mutationFn: () =>
      api.put<Preferences>(
        '/preferences',
        form!,
      ),

    onSuccess: (data) => {
      client.setQueryData(
        ['preferences'],
        data,
      );

      push(
        'Job preferences saved',
      );
    },
  });


  if (
    q.isLoading ||
    !form
  ) {
    return (
      <>
        <PageHeader
          eyebrow="Job discovery"
          title="Job preferences"
        />

        <Skeleton className="h-[560px] rounded-[20px]" />
      </>
    );
  }


  if (q.error) {
    return (
      <ErrorState
        message={err(q.error)}
        retry={() => q.refetch()}
      />
    );
  }


  const text = (
    value: string[],
  ) => value.join(', ');


  const updateArray = (
    key: keyof Preferences,
    value: string,
  ) =>
    setForm((current) =>
      current
        ? {
            ...current,
            [key]: split(value),
          }
        : current,
    );


  function submit(
    e: FormEvent,
  ) {
    e.preventDefault();

    save.mutate();
  }


  return (
    <>
      <PageHeader
        eyebrow="Job discovery"
        title="Job preferences"
        description="Tell CareerPilot what a good opportunity looks like. These preferences tune recommendations without changing your verified profile."
        actions={
          <Link href="/dashboard/jobs">
            <Button variant="secondary">
              Browse jobs
              <ArrowRight size={14} />
            </Button>
          </Link>
        }
      />


      <form
        onSubmit={submit}
        className="space-y-5"
      >
        {/* Role */}
        <PreferenceSection
          icon={Target}
          title="Target roles"
          description="What kinds of positions and industries are you interested in?"
          color="indigo"
        >
          <PreferenceField
            label="Target job titles"
            hint="Separate multiple values with commas."
          >
            <Input
              value={text(
                form.target_titles,
              )}
              onChange={(e) =>
                updateArray(
                  'target_titles',
                  e.target.value,
                )
              }
              placeholder="Senior Engineer, Product Engineer, Platform Engineer"
              className="h-11"
            />
          </PreferenceField>


          <PreferenceField
            label="Industries"
          >
            <Input
              value={text(
                form.industries,
              )}
              onChange={(e) =>
                updateArray(
                  'industries',
                  e.target.value,
                )
              }
              placeholder="SaaS, Fintech, AI"
              className="h-11"
            />
          </PreferenceField>


          <PreferenceField
            label="Experience levels"
          >
            <Input
              value={text(
                form.experience_levels,
              )}
              onChange={(e) =>
                updateArray(
                  'experience_levels',
                  e.target.value,
                )
              }
              placeholder="Senior, Staff"
              className="h-11"
            />
          </PreferenceField>


          <PreferenceField
            label="Preferred companies"
          >
            <Input
              value={text(
                form.preferred_companies,
              )}
              onChange={(e) =>
                updateArray(
                  'preferred_companies',
                  e.target.value,
                )
              }
              placeholder="Optional company list"
              className="h-11"
            />
          </PreferenceField>
        </PreferenceSection>


        {/* Location */}
        <PreferenceSection
          icon={Globe2}
          title="Location and work style"
          description="Control where CareerPilot should search and what working arrangements you prefer."
          color="cyan"
        >
          <PreferenceField label="Preferred locations">
            <Input
              value={text(
                form.locations,
              )}
              onChange={(e) =>
                updateArray(
                  'locations',
                  e.target.value,
                )
              }
              placeholder="Colombo, London, Amsterdam, Remote"
              className="h-11"
            />
          </PreferenceField>


          <PreferenceField label="Work modes">
            <Input
              value={text(
                form.work_modes,
              )}
              onChange={(e) =>
                updateArray(
                  'work_modes',
                  e.target.value,
                )
              }
              placeholder="Remote, Hybrid, On-site"
              className="h-11"
            />
          </PreferenceField>


          <PreferenceField label="Employment types">
            <Input
              value={text(
                form.employment_types,
              )}
              onChange={(e) =>
                updateArray(
                  'employment_types',
                  e.target.value,
                )
              }
              placeholder="Full-time, Contract"
              className="h-11"
            />
          </PreferenceField>


          <div className="flex items-center">
            <RelocationToggle
              checked={
                form.relocation_willing
              }
              onChange={(value) =>
                setForm({
                  ...form,
                  relocation_willing:
                    value,
                })
              }
            />
          </div>
        </PreferenceSection>


        {/* Compensation */}
        <PreferenceSection
          icon={BriefcaseBusiness}
          title="Compensation"
          description="Set a minimum salary preference to reduce low-relevance recommendations."
          color="emerald"
        >
          <PreferenceField label="Minimum salary">
            <Input
              type="number"
              min="0"
              value={
                form.salary_min ??
                ''
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  salary_min:
                    e.target.value
                      ? Number(
                          e.target
                            .value,
                        )
                      : null,
                })
              }
              placeholder="120000"
              className="h-11"
            />
          </PreferenceField>


          <PreferenceField label="Currency">
            <Input
              maxLength={8}
              value={
                form.salary_currency ??
                ''
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  salary_currency:
                    e.target.value ||
                    null,
                })
              }
              placeholder="USD"
              className="h-11 uppercase"
            />
          </PreferenceField>
        </PreferenceSection>


        {/* Alerts */}
        <PreferenceSection
          icon={SlidersHorizontal}
          title="Recommendations and alerts"
          description="Choose how often CareerPilot should surface new opportunities."
          color="violet"
        >
          <PreferenceField label="Job alert frequency">
            <Select
              className="h-11"
              value={
                form.alert_frequency
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  alert_frequency:
                    e.target.value,
                })
              }
            >
              <option value="off">
                Off
              </option>

              <option value="daily">
                Daily
              </option>

              <option value="weekly">
                Weekly
              </option>
            </Select>
          </PreferenceField>


          <div className="flex items-end">
            <div className="rounded-[12px] border border-border bg-surface-2/60 p-4 text-11 leading-5 text-text-secondary">
              Your verified career evidence stays unchanged. Preferences only influence which opportunities CareerPilot prioritizes.
            </div>
          </div>
        </PreferenceSection>


        {save.error && (
          <FieldError>
            {err(save.error)}
          </FieldError>
        )}


        <div className="sticky bottom-4 z-20 flex items-center justify-between rounded-[16px] border border-border bg-canvas/85 p-3 shadow-[0_20px_60px_rgba(0,0,0,.18)] backdrop-blur-xl">
          <p className="hidden pl-2 text-11 text-text-secondary sm:block">
            Update these preferences anytime as your search changes.
          </p>

          <Button
            disabled={
              save.isPending
            }
          >
            {save.isPending ? (
              'Saving…'
            ) : (
              <>
                <Save size={14} />
                Save preferences
              </>
            )}
          </Button>
        </div>
      </form>
    </>
  );
}


/* =========================================================
   SMALL COMPONENTS
   ========================================================= */

function ProfileField({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center gap-1.5">
        {Icon && (
          <Icon
            size={12}
            className="text-text-tertiary"
          />
        )}

        <span className="text-12 font-medium">
          {label}
        </span>
      </div>

      {children}
    </label>
  );
}


function ProfileMetric({
  icon: Icon,
  label,
  value,
  detail,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  color:
    | 'indigo'
    | 'cyan'
    | 'emerald'
    | 'violet';
}) {
  const styles = {
    indigo:
      'border-indigo-500/15 bg-indigo-500/10 text-indigo-400',

    cyan:
      'border-cyan-500/15 bg-cyan-500/10 text-cyan-400',

    emerald:
      'border-emerald-500/15 bg-emerald-500/10 text-emerald-400',

    violet:
      'border-violet-500/15 bg-violet-500/10 text-violet-400',
  };


  return (
    <Panel className="group p-4 transition duration-200 hover:-translate-y-0.5 hover:border-border-strong">
      <div className="flex items-start justify-between">
        <div
          className={`flex size-8 items-center justify-center rounded-[9px] border ${styles[color]}`}
        >
          <Icon size={14} />
        </div>

        <div className="text-right">
          <div className="text-22 font-semibold tracking-[-0.035em]">
            {value}
          </div>
        </div>
      </div>

      <div className="mt-4 text-11 font-medium">
        {label}
      </div>

      <div className="mt-1 text-[10px] text-text-secondary">
        {detail}
      </div>
    </Panel>
  );
}


function ProfileHealthRow({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-11 text-text-secondary">
        {label}
      </span>

      <span
        className={`font-mono text-[10px] ${
          positive
            ? 'text-emerald-400'
            : 'text-amber-400'
        }`}
      >
        {value}
      </span>
    </div>
  );
}


function AdjacentCareerCard({
  category,
  fit,
  reason,
  rank,
}: {
  category: string;
  fit: number;
  reason: string;
  rank: number;
}) {
  return (
    <div className="group p-5 transition hover:bg-surface-2/45 md:px-6">
      <div className="flex gap-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface-2 font-mono text-[10px] text-text-secondary">
          {String(rank).padStart(
            2,
            '0',
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-13 font-semibold">
              {category}
            </h3>

            <span className="font-mono text-11 text-cyan-400">
              {Math.round(fit)}%
            </span>
          </div>

          <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500"
              style={{
                width: `${Math.min(
                  100,
                  Math.max(0, fit),
                )}%`,
              }}
            />
          </div>

          <p className="mt-3 text-11 leading-5 text-text-secondary">
            {reason}
          </p>
        </div>
      </div>
    </div>
  );
}


function AnalysisDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-11 text-text-secondary">
        {label}
      </span>

      <span className="max-w-[160px] truncate font-mono text-[10px] text-text-primary">
        {value}
      </span>
    </div>
  );
}


function PreferenceSection({
  icon: Icon,
  title,
  description,
  color,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  color:
    | 'indigo'
    | 'cyan'
    | 'emerald'
    | 'violet';
  children: ReactNode;
}) {
  const iconStyles = {
    indigo:
      'border-indigo-500/15 bg-indigo-500/10 text-indigo-400',

    cyan:
      'border-cyan-500/15 bg-cyan-500/10 text-cyan-400',

    emerald:
      'border-emerald-500/15 bg-emerald-500/10 text-emerald-400',

    violet:
      'border-violet-500/15 bg-violet-500/10 text-violet-400',
  };


  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-border px-5 py-5 md:px-6">
        <div className="flex gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-[11px] border ${iconStyles[color]}`}
          >
            <Icon size={16} />
          </div>

          <div>
            <h2 className="text-15 font-semibold tracking-[-0.02em]">
              {title}
            </h2>

            <p className="mt-1 text-11 leading-5 text-text-secondary">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        {children}
      </div>
    </Panel>
  );
}


function PreferenceField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-12 font-medium">
          {label}
        </span>

        {hint && (
          <span className="hidden text-[9px] text-text-tertiary sm:block">
            {hint}
          </span>
        )}
      </div>

      {children}
    </label>
  );
}


function RelocationToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (
    value: boolean,
  ) => void;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onChange(!checked)
      }
      className={`flex w-full items-center gap-3 rounded-[12px] border p-4 text-left transition ${
        checked
          ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
          : 'border-border bg-surface-2/50 hover:border-border-strong'
      }`}
    >
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition ${
          checked
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-border-strong bg-canvas'
        }`}
      >
        {checked && (
          <Check size={12} />
        )}
      </span>

      <span>
        <span className="block text-12 font-medium">
          Willing to relocate
        </span>

        <span className="mt-0.5 block text-[10px] text-text-secondary">
          Include suitable international opportunities.
        </span>
      </span>
    </button>
  );
}


/* =========================================================
   LOADING STATES
   ========================================================= */

function ProfileLoading() {
  return (
    <>
      <PageHeader
        eyebrow="Career profile"
        title="Your career evidence"
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map(
          (item) => (
            <Skeleton
              key={item}
              className="h-28 rounded-[16px]"
            />
          ),
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_290px]">
        <div className="space-y-5">
          <Skeleton className="h-[390px] rounded-[20px]" />
          <Skeleton className="h-[250px] rounded-[20px]" />
          <Skeleton className="h-[250px] rounded-[20px]" />
        </div>

        <Skeleton className="h-[390px] rounded-[20px]" />
      </div>
    </>
  );
}


function ProfileAnalysisLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[240px] rounded-[22px]" />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-[330px] rounded-[20px]" />
        <Skeleton className="h-[330px] rounded-[20px]" />
      </div>
    </div>
  );
}