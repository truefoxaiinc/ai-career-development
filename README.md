# CareerPilot Frontend v2

Product-grade Next.js 15 frontend built from `CareerPilot_Frontend_Design_v2.md`.

## What changed from v1

The decorative verification stamp / compass language is removed. Trust is now communicated through **inline numbered citation references** that open source-fact popovers. Navigation adds a keyboard-first **Cmd/Ctrl+K command palette**. The authenticated UI is dark-first, dense, border-led, and uses one restrained indigo accent.

## Routes

- `/` — dark marketing home, one Instrument Serif hero moment, live citation example, seven-stage journey, grounded-claim editor panel, plan comparison
- `/login`, `/signup` — minimal auth
- `/onboarding` — four-step wizard with slim progress bar and explicit extracted-data confirmation
- `/dashboard/profile` — sectioned evidence profile, verified skill dots, raw vs AI-enhanced achievements
- `/dashboard/jobs` — JD analysis, radial match score, strong/partial/missing breakdown, before/after resume score, inline source citations, unresolved-claim export gate
- `/dashboard/applications` — dense table by default, kanban toggle, 9-stage pipeline, explicit popover confirmation before `Applied`
- `/dashboard/interview-prep` — categorized accordion and saved answers, later-phase live mock placeholder
- `/dashboard/settings` — usage bars and factual three-column plan comparison

## Architecture

- Next.js 15 App Router + strict TypeScript
- Tailwind with the supplied v2 tokens centralized in `app/globals.css` and exposed in `tailwind.config.ts`
- TanStack Query with resource hooks in `hooks/`
- Framer Motion for spring micro-interactions, citation/command-palette transitions, onboarding transition, and the before/after radial score moment
- Lucide icons only, 1.5px stroke where icons are informational
- Custom SVG radial score (no chart library defaults)
- Mock fixtures in `lib/fixtures.ts`; replace each hook's fixture return with the eventual API call

## Run

```bash
npm install
npm run dev
```

Production checks:

```bash
npm run typecheck
npm run build
```

## Scope deliberately excluded

Recruiter marketplace, referral agent screens, and voice/video interview UI.
