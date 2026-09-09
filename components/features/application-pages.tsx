'use client';

import Link from 'next/link';
import {
  FormEvent,
  ReactNode,
  useMemo,
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
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  FolderKanban,
  MapPin,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';

import { api } from '@/lib/api';

import type {
  Application,
  ApplicationStatus,
  GeneratedDocument,
  Job,
} from '@/lib/types';

import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FieldError,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  StatusPill,
  Textarea,
} from '@/components/ui';

import { useApplications } from '@/hooks/useApplications';
import { useToast } from '@/components/toast';


/* =========================================================
   HELPERS
   ========================================================= */

const err = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Request failed';


const statuses: ApplicationStatus[] = [
  'Recommended',
  'Saved',
  'Resume generated',
  'Screening',
  'Interview',
  'Technical interview',
  'Offer',
  'Rejected',
  'Withdrawn',
];


const positiveStatuses = new Set<ApplicationStatus>([
  'Offer',
]);

const activeStatuses = new Set<ApplicationStatus>([
  'Screening',
  'Interview',
  'Technical interview',
]);

const closedStatuses = new Set<ApplicationStatus>([
  'Rejected',
  'Withdrawn',
]);


const stageOrder: ApplicationStatus[] = [
  'Recommended',
  'Saved',
  'Resume generated',
  'Applied',
  'Screening',
  'Interview',
  'Technical interview',
  'Offer',
];


function stageIndex(
  status: ApplicationStatus,
) {
  return Math.max(
    0,
    stageOrder.indexOf(status),
  );
}


function stageProgress(
  status: ApplicationStatus,
) {
  if (
    status === 'Rejected' ||
    status === 'Withdrawn'
  ) {
    return 100;
  }

  const index =
    stageIndex(status);

  return Math.round(
    (index /
      (stageOrder.length - 1)) *
      100,
  );
}


function applicationTone(
  status: ApplicationStatus,
) {
  if (positiveStatuses.has(status)) {
    return 'positive';
  }

  if (closedStatuses.has(status)) {
    return 'negative';
  }

  if (activeStatuses.has(status)) {
    return 'active';
  }

  return 'neutral';
}


function formatDate(
  value?: string | null,
) {
  if (!value) return '—';

  return new Date(
    value,
  ).toLocaleDateString(
    undefined,
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  );
}


/* =========================================================
   WORKSPACE NAV
   ========================================================= */

function ApplicationsNav({
  active,
}: {
  active:
    | 'applications'
    | 'jobs'
    | 'documents';
}) {
  const items = [
    {
      id: 'applications',
      label: 'Applications',
      href: '/dashboard/applications',
      icon: FolderKanban,
    },
    {
      id: 'jobs',
      label: 'Jobs',
      href: '/dashboard/jobs/recommendations',
      icon: Target,
    },
    {
      id: 'documents',
      label: 'Documents',
      href: '/dashboard/documents',
      icon: FileText,
    },
  ] as const;

  return (
    <div className="mb-5 overflow-x-auto hide-scrollbar">
      <div className="inline-flex min-w-full items-center gap-1 rounded-[14px] border border-border bg-surface-1/80 p-1.5 shadow-sm backdrop-blur-xl sm:min-w-0">
        {items.map(
          (item) => {
            const Icon =
              item.icon;

            const selected =
              active === item.id;

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`inline-flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-11 font-medium transition ${
                  selected
                    ? 'bg-text-primary text-canvas shadow-sm'
                    : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                }`}
              >
                <Icon
                  size={13}
                />
                {item.label}
              </Link>
            );
          },
        )}
      </div>
    </div>
  );
}


/* =========================================================
   APPLICATIONS DASHBOARD
   ========================================================= */

