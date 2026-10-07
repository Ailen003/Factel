# Conversation Processing Demo

A bilingual web application for reviewing recorded business conversations and
turning them into clients and service requests through explicit confirmation.
Users also manage those records through ordinary forms; a workspace-scoped AI
assistant uses the same governed creation service.

## Current state

The application includes a product-specific bilingual landing experience,
Better Auth email/password sessions, role-protected dashboard and user
administration routes, Prisma-backed trial-account administration, and
workspace-isolated client, service-request and conversation modules. Clients support search,
pagination, details, governed creation, editing and restricted deletion;
requests support filtered listing, details, governed manual creation, editing,
priority and status management, same-workspace reassignment and confirmed
deletion. The dashboard now reads each signed-in workspace's real client and
service-request totals, request status distribution and recently updated
requests. Conversations support server-rendered, workspace-scoped listing and
details plus consent-gated browser microphone capture, verified private
prepared-audio upload, playback and recoverable deletion. The current
transcription increment adds atomic credit initialization/reservation, durable
outbox-backed processing, AssemblyAI transcription/diarization, persisted original evidence,
bilingual progress and the nonterminal `TRANSCRIBED` boundary. Closed Groq
extraction now publishes an evidence-validated proposal and consumes its reserved
credit atomically. The detail modal supports authored revision history, explicit
draft saving and human readiness, contact duplicate decisions, exact batch
preview and confirmed atomic creation of one client and all reviewed requests.
Before completion, users can generate another extraction, compare its separate
candidate with their saved corrections, and explicitly adopt fields/requests or
keep the previous revision. Starting invalidates readiness and prepared previews.

The intended architecture is one Next.js application on Vercel, using Better
Auth, Neon/PostgreSQL, Prisma, private S3-compatible object storage, Vercel
Workflow, AssemblyAI, and AI SDK/Groq. Authentication, its PostgreSQL
persistence, browser microphone capture, the private conversation-media
boundary, Vercel Workflow orchestration, and the AssemblyAI speech adapter are
implemented, together with closed structured extraction. The agentic assistant
and conversational record creation remain future work.

Start with the [product definition](docs/product-source-of-truth.md),
[architecture](docs/solution-architecture.md), [data model](docs/data-model.md),
and [prioritized requirements](docs/requirements/index.md). The baseline covers
administrator-created trial accounts; public registration is deferred.

## Setup

Requires Node.js 20.19+ and pnpm 10.30.2.

```bash
pnpm install
pnpm db:generate
pnpm db:migrate:dev
pnpm dev
```

Copy `.env.example` to `.env` first and configure `DATABASE_URL`,
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and the explicit trusted origins. Review
the development migration before applying it. Bootstrap the first administrator
with the Better Auth CLI after making that CLI available locally; the application
dependencies intentionally do not download it. The command prompts for credentials
and none are stored in the repository:

```bash
pnpm exec auth create-admin --role platform_admin
```

To enable object storage, create a private Supabase Storage bucket, enable its
S3 protocol, and copy the endpoint, region, access key, secret key, and bucket
name into the corresponding `STORAGE_*` variables. The S3 credentials bypass
Supabase RLS and must remain server-only. Leave `STORAGE_PUBLIC_URL` empty for
private multimedia. Conversation files use short-lived, exact-key upload grants;
verified audio is streamed through an authenticated, workspace-scoped route.

Set `CRON_SECRET` to a strong server-only value and configure the scheduler to
send it as a Bearer token to `/api/cron/conversation-audio-cleanup`. The included
Vercel Hobby-compatible schedule invokes that endpoint once per day. This reconciler
expires abandoned upload grants, retries object and AssemblyAI transcript
deletion, and finalizes tombstoned conversations. The same secret protects
`/api/cron/conversation-processing`, which redelivers pending or interrupted
workflow outbox events once per day. The `CONVERSATION_AUDIO_*` variables may
override the default 25 MiB file limit, ten-minute duration limit and
fifteen-minute grant.

Speech processing is disabled by default. Set
`CONVERSATION_SPEECH_ENABLED=true` and provide the server-only
`ASSEMBLYAI_API_KEY` to enable it. `ASSEMBLYAI_BASE_URL` is optional and accepts
only an HTTPS regional endpoint. Never expose these values with a
`NEXT_PUBLIC_` prefix. The speech profile submits the declared `en` or `es`
language, enables speaker labels and pins the `universal-3-5-pro` then
`universal-2` model sequence.

