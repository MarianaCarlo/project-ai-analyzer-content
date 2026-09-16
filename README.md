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

### Day 1 — Setup + first Express server
**Done:**
- Node.js, Docker, and Git installed and verified
- Project folder structure created (`backend/`, `frontend/`)
- npm dependencies installed (Express, Postgres driver, JWT, bcrypt, Anthropic SDK, security middleware)
- Express server running on `localhost:3000`
- Security middleware active: `helmet`, `cors` (locked to the Vite dev origin), `express-rate-limit` (100 req/15min on `/api/`, sized to protect AI endpoint costs)
- `/api/health` endpoint working, plus generic 404 and error handlers

**Decisions:**
- Picked PostgreSQL over MongoDB/DynamoDB — see Tech Stack table above.
- Rate limiting was added at the server level from day one, even before the AI endpoint exists, since AI calls are the main cost driver to protect.

**Remaining for Day 1:**
- Run PostgreSQL via Docker
- Connect the database to Express
- Initialize git and push the first commit to GitHub