export function ApplicationsDashboard() {
  const q =
    useApplications();

  const client =
    useQueryClient();

  const { push } =
    useToast();


  const update =
    useMutation({
      mutationFn: ({
        id,
        status,
      }: {
        id: string;
        status: ApplicationStatus;
      }) =>
        api.patch<Application>(
          `/applications/${id}`,
          { status },
        ),

      onSuccess: () => {
        client.invalidateQueries({
          queryKey: [
            'applications',
          ],
        });

        push(
          'Application status updated',
        );
      },
    });


  const metrics = useMemo(() => {
    const items =
      q.data ?? [];

    return {
      total: items.length,

      active: items.filter(
        (item) =>
          activeStatuses.has(
            item.status,
          ),
      ).length,

      interviews:
        items.filter(
          (item) =>
            item.status ===
              'Interview' ||
            item.status ===
              'Technical interview',
        ).length,

      offers: items.filter(
        (item) =>
          item.status ===
          'Offer',
      ).length,
    };
  }, [q.data]);


  return (
    <>
      <PageHeader
        eyebrow="Application pipeline"
        title="Track every opportunity"
        description="Follow each role from shortlist to outcome while keeping the exact resume and cover-letter versions attached."
        actions={
          <Link href="/dashboard/jobs/recommendations">
            <Button>
              <Target size={14} />
              Find opportunities
            </Button>
          </Link>
        }
      />


      <ApplicationsNav active="applications" />


      <section className="career-applications-hero mb-5 overflow-hidden rounded-[22px] border border-indigo-500/15">
        <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-7">
          <div className="relative z-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-indigo-300">
              Your job-search pipeline
            </div>

            <h2 className="mt-3 max-w-2xl text-24 font-semibold tracking-[-0.035em] md:text-28">
              Know what is moving,
              what is waiting, and what
              needs your attention.
            </h2>

            <p className="mt-3 max-w-2xl text-12 leading-6 text-text-secondary">
              CareerPilot keeps your application stage, verified documents, and review state together so nothing gets lost between applying and interviewing.
            </p>
          </div>


          <div className="relative z-10 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ApplicationMiniMetric
              value={
                q.data
                  ? String(
                      metrics.total,
                    )
                  : '—'
              }
              label="total"
            />

            <ApplicationMiniMetric
              value={
                q.data
                  ? String(
                      metrics.active,
                    )
                  : '—'
              }
              label="active"
              tone="active"
            />

            <ApplicationMiniMetric
              value={
                q.data
                  ? String(
                      metrics.interviews,
                    )
                  : '—'
              }
              label="interviews"
              tone="interview"
            />

            <ApplicationMiniMetric
              value={
                q.data
                  ? String(
                      metrics.offers,
                    )
                  : '—'
              }
              label="offers"
              tone="positive"
            />
          </div>
        </div>
      </section>


      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <ApplicationFeatureMetric
          icon={ShieldCheck}
          label="Document integrity"
          value="Version locked"
          description="Exact approved documents stay attached"
          color="emerald"
        />

        <ApplicationFeatureMetric
          icon={Clock3}
          label="Pipeline"
          value="Stage aware"
          description="Track screening, interviews, and outcomes"
          color="indigo"
        />

        <ApplicationFeatureMetric
          icon={Send}
          label="Submission"
          value="Human confirmed"
          description="Applied status requires explicit confirmation"
          color="cyan"
        />
      </div>


      {q.isLoading ? (
        <ApplicationsLoading />
      ) : q.error ? (
        <ErrorState
          message={err(q.error)}
          retry={() => q.refetch()}
        />
      ) : !q.data?.length ? (
        <EmptyState
          title="No applications yet"
          description="Open a matched job and prepare an application package. CareerPilot never submits automatically."
          action={
            <Link href="/dashboard/jobs/recommendations">
              <Button>
                Browse jobs
                <ArrowRight size={14} />
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {q.data.map(
            (application) => (
              <ApplicationCard
                key={
                  application.id
                }
                application={
                  application
                }
                updating={
                  update.isPending
                }
                onStatusChange={(
                  status,
                ) =>
                  update.mutate({
                    id:
                      application.id,
                    status,
                  })
                }
              />
            ),
          )}
        </div>
      )}
    </>
  );
}


/* =========================================================
   APPLICATION CARD
   ========================================================= */

function ApplicationCard({
  application,
  updating,
  onStatusChange,
}: {
  application: Application;
  updating: boolean;
  onStatusChange: (
    status: ApplicationStatus,
  ) => void;
}) {
  const tone =
    applicationTone(
      application.status,
    );

  const toneStyles = {
    positive:
      'from-emerald-400 via-cyan-400 to-transparent',

    active:
      'from-cyan-400 via-indigo-500 to-transparent',

    negative:
      'from-red-400 via-amber-400 to-transparent',

    neutral:
      'from-indigo-500/70 to-transparent',
  };


  return (
    <article className="career-application-card group overflow-hidden rounded-[20px] border border-border bg-surface-1 transition duration-300 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_18px_55px_rgba(0,0,0,.10)]">
      <div
        className={`h-[2px] bg-gradient-to-r ${
          toneStyles[tone]
        }`}
      />


      <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_200px_190px_auto] md:items-center md:p-6">
        {/* role */}
        <div className="min-w-0">
          <div className="flex items-start gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-[12px] border border-border bg-surface-2 text-14 font-semibold text-text-secondary transition group-hover:border-indigo-500/20 group-hover:bg-indigo-500/[0.07] group-hover:text-indigo-400">
              {application.job
                ?.company
                ?.trim()
                ?.slice(0, 1)
                ?.toUpperCase() || (
                <Building2
                  size={16}
                />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  status={
                    application.status
                  }
                />

                {application.approved_at && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.07] px-2 py-1 text-[9px] font-medium text-emerald-400">
                    <ShieldCheck
                      size={10}
                    />
                    Package approved
                  </span>
                )}
              </div>

              <Link
                href={`/dashboard/applications/review/${application.id}`}
                className="mt-3 block max-w-xl text-16 font-semibold leading-6 tracking-[-0.02em] transition hover:text-indigo-400"
              >
                {application.job
                  ?.title ||
                  'Unavailable job'}
              </Link>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <Building2
                    size={11}
                  />
                  {application.job
                    ?.company ||
                    'Unknown company'}
                </span>

                {application.job
                  ?.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin
                      size={11}
                    />
                    {
                      application
                        .job.location
                    }
                  </span>
                )}
              </div>
            </div>
          </div>


          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-tertiary">
                Pipeline progress
              </span>

              <span className="font-mono text-[9px] text-text-secondary">
                {stageProgress(
                  application.status,
                )}
                %
              </span>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${
                  toneStyles[tone]
                }`}
                style={{
                  width: `${stageProgress(
                    application.status,
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>


        {/* status */}
        <div>
          <div className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.05em] text-text-tertiary">
            Current stage
          </div>

          <Select
            value={
              application.status
            }
            onChange={(e) =>
              onStatusChange(
                e.target
                  .value as ApplicationStatus,
              )
            }
            disabled={updating}
            className="h-10"
          >
            <option
              value="Applied"
              disabled
            >
              Applied — explicit approval only
            </option>

            {statuses.map(
              (status) => (
                <option
                  key={
                    status
                  }
                >
                  {status}
                </option>
              ),
            )}
          </Select>
        </div>


        {/* docs */}
        <div>
          <div className="mb-2 text-[9px] font-medium uppercase tracking-[0.05em] text-text-tertiary">
            Attached documents
          </div>

          <div className="space-y-2">
            <DocumentAttachment
              label="Resume"
              version={
                application
                  .resume?.version
              }
              attached={Boolean(
                application.resume,
              )}
            />

            <DocumentAttachment
              label="Cover letter"
              version={
                application
                  .cover_letter
                  ?.version
              }
              attached={Boolean(
                application.cover_letter,
              )}
            />
          </div>
        </div>


        {/* action */}
        <div className="flex flex-col items-stretch gap-2 md:items-end">
          <Link
            href={`/dashboard/applications/review/${application.id}`}
          >
            <Button
              variant="secondary"
              className="w-full md:w-auto"
            >
              Review package
              <ArrowRight
                size={13}
              />
            </Button>
          </Link>

          <div className="flex items-center gap-1.5 text-[9px] text-text-tertiary md:justify-end">
            <CalendarDays
              size={10}
            />

            Updated{' '}
            {formatDate(
              application.updated_at,
            )}
          </div>
        </div>
      </div>
    </article>
  );
}


