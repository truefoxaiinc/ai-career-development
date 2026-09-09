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
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  Lightbulb,
  MessageSquareText,
  Mic2,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  WandSparkles,
} from 'lucide-react';

import { api } from '@/lib/api';

import type {
  InterviewQuestion,
  STARAnswer,
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
  Skeleton,
  Textarea,
} from '@/components/ui';

import { useInterviewDashboard } from '@/hooks/useInterviewPrep';
import { useToast } from '@/components/toast';


/* =========================================================
   TYPES / HELPERS
   ========================================================= */

const err = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Request failed';

type Session = {
  id: string;
  job_id?: string | null;
  session_type: string;
  status: string;
  questions: InterviewQuestion[];
  transcript: Array<{
    question_id: string;
    question: string;
    category: string;
    answer: string;
  }>;
  scores: Record<
    string,
    number | Array<Record<string, unknown>>
  >;
  feedback: string;
  completed_at?: string | null;
  created_at: string;
};

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, x => x.toUpperCase());
}

function scoreTone(score: number) {
  if (score >= 80) return 'positive';
  if (score >= 60) return 'good';
  return 'warning';
}

/* =========================================================
   INTERVIEW WORKSPACE NAV
   ========================================================= */

function InterviewNav({
  active,
}: {
  active:
    | 'dashboard'
    | 'questions'
    | 'mock'
    | 'star';
}) {
  const items = [
    {
      id: 'dashboard',
      label: 'Overview',
      href: '/dashboard/interview',
      icon: BarChart3,
    },
    {
      id: 'questions',
      label: 'Question bank',
      href: '/dashboard/interview/questions',
      icon: MessageSquareText,
    },
    {
      id: 'mock',
      label: 'Mock interview',
      href: '/dashboard/interview/mock',
      icon: Play,
    },
    {
      id: 'star',
      label: 'STAR library',
      href: '/dashboard/interview/library',
      icon: Star,
    },
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
              className={`inline-flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-11 font-medium transition ${
                selected
                  ? 'bg-text-primary text-canvas shadow-sm'
                  : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
              }`}
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

/* =========================================================
   DASHBOARD
   ========================================================= */

export function InterviewDashboardPage() {
  const q = useInterviewDashboard();

  return (
    <>
      <PageHeader
        eyebrow="Interview preparation"
        title="Interview prep workspace"
        description="Practice targeted questions, run scored mock interviews, and build reusable STAR stories from your verified career evidence."
        actions={
          <Link href="/dashboard/interview/mock">
            <Button>
              <Play size={14} />
              Start mock interview
            </Button>
          </Link>
        }
      />

      <InterviewNav active="dashboard" />

      <section className="career-interview-hero mb-5 overflow-hidden rounded-[22px] border border-indigo-500/15">
        <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-7">
          <div className="relative z-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-indigo-300">
              Evidence-led practice
            </div>

            <h2 className="mt-3 max-w-2xl text-24 font-semibold tracking-[-0.035em] md:text-28">
              Practice the stories you can actually defend.
            </h2>

            <p className="mt-3 max-w-2xl text-12 leading-6 text-text-secondary">
              CareerPilot helps you prepare specific, grounded answers instead of memorizing generic AI responses.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-2 gap-2">
            <InterviewMiniMetric
              value={
                q.data
                  ? String(q.data.star_answer_count)
                  : '—'
              }
              label="STAR stories"
              tone="violet"
            />

            <InterviewMiniMetric
              value="Text"
              label="mock mode"
              tone="cyan"
            />
          </div>
        </div>
      </section>

      {q.isLoading ? (
        <DashboardLoading />
      ) : q.error ? (
        <ErrorState message={err(q.error)} />
      ) : q.data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <InterviewFeatureCard
              href="/dashboard/interview/questions"
              icon={MessageSquareText}
              eyebrow="Prepare"
              title="Question bank"
              description="Generate role-aware prompts for behavioral, technical, resume-based, and general interview practice."
              color="indigo"
            />

            <InterviewFeatureCard
              href="/dashboard/interview/mock"
              icon={Play}
              eyebrow="Practice"
              title="Text mock interview"
              description="Answer interactively and receive structured scoring across relevance, clarity, structure, and completeness."
              color="cyan"
            />

            <InterviewFeatureCard
              href="/dashboard/interview/library"
              icon={Star}
              eyebrow="Reuse"
              title="STAR answer library"
              description={`${q.data.star_answer_count} saved answer${q.data.star_answer_count === 1 ? '' : 's'} ready for behavioral interview prep.`}
              color="violet"
            />
          </div>

          <Panel className="career-voice-readiness mt-5 overflow-hidden">
            <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-6">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] border border-border bg-surface-2 text-text-secondary">
                  <Mic2 size={17} />
                </div>

                <div>
                  <h2 className="text-14 font-semibold">
                    Voice interview mode
                  </h2>

                  <p className="mt-1 max-w-2xl text-11 leading-5 text-text-secondary">
                    The interview domain is ready for alternate transports, but voice capture is not enabled in this build. No fake microphone workflow is shown.
                  </p>
                </div>
              </div>

              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.06em] text-text-secondary">
                <CircleAlert size={11} />
                Not enabled
              </span>
            </div>
          </Panel>
        </>
      ) : null}
    </>
  );
}

