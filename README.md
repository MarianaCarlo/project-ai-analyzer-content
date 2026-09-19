# Smart Content Summarizer & Classifier

An AI-assisted full-stack app where users submit text content and receive an
AI-generated summary and classification. Built as part of a Full Stack AI
Engineer take-home assessment.

## Chosen Use Case

**AI assistant that summarizes and classifies user input.**

All three example use cases from the brief were considered:

- ❌ **Document Q&A upload** — rejected: file upload/parsing/chunking adds
  significant complexity that would eat into the time available for the AI
  layer itself, which is the part actually being evaluated.
- ❌ **Structured data extraction from free text** — rejected: doubles the
  difficulty, since both the input (unpredictable free text) and the output
  (a fixed schema) are hard problems to get right at once.
- ✅ **Summarize + classify** — smallest surface area while still exercising
  every required piece: an AI endpoint, structured output, auth, and
  persistence.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Node.js + Express | Explicitly "preferred" per the assessment brief; same language as my Angular/JS background so momentum is high; no annotation-based magic to learn — mental model: *Express is Spring Boot without the magic*. |
| Database | PostgreSQL (via Docker locally) | Simpler local setup than DynamoDB, SQL knowledge transfers directly from my SQL Server experience, no AWS credentials needed to develop. In production, would likely migrate to DynamoDB or RDS depending on actual scaling requirements. |
| AI Provider | Anthropic API, direct call | Simpler for this challenge than going through AWS Bedrock. Exact model (e.g. Haiku vs Sonnet) is picked on Day 3 based on a cost/quality trade-off. The provider is abstracted behind an interface (see Architecture Decisions) so switching to Bedrock later would be a config change, not a rewrite. |
| Auth | JWT + bcrypt | A small middleware function is enough at this scale — no need for Spring-Security-level complexity. |
| Frontend | React + Vite | Scheduled for Day 4. |
| Infra | Docker (Postgres locally, backend container later) | README documents the target AWS deployment approach rather than deploying live, given the time budget. |

## Time Budget

~2 hours/day × 7 days ≈ 14 hours total, aligned with the assessment's 1-week window.

## Getting Started

### Prerequisites
- Node.js 20+
- Docker Desktop
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

### 1. Clone and install dependencies
```
git clone <repo-url>
cd proyect-ai-analyzer-content
npm install
cd frontend && npm install && cd ..
```

