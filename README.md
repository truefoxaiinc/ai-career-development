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

The production stack is separate from local development and requires real secrets, public frontend/API URLs, SMTP, AI-provider configuration, AWS RDS for PostgreSQL, and an externally managed S3-compatible bucket. It includes authenticated Redis with persistence, the API, a database-backed worker, and the Next.js frontend. Put the production environment file in a secret-managed deployment environment; do not commit it.

```bash
copy .env.production.example .env.production
# Edit .env.production with production URLs, secrets, SMTP, and OpenAI settings.
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

The frontend and API bind to loopback only. Terminate TLS with a host reverse proxy or load balancer and forward traffic to `127.0.0.1:3000` and `127.0.0.1:8000`. The database and Redis are isolated on an internal Docker network and are not published to the host.

Before the first deployment, create the S3 bucket, grant its application identity access only to that bucket, enable bucket encryption/versioning, and configure lifecycle retention. Back up PostgreSQL and test restoration regularly; Docker volumes are persistent storage, not backups.

For RDS, use PostgreSQL with the `vector` extension available and set these values in `.env.production`:

```dotenv
RDS_HOST=INSTANCE.REGION.rds.amazonaws.com
RDS_PORT=5432
RDS_DB_NAME=careerpilot
RDS_USERNAME=careerpilot
RDS_PASSWORD=your-rotated-password
RDS_SSLMODE=require
```

The application constructs the SQLAlchemy connection URL safely, so the password may contain special characters. Keep the RDS instance private where possible, allow port `5432` only from the application host or its security group, require TLS, and never put real credentials in an example file. The API runs Alembic migrations on startup, including `CREATE EXTENSION IF NOT EXISTS vector`, so the database user needs permission to install that RDS-supported extension during the first deployment.

Check the deployment:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs -f api worker
```

Terminate it without deleting persistent volumes:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml down
```

## AI Resume Studio

Authenticated candidates can open `/dashboard/resume-studio` to upload versioned PDF/DOCX resumes, review unverified extracted facts, request grounded AI suggestions, target a saved or pasted job, generate resume and cover-letter drafts, choose an ATS/Modern/Minimal/Professional template, approve claim-safe versions, and export PDF or DOCX.

Uploads are content-validated and stored under private per-candidate object keys. `UPLOAD_MAX_BYTES` controls the upload limit. Production uses the configured private S3/MinIO bucket; storage keys are never returned by the API. Extraction, suggestions, and generation use the existing task worker. Database workers claim PostgreSQL tasks with `FOR UPDATE SKIP LOCKED`.

Apply database migrations before deploying a separately managed API process:

```bash
cd backend
alembic upgrade head
```

The backend Docker image performs this migration automatically before starting the API. Configure AI access with `LITELLM_BASE_URL`, `LITELLM_API_KEY`, and `LITELLM_MODEL`. Direct OpenAI access uses `https://api.openai.com/v1`; keys remain backend-only. `LLM_TIMEOUT_SECONDS`, `LLM_MAX_OUTPUT_TOKENS`, `LLM_RETRY_ATTEMPTS`, and `LLM_MAX_COST_USD_PER_REQUEST` bound calls.

Verification commands:

```bash
cd backend && python -m pytest -q
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Scope deliberately excluded

Recruiter marketplace, referral agent screens, and voice/video interview UI.