/* =========================================================
   QUESTION BANK
   ========================================================= */

export function InterviewQuestionsPage() {
  const [jobId, setJobId] = useState('');

  const q = useQuery({
    queryKey: [
      'interview',
      'questions',
      jobId,
    ],
    queryFn: () =>
      api.get<InterviewQuestion[]>(
        `/interviews/questions${
          jobId
            ? `?job_id=${encodeURIComponent(jobId)}&count=15`
            : '?count=15'
        }`,
      ),
  });

  const grouped = useMemo(() => {
    const map: Record<string, InterviewQuestion[]> = {};

    for (const item of q.data || []) {
      (map[item.category] ??= []).push(item);
    }

    return map;
  }, [q.data]);

  return (
    <>
      <PageHeader
        eyebrow="Interview preparation"
        title="Question bank"
        description="Generate practice prompts from your verified profile and, when supplied, the requirements of a specific target job."
        actions={
          <Link href="/dashboard/jobs/search">
            <Button variant="secondary">
              <Target size={14} />
              Find a job
            </Button>
          </Link>
        }
      />

      <InterviewNav active="questions" />

      <Panel className="career-question-filter mb-5 overflow-hidden">
        <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-end">
          <label className="block">
            <div className="mb-2 text-12 font-medium">
              Optional target job ID
            </div>

            <Input
              className="h-11"
              value={jobId}
              onChange={e => setJobId(e.target.value)}
              placeholder="Paste a CareerPilot job UUID"
            />

            <p className="mt-2 text-[10px] leading-5 text-text-secondary">
              Leave blank for general and profile-based questions. Add a job ID for role-specific prompts.
            </p>
          </label>

          <div className="rounded-[12px] border border-indigo-500/15 bg-indigo-500/[0.055] px-4 py-3">
            <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-indigo-400">
              Question source
            </div>
            <div className="mt-1 text-11 font-semibold">
              {jobId ? 'Profile + target job' : 'Verified profile'}
            </div>
          </div>
        </div>
      </Panel>

      {q.isLoading ? (
        <QuestionLoading />
      ) : q.error ? (
        <ErrorState
          message={err(q.error)}
          retry={() => q.refetch()}
        />
      ) : !q.data?.length ? (
        <EmptyState
          title="No questions available"
          description="Try removing the target job ID or verify that the selected job exists."
        />
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(
            ([category, questions]) => (
              <QuestionCategory
                key={category}
                category={category}
                questions={questions}
              />
            ),
          )}
        </div>
      )}
    </>
  );
}