/* =========================================================
   PREPARE APPLICATION
   ========================================================= */

export function ApplicationPreparePage({
  jobId,
}: {
  jobId: string;
}) {
  const router =
    useRouterCompat();

  const { push } =
    useToast();


  const job = useQuery({
    queryKey: [
      'job',
      jobId,
    ],

    queryFn: () =>
      api.get<Job>(
        `/jobs/${jobId}`,
      ),
  });


  const docs = useQuery({
    queryKey: ['documents'],

    queryFn: () =>
      api.get<
        GeneratedDocument[]
      >('/documents'),
  });


  const [resume, setResume] =
    useState('');

  const [cover, setCover] =
    useState('');

  const [notes, setNotes] =
    useState('');


  const create =
    useMutation({
      mutationFn: () =>
        api.post<Application>(
          '/applications',
          {
            job_id: jobId,
            resume_document_id:
              resume || null,
            cover_letter_document_id:
              cover || null,
            notes,
          },
        ),

      onSuccess: (
        application,
      ) => {
        push(
          'Application package created',
        );

        router(
          `/dashboard/applications/review/${application.id}`,
        );
      },
    });


  const matchingResume =
    (docs.data || []).filter(
      (doc) =>
        doc.job_id ===
          jobId &&
        doc.document_type ===
          'resume',
    );


  const matchingCover =
    (docs.data || []).filter(
      (doc) =>
        doc.job_id ===
          jobId &&
        doc.document_type ===
          'cover_letter',
    );


  const selectedResume =
    matchingResume.find(
      (doc) =>
        doc.id === resume,
    );


  const selectedCover =
    matchingCover.find(
      (doc) =>
        doc.id === cover,
    );


  function submit(
    e: FormEvent,
  ) {
    e.preventDefault();
    create.mutate();
  }


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
        eyebrow="Application assistance"
        title="Prepare application"
        description={
          job.data
            ? `${job.data.company} · ${job.data.title}`
            : 'Attach claim-verified document versions and review before any applied status is recorded.'
        }
      />


      <ApplicationsNav active="applications" />


      {job.isLoading ||
      docs.isLoading ? (
        <PrepareLoading />
      ) : job.error ||
        docs.error ? (
        <ErrorState
          message={err(
            job.error ||
              docs.error,
          )}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Panel className="career-prepare-card overflow-hidden">
            <div className="border-b border-border px-5 py-5 md:px-6">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-[11px] border border-indigo-500/15 bg-indigo-500/10 text-indigo-400">
                  <FolderKanban
                    size={17}
                  />
                </div>

                <div>
                  <h2 className="text-15 font-semibold">
                    Build review package
                  </h2>

                  <p className="mt-1 text-11 leading-5 text-text-secondary">
                    Attach the exact document versions you want to review before marking anything as applied.
                  </p>
                </div>
              </div>
            </div>


            <form
              onSubmit={submit}
              className="space-y-6 p-5 md:p-6"
            >
              <ApplicationField
                label="Resume version"
                description="Choose a job-specific resume version, preferably approved and claim-verified."
              >
                <Select
                  className="h-12"
                  value={resume}
                  onChange={(e) =>
                    setResume(
                      e.target
                        .value,
                    )
                  }
                >
                  <option value="">
                    No resume attached
                  </option>

                  {matchingResume.map(
                    (doc) => (
                      <option
                        key={
                          doc.id
                        }
                        value={
                          doc.id
                        }
                      >
                        v
                        {
                          doc.version
                        }{' '}
                        ·{' '}
                        {
                          doc.title
                        }{' '}
                        ·{' '}
                        {doc.approved_at
                          ? 'approved'
                          : 'not approved'}
                      </option>
                    ),
                  )}
                </Select>
              </ApplicationField>


              {!matchingResume.length && (
                <MissingDocumentNotice
                  label="resume"
                  href="/dashboard/documents/resume/new"
                />
              )}


              {selectedResume && (
                <SelectedDocumentCard
                  label="Resume"
                  doc={
                    selectedResume
                  }
                />
              )}


              <ApplicationField
                label="Cover-letter version"
                description="Attach a tailored cover letter if you intend to use one for this role."
              >
                <Select
                  className="h-12"
                  value={cover}
                  onChange={(e) =>
                    setCover(
                      e.target
                        .value,
                    )
                  }
                >
                  <option value="">
                    No cover letter attached
                  </option>

                  {matchingCover.map(
                    (doc) => (
                      <option
                        key={
                          doc.id
                        }
                        value={
                          doc.id
                        }
                      >
                        v
                        {
                          doc.version
                        }{' '}
                        ·{' '}
                        {
                          doc.title
                        }{' '}
                        ·{' '}
                        {doc.approved_at
                          ? 'approved'
                          : 'not approved'}
                      </option>
                    ),
                  )}
                </Select>
              </ApplicationField>


              {selectedCover && (
                <SelectedDocumentCard
                  label="Cover letter"
                  doc={
                    selectedCover
                  }
                />
              )}


              <ApplicationField
                label="Preparation notes"
                description="Keep recruiter details, deadlines, follow-up reminders, or anything you want visible during review."
              >
                <Textarea
                  className="min-h-[130px]"
                  value={notes}
                  onChange={(e) =>
                    setNotes(
                      e.target.value,
                    )
                  }
                  placeholder="Recruiter contact, application deadline, checklist, follow-up date…"
                />
              </ApplicationField>


              <div className="career-human-approval-note rounded-[14px] border border-cyan-500/15 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-cyan-500/10 text-cyan-400">
                    <ShieldCheck
                      size={15}
                    />
                  </div>

                  <div>
                    <div className="text-11 font-semibold">
                      Human approval is mandatory
                    </div>

                    <p className="mt-1 text-[10px] leading-5 text-text-secondary">
                      Creating this package does not submit anything to the employer. The review screen checks attached documents before explicit approval and manual applied confirmation.
                    </p>
                  </div>
                </div>
              </div>


              {create.error && (
                <FieldError>
                  {err(
                    create.error,
                  )}
                </FieldError>
              )}


              <div className="flex items-center justify-between border-t border-border pt-5">
                <p className="hidden text-[10px] text-text-secondary sm:block">
                  You can still edit or replace documents before approval.
                </p>

                <Button
                  disabled={
                    create.isPending
                  }
                >
                  {create.isPending
                    ? 'Creating…'
                    : (
                      <>
                        Create review package
                        <ArrowRight
                          size={14}
                        />
                      </>
                    )}
                </Button>
              </div>
            </form>
          </Panel>


          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Panel className="career-prepare-summary overflow-hidden">
              <div className="border-b border-border p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-[10px] border border-violet-500/15 bg-violet-500/10 text-violet-400">
                    <Sparkles
                      size={15}
                    />
                  </div>

                  <div>
                    <h2 className="text-13 font-semibold">
                      Application checklist
                    </h2>

                    <p className="mt-1 text-[10px] text-text-secondary">
                      What must happen before applied status.
                    </p>
                  </div>
                </div>
              </div>


              <div className="space-y-4 p-5">
                <ChecklistStep
                  done={Boolean(
                    resume ||
                      cover,
                  )}
                  title="Attach documents"
                  text="At least one resume or cover letter is recommended."
                />

                <ChecklistStep
                  done={Boolean(
                    selectedResume
                      ?.approved_at ||
                      selectedCover
                        ?.approved_at,
                  )}
                  title="Verify documents"
                  text="Attached versions should pass claim checks and be approved."
                />

                <ChecklistStep
                  done={false}
                  title="Approve package"
                  text="Review and approve the complete package explicitly."
                />

                <ChecklistStep
                  done={false}
                  title="Confirm submission"
                  text="Mark applied only after you actually submit."
                />
              </div>
            </Panel>
          </aside>
        </div>
      )}
    </>
  );
}