### 2. Configure environment variables
Create `backend/.env` with:
```
PORT=3000
JWT_SECRET=<a random string>
ANTHROPIC_API_KEY=<your key>
DB_HOST=localhost
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=admin123
DB_NAME=smart_summarizer
LLM_PROVIDER=mock
```
(`LLM_PROVIDER=mock` avoids any API cost during setup; switch to `anthropic` once you're ready to test real AI calls.)

### 3. Start Postgres
```
docker compose up -d postgres
```

### 4. Run the database migrations
```
node backend/src/db/migrate.js
```

### 5. Start the backend
```
npm run dev
```
Runs on `http://localhost:3000`. (Alternatively, run `docker compose up -d --build` instead of steps 3 and 5 together, to run the backend containerized too — see the Day 5 log for details on that option.)

### 6. Start the frontend
```
cd frontend
npm run dev
```
Runs on `http://localhost:5173`.

### 7. Create an account and try it
There's no register page in the UI (see Day 4 decisions) — create a test account directly:
```
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234"}'
```
Then open `http://localhost:5173`, log in with those credentials, and submit some text to summarize.

## Architecture Decisions

**System overview:**
```
React (Vite) SPA  →  Express REST API  →  PostgreSQL (persistence)
                              ↓
                        AI Layer (provider-abstracted)  →  Anthropic API (Claude Haiku)
```
JWT-based auth protects every route except `/api/health`, `/api/auth/register`, and `/api/auth/login`.

**Backend structure:**
```
backend/src/
  routes/          → HTTP endpoints, validation only
  controllers/     → request orchestration
  middleware/      → JWT auth, rate limiting, security headers
  db/              → connection pool + versioned schema migrations
  services/ai/     → the AI layer, isolated by concern:
    prompts/            → versioned prompt templates
    promptBuilder.js    → prompt construction
    modelInvoker.js     → model invocation, provider-agnostic
    providers/           → anthropicProvider.js (real) / mockProvider.js (free/instant)
    responseProcessor.js → response validation/post-processing
```
This structure directly satisfies the assessment's requirement for "clear separation between prompt construction / model invocation / response post-processing," and the provider abstraction satisfies "ability to switch LLM providers."

**Key decisions** (condensed from the day-by-day log below — see that log for full reasoning and order):
- PostgreSQL over MongoDB/DynamoDB for local development — relational data (users, summaries, audit metadata) benefits from schema constraints; SQL experience transfers directly.
- Node.js/Express over Spring Boot — explicitly preferred by the assessment brief, and matches existing JavaScript experience.
- JWT auth with bcrypt-hashed passwords, 1-hour token expiry, no refresh-token flow (a deliberate scope trade-off).
- Claude Haiku via direct Anthropic API (not Bedrock) — cheapest model adequate for summarize+classify, chosen explicitly for cost control.
- Structured output via Anthropic tool-calling rather than free-text parsing — improves reliability and doubles as a second layer of prompt-injection defense.
- Defense-in-depth against prompt injection: delimited user input + explicit system instructions (layer 1), schema-constrained output (layer 2).
- Client-side route protection (React) is UX only — all real authorization is enforced server-side, since client-side code can never be trusted.
- Backend containerized with Docker; frontend intentionally left un-containerized (explicitly optional per the assessment brief).

## Data Flow & Storage

**What we store:**
- User accounts — email and a bcrypt password hash (never the plaintext password)
- Summaries — the original `input_text`, the AI-generated summary, the classification (category + confidence, as JSON), and audit metadata (`prompt_version`, `model`, `tokens_used`, `created_at`), tied to the user who created it

**What we don't store:**
- Plaintext passwords — only bcrypt hashes ever touch the database
- API keys in the database — the Anthropic key lives only in environment configuration (`.env` locally; Secrets Manager in the AWS plan below), never in application data
- Full request/response logs at rest — error logs capture stack traces on failure, but prompt/response bodies are never written to logs

**Retention:**
- This prototype has no automatic expiration — summaries persist indefinitely. For production, a real retention policy (e.g., purge or anonymize summaries older than 90 days) and a user-triggered deletion endpoint (a "right to erasure" control) would be added — named here as a known limitation rather than silently skipped.

**PII:**
- Since users can paste arbitrary text, submitted content may contain PII, and this prototype does not detect or redact it before storage. For production: redact common PII patterns before persisting/logging, and/or encrypt the `input_text` column at rest (e.g., Postgres `pgcrypto`, or AWS KMS in the DynamoDB plan below).

**Logging:**
- Errors are logged with stack traces on failure, but full request bodies and AI responses are never logged at the info level — deliberately, to avoid accidentally persisting sensitive user content in log files. No centralized logging pipeline (e.g., CloudWatch) was built for this prototype.

**Auditability:**
- Every summary row records exactly which `prompt_version` and `model` produced it, plus token usage — so any past result is traceable to the exact configuration that generated it, supporting reproducibility and "why did the AI say this" debugging.

**Bonus sections (vector store / RAG):** intentionally not built — the chosen use case (summarize + classify a single submission) doesn't involve retrieval over a document corpus, so this was a deliberately declined bonus rather than a gap, in favor of spending the time budget on the required core pieces instead.

## AI Evaluation & Reliability

**Measuring output quality:** build a small "golden set" of 15–20 representative sample inputs spanning each category, with a manually-agreed expected summary/classification for each. Re-run this set (manually, or via an LLM-as-judge approach — having Claude score a candidate output against the expected one on a rubric of accuracy, conciseness, and correct category) whenever the prompt or model changes, rather than relying on informal spot-checks.

**Detecting regressions after a prompt/model change:** every prompt is versioned (`prompts/summarize.v1.js`, `v2`, etc.), and every stored summary records exactly which `prompt_version` and `model` produced it. A new prompt version would be run against the golden set *before* being promoted, and its scores compared directly against the previous version's — a regression shows up as a measurable score drop, not something discovered later from a user complaint.

**Handling "AI gives a wrong answer" in production:**
- The disclaimer already built into the Input page ("AI-generated — verify important details") sets honest expectations rather than implying certainty.
- `responseProcessor.js`'s schema validation with a labeled fallback (see Day 3) prevents obviously malformed output from ever being silently presented as normal.
- A feedback control (thumbs up/down or "report incorrect") isn't built in this prototype — named here as a clear next step — but the `prompt_version`/`model` recorded on every row already means any reported bad output can be traced back to exactly which configuration produced it, rather than being an unexplainable one-off.

## Cloud & Runtime (AWS Plan)

Given the 1-week assessment timeframe, this section documents an infrastructure **plan**, written as real Terraform (see `terraform/main.tf`), rather than a live deployment — a deliberate choice given the assessment's explicit "mock if preferred" allowance, and given that real deployment/debugging time and small ongoing AWS costs weren't justified for a demo of this scope.

**Target architecture:**
```
API Gateway → Lambda (Express app via a Lambda adapter) → DynamoDB (users, summaries)
                                    ↓
                          Secrets Manager (Anthropic API key, JWT secret)
```

**Where AI API keys live:** in AWS Secrets Manager, fetched by the Lambda function at runtime rather than set as a plain Lambda environment variable. Environment variables are visible to anyone with read access to the Lambda's configuration in the AWS console; Secrets Manager adds access control and audit logging (via CloudTrail) on top.

**How we'd rotate them:** Secrets Manager supports scheduled automatic rotation via a rotation Lambda for AWS-native credentials (e.g., RDS passwords). Anthropic keys have no native AWS rotation integration, so rotation would be a manual/periodic process: generate a new key in the Anthropic console, update the secret's value — any Lambda invocation after that automatically picks up the new value on its next fetch, with no redeployment needed, since the key is never baked into deployed code.

**How we'd scale under bursty AI usage:** Lambda scales horizontally per-request automatically — a burst of 100 simultaneous requests spins up (up to account/region limits) 100 parallel executions rather than queueing behind a fixed pool of servers, a natural fit for unpredictable AI traffic. The real constraint to manage is Lambda's account-level concurrency limit and Anthropic's own API rate limits — a request queue (e.g., SQS) in front of Lambda would be added if traffic ever approached either limit, to smooth bursts rather than drop requests.

## Progress Log

### Day 1 — Setup + first Express server ✅ 100%
**Done:**
- Node.js, Docker, and Git installed and verified
- Project folder structure created (`backend/`, `frontend/`)
- npm dependencies installed (Express, Postgres driver, JWT, bcrypt, Anthropic SDK, security middleware)
- Express server running on `localhost:3000`
- Security middleware active: `helmet`, `cors` (locked to the Vite dev origin), `express-rate-limit` (100 req/15min on `/api/`, sized to protect AI endpoint costs)
- `/api/health` endpoint working, plus generic 404 and error handlers
- PostgreSQL running via Docker (`smart_summarizer_db` container)
- Express connected to Postgres via a `pg` connection pool (`backend/src/db/pool.js`); `/api/health` now reports live DB connectivity
- Git repo initialized, first commit pushed to GitHub

**Decisions:**
- Picked PostgreSQL over MongoDB/DynamoDB — see Tech Stack table above.
- Rate limiting was added at the server level from day one, even before the AI endpoint exists, since AI calls are the main cost driver to protect.
- Used a `pg.Pool` rather than opening ad-hoc connections, so connections are reused across requests instead of recreated each time.

**Lesson learned:**
- `dotenv`'s `path` option resolves relative to the process's *current working directory*, not the file calling it. A relative path (`'../.env'`) silently failed to load env vars when run from the project root, causing the DB pool to connect with no credentials. Fixed by anchoring the path to the file itself: `path.join(__dirname, '../.env')`.

### Day 2 — Backend: auth + database + routes ✅ 100%
**Done:**
- PostgreSQL tables created via per-table migration files (`create_users.sql`, `create_summaries.sql`) applied through `migrate.js`
- JWT auth: `POST /api/auth/register` (bcrypt-hashed passwords) and `POST /api/auth/login` (issues a signed JWT)
- Auth middleware (`backend/src/middleware/auth.js`) verifying Bearer tokens and protecting routes
- Summary routes wired: `POST /api/summaries` and `GET /api/summaries` (both protected), storing/listing rows — actual AI generation is deferred to Day 3
- Verified the full flow with Postman: register → duplicate check (409) → login → protected route rejected without a token (401) → accepted with a valid token (201/200)
- Set up DBeaver to visually inspect Postgres tables during development

**Decisions:**
- Split the schema into per-table SQL files instead of one big `schema.sql`, with explicit file ordering in `migrate.js` (users before summaries) rather than relying on filesystem/alphabetical order, since `summaries` has a foreign key dependency on `users`.
- Login returns the same generic `"Invalid credentials"` message whether the email doesn't exist or the password is wrong, to avoid leaking which emails are registered (user enumeration).
- JWTs expire after 1 hour with no refresh-token flow — a deliberate scope trade-off for this timeframe, noted here as a known limitation rather than silently skipped.

### Day 3 — AI layer: Anthropic integration ✅ 100%
**Done:**
- Versioned prompt template (`prompts/summarize.v1.js`) defining the system prompt, model, and max tokens
- PromptBuilder wraps user input in `<user_content>` delimiters as a first-layer prompt-injection defense
- Provider abstraction (`modelInvoker.js`) with swappable providers — `anthropicProvider.js` (real Claude Haiku call via tool-calling) and `mockProvider.js` (free, instant, for dev/testing) — switched via the `LLM_PROVIDER` env var
- Structured output enforced via Anthropic tool-calling, forcing the model to return `summary`/`category`/`confidence` in a fixed schema — this also acts as a second layer of injection defense, since the output can't deviate into arbitrary free-form behavior
- ResponseProcessor validates/cleans the model's output, clamping confidence to [0,1] and falling back to a safe default if the schema is ever violated
- Wired into `POST /api/summaries`: the full pipeline (buildPrompt → modelInvoker → processResponse → DB save) now runs live
- Verified end-to-end with both the mock provider (free/instant) and the real Anthropic API (real Claude Haiku call, correct summary + classification returned)

**Decisions:**
- Chose Claude Haiku over Sonnet/Opus for this task — cost-conscious model selection matched to task complexity, since summarize+classify doesn't need heavier reasoning.
- Combined the "provider abstraction" and "structured output" steps into one implementation, since tool-calling schemas are inherently provider-specific request details.
- Prompt-injection defense is layered rather than relying on one trick: delimited input + explicit system instructions (layer 1), plus schema-constrained output via tool-calling (layer 2).

**Lesson learned:**
- `nodemon` does not watch `.env` files by default (only `.js`/`.json`), so changing an environment variable requires manually restarting the dev server — a silent gotcha that can make it look like a config change "didn't work."

### Day 4 — Frontend: React app ✅ 100%
**Done:**
- Scaffolded a React app with Vite (JavaScript, ESLint)
- `react-router-dom` for client-side routing across 3 pages: Login, Input, Results
- Axios client (`api/client.js`) with a request interceptor that automatically attaches the JWT to every call
- `LoginPage`: authenticates against `POST /api/auth/login`, stores the token in `localStorage`
- `InputPage`: submits text to `POST /api/summaries`, displays the AI result, with loading/error states, an "AI-generated — verify" disclaimer, and a "Summarize another" re-ask action
- `ResultsPage`: fetches `GET /api/summaries`, with loading/error/empty states, listing all past summaries newest-first
- `ProtectedRoute` wrapper redirects unauthenticated users to `/login` — a UX convenience only; real security enforcement remains server-side via the Day 2 auth middleware
- Verified the full flow end-to-end in the browser: login → submit → real AI-generated summary → visible in the Results list, tested against both the mock and real Anthropic providers

**Decisions:**
- No dedicated register page in the UI — the existing `POST /api/auth/register` endpoint was used directly via Postman to create the test account, a deliberate scope simplification given the time budget.
- Auth state kept minimal: a single JWT in `localStorage`, rather than a full state-management library — appropriate for an app this size with only 3 pages.
- Styling kept close to default — the assessment explicitly states design quality is secondary to usability and clarity, so time was spent on functionality (loading/error/empty states, AI-aware UX) rather than visual polish.

### Day 5 — Connect everything + Docker ✅ 100%
**Done:**
- Dockerized the backend (`backend/Dockerfile`) — Node 20 Alpine image, dependencies installed in a cached layer before copying app code
- Added a `.dockerignore` to prevent baking `backend/.env` (and `node_modules`, `frontend`, `.git`) into the image — secrets are injected at container runtime via `docker-compose`'s `env_file`, never baked into image layers
- Extended `docker-compose.yml` with a `backend` service, building from the new Dockerfile and depending on `postgres`
- Fixed Docker networking: overrode `DB_HOST` to `postgres` (the service name) specifically for the containerized backend, since `localhost` means something different inside a container than on the host machine
- Verified the full stack running via `docker compose up -d --build`: health check reports `db: connected`, and the complete login → summarize → results flow works identically through both the React frontend and Postman — confirming the backend's containerization is fully transparent to any client reaching it via the host's port mapping

**Decisions:**
- Removed the obsolete `version: '3.8'` line from `docker-compose.yml` while editing it (flagged back on Day 1, addressed now)
- `depends_on: postgres` only guarantees container *start order*, not that Postgres is actually *ready* to accept connections — a known limitation; a production setup would add a proper health check instead
- The frontend was intentionally left un-Dockerized, per the assessment's explicit "frontend optional" allowance for containerization, prioritizing time on the backend + AI layer instead

### Day 6 — README + architecture decisions ✅ 100%
**Done:**
- Consolidated the "Architecture Decisions" section into a coherent system-level summary (previously just a placeholder pointing at this log)
- Wrote "Data Flow & Storage" (assessment Part 2.1): what's stored/not stored, retention, PII, logging, auditability
- Wrote "AI Evaluation & Reliability" (Part 2.2): quality measurement via a golden set, regression detection via prompt versioning, handling wrong answers in production
- Wrote "Cloud & Runtime" (Part 3.1) plus a full `terraform/main.tf` documenting a target AWS deployment (API Gateway + Lambda + DynamoDB + Secrets Manager) — written as infrastructure-as-code but not applied against a real account, per the assessment's explicit "mock if preferred" allowance
- Completed "Getting Started" with real, step-by-step local setup instructions (previously a placeholder)

**Decisions:**
- Pivoted the AWS target architecture from an initially-proposed ECS/RDS/ALB setup to a serverless Lambda/API Gateway/DynamoDB one, specifically to align with real hands-on AWS experience (Lambda, API Gateway, DynamoDB, S3) rather than services used for the first time in this project — a deliberate choice to demonstrate genuine familiarity rather than unfamiliar textbook services.
- Chose not to deploy real AWS infrastructure given the remaining time budget and the assessment's explicit permission to mock this section; the Terraform file stands as a concrete, reviewable plan instead.
- DynamoDB (rather than RDS/Postgres) was chosen specifically for the AWS target, since it's one of the three explicitly-approved database options in the assessment brief and pairs naturally with Lambda's pay-per-use billing model.