function QuestionCategory({
  category,
  questions,
}: {
  category: string;
  questions: InterviewQuestion[];
}) {
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-[10px] border border-indigo-500/15 bg-indigo-500/10 text-indigo-400">
            <MessageSquareText size={15} />
          </div>

          <div>
            <h2 className="text-14 font-semibold">
              {titleCase(category)}
            </h2>
            <p className="mt-0.5 text-[10px] text-text-secondary">
              {questions.length} practice question{questions.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border">
        {questions.map((question, index) => (
          <div
            key={question.id}
            className="group flex items-start gap-4 p-5 transition hover:bg-surface-2/40 md:px-6"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface-2 font-mono text-[9px] text-text-secondary">
              {String(index + 1).padStart(2, '0')}
            </div>

            <p className="flex-1 text-13 leading-6 text-text-primary">
              {question.question}
            </p>

            <ChevronRight
              size={14}
              className="mt-1 shrink-0 text-text-tertiary opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* =========================================================
   MOCK INTERVIEW
   ========================================================= */

export function MockInterviewPage() {
  const { push } = useToast();

  const [session, setSession] =
    useState<Session | null>(null);

  const [index, setIndex] =
    useState(0);

  const [answer, setAnswer] =
    useState('');

  const [error, setError] =
    useState('');

  const [busy, setBusy] =
    useState(false);


  async function start() {
    setBusy(true);
    setError('');

    try {
      const s =
        await api.post<Session>(
          '/interviews/sessions',
          {
            job_id: null,
            question_count: 6,
          },
        );

      setSession(s);
      setIndex(0);
      setAnswer('');
    } catch (e) {
      setError(err(e));
    } finally {
      setBusy(false);
    }
  }


  async function submitAnswer() {
    if (
      !session ||
      !answer.trim()
    ) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const question =
        session.questions[index];

      const updated =
        await api.post<Session>(
          `/interviews/sessions/${session.id}/answers`,
          {
            question_id:
              question.id,
            answer,
          },
        );

      setSession(updated);
      setAnswer('');

      if (
        index <
        session.questions.length -
          1
      ) {
        setIndex(index + 1);
      } else {
        const done =
          await api.post<Session>(
            `/interviews/sessions/${session.id}/complete`,
            {},
          );

        setSession(done);

        push(
          'Mock interview complete',
        );
      }
    } catch (e) {
      setError(err(e));
    } finally {
      setBusy(false);
    }
  }


  if (!session) {
    return (
      <>
        <PageHeader
          eyebrow="Interview preparation"
          title="Mock interview"
          description="Practice a six-question text session and receive structured feedback on relevance, clarity, structure, and completeness."
        />

        <InterviewNav active="mock" />

        <section className="career-mock-start overflow-hidden rounded-[24px] border border-indigo-500/15">
          <div className="relative grid gap-8 p-6 md:grid-cols-[1fr_330px] md:items-center md:p-8">
            <div className="relative z-10">
              <div className="flex size-12 items-center justify-center rounded-[14px] border border-indigo-500/15 bg-indigo-500/10 text-indigo-400">
                <Play size={20} />
              </div>

              <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.08em] text-indigo-300">
                6-question practice session
              </div>

              <h2 className="mt-3 max-w-2xl text-28 font-semibold tracking-[-0.04em] md:text-34">
                Practice like it is a real interview.
              </h2>

              <p className="mt-4 max-w-2xl text-12 leading-6 text-text-secondary">
                Answer naturally, use specific examples, and avoid inventing details. CareerPilot will score the session and show where your responses can become sharper.
              </p>

              {error && (
                <div className="mt-5 max-w-xl">
                  <FieldError>{error}</FieldError>
                </div>
              )}

              <Button
                className="mt-6"
                onClick={start}
                disabled={busy}
              >
                {busy ? (
                  'Starting…'
                ) : (
                  <>
                    <Play size={14} />
                    Start mock interview
                  </>
                )}
              </Button>
            </div>

            <Panel className="relative z-10 career-mock-expectations overflow-hidden">
              <div className="border-b border-border p-5">
                <h3 className="text-13 font-semibold">
                  What will be scored
                </h3>
              </div>

              <div className="space-y-4 p-5">
                <ScoreDimension
                  icon={Target}
                  title="Relevance"
                  text="Does the answer address the actual question?"
                />

                <ScoreDimension
                  icon={MessageSquareText}
                  title="Clarity"
                  text="Is the response easy to follow and specific?"
                />

                <ScoreDimension
                  icon={FileText}
                  title="Structure"
                  text="Does the answer have a coherent narrative?"
                />

                <ScoreDimension
                  icon={CheckCircle2}
                  title="Completeness"
                  text="Does the answer include enough useful detail?"
                />
              </div>
            </Panel>
          </div>
        </section>
      </>
    );
  }


  if (
    session.status ===
    'completed'
  ) {
    const overall =
      Number(
        session.scores.overall ||
          0,
      );

    const per =
      (session.scores
        .questions ||
        []) as Array<{
        question_id: string;
        overall: number;
        feedback: string[];
      }>;

    return (
      <>
        <PageHeader
          eyebrow="Mock interview feedback"
          title="Session complete"
          description={session.feedback}
          actions={
            <Button
              variant="secondary"
              onClick={() =>
                setSession(null)
              }
            >
              <RotateCcw size={14} />
              Start another
            </Button>
          }
        />

        <InterviewNav active="mock" />

        <section className="career-score-hero mb-5 overflow-hidden rounded-[22px] border border-indigo-500/15">
          <div className="grid gap-6 p-6 md:grid-cols-[180px_1fr] md:items-center md:p-7">
            <div className="mx-auto">
              <MatchScoreRadial
                value={overall}
                size={118}
                label="overall"
              />
            </div>

            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-indigo-300">
                Session performance
              </div>

              <h2 className="mt-3 text-24 font-semibold tracking-[-0.035em]">
                {overall >= 80
                  ? 'Strong interview performance'
                  : overall >= 60
                    ? 'Solid foundation with room to sharpen'
                    : 'Useful practice — focus on structure and specificity'}
              </h2>

              <p className="mt-3 max-w-2xl text-12 leading-6 text-text-secondary">
                {session.feedback}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
          <Panel className="h-fit overflow-hidden lg:sticky lg:top-24">
            <div className="border-b border-border p-5">
              <h2 className="text-14 font-semibold">
                Score breakdown
              </h2>
            </div>

            <div className="space-y-4 p-5">
              {[
                'relevance',
                'clarity',
                'structure',
                'completeness',
              ].map(key => (
                <ScoreRow
                  key={key}
                  label={titleCase(key)}
                  score={Number(
                    session.scores[key] ??
                      0,
                  )}
                />
              ))}
            </div>
          </Panel>

          <div className="space-y-3">
            {session.transcript.map(
              (item, questionIndex) => {
                const score = per.find(
                  row =>
                    row.question_id ===
                    item.question_id,
                );

                return (
                  <Panel
                    className="overflow-hidden"
                    key={item.question_id}
                  >
                    <div className="flex items-center justify-between border-b border-border px-5 py-4">
                      <div className="font-mono text-[10px] uppercase tracking-[0.05em] text-text-secondary">
                        Question {questionIndex + 1}
                      </div>

                      <ScoreBadge
                        score={
                          score?.overall ??
                          0
                        }
                      />
                    </div>

                    <div className="p-5">
                      <h2 className="text-14 font-semibold leading-6">
                        {item.question}
                      </h2>

                      <div className="mt-4 rounded-[12px] border border-border bg-surface-2/50 p-4">
                        <div className="font-mono text-[9px] uppercase tracking-[0.05em] text-text-tertiary">
                          Your answer
                        </div>

                        <p className="mt-2 whitespace-pre-wrap text-12 leading-6 text-text-secondary">
                          {item.answer}
                        </p>
                      </div>

                      {score?.feedback
                        ?.length ? (
                        <div className="mt-4">
                          <div className="flex items-center gap-2 text-11 font-semibold">
                            <Lightbulb
                              size={13}
                              className="text-amber-400"
                            />
                            Feedback
                          </div>

                          <ul className="mt-3 space-y-2">
                            {score.feedback.map(
                              feedback => (
                                <li
                                  key={feedback}
                                  className="flex items-start gap-2.5 text-[11px] leading-5 text-text-secondary"
                                >
                                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-400" />
                                  {feedback}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </Panel>
                );
              },
            )}
          </div>
        </div>
      </>
    );
  }


  const question =
    session.questions[index];

  const progress =
    Math.round(
      ((index + 1) /
        session.questions.length) *
        100,
    );


  return (
    <>
      <PageHeader
        eyebrow={`Mock interview · ${index + 1}/${session.questions.length}`}
        title={titleCase(
          question.category,
        )}
        description="Answer as you would in an actual interview. Use specific, verified examples instead of invented details."
      />

      <InterviewNav active="mock" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel className="career-mock-question overflow-hidden">
          <div className="border-b border-border p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <span className="rounded-full border border-indigo-500/15 bg-indigo-500/[0.07] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.06em] text-indigo-400">
                {titleCase(
                  question.category,
                )}
              </span>

              <span className="font-mono text-[9px] text-text-secondary">
                {progress}% complete
              </span>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 transition-all duration-500"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>

          <div className="p-5 md:p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
              Interview question
            </div>

            <h2 className="mt-3 max-w-3xl text-20 font-semibold leading-8 tracking-[-0.02em]">
              {question.question}
            </h2>

            <label className="mt-6 block">
              <div className="mb-2 text-12 font-medium">
                Your answer
              </div>

              <Textarea
                className="min-h-[240px] resize-y"
                value={answer}
                onChange={e =>
                  setAnswer(
                    e.target.value,
                  )
                }
                placeholder="Type your response as if you were speaking to the interviewer…"
              />

              <div className="mt-2 flex justify-between text-[9px] text-text-tertiary">
                <span>
                  Use concrete examples and outcomes.
                </span>

                <span>
                  {answer.length} characters
                </span>
              </div>
            </label>

            {error && (
              <div className="mt-4">
                <FieldError>
                  {error}
                </FieldError>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <Button
                onClick={
                  submitAnswer
                }
                disabled={
                  !answer.trim() ||
                  busy
                }
              >
                {busy
                  ? 'Saving…'
                  : index ===
                      session.questions.length -
                        1
                    ? (
                      <>
                        Finish and score
                        <Trophy
                          size={14}
                        />
                      </>
                    )
                    : (
                      <>
                        Save and continue
                        <ArrowRight
                          size={14}
                        />
                      </>
                    )}
              </Button>
            </div>
          </div>
        </Panel>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Panel className="overflow-hidden">
            <div className="border-b border-border p-5">
              <h3 className="text-13 font-semibold">
                Answer guidance
              </h3>
            </div>

            <div className="space-y-4 p-5">
              <GuidanceItem
                title="Be specific"
                text="Use one concrete situation rather than several vague examples."
              />

              <GuidanceItem
                title="Show your role"
                text="Explain what you personally did, not only what the team did."
              />

              <GuidanceItem
                title="Include the result"
                text="Finish with an outcome, lesson, or measurable impact."
              />
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}

/* =========================================================
   STAR LIBRARY
   ========================================================= */

export function StarLibraryPage() {
  const client =
    useQueryClient();

  const { push } =
    useToast();

  const q = useQuery({
    queryKey: [
      'interviews',
      'star',
    ],
    queryFn: () =>
      api.get<STARAnswer[]>(
        '/interviews/star',
      ),
  });

  const [open, setOpen] =
    useState(false);

  const empty = {
    theme: '',
    title: '',
    situation: '',
    task: '',
    action: '',
    result: '',
    tags: '',
  };

  const [form, setForm] =
    useState(empty);

  const add = useMutation({
    mutationFn: () =>
      api.post(
        '/interviews/star',
        {
          ...form,
          tags: form.tags
            .split(',')
            .map(x => x.trim())
            .filter(Boolean),
        },
      ),

    onSuccess: () => {
      client.invalidateQueries({
        queryKey: [
          'interviews',
          'star',
        ],
      });

      setForm(empty);
      setOpen(false);

      push(
        'STAR answer saved',
      );
    },
  });


  function submit(
    e: FormEvent,
  ) {
    e.preventDefault();
    add.mutate();
  }


  return (
    <>
      <PageHeader
        eyebrow="Interview preparation"
        title="STAR answer library"
        description="Store reusable Situation, Task, Action, and Result stories for behavioral interviews."
        actions={
          <Button
            onClick={() =>
              setOpen(
                value => !value,
              )
            }
          >
            {open ? (
              'Close'
            ) : (
              <>
                <Plus size={14} />
                Add STAR answer
              </>
            )}
          </Button>
        }
      />

      <InterviewNav active="star" />

      <section className="career-star-hero mb-5 overflow-hidden rounded-[22px] border border-violet-500/15">
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-7">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-violet-300">
              Behavioral interview memory
            </div>

            <h2 className="mt-3 max-w-2xl text-24 font-semibold tracking-[-0.035em] md:text-28">
              Build your best examples once. Reuse them intelligently.
            </h2>

            <p className="mt-3 max-w-2xl text-12 leading-6 text-text-secondary">
              Capture real leadership, teamwork, conflict, delivery, failure, and problem-solving stories before the pressure of an interview.
            </p>
          </div>

          <InterviewMiniMetric
            value={
              q.data
                ? String(q.data.length)
                : '—'
            }
            label="saved stories"
            tone="violet"
          />
        </div>
      </section>

      {open && (
        <Panel className="career-star-form mb-5 overflow-hidden border-violet-500/15">
          <div className="border-b border-border px-5 py-5 md:px-6">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-[11px] border border-violet-500/15 bg-violet-500/10 text-violet-400">
                <WandSparkles size={17} />
              </div>

              <div>
                <h2 className="text-15 font-semibold">
                  Add STAR story
                </h2>

                <p className="mt-1 text-11 text-text-secondary">
                  Capture the real example in a reusable interview-ready structure.
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={submit}
            className="space-y-5 p-5 md:p-6"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <StarField label="Theme">
                <Input
                  className="h-11"
                  required
                  value={form.theme}
                  onChange={e =>
                    setForm({
                      ...form,
                      theme:
                        e.target.value,
                    })
                  }
                  placeholder="Leadership"
                />
              </StarField>

              <StarField label="Title">
                <Input
                  className="h-11"
                  required
                  value={form.title}
                  onChange={e =>
                    setForm({
                      ...form,
                      title:
                        e.target.value,
                    })
                  }
                  placeholder="Recovered a delayed launch"
                />
              </StarField>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {(
                [
                  'situation',
                  'task',
                  'action',
                  'result',
                ] as const
              ).map(key => (
                <StarField
                  key={key}
                  label={titleCase(
                    key,
                  )}
                >
                  <Textarea
                    className="min-h-[140px]"
                    value={form[key]}
                    onChange={e =>
                      setForm({
                        ...form,
                        [key]:
                          e.target.value,
                      })
                    }
                    placeholder={
                      key ===
                      'situation'
                        ? 'What was happening?'
                        : key ===
                            'task'
                          ? 'What were you responsible for?'
                          : key ===
                              'action'
                            ? 'What did you personally do?'
                            : 'What changed as a result?'
                    }
                  />
                </StarField>
              ))}
            </div>

            <StarField
              label="Tags"
              description="Separate tags with commas."
            >
              <Input
                className="h-11"
                value={form.tags}
                onChange={e =>
                  setForm({
                    ...form,
                    tags:
                      e.target.value,
                  })
                }
                placeholder="leadership, conflict, delivery"
              />
            </StarField>

            {add.error && (
              <FieldError>
                {err(add.error)}
              </FieldError>
            )}

            <div className="flex justify-end border-t border-border pt-5">
              <Button
                disabled={
                  add.isPending
                }
              >
                {add.isPending
                  ? 'Saving…'
                  : (
                    <>
                      <Star size={14} />
                      Save STAR answer
                    </>
                  )}
              </Button>
            </div>
          </form>
        </Panel>
      )}

      {q.isLoading ? (
        <StarLoading />
      ) : q.error ? (
        <ErrorState
          message={err(q.error)}
        />
      ) : !q.data?.length ? (
        <EmptyState
          title="No STAR stories yet"
          description="Capture a real example for leadership, teamwork, conflict, failure, delivery, or problem solving."
          action={
            <Button
              onClick={() =>
                setOpen(true)
              }
            >
              Add your first story
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {q.data.map(star => (
            <StarCard
              key={star.id}
              star={star}
            />
          ))}
        </div>
      )}
    </>
  );
}

function StarCard({
  star,
}: {
  star: STARAnswer;
}) {
  return (
    <Panel className="career-star-card group overflow-hidden">
      <div className="h-[2px] bg-gradient-to-r from-violet-400 via-indigo-500 to-transparent" />

      <div className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="rounded-full border border-violet-500/15 bg-violet-500/[0.07] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.06em] text-violet-400">
              {star.theme}
            </span>

            <h2 className="mt-3 text-16 font-semibold tracking-[-0.02em]">
              {star.title}
            </h2>
          </div>

          <Star
            size={16}
            className="shrink-0 text-violet-400"
          />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(
            [
              'situation',
              'task',
              'action',
              'result',
            ] as const
          ).map(key => (
            <div
              key={key}
              className="rounded-[12px] border border-border bg-surface-2/45 p-3.5"
            >
              <div className="font-mono text-[9px] uppercase tracking-[0.05em] text-text-tertiary">
                {key}
              </div>

              <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-text-secondary">
                {star[key] || '—'}
              </p>
            </div>
          ))}
        </div>

        {star.tags?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {star.tags.map(tag => (
              <span
                key={tag}
                className="rounded-full border border-border bg-surface-2 px-2 py-1 font-mono text-[9px] text-text-secondary"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

/* =========================================================
   SMALL COMPONENTS
   ========================================================= */

function InterviewFeatureCard({
  href,
  icon: Icon,
  eyebrow,
  title,
  description,
  color,
}: {
  href: string;
  icon: typeof Play;
  eyebrow: string;
  title: string;
  description: string;
  color:
    | 'indigo'
    | 'cyan'
    | 'violet';
}) {
  const styles = {
    indigo:
      'border-indigo-500/15 bg-indigo-500/10 text-indigo-400',
    cyan:
      'border-cyan-500/15 bg-cyan-500/10 text-cyan-400',
    violet:
      'border-violet-500/15 bg-violet-500/10 text-violet-400',
  };

  return (
    <Link
      href={href}
      className="career-interview-feature group overflow-hidden rounded-[20px] border border-border bg-surface-1 p-5 transition duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-[0_18px_55px_rgba(0,0,0,.10)]"
    >
      <div className="flex items-start justify-between">
        <div
          className={`flex size-10 items-center justify-center rounded-[11px] border ${styles[color]}`}
        >
          <Icon size={17} />
        </div>

        <ArrowRight
          size={14}
          className="text-text-tertiary transition group-hover:translate-x-0.5 group-hover:text-indigo-400"
        />
      </div>

      <div className="mt-8 font-mono text-[9px] uppercase tracking-[0.06em] text-text-tertiary">
        {eyebrow}
      </div>

      <h2 className="mt-2 text-16 font-semibold">
        {title}
      </h2>

      <p className="mt-2 text-11 leading-5 text-text-secondary">
        {description}
      </p>
    </Link>
  );
}

function InterviewMiniMetric({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone:
    | 'cyan'
    | 'violet';
}) {
  const styles = {
    cyan:
      'border-cyan-500/15 bg-cyan-500/[0.06] text-cyan-400',
    violet:
      'border-violet-500/15 bg-violet-500/[0.06] text-violet-400',
  };

  return (
    <div
      className={`min-w-[96px] rounded-[13px] border p-3 text-right ${styles[tone]}`}
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

function ScoreDimension({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Target;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface-2 text-text-secondary">
        <Icon size={13} />
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

function ScoreRow({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  const tone =
    scoreTone(score);

  const gradient =
    tone === 'positive'
      ? 'from-emerald-400 to-cyan-400'
      : tone === 'good'
        ? 'from-cyan-400 to-indigo-500'
        : 'from-amber-400 to-indigo-500';

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-11 text-text-secondary">
          {label}
        </span>

        <span className="font-mono text-[10px]">
          {score}%
        </span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
          style={{
            width: `${Math.max(
              0,
              Math.min(
                100,
                score,
              ),
            )}%`,
          }}
        />
      </div>
    </div>
  );
}

function ScoreBadge({
  score,
}: {
  score: number;
}) {
  const tone =
    scoreTone(score);

  const classes =
    tone === 'positive'
      ? 'border-emerald-500/15 bg-emerald-500/[0.07] text-emerald-400'
      : tone === 'good'
        ? 'border-cyan-500/15 bg-cyan-500/[0.07] text-cyan-400'
        : 'border-amber-500/15 bg-amber-500/[0.07] text-amber-400';

  return (
    <span
      className={`rounded-full border px-2.5 py-1 font-mono text-[9px] ${classes}`}
    >
      {score}%
    </span>
  );
}

function GuidanceItem({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-emerald-500/10 text-emerald-400">
        <CheckCircle2 size={12} />
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

function StarField({
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
          <p className="mt-1 text-[10px] text-text-secondary">
            {description}
          </p>
        )}
      </div>

      {children}
    </label>
  );
}

/* =========================================================
   LOADING STATES
   ========================================================= */

function DashboardLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[1, 2, 3].map(item => (
        <Skeleton
          key={item}
          className="h-[230px] rounded-[20px]"
        />
      ))}
    </div>
  );
}

function QuestionLoading() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(item => (
        <Skeleton
          key={item}
          className="h-[220px] rounded-[20px]"
        />
      ))}
    </div>
  );
}

function StarLoading() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[1, 2, 3, 4].map(item => (
        <Skeleton
          key={item}
          className="h-[360px] rounded-[20px]"
        />
      ))}
    </div>
  );
}
