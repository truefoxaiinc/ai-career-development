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

## Run with Docker and OpenAI

Docker Compose starts the Next.js frontend, FastAPI API, PostgreSQL with pgvector, and Redis. The API uses OpenAI through the OpenAI-compatible gateway settings in `.env.docker`.

```bash
copy .env.docker.example .env.docker
# Edit .env.docker and set LITELLM_API_KEY to your OpenAI API key.
docker compose --env-file .env.docker up --build
```

Open `http://localhost:3000`. The API is available at `http://localhost:8000/docs`.

To stop the stack while keeping downloaded data:

```bash
docker compose --env-file .env.docker down
```

## Production Docker deployment

The production stack is separate from local development and requires real secrets, a public frontend/API URL, SMTP, and OpenAI configuration. It includes PostgreSQL with pgvector, Redis with persistence, MinIO S3-compatible object storage, the API, a database-backed worker, and the Next.js frontend. Put the production file in a secret-managed deployment environment; do not commit it.

```bash
copy .env.production.example .env.production
# Edit .env.production with production URLs, secrets, SMTP, and OpenAI settings.
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

Check the deployment:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs -f api worker
```

Terminate it without deleting persistent volumes:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml down
```

## Scope deliberately excluded

Recruiter marketplace, referral agent screens, and voice/video interview UI.