/* =========================================================
   ROUTER COMPAT
   ========================================================= */

function useRouterCompat() {
  if (
    typeof window ===
    'undefined'
  ) {
    return (
      _: string,
    ) => {};
  }

  return (
    path: string,
  ) =>
    window.location.assign(
      path,
    );
}


/* =========================================================
   APPLICATION REVIEW
   ========================================================= */

export function ApplicationReviewPage({
  applicationId,
}: {
  applicationId: string;
}) {
  const client =
    useQueryClient();

  const { push } =
    useToast();


  const q = useQuery({
    queryKey: [
      'application',
      applicationId,
    ],

    queryFn: () =>
      api.get<Application>(
        `/applications/${applicationId}`,
      ),
  });


  const [
    confirmApplied,
    setConfirmApplied,
  ] = useState(false);


  const approve =
    useMutation({
      mutationFn: () =>
        api.post<Application>(
          `/applications/${applicationId}/approve`,
          { approved: true },
        ),

      onSuccess: (
        application,
      ) => {
        client.setQueryData(
          [
            'application',
            applicationId,
          ],
          application,
        );

        client.invalidateQueries({
          queryKey: [
            'applications',
          ],
        });

        push(
          'Application package approved',
        );
      },
    });


  const applied =
    useMutation({
      mutationFn: () =>
        api.post<Application>(
          `/applications/${applicationId}/mark-applied`,
          { confirmed: true },
        ),

      onSuccess: (
        application,
      ) => {
        client.setQueryData(
          [
            'application',
            applicationId,
          ],
          application,
        );

        client.invalidateQueries({
          queryKey: [
            'applications',
          ],
        });

        setConfirmApplied(
          false,
        );

        push(
          'Application marked as applied',
        );
      },
    });


  if (q.isLoading) {
    return <ReviewLoading />;
  }


  if (q.error) {
    return (
      <ErrorState
        message={err(q.error)}
      />
    );
  }


  const application =
    q.data!;


  const resumeReady =
    !application.resume ||
    (application.resume
      .approved &&
      application.resume
        .claim_status ===
        'passed');


  const coverReady =
    !application.cover_letter ||
    (application.cover_letter
      .approved &&
      application
        .cover_letter
        .claim_status ===
        'passed');


  const hasDocument =
    Boolean(
      application.resume ||
        application.cover_letter,
    );


  const docsReady =
    hasDocument &&
    resumeReady &&
    coverReady;


  return (
    <>
      <div className="mb-4">
        <Link
          href="/dashboard/applications"
          className="inline-flex items-center gap-1.5 text-11 font-medium text-text-secondary transition hover:text-indigo-400"
        >
          <ArrowLeft size={13} />
          Back to applications
        </Link>
      </div>


      <PageHeader
        eyebrow="Application approval"
        title={
          application.job
            ?.title ||
          'Application package'
        }
        description={`${application.job?.company || ''} · ${application.job?.location || ''}`}
        actions={
          <StatusPill
            status={
              application.status
            }
          />
        }
      />


      <section className="career-review-hero mb-5 overflow-hidden rounded-[22px] border border-indigo-500/15">
        <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-7">
          <div className="relative z-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-indigo-300">
              Final review gate
            </div>

            <h2 className="mt-3 max-w-2xl text-24 font-semibold tracking-[-0.035em] md:text-28">
              Review the exact package before recording submission.
            </h2>

            <p className="mt-3 max-w-2xl text-12 leading-6 text-text-secondary">
              CareerPilot keeps approval separate from submission. Documents must be verified first, then you explicitly approve the package and confirm when it was actually submitted.
            </p>
          </div>


          <div className="relative z-10 flex items-center gap-3">
            <ReviewState
              label="Documents"
              ready={docsReady}
            />

            <ReviewState
              label="Package"
              ready={Boolean(
                application.approved_at,
              )}
            />
          </div>
        </div>
      </section>


      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <Panel className="overflow-hidden">
            <div className="border-b border-border px-5 py-5 md:px-6">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-[10px] border border-indigo-500/15 bg-indigo-500/10 text-indigo-400">
                  <FileCheck2
                    size={15}
                  />
                </div>

                <div>
                  <h2 className="text-15 font-semibold">
                    Attached document versions
                  </h2>

                  <p className="mt-1 text-[10px] text-text-secondary">
                    These exact versions will stay recorded with the application.
                  </p>
                </div>
              </div>
            </div>


            <div className="space-y-3 p-5 md:p-6">
              {application.resume && (
                <ReviewDocumentCard
                  label="Resume"
                  id={
                    application.resume.id
                  }
                  route="resume"
                  version={
                    application.resume
                      .version
                  }
                  approved={
                    application.resume
                      .approved
                  }
                  claimStatus={
                    application.resume
                      .claim_status ?? 'unknown'
                  }
                />
              )}


              {application.cover_letter && (
                <ReviewDocumentCard
                  label="Cover letter"
                  id={
                    application
                      .cover_letter.id
                  }
                  route="cover-letter"
                  version={
                    application
                      .cover_letter
                      .version
                  }
                  approved={
                    application
                      .cover_letter
                      .approved
                  }
                  claimStatus={
                    application
                      .cover_letter
                      .claim_status ?? 'unknown'
                  }
                />
              )}


              {!application.resume &&
                !application.cover_letter && (
                  <div className="rounded-[13px] border border-amber-500/15 bg-amber-500/[0.055] p-4">
                    <div className="flex items-start gap-3">
                      <CircleAlert
                        size={15}
                        className="mt-0.5 shrink-0 text-amber-400"
                      />

                      <p className="text-11 leading-5 text-text-secondary">
                        No documents are attached. Recreate the package with at least one approved document.
                      </p>
                    </div>
                  </div>
                )}
            </div>
          </Panel>


          <Panel className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <MessageSquareText
                  size={14}
                  className="text-cyan-400"
                />

                <h2 className="text-14 font-semibold">
                  Preparation notes
                </h2>
              </div>
            </div>

            <div className="p-5 md:p-6">
              <p className="whitespace-pre-wrap text-12 leading-6 text-text-secondary">
                {application.notes ||
                  'No preparation notes.'}
              </p>
            </div>
          </Panel>
        </div>


        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Panel className="career-approval-gate overflow-hidden border-indigo-500/15">
            <div className="p-5">
              <div
                className={`flex size-10 items-center justify-center rounded-[11px] ${
                  docsReady
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                <ShieldCheck
                  size={18}
                />
              </div>


              <h2 className="mt-4 text-15 font-semibold">
                Approval gate
              </h2>

              <p className="mt-2 text-11 leading-5 text-text-secondary">
                All attached documents must be claim-verified and individually approved before the package can be approved.
              </p>


              <div className="mt-5 space-y-3">
                <GateRow
                  label="At least one document"
                  done={
                    hasDocument
                  }
                />

                <GateRow
                  label="Resume verified"
                  done={
                    resumeReady
                  }
                />

                <GateRow
                  label="Cover letter verified"
                  done={
                    coverReady
                  }
                />

                <GateRow
                  label="Package approved"
                  done={Boolean(
                    application.approved_at,
                  )}
                />
              </div>


              <Button
                className="mt-6 w-full"
                disabled={
                  !docsReady ||
                  Boolean(
                    application.approved_at,
                  ) ||
                  approve.isPending
                }
                onClick={() =>
                  approve.mutate()
                }
              >
                {application.approved_at ? (
                  <>
                    <CheckCircle2
                      size={14}
                    />
                    Package approved
                  </>
                ) : approve.isPending ? (
                  'Approving…'
                ) : (
                  <>
                    <ShieldCheck
                      size={14}
                    />
                    Approve package
                  </>
                )}
              </Button>


              <Button
                className="mt-2 w-full"
                variant="secondary"
                disabled={
                  !application.approved_at ||
                  application.status ===
                    'Applied'
                }
                onClick={() =>
                  setConfirmApplied(
                    true,
                  )
                }
              >
                <Send size={14} />
                Mark as applied
              </Button>


              {application.job
                ?.apply_url && (
                <a
                  className="mt-2 block"
                  href={
                    application.job
                      .apply_url
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="ghost"
                    className="w-full"
                  >
                    Open employer site
                    <ExternalLink
                      size={14}
                    />
                  </Button>
                </a>
              )}


              <p className="mt-4 border-t border-border pt-4 font-mono text-[9px] leading-5 text-text-secondary">
                CareerPilot records applied status only after your explicit confirmation. It does not silently submit to unsupported third-party platforms.
              </p>
            </div>
          </Panel>
        </aside>
      </div>


      <ConfirmDialog
        open={confirmApplied}
        title="Confirm you submitted this application"
        description="This records the application as Applied with the exact attached document versions. It does not send data to the employer. Continue only after you have actually submitted or an approved official integration has done so."
        confirmLabel="Yes, mark applied"
        onClose={() =>
          setConfirmApplied(
            false,
          )
        }
        onConfirm={() =>
          applied.mutate()
        }
        busy={
          applied.isPending
        }
      />
    </>
  );
}


/* =========================================================
   SMALL COMPONENTS
   ========================================================= */

function ApplicationFeatureMetric({
  icon: Icon,
  label,
  value,
  description,
  color,
}: {
  icon: typeof ShieldCheck;
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


function ApplicationMiniMetric({
  value,
  label,
  tone = 'neutral',
}: {
  value: string;
  label: string;
  tone?:
    | 'neutral'
    | 'active'
    | 'interview'
    | 'positive';
}) {
  const styles = {
    neutral:
      'border-border bg-surface-1/60 text-text-primary',

    active:
      'border-cyan-500/15 bg-cyan-500/[0.06] text-cyan-400',

    interview:
      'border-violet-500/15 bg-violet-500/[0.06] text-violet-400',

    positive:
      'border-emerald-500/15 bg-emerald-500/[0.06] text-emerald-400',
  };


  return (
    <div
      className={`min-w-[92px] rounded-[13px] border p-3 text-right ${styles[tone]}`}
    >
      <div className="text-20 font-semibold tracking-[-0.04em]">
        {value}
      </div>

      <div className="mt-1 text-[9px] text-text-secondary">
        {label}
      </div>
    </div>
  );
}


function DocumentAttachment({
  label,
  version,
  attached,
}: {
  label: string;
  version?: number;
  attached: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[10px]">
      <span className="text-text-secondary">
        {label}
      </span>

      <span
        className={`font-mono ${
          attached
            ? 'text-text-primary'
            : 'text-text-tertiary'
        }`}
      >
        {attached
          ? `v${version}`
          : '—'}
      </span>
    </div>
  );
}


function ApplicationField({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2">
        <div className="text-12 font-medium">
          {label}
        </div>

        {description && (
          <p className="mt-1 text-[10px] leading-5 text-text-secondary">
            {description}
          </p>
        )}
      </div>

      {children}
    </label>
  );
}


function MissingDocumentNotice({
  label,
  href,
}: {
  label: string;
  href: string;
}) {
  return (
    <div className="rounded-[12px] border border-amber-500/15 bg-amber-500/[0.055] p-3.5">
      <div className="flex items-start gap-2.5">
        <CircleAlert
          size={14}
          className="mt-0.5 shrink-0 text-amber-400"
        />

        <p className="text-[10px] leading-5 text-text-secondary">
          No {label} exists for this job.{' '}
          <Link
            href={href}
            className="font-medium text-text-primary underline decoration-border-strong underline-offset-4 transition hover:text-indigo-400"
          >
            Generate one
          </Link>
          .
        </p>
      </div>
    </div>
  );
}


function SelectedDocumentCard({
  label,
  doc,
}: {
  label: string;
  doc: GeneratedDocument;
}) {
  const verified =
    Boolean(
      doc.approved_at,
    ) &&
    doc.claim_report.status ===
      'passed' &&
    doc.claim_report
      .unsupported_claims ===
      0;


  return (
    <div
      className={`rounded-[13px] border p-4 ${
        verified
          ? 'border-emerald-500/15 bg-emerald-500/[0.05]'
          : 'border-amber-500/15 bg-amber-500/[0.05]'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-tertiary">
            {label}
          </div>

          <div className="mt-1 text-11 font-semibold">
            {doc.title} · v
            {doc.version}
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 text-[9px] font-medium ${
            verified
              ? 'text-emerald-400'
              : 'text-amber-400'
          }`}
        >
          {verified ? (
            <CheckCircle2
              size={11}
            />
          ) : (
            <CircleAlert
              size={11}
            />
          )}

          {verified
            ? 'Approved + verified'
            : 'Needs review'}
        </span>
      </div>
    </div>
  );
}


function ChecklistStep({
  done,
  title,
  text,
}: {
  done: boolean;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={`flex size-7 shrink-0 items-center justify-center rounded-[8px] border ${
          done
            ? 'border-emerald-500/15 bg-emerald-500/10 text-emerald-400'
            : 'border-border bg-surface-2 text-text-tertiary'
        }`}
      >
        {done ? (
          <Check size={12} />
        ) : (
          <Clock3 size={12} />
        )}
      </div>

      <div>
        <div className="text-11 font-semibold">
          {title}
        </div>

        <p className="mt-1 text-[10px] leading-5 text-text-secondary">
          {text}
        </p>
      </div>
    </div>
  );
}


function ReviewState({
  label,
  ready,
}: {
  label: string;
  ready: boolean;
}) {
  return (
    <div
      className={`min-w-[110px] rounded-[14px] border p-3 ${
        ready
          ? 'border-emerald-500/15 bg-emerald-500/[0.06]'
          : 'border-amber-500/15 bg-amber-500/[0.06]'
      }`}
    >
      <div
        className={`text-11 font-semibold ${
          ready
            ? 'text-emerald-400'
            : 'text-amber-400'
        }`}
      >
        {ready
          ? 'Ready'
          : 'Pending'}
      </div>

      <div className="mt-1 text-[9px] text-text-secondary">
        {label}
      </div>
    </div>
  );
}


function ReviewDocumentCard({
  label,
  id,
  route,
  version,
  approved,
  claimStatus,
}: {
  label: string;
  id: string;
  route:
    | 'resume'
    | 'cover-letter';
  version: number;
  approved: boolean;
  claimStatus: string;
}) {
  const ready =
    approved &&
    claimStatus === 'passed';


  return (
    <div
      className={`rounded-[14px] border p-4 ${
        ready
          ? 'border-emerald-500/15 bg-emerald-500/[0.05]'
          : 'border-amber-500/15 bg-amber-500/[0.05]'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-9 items-center justify-center rounded-[10px] ${
              ready
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-amber-500/10 text-amber-400'
            }`}
          >
            <FileText
              size={15}
            />
          </div>

          <div>
            <div className="text-11 font-semibold">
              {label} · version{' '}
              {version}
            </div>

            <div
              className={`mt-1 text-[9px] font-medium ${
                ready
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}
            >
              {ready
                ? 'Approved + verified'
                : 'Needs document approval'}
            </div>
          </div>
        </div>


        <Link
          href={`/dashboard/documents/${route}/${id}`}
        >
          <Button
            variant="secondary"
          >
            Open version
            <ArrowRight
              size={12}
            />
          </Button>
        </Link>
      </div>
    </div>
  );
}


function GateRow({
  label,
  done,
}: {
  label: string;
  done: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-10 text-text-secondary">
        {label}
      </span>

      <span
        className={`inline-flex items-center gap-1.5 font-mono text-[9px] ${
          done
            ? 'text-emerald-400'
            : 'text-amber-400'
        }`}
      >
        {done ? (
          <>
            <Check size={10} />
            Ready
          </>
        ) : (
          <>
            <Clock3 size={10} />
            Pending
          </>
        )}
      </span>
    </div>
  );
}


/* =========================================================
   LOADING STATES
   ========================================================= */

function ApplicationsLoading() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(
        (item) => (
          <Skeleton
            key={item}
            className="h-[210px] rounded-[20px]"
          />
        ),
      )}
    </div>
  );
}


function PrepareLoading() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <Skeleton className="h-[650px] rounded-[20px]" />
      <Skeleton className="h-[430px] rounded-[20px]" />
    </div>
  );
}


function ReviewLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[210px] rounded-[22px]" />

      <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
        <div className="space-y-5">
          <Skeleton className="h-[330px] rounded-[20px]" />
          <Skeleton className="h-[200px] rounded-[20px]" />
        </div>

        <Skeleton className="h-[470px] rounded-[20px]" />
      </div>
    </div>
  );
}