For the full processing path also set `CONVERSATION_EXTRACTION_ENABLED=true`
and configure private `GROQ_API_KEY`. Apply the incremental proposal-review
migration using `pnpm db:migrate:deploy` on the intended development database,
then run `pnpm db:generate`. The pinned extraction profile uses
`openai/gpt-oss-120b` through AI SDK/Groq with structured output, no tools and
versioned prompts/schemas. Optional `CONVERSATION_EXTRACTION_*` limits are listed
in `.env.example`. Both capabilities must be configured before starting new
audio processing. Existing transcribed runs can continue with extraction alone.

After applying the transcription migration, initialize credit ledgers for
existing workspaces with the repeatable command below. New administrative user
creation performs the same initialization transactionally; an explicit zero
allocation is still marked initialized.

```bash
pnpm db:initialize-credits
```

For a local authentication exercise, configure `SEED_ADMIN_PASSWORD` and
`SEED_USER_PASSWORD` in `.env` and run the idempotent Prisma seed. It creates
one platform administrator and three trial users, reuses existing fixture
identities, ensures one active workspace per user, and records one audit event
per fixture. Each trial workspace also receives three synthetic clients with
two service requests each and completed manual operation receipts; rerunning
the seed reuses those records without creating duplicates. It does not print
passwords or change unrelated accounts:

```bash
pnpm db:seed
```

Use `SEED_USER_COUNT` (1-20), `SEED_USER_EMAIL_DOMAIN`, and
`SEED_CLIENT_COUNT` (0-20; zero disables client fixtures) and
`SEED_REQUESTS_PER_CLIENT` (0-10) to adjust the local fixture set.
`SEED_DRY_RUN=true pnpm db:seed` validates and prints the planned fixture
identities without connecting to the database. Prisma 7 runs this seed only
when `pnpm db:seed` is invoked explicitly; production refuses fixtures unless
`SEED_ALLOW_PRODUCTION=true` is set deliberately.

After the additive H2C-2b migration has been reviewed and applied to the
intended environment, total loss of the sole owner's MFA factors is handled by
the dry-run-first operational command below. It requires an explicit owner,
operation UUID and structured reason; mutation adds `--confirm`, and production
also adds `--confirm-production`. Do not place real addresses or credentials in
repository files or shell history. Follow the complete
[owner MFA break-glass runbook](docs/operations/owner-mfa-break-glass.md).

```bash
pnpm --silent auth:recover-owner-mfa --email <owner-address> --operation-id <uuid> --reason lost_all_factors
```

Public sign-up is disabled. From `/users`, authorized administrators can create
active `trial_user` accounts, manage their temporary credentials, activate or
suspend them, and revoke sessions. The owner additionally manages operator
profiles, can recover an operator's lost MFA with password/TOTP step-up, and can
start or cancel a protected two-participant ownership transfer. The target
operator can accept or decline only its own pending transfer. Identity-only
trial accounts can be deleted after explicit confirmation; cross-domain cleanup
remains later scope. Invitations, email activation and administrative password
changes remain deferred.

## Client workspace

Open **Clients** from the workspace navigation (`/en/clients` or `/es/clients`).
Each account, including an administrator, sees only its own clients. Search by
name, email, phone or company; sorting, page size and pagination use URL state.

Select **New client**, enter a name and at least one valid email or international
phone number, then review the normalized values. Possible duplicates are matched
by email or phone. Opening an existing match only opens its details; creating a
distinct client requires acknowledgment of the matches and explicit confirmation.
The shared record-plan service saves the approval, client, operation receipt and
audit together. A retry of the same confirmation returns the original result.
If the result is uncertain, keep the dialog open and retry that operation.

Use the row menu to inspect, edit or delete a client. Edits use the loaded
version and recheck possible contact duplicates; a concurrent change is rejected
instead of being overwritten. Deletion requires confirmation and is blocked
while the client owns service requests. Client details expose a **Requests** tab
with local filters, status totals and pagination; its data loads only when the
tab is opened.

## Service-request workspace

Open **Requests** from the workspace navigation (`/en/requests` or
`/es/requests`). The first render, filters and pagination are server-backed and
workspace-scoped. Search by request text or client and filter by client, service
type, priority and status; filter state is encoded in the URL. The client picker
loads a bounded catalog incrementally and preserves the selected client.

