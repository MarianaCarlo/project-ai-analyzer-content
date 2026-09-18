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

_(Filled in as each piece comes online — see Progress Log.)_

## Architecture Decisions

_(Progressively filled in — see Progress Log for the running rationale; this section will summarize the final state.)_

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
