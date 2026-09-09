'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    ArrowRight,
    BarChart3,
    Briefcase,
    Check,
    ChevronRight,
    CircleCheck,
    FileText,
    Globe2,
    GraduationCap,
    MapPin,
    MessageSquare,
    Search,
    ShieldCheck,
    Sparkles,
    Target,
    UploadCloud,
    UserRoundCheck,
} from 'lucide-react';

import { CitationReference, ThemeToggle } from '@/components/ui';

type DemoMode = 'match' | 'apply' | 'prepare';

const source = {
    id: 'EMP-0084',
    source: 'Employment · Clearline · 2023–present',
    detail:
        'Cut checkout p95 from 1.8s to 1.19s after redesigning cache behavior.',
    verified: true,
};

const journey = [
    {
        number: '01',
        title: 'Upload',
        copy: 'Import your CV or resume. CareerPilot builds a structured career profile.',
        icon: UploadCloud,
    },
    {
        number: '02',
        title: 'Discover',
        copy: 'Find relevant opportunities in your country, abroad, or remote.',
        icon: Search,
    },
    {
        number: '03',
        title: 'Match',
        copy: 'See why each role fits your experience, education, and skills.',
        icon: Target,
    },
    {
        number: '04',
        title: 'Apply',
        copy: 'Tailor your resume and cover letter without inventing experience.',
        icon: FileText,
    },
    {
        number: '05',
        title: 'Prepare',
        copy: 'Practice likely interview questions using evidence from your career.',
        icon: MessageSquare,
    },
    {
        number: '06',
        title: 'Track',
        copy: 'Keep applications, interviews, outcomes, and next steps together.',
        icon: BarChart3,
    },
];

const capabilities = [
    {
        icon: UploadCloud,
        title: 'Resume intelligence',
        copy: 'Extract experience, education, skills, projects, certifications, and measurable achievements from PDF or DOCX.',
    },
    {
        icon: Globe2,
        title: 'Local + global jobs',
        copy: 'Recommend opportunities based on your career profile, preferred countries, location, and work preferences.',
    },
    {
        icon: Target,
        title: 'Explainable matching',
        copy: 'Understand strengths, missing requirements, transferable skills, and the evidence behind every match.',
    },
    {
        icon: FileText,
        title: 'Application studio',
        copy: 'Create a job-specific CV and cover letter while protecting the truth of your experience.',
    },
    {
        icon: MessageSquare,
        title: 'Interview coach',
        copy: 'Prepare role-specific, behavioral, technical, and STAR interview answers before the conversation starts.',
    },
    {
        icon: BarChart3,
        title: 'Application tracking',
        copy: 'Track saved roles, applications, interviews, offers, rejections, and the actions that come next.',
    },
];

const plans = [
    {
        name: 'Free',
        description: 'Start building your career profile.',
        price: '₹0',
        suffix: '',
        items: [
            '3 matched jobs per month',
            '1 tailored resume',
            'Basic interview preparation',
            'Inline evidence references',
        ],
    },
    {
        name: 'Pro',
        description: 'For an active job search.',
        price: '₹999',
        suffix: '/ month',
        featured: true,
        items: [
            'Unlimited job matching',
            '10 tailored applications',
            'Cover letter generation',
            'Advanced interview preparation',
            'Application tracking',
            'PDF + DOCX export',
        ],
    },
    {
        name: 'Team',
        description: 'For career teams and organizations.',
        price: 'Custom',
        suffix: '',
        items: [
            'Shared candidate workspace',
            'Evidence review workflows',
            'Team controls',
            'Candidate progress visibility',
            'Organization-level configuration',
        ],
    },
];