Select **New request**, choose an existing client, complete the service fields,
review the normalized preview and confirm. The shared plan service atomically
persists the approval, pending request, operation receipt and audit event. A
repeated confirmation reconciles to the original request. Editing request
information or priority uses an explicit versioned save; assignment can move
only to another client in the same workspace. The row menu exposes only valid
status transitions, including reopening resolved or cancelled requests as
pending, and deletion requires confirmation while preserving the client and
creation proof. The same actions and forms are available from the client's
**Requests** tab, which refreshes its local list and status totals after each
mutation. No schema migration or additional provider configuration is needed
for these modules.

## Manual workspace dashboard

Open **Dashboard** (`/en/dashboard` or `/es/dashboard`) to review the current
workspace's client and request totals, the four request-status counts and the
five most recently updated requests. Recent rows reuse the same detail, edit,
status and deletion controls as the Requests screen. The header exposes the
existing governed client/request creation flows, and the summary links continue
to the complete Clients and Requests workspaces. Dashboard reads are SSR-backed
and workspace-scoped; failures remain distinct from a legitimate empty state.

## Conversation workspace

Apply the checked-in Prisma migration before exercising this module, then open
**Conversations** from the workspace navigation (`/en/conversations` or
`/es/conversations`). The initial page render, filters, sorting and pagination
are server-backed. Every list, detail, mutation and playback lookup resolves the
active session and workspace before returning conversation data.

Select **Import audio** to upload an MP3/MPEG, MP4/M4A, WAV, OGG or WebM file. The
browser transfers the file directly to a private staging key; completion does
not trust the filename or browser declaration. The server checks the stored
size and content type, reads the bounded object, parses its media metadata,
enforces the duration limit and stores a SHA-256 checksum before making it
available for playback. Invalid uploads are rejected and scheduled for cleanup.

Select **Record conversation** in desktop Chrome or Edge to capture the local
device microphone. Each recording requires a fresh consent acknowledgement and
explicit browser permission. The dialog shows elapsed time and microphone
activity, preserves usable partial audio after an interruption, and keeps the
result only in browser memory until **Save conversation** is selected. Use HTTPS
or `localhost` for microphone access; `pnpm dev:https` is available when a local
secure origin is needed. Saved recordings reuse the same private upload,
server-side verification, playback and cleanup path as imported files.

Select **Process** on a verified audio-ready conversation with an available
credit. The accepted operation creates one run, reservation, checkpoint and
workflow outbox event atomically; duplicate intent or a double click resolves
to the active run. The detail view shows available, reserved and consumed
balances and refreshes persisted processing state every three seconds while the
run is active.

At `TRANSCRIBED`, the **Transcript** tab preserves the literal original text and
shows time-aligned generic speaker segments when reliable. When diarization or
granular alignment is unavailable, the full transcript remains readable with a
clear warning and no invented speaker. This intermediate state does not consume
the credit. New runs continue automatically through extraction and validation.
Existing conversations left at `TRANSCRIBED` expose **Continue extraction**,
reusing their original transcript, run and reservation. A failed extraction can
be retried as a new run/reservation while preserving the original transcript.

The **Review** tab presents one client and multiple request drafts alongside
field evidence. Missing business information remains visible and editable;
schema/evidence-valid publication consumes one credit even if fields are missing.
When no request is identified, an explicitly incomplete empty request draft is
provided for human completion without invented evidence. Saving corrections
creates an immutable revision with author/time; manual edits carry no fabricated
audio references. Concurrent stale edits are rejected while the local draft is
retained. **Mark as ready** requires a saved current revision, valid required
fields and resolved blocking conflicts. Editing a ready revision requires a new
save and readiness action. Review does not create business records.

After readiness, **Create client and requests** opens the final creation flow.
With no contact matches, it previews one new client and all requests assigned to
that client. If email/phone matches exist, choose one existing candidate or
acknowledge creating a distinct client. The choice applies to every request;
reusing a client preserves all saved client fields. Review the complete normalized
payload, then confirm the batch once. Every new request starts pending.
The 15-minute preview persists across modal reopenings. Back/abandon returns to
readiness; saving corrections invalidates the preview. A failed transaction
creates nothing; uncertain responses retry the same confirmation and recover
the durable receipt. Completed conversations show the result and read-only
review history. Creation consumes no additional processing credit.

Conversations can be deleted with explicit confirmation. Deletion first revokes
asynchronous write authority, tombstones the conversation, restores an open
reservation once, removes proposal revisions and local transcript/evidence artifacts and schedules
retryable cleanup for staging/verified audio and any AssemblyAI transcript.
Late workflow/provider delivery cannot recreate deleted evidence. Already
confirmed client and service-request records are outside this cleanup lifecycle.
Consumed credits are not refunded by deletion. Each reprocessing execution reuses
the original transcript and reserves its own credit: publication consumes it even
when the user keeps their previous revision; terminal failure restores the reserve
and returns the saved revision to review. An unresolved candidate must be adopted
or declined before editing/readiness or another extraction. Comparison supports
client-field selection, explicit mapping of candidate fields to existing requests,
whole new requests and explicit removal of existing requests. It never matches or
merges requests automatically. Every resulting draft requires readiness and a new
preview before confirmation. Completed conversations cannot reprocess.
Explicit Groq HTTP 400 `json_validate_failed` generation rejections use the
existing durable retry budget (`CONVERSATION_EXTRACTION_MAX_ATTEMPTS`, default 2,
maximum 3 total attempts), retaining the same run and credit reservation. Other
400 responses, uncertain submissions and application validation failures remain
terminal. Strict schema/evidence checks still apply to every accepted output.
An already failed run is not reopened by this change: use Review to keep its
preserved proposal or explicitly generate another proposal.
Full managed-account deletion remains blocked while
domain data exists; proposal cleanup is available to the later account cleanup
service through the same conversation boundary.

## Quality commands

Run `node scripts/verify-reprocessing-integration.mjs` for isolated local
PostgreSQL reprocessing checks. It creates and removes its own temporary database,
uses synthetic records, and forbids provider/network calls. The suite covers
concurrent starts/confirmation, credits, rollback, adoption, failure and cleanup.

Run `node scripts/verify-proposal-integration.mjs` for the isolated local
PostgreSQL checks; it creates and removes only its own temporary database.
Run `node scripts/verify-conversation-creation-integration.mjs` for the isolated
local PostgreSQL batch-service checks, including rollback and concurrent confirmation.
The opt-in `lib/ai/conversation-extraction.smoke.test.ts` calls real Groq with
synthetic English/Spanish evidence when `GROQ_SMOKE_TEST=true`. It never writes
application records. HTTP 401/403 is reported as provider access denied; check
provider credentials and network access before retrying.

```bash
pnpm validate:harness # repository harness checks
pnpm test:unit:run    # deterministic unit/component tests
pnpm verify:fast      # quick implementation feedback
pnpm typecheck        # application/reference TypeScript
pnpm lint             # full ESLint
pnpm build            # production build
pnpm verify           # full final repository runner
```

`pnpm verify` begins with `pnpm validate:harness` and runs the repository's
full final check sequence. `pnpm verify:fast` is useful feedback during work,
but it is not a replacement for the final checks. A reported PASS means the
work is ready for the user to review and commit manually; agents never run
`git commit`.

The optional PostgreSQL records contract check uses a local, non-production
database with the existing schema. It exercises real relational constraints,
workspace isolation, governed client/request creation, client edit/delete rules,
request editing, stale versions, status transitions, reopening, reassignment,
deletion cleanup and service rollback through savepoints; an outer transaction
rolls back every fixture and write. It does not test simultaneous connections.
In PowerShell:

```powershell
$env:CLIENTS_POSTGRES_TEST = '1'
pnpm test:unit:run test/integration/clients-postgres.test.ts
Remove-Item Env:CLIENTS_POSTGRES_TEST
```

## Lightweight workflow

`understand -> choose a native plan if useful -> implement or delegate -> verify -> manual user commit`

- `docs/` holds product context, a documentation inventory, and curated
  requirement briefs.
- `harness-docs/` holds practical developer and operator guidance.
- `.agent/` holds reusable roles, skills, contracts, and implementation
  patterns.

Planning belongs to the coding tool or agent that is doing the work. It is a
useful choice when it clarifies scope, but it is never a harness requirement or
a blocker. Agents may delegate independently scoped work, use the repository's
patterns, and run proportionate checks. They report the changed files, checks,
and remaining risks, but they do not create commits.

For a new requirement or any future material iteration that implements,
reopens, or changes one, create or update
`docs/requirements/<requirement-kebab>/progress.md`. It keeps current state and
an append-only iteration history. Untouched historical requirements are not
backfilled.

See the [developer guide](harness-docs/developer-harness-guide.md), [operator
guide](harness-docs/human-operator-guide.md), [harness index](harness-docs/README.md),
and [project documentation](docs/README.md).

## Project structure

`app/` routes; `components/` shared UI; `modules/` domain modules; `messages/`
locales; `docs/` product knowledge; `harness-docs/` collaboration guides; and
`.agent/` reusable agent guidance and references.