export default function Home() {
    const [demoMode, setDemoMode] = useState<DemoMode>('match');

    return (
        <main className="relative min-h-screen overflow-hidden bg-canvas text-text-primary">
            {/* Ambient background */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[900px] overflow-hidden">
                <div className="career-grid absolute inset-0 opacity-[0.48]" />
                <div className="career-orb career-orb-one" />
                <div className="career-orb career-orb-two" />
                <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-b from-transparent to-canvas" />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-border/70 bg-canvas/80 backdrop-blur-xl">
                <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 md:px-8">
                    <Link
                        href="/"
                        className="flex items-center gap-2.5"
                        aria-label="CareerPilot home"
                    >
                        <div className="flex size-8 items-center justify-center rounded-[10px] bg-text-primary text-canvas">
                            <Sparkles size={15} strokeWidth={2} />
                        </div>

                        <span className="text-15 font-semibold tracking-[-0.025em]">
                            CareerPilot
                        </span>
                    </Link>

                    <nav className="hidden items-center gap-7 lg:flex">
                        <a
                            href="#product"
                            className="text-13 text-text-secondary transition hover:text-text-primary"
                        >
                            Product
                        </a>
                        <a
                            href="#workflow"
                            className="text-13 text-text-secondary transition hover:text-text-primary"
                        >
                            How it works
                        </a>
                        <a
                            href="#trust"
                            className="text-13 text-text-secondary transition hover:text-text-primary"
                        >
                            Trust
                        </a>
                        <a
                            href="#pricing"
                            className="text-13 text-text-secondary transition hover:text-text-primary"
                        >
                            Pricing
                        </a>
                    </nav>

                    <div className="flex items-center gap-2">
                        <ThemeToggle />

                        <Link
                            href="/login"
                            className="hidden rounded-[10px] px-3.5 py-2 text-13 font-medium text-text-secondary transition hover:bg-surface-2 hover:text-text-primary sm:block"
                        >
                            Log in
                        </Link>

                        <Link
                            href="/signup"
                            className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-text-primary px-4 text-13 font-medium text-canvas transition duration-200 hover:opacity-90 active:scale-[0.98]"
                        >
                            Get started
                            <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="relative z-10">
                <div className="mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-20 md:px-8 md:pb-28 md:pt-28 lg:grid-cols-12 lg:items-center">
                    <div className="animate-enter lg:col-span-5">
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-canvas/70 px-3 py-1.5 text-12 text-text-secondary shadow-sm backdrop-blur">
                            <span className="relative flex size-2">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-positive opacity-30" />
                                <span className="relative inline-flex size-2 rounded-full bg-positive" />
                            </span>
                            AI career workspace grounded in your real experience
                        </div>

                        <h1 className="max-w-[680px] font-display text-[48px] font-medium leading-[0.98] tracking-[-0.05em] sm:text-[62px] lg:text-[72px]">
                            Your next job,
                            <span className="block text-text-secondary">
                                built from what you&apos;ve actually done.
                            </span>
                        </h1>

                        <p className="mt-7 max-w-xl text-16 leading-7 text-text-secondary md:text-[17px]">
                            Upload your CV, discover relevant jobs locally and abroad,
                            tailor every application, and prepare for the interview — with
                            evidence from your real career attached throughout.
                        </p>

                        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                            <Link
                                href="/onboarding"
                                className="group inline-flex h-12 items-center justify-center gap-2 rounded-[12px] bg-accent px-5 text-14 font-medium text-white shadow-[0_8px_30px_rgba(0,0,0,.12)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(0,0,0,.16)] active:translate-y-0"
                            >
                                Upload your CV
                                <ArrowRight
                                    size={15}
                                    className="transition-transform group-hover:translate-x-0.5"
                                />
                            </Link>

                            <Link
                                href="/dashboard/jobs"
                                className="inline-flex h-12 items-center justify-center gap-2 rounded-[12px] border border-border bg-canvas/70 px-5 text-14 font-medium text-text-primary backdrop-blur transition hover:border-border-strong hover:bg-surface-2"
                            >
                                Explore workspace
                            </Link>
                        </div>

                        <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-12 text-text-secondary">
                            <span className="flex items-center gap-1.5">
                                <CircleCheck size={14} className="text-positive" />
                                No invented experience
                            </span>

                            <span className="flex items-center gap-1.5">
                                <CircleCheck size={14} className="text-positive" />
                                Source-linked claims
                            </span>

                            <span className="flex items-center gap-1.5">
                                <CircleCheck size={14} className="text-positive" />
                                Local + global search
                            </span>
                        </div>
                    </div>

                    {/* Product Preview */}
                    <div className="animate-enter-delay lg:col-span-7">
                        <div className="relative lg:pl-8">
                            <div className="absolute -inset-8 rounded-[40px] bg-accent/5 blur-3xl" />

                            <div className="relative overflow-hidden rounded-[22px] border border-border bg-canvas shadow-[0_30px_100px_rgba(0,0,0,.12)]">
                                {/* browser header */}
                                <div className="flex h-12 items-center border-b border-border bg-surface-2/60 px-4">
                                    <div className="flex gap-1.5">
                                        <span className="size-2.5 rounded-full border border-border-strong bg-canvas" />
                                        <span className="size-2.5 rounded-full border border-border-strong bg-canvas" />
                                        <span className="size-2.5 rounded-full border border-border-strong bg-canvas" />
                                    </div>

                                    <div className="mx-auto rounded-md border border-border bg-canvas px-5 py-1 font-mono text-[10px] text-text-secondary">
                                        app.careerpilot.ai/workspace
                                    </div>

                                    <div className="w-[42px]" />
                                </div>

                                <div className="grid min-h-[520px] md:grid-cols-[180px_1fr]">
                                    {/* app sidebar */}
                                    <aside className="hidden border-r border-border bg-surface-2/35 p-3 md:block">
                                        <div className="px-2 pb-5 pt-2">
                                            <div className="flex items-center gap-2">
                                                <div className="flex size-7 items-center justify-center rounded-lg bg-text-primary text-canvas">
                                                    <Sparkles size={12} />
                                                </div>

                                                <span className="text-12 font-semibold">
                                                    CareerPilot
                                                </span>
                                            </div>
                                        </div>

                                        {[
                                            [Search, 'Discover'],
                                            [Target, 'Matches'],
                                            [FileText, 'Applications'],
                                            [MessageSquare, 'Interview'],
                                            [BarChart3, 'Tracker'],
                                        ].map(([Icon, label], index) => {
                                            const ItemIcon = Icon as typeof Search;

                                            return (
                                                <div
                                                    key={label as string}
                                                    className={`mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11px] ${index === 1
                                                            ? 'bg-text-primary text-canvas'
                                                            : 'text-text-secondary'
                                                        }`}
                                                >
                                                    <ItemIcon size={13} strokeWidth={1.7} />
                                                    {label as string}
                                                </div>
                                            );
                                        })}
                                    </aside>

                                    {/* workspace */}
                                    <div className="min-w-0">
                                        <div className="border-b border-border px-4 py-4 sm:px-6">
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <div className="text-13 font-semibold">
                                                        Senior Frontend Engineer
                                                    </div>

                                                    <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-text-secondary">
                                                        <span className="flex items-center gap-1">
                                                            <Briefcase size={10} />
                                                            Northstar
                                                        </span>

                                                        <span className="flex items-center gap-1">
                                                            <MapPin size={10} />
                                                            Amsterdam
                                                        </span>

                                                        <span>Hybrid</span>
                                                    </div>
                                                </div>

                                                <div className="rounded-full border border-positive/30 bg-positive/10 px-2.5 py-1 font-mono text-[10px] text-positive">
                                                    91% match
                                                </div>
                                            </div>
                                        </div>

                                        {/* preview tabs */}
                                        <div className="flex border-b border-border px-3 sm:px-5">
                                            {[
                                                ['match', 'Match'],
                                                ['apply', 'Apply'],
                                                ['prepare', 'Prepare'],
                                            ].map(([id, label]) => (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => setDemoMode(id as DemoMode)}
                                                    className={`relative px-3 py-3 text-[11px] transition ${demoMode === id
                                                            ? 'text-text-primary'
                                                            : 'text-text-secondary hover:text-text-primary'
                                                        }`}
                                                >
                                                    {label}

                                                    {demoMode === id && (
                                                        <span className="absolute inset-x-2 bottom-0 h-px bg-text-primary" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="p-4 sm:p-6">
                                            {demoMode === 'match' && <MatchPreview />}
                                            {demoMode === 'apply' && <ApplyPreview />}
                                            {demoMode === 'prepare' && <PreparePreview />}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* floating status */}
                            <div className="float-card absolute -bottom-6 -left-3 hidden w-[230px] rounded-[15px] border border-border bg-canvas/95 p-3.5 shadow-xl backdrop-blur sm:block lg:left-0">
                                <div className="flex items-center gap-2">
                                    <div className="flex size-8 items-center justify-center rounded-lg bg-positive/10">
                                        <ShieldCheck size={15} className="text-positive" />
                                    </div>

                                    <div>
                                        <div className="text-[11px] font-medium">
                                            Evidence check passed
                                        </div>
                                        <div className="mt-0.5 text-[10px] text-text-secondary">
                                            8 / 8 claims grounded
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* principle strip */}
            <section className="relative z-10 border-y border-border bg-surface-2/40">
                <div className="mx-auto grid max-w-7xl divide-y divide-border px-5 md:grid-cols-4 md:divide-x md:divide-y-0 md:px-8">
                    {[
                        ['Profile', 'One verified career profile'],
                        ['Jobs', 'Local, abroad, and remote'],
                        ['Applications', 'Tailored to each vacancy'],
                        ['Interview', 'Prepared from real evidence'],
                    ].map(([title, copy]) => (
                        <div key={title} className="py-5 md:px-6 first:md:pl-0">
                            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-secondary">
                                {title}
                            </div>
                            <div className="mt-1.5 text-13 font-medium">{copy}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Product capabilities */}
            <section
                id="product"
                className="relative z-10 mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32"
            >
                <SectionIntro
                    eyebrow="One career operating system"
                    title="From uploaded CV to signed offer."
                    copy="CareerPilot connects the parts of a job search that normally live across job boards, documents, notes, spreadsheets, and interview-prep tools."
                />

                <div className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {capabilities.map(({ icon: Icon, title, copy }, index) => (
                        <div
                            key={title}
                            className="product-card group rounded-[18px] border border-border bg-canvas p-6 transition duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-[0_18px_50px_rgba(0,0,0,.06)]"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex size-10 items-center justify-center rounded-[11px] border border-border bg-surface-2">
                                    <Icon size={17} strokeWidth={1.6} />
                                </div>

                                <span className="font-mono text-[10px] text-text-secondary">
                                    0{index + 1}
                                </span>
                            </div>

                            <h3 className="mt-8 text-17 font-semibold tracking-[-0.02em]">
                                {title}
                            </h3>

                            <p className="mt-3 text-13 leading-6 text-text-secondary">
                                {copy}
                            </p>

                            <div className="mt-7 flex items-center gap-1 text-12 font-medium opacity-0 transition group-hover:opacity-100">
                                Explore
                                <ChevronRight size={13} />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Workflow */}
            <section
                id="workflow"
                className="relative z-10 border-y border-border bg-surface-2/35"
            >
                <div className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
                    <SectionIntro
                        eyebrow="The candidate loop"
                        title="Every step improves the next one."
                        copy="CareerPilot keeps the same career evidence connected from discovery through interview, so you do not start from scratch every time."
                    />

                    <div className="mt-12 overflow-hidden rounded-[20px] border border-border bg-canvas">
                        <div className="grid md:grid-cols-2 lg:grid-cols-3">
                            {journey.map(({ number, title, copy, icon: Icon }, index) => (
                                <div
                                    key={title}
                                    className={`group min-h-[250px] p-6 md:p-7 ${index % 3 !== 2 ? 'lg:border-r lg:border-border' : ''
                                        } ${index < 3 ? 'lg:border-b lg:border-border' : ''} ${index % 2 === 0 ? 'md:border-r md:border-border' : ''
                                        } ${index < 4 ? 'md:border-b md:border-border' : ''}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <span className="font-mono text-[11px] text-text-secondary">
                                            {number}
                                        </span>

                                        <Icon
                                            size={18}
                                            strokeWidth={1.5}
                                            className="text-text-secondary transition duration-300 group-hover:text-text-primary"
                                        />
                                    </div>

                                    <div className="mt-16">
                                        <h3 className="text-17 font-semibold">{title}</h3>
                                        <p className="mt-2 max-w-xs text-13 leading-6 text-text-secondary">
                                            {copy}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Global job intelligence */}
            <section className="relative z-10 mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
                <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
                    <div className="lg:col-span-5">
                        <div className="font-mono text-11 uppercase tracking-[0.08em] text-text-secondary">
                            Opportunity intelligence
                        </div>

                        <h2 className="mt-4 max-w-lg text-36 font-semibold leading-[1.05] tracking-[-0.045em] md:text-44">
                            Search beyond a job title.
                        </h2>

                        <p className="mt-5 max-w-lg text-14 leading-7 text-text-secondary">
                            Recommendations use your experience, education, skills,
                            preferences, and location — not only the keywords written in
                            your current job title.
                        </p>

                        <div className="mt-8 space-y-5">
                            {[
                                [
                                    Globe2,
                                    'Home country + international roles',
                                    'Compare opportunities across locations in one workspace.',
                                ],
                                [
                                    GraduationCap,
                                    'Experience and education aware',
                                    'Match against what employers are actually asking for.',
                                ],
                                [
                                    UserRoundCheck,
                                    'Transparent fit analysis',
                                    'Know why a role matches before spending time applying.',
                                ],
                            ].map(([Icon, title, copy]) => {
                                const RowIcon = Icon as typeof Globe2;

                                return (
                                    <div key={title as string} className="flex gap-3.5">
                                        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2">
                                            <RowIcon size={14} />
                                        </div>

                                        <div>
                                            <div className="text-13 font-medium">
                                                {title as string}
                                            </div>
                                            <p className="mt-1 text-12 leading-5 text-text-secondary">
                                                {copy as string}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="lg:col-span-7">
                        <JobRecommendationPreview />
                    </div>
                </div>
            </section>

            {/* Evidence trust */}
            <section
                id="trust"
                className="relative z-10 border-y border-border bg-text-primary text-canvas"
            >
                <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 md:px-8 md:py-32 lg:grid-cols-12 lg:items-center">
                    <div className="lg:col-span-5">
                        <div className="font-mono text-11 uppercase tracking-[0.08em] text-canvas/55">
                            Grounded generation
                        </div>

                        <h2 className="mt-4 text-36 font-semibold leading-[1.06] tracking-[-0.045em] md:text-44">
                            AI should strengthen your story.
                            <span className="block text-canvas/55">
                                Not manufacture one.
                            </span>
                        </h2>

                        <p className="mt-5 max-w-lg text-14 leading-7 text-canvas/65">
                            CareerPilot retrieves verified facts from your career profile
                            before generating application material, then keeps the
                            references connected to the claims.
                        </p>

                        <div className="mt-8 space-y-3">
                            {[
                                'Retrieve relevant profile evidence',
                                'Generate within verified constraints',
                                'Flag unsupported requirements',
                                'Keep source references attached',
                            ].map((item) => (
                                <div
                                    key={item}
                                    className="flex items-center gap-2.5 text-13 text-canvas/75"
                                >
                                    <Check size={14} />
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-7">
                        <div className="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04] shadow-2xl">
                            <div className="flex h-12 items-center justify-between border-b border-white/10 px-5">
                                <span className="font-mono text-[10px] text-canvas/50">
                                    tailored_resume.md
                                </span>

                                <span className="flex items-center gap-1.5 font-mono text-[10px] text-canvas/50">
                                    <ShieldCheck size={12} />
                                    grounded
                                </span>
                            </div>

                            <div className="p-5 md:p-8">
                                <div className="font-mono text-[10px] text-canvas/40">
                                    GENERATED EXPERIENCE BULLET
                                </div>

                                <p className="mt-5 max-w-2xl text-18 leading-8 text-canvas md:text-20">
                                    Reduced checkout p95 latency by 34% by redesigning the React
                                    data-loading path and introducing targeted cache
                                    invalidation.
                                    <CitationReference number={1} source={source} />
                                </p>

                                <div className="mt-8 rounded-[14px] border border-white/10 bg-black/10 p-4">
                                    <div className="flex items-center gap-2 font-mono text-[10px] text-canvas/50">
                                        <span className="size-1.5 rounded-full bg-positive" />
                                        Source 1 · verified employment evidence
                                    </div>

                                    <p className="mt-3 text-12 leading-6 text-canvas/75">
                                        “Cut checkout p95 from 1.8s to 1.19s after redesigning cache
                                        behavior.”
                                    </p>
                                </div>

                                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-5">
                                    <span className="text-11 text-canvas/45">
                                        Unsupported claims detected
                                    </span>
                                    <span className="font-mono text-11 text-positive">0</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Interview section */}
            <section className="relative z-10 mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
                <div className="grid gap-12 lg:grid-cols-12">
                    <div className="lg:col-span-4">
                        <div className="font-mono text-11 uppercase tracking-[0.08em] text-text-secondary">
                            Interview preparation
                        </div>

                        <h2 className="mt-4 text-36 font-semibold leading-[1.06] tracking-[-0.045em] md:text-44">
                            Walk into the interview with examples ready.
                        </h2>

                        <p className="mt-5 text-14 leading-7 text-text-secondary">
                            Prepare likely questions, STAR stories, role-specific answers,
                            and questions for the interviewer using the same evidence behind
                            your application.
                        </p>

                        <Link
                            href="/dashboard/interview"
                            className="mt-8 inline-flex items-center gap-2 text-13 font-medium"
                        >
                            Open interview coach
                            <ArrowRight size={14} />
                        </Link>
                    </div>

                    <div className="lg:col-span-8">
                        <InterviewPreview />
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section
                id="pricing"
                className="relative z-10 border-y border-border bg-surface-2/35"
            >
                <div className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32">
                    <div className="mx-auto max-w-2xl text-center">
                        <div className="font-mono text-11 uppercase tracking-[0.08em] text-text-secondary">
                            Pricing
                        </div>

                        <h2 className="mt-4 text-36 font-semibold tracking-[-0.04em] md:text-44">
                            Start free. Upgrade when the search gets serious.
                        </h2>

                        <p className="mt-4 text-14 leading-7 text-text-secondary">
                            Your profile stays useful across every job, application, and
                            interview.
                        </p>
                    </div>

                    <div className="mt-12 grid gap-3 lg:grid-cols-3">
                        {plans.map((plan) => (
                            <div
                                key={plan.name}
                                className={`relative rounded-[20px] border p-6 ${plan.featured
                                        ? 'border-text-primary bg-canvas shadow-[0_24px_70px_rgba(0,0,0,.08)]'
                                        : 'border-border bg-canvas'
                                    }`}
                            >
                                {plan.featured && (
                                    <div className="absolute right-4 top-4 rounded-full bg-text-primary px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.07em] text-canvas">
                                        Most popular
                                    </div>
                                )}

                                <h3 className="text-17 font-semibold">{plan.name}</h3>

                                <p className="mt-2 text-12 text-text-secondary">
                                    {plan.description}
                                </p>

                                <div className="mt-7 flex items-end gap-1">
                                    <span className="text-36 font-semibold tracking-[-0.04em]">
                                        {plan.price}
                                    </span>
                                    {plan.suffix && (
                                        <span className="pb-1 text-11 text-text-secondary">
                                            {plan.suffix}
                                        </span>
                                    )}
                                </div>

                                <div className="mt-7 border-t border-border pt-6">
                                    <div className="space-y-3">
                                        {plan.items.map((item) => (
                                            <div
                                                key={item}
                                                className="flex gap-2.5 text-12 text-text-secondary"
                                            >
                                                <Check
                                                    size={14}
                                                    className="mt-0.5 shrink-0 text-positive"
                                                />
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Link
                                    href="/signup"
                                    className={`mt-8 inline-flex h-11 w-full items-center justify-center rounded-[11px] text-13 font-medium transition active:scale-[0.99] ${plan.featured
                                            ? 'bg-text-primary text-canvas hover:opacity-90'
                                            : 'border border-border bg-surface-2 hover:border-border-strong'
                                        }`}
                                >
                                    {plan.name === 'Team'
                                        ? 'Contact us'
                                        : `Choose ${plan.name}`}
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* final CTA */}
            <section className="relative z-10 px-5 py-24 md:px-8 md:py-32">
                <div className="mx-auto max-w-7xl overflow-hidden rounded-[28px] bg-accent px-6 py-16 text-white md:px-12 md:py-20">
                    <div className="relative">
                        <div className="pointer-events-none absolute -right-20 -top-40 size-[400px] rounded-full border border-white/10" />
                        <div className="pointer-events-none absolute -right-5 -top-24 size-[260px] rounded-full border border-white/10" />

                        <div className="relative max-w-2xl">
                            <div className="font-mono text-11 uppercase tracking-[0.08em] text-white/65">
                                Start with your real experience
                            </div>

                            <h2 className="mt-4 text-38 font-semibold leading-[1.04] tracking-[-0.045em] md:text-52">
                                Your CV already contains the beginning of your next move.
                            </h2>

                            <p className="mt-5 max-w-xl text-14 leading-7 text-white/75">
                                Turn it into a structured career profile, discover better-fit
                                roles, and prepare every application from one trusted source.
                            </p>

                            <Link
                                href="/onboarding"
                                className="mt-8 inline-flex h-12 items-center gap-2 rounded-[12px] bg-white px-5 text-14 font-medium text-black transition hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
                            >
                                Upload your CV
                                <ArrowRight size={15} />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-border">
                <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-12 md:px-8">
                    <div className="md:col-span-5">
                        <div className="flex items-center gap-2">
                            <div className="flex size-7 items-center justify-center rounded-lg bg-text-primary text-canvas">
                                <Sparkles size={12} />
                            </div>
                            <span className="text-14 font-semibold">CareerPilot</span>
                        </div>

                        <p className="mt-4 max-w-sm text-12 leading-6 text-text-secondary">
                            Grounded career tools for discovering opportunities, creating
                            stronger applications, and preparing for what comes next.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-8 text-12 md:col-span-7 md:grid-cols-3">
                        <FooterColumn
                            title="Product"
                            items={[
                                ['Job matching', '/dashboard/jobs'],
                                ['Application studio', '/dashboard/documents'],
                                ['Interview coach', '/dashboard/interview'],
                            ]}
                        />

                        <FooterColumn
                            title="Account"
                            items={[
                                ['Create profile', '/signup'],
                                ['Log in', '/login'],
                                ['Workspace', '/dashboard/jobs'],
                            ]}
                        />

                        <FooterColumn
                            title="Company"
                            items={[
                                ['Privacy', '/privacy'],
                                ['Terms', '/terms'],
                                ['Contact', '/contact'],
                            ]}
                        />
                    </div>
                </div>

                <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-border px-5 py-5 text-11 text-text-secondary sm:flex-row sm:items-center sm:justify-between md:px-8">
                    <span>© 2026 CareerPilot.</span>
                    <span>Built around evidence, not invented experience.</span>
                </div>
            </footer>
        </main>
    );
}

function SectionIntro({
    eyebrow,
    title,
    copy,
}: {
    eyebrow: string;
    title: string;
    copy: string;
}) {
    return (
        <div className="max-w-2xl">
            <div className="font-mono text-11 uppercase tracking-[0.08em] text-text-secondary">
                {eyebrow}
            </div>

            <h2 className="mt-4 text-36 font-semibold leading-[1.05] tracking-[-0.045em] md:text-44">
                {title}
            </h2>

            <p className="mt-4 max-w-xl text-14 leading-7 text-text-secondary">
                {copy}
            </p>
        </div>
    );
}

function MatchPreview() {
    return (
        <div className="demo-swap">
            <div className="flex items-end justify-between">
                <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-secondary">
                        Overall fit
                    </div>
                    <div className="mt-1 text-28 font-semibold tracking-[-0.04em]">
                        91%
                    </div>
                </div>

                <span className="text-[10px] text-positive">Strong match</span>
            </div>

            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="match-bar h-full w-[91%] rounded-full bg-positive" />
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {[
                    ['React + TypeScript', 'Matched', true],
                    ['6+ years experience', 'Matched', true],
                    ['GraphQL', 'Transferable', true],
                    ['Dutch language', 'Preferred', false],
                ].map(([name, status, matched]) => (
                    <div
                        key={name as string}
                        className="rounded-[10px] border border-border p-3"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-medium">{name as string}</span>

                            <span
                                className={`size-1.5 shrink-0 rounded-full ${matched ? 'bg-positive' : 'bg-text-secondary/30'
                                    }`}
                            />
                        </div>

                        <div className="mt-2 text-[9px] text-text-secondary">
                            {status as string}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-5 rounded-[11px] bg-surface-2 p-3">
                <div className="text-[10px] font-medium">Why you match</div>
                <p className="mt-1 text-[10px] leading-5 text-text-secondary">
                    Your frontend performance work and React experience directly support
                    two of the role&apos;s highest-priority requirements.
                </p>
            </div>
        </div>
    );
}

function ApplyPreview() {
    return (
        <div className="demo-swap">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-12 font-semibold">Tailored experience</div>
                    <div className="mt-1 text-[10px] text-text-secondary">
                        Senior Frontend Engineer · Northstar
                    </div>
                </div>

                <div className="rounded-full border border-positive/30 bg-positive/10 px-2 py-1 font-mono text-[9px] text-positive">
                    grounded
                </div>
            </div>

            <div className="mt-6 rounded-[12px] border border-border p-4">
                <p className="text-[11px] leading-6">
                    Reduced checkout p95 latency by 34% by redesigning the React
                    data-loading path and targeted cache invalidation.
                    <CitationReference number={1} source={source} />
                </p>
            </div>

            <div className="mt-3 rounded-[12px] border border-border p-4">
                <p className="text-[11px] leading-6">
                    Led frontend delivery across checkout modernization while
                    collaborating with design, product, and platform engineering.
                </p>
            </div>

            <div className="mt-5 flex gap-2">
                <div className="rounded-md bg-surface-2 px-2.5 py-1.5 font-mono text-[9px] text-text-secondary">
                    Resume
                </div>
                <div className="rounded-md bg-surface-2 px-2.5 py-1.5 font-mono text-[9px] text-text-secondary">
                    Cover letter
                </div>
                <div className="rounded-md bg-surface-2 px-2.5 py-1.5 font-mono text-[9px] text-text-secondary">
                    Export
                </div>
            </div>
        </div>
    );
}

function PreparePreview() {
    return (
        <div className="demo-swap">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-12 font-semibold">Interview preparation</div>
                    <div className="mt-1 text-[10px] text-text-secondary">
                        Generated from role + profile
                    </div>
                </div>

                <MessageSquare size={15} className="text-text-secondary" />
            </div>

            <div className="mt-5 space-y-2">
                {[
                    'Tell me about a frontend performance problem you solved.',
                    'How do you decide when client-side caching is appropriate?',
                    'Describe a disagreement with product or design and how you handled it.',
                ].map((question, index) => (
                    <div
                        key={question}
                        className="group flex items-start gap-3 rounded-[11px] border border-border p-3 transition hover:bg-surface-2"
                    >
                        <span className="mt-0.5 font-mono text-[9px] text-text-secondary">
                            0{index + 1}
                        </span>

                        <span className="flex-1 text-[10px] leading-5">{question}</span>

                        <ChevronRight
                            size={12}
                            className="mt-1 text-text-secondary opacity-0 transition group-hover:opacity-100"
                        />
                    </div>
                ))}
            </div>

            <div className="mt-4 flex items-center gap-2 text-[10px] text-text-secondary">
                <ShieldCheck size={12} className="text-positive" />
                Suggested answers use verified profile evidence.
            </div>
        </div>
    );
}

function JobRecommendationPreview() {
    const jobs = [
        {
            role: 'Senior Frontend Engineer',
            company: 'Northstar',
            location: 'Amsterdam, Netherlands',
            type: 'Hybrid',
            match: '91%',
        },
        {
            role: 'Product Engineer',
            company: 'Orbit',
            location: 'London, United Kingdom',
            type: 'Visa support',
            match: '87%',
        },
        {
            role: 'Frontend Platform Engineer',
            company: 'Mono',
            location: 'Remote · Europe',
            type: 'Remote',
            match: '84%',
        },
    ];

    return (
        <div className="overflow-hidden rounded-[20px] border border-border bg-canvas shadow-[0_24px_80px_rgba(0,0,0,.06)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                    <div className="text-12 font-semibold">Recommended for you</div>
                    <div className="mt-1 text-[10px] text-text-secondary">
                        Based on experience, education, skills, and preferences
                    </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[9px] text-text-secondary">
                    <Globe2 size={10} />
                    Worldwide
                </div>
            </div>

            <div className="divide-y divide-border">
                {jobs.map((job, index) => (
                    <div
                        key={job.company}
                        className="group p-5 transition hover:bg-surface-2/60"
                    >
                        <div className="flex items-start gap-4">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] border border-border bg-surface-2 text-12 font-semibold">
                                {job.company.slice(0, 1)}
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-13 font-semibold">{job.role}</h3>
                                        <p className="mt-1 text-[10px] text-text-secondary">
                                            {job.company}
                                        </p>
                                    </div>

                                    <div className="font-mono text-11 text-positive">
                                        {job.match}
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] text-text-secondary">
                                    <span className="flex items-center gap-1">
                                        <MapPin size={10} />
                                        {job.location}
                                    </span>
                                    <span>{job.type}</span>
                                </div>

                                {index === 0 && (
                                    <div className="mt-4 flex gap-1.5">
                                        {['React', 'TypeScript', 'Performance'].map((skill) => (
                                            <span
                                                key={skill}
                                                className="rounded-md bg-positive/10 px-2 py-1 text-[9px] text-positive"
                                            >
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="border-t border-border px-5 py-4">
                <Link
                    href="/dashboard/jobs"
                    className="flex items-center justify-between text-11 font-medium"
                >
                    View all recommendations
                    <ArrowRight size={13} />
                </Link>
            </div>
        </div>
    );
}

function InterviewPreview() {
    return (
        <div className="overflow-hidden rounded-[20px] border border-border bg-canvas shadow-[0_24px_80px_rgba(0,0,0,.05)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                    <div className="text-12 font-semibold">Mock interview</div>
                    <div className="mt-1 text-[10px] text-text-secondary">
                        Senior Frontend Engineer
                    </div>
                </div>

                <div className="rounded-full border border-border px-2.5 py-1 font-mono text-[9px] text-text-secondary">
                    Question 03 / 08
                </div>
            </div>

            <div className="p-5 md:p-7">
                <div className="font-mono text-[9px] uppercase tracking-[0.07em] text-text-secondary">
                    Behavioral · performance
                </div>

                <h3 className="mt-4 max-w-2xl text-20 font-medium leading-8 tracking-[-0.02em]">
                    Tell me about a time you improved the performance of a customer-facing
                    product.
                </h3>

                <div className="mt-7 rounded-[14px] border border-border bg-surface-2/45 p-4">
                    <div className="text-[10px] font-medium">Evidence you can use</div>

                    <p className="mt-2 text-11 leading-6 text-text-secondary">
                        Clearline checkout performance project · p95 reduced from 1.8s to
                        1.19s · cache behavior redesign
                    </p>

                    <div className="mt-3 inline-flex items-center gap-1.5 text-[9px] text-positive">
                        <ShieldCheck size={11} />
                        Verified employment evidence
                    </div>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-4">
                    {[
                        ['Situation', 'Checkout latency'],
                        ['Task', 'Improve p95'],
                        ['Action', 'Cache redesign'],
                        ['Result', '34% faster'],
                    ].map(([label, value]) => (
                        <div
                            key={label}
                            className="rounded-[10px] border border-border p-3"
                        >
                            <div className="font-mono text-[8px] uppercase tracking-[0.06em] text-text-secondary">
                                {label}
                            </div>
                            <div className="mt-2 text-[10px] font-medium">{value}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function FooterColumn({
    title,
    items,
}: {
    title: string;
    items: [string, string][];
}) {
    return (
        <div>
            <div className="font-medium text-text-primary">{title}</div>

            <div className="mt-4 space-y-3">
                {items.map(([label, href]) => (
                    <div key={label}>
                        <Link
                            href={href}
                            className="text-text-secondary transition hover:text-text-primary"
                        >
                            {label}
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
}