# Conversation Processing Demo Solution Architecture

## 1. Architecture purpose

This document defines the solution architecture for the **Conversation
Processing Demo** described in `product-source-of-truth.md`.

It establishes:

- The deployable topology.
- The selected technologies and managed services.
- Logical application services and their responsibilities.
- Communication and dependency boundaries.
- Identity, workspace isolation, and trust boundaries.
- Audio, workflow, transcription, diarization, extraction, review, and agent
  execution flows.
- Persistence ownership, deletion, audit, observability, and operational
  controls.
- Failure handling, portability, and future extension points.

The [logical data model](data-model.md) specifies entities, fields, relations,
and invariants under the product and architecture authorities. This document
describes the target system, not integrations already present in the scaffold.

This is a system-design document. It intentionally does not prescribe source
folders, framework conventions, route-handler implementation, Prisma query
syntax, UI component code, or AI SDK programming patterns. Those choices belong
to implementation planning and engineering standards in this application
repository.

## 2. Architecture goals and boundaries

### 2.1 Goals

The architecture must:

1. Deliver the complete product from one modular Next.js and TypeScript
   application deployed on Vercel.
2. Keep application services explicit without introducing a separate NestJS
   backend, continuously running worker, or microservice estate.
3. Store every user's data within a server-resolved personal workspace boundary.
4. Accept browser microphone recordings and prepared audio uploads without
   sending large media bodies through the application runtime.
5. Execute transcription, diarization, extraction, and validation as a durable,
   observable, resumable workflow.
6. Preserve an immutable original transcript independently from derived speaker
   segmentation and extraction results.
7. Isolate speech transcription, structured extraction, and agent inference as
   separately governed AI capabilities.
8. Provide a bounded agentic assistant whose tools cannot bypass application
   authorization, confirmation, or transaction boundaries.
9. Use one shared record-plan service for direct workspace writes and assistant
   writes.
10. Bound external-provider cost and platform consumption through credits,
    limits, concurrency control, and kill switches.
11. Keep selected hosting and AI providers replaceable behind application-owned
    contracts.
12. Support English and Spanish without creating separate product paths.
13. Support ordinary UI CRUD for clients and requests, with the same creation
    rules used by conversation intake and the assistant.
14. Create a conversation's one client and complete reviewed request set
    atomically, at most once per conversation.

### 2.2 Boundaries

The baseline architecture does not include:

- A separate backend framework or deployable API service.
- A continuously running application worker.
- VoIP, SIP, PBX, or telephone-provider infrastructure.
- WebRTC rooms or remote participant calling.
- Operating-system or third-party meeting audio capture.
- Live transcription or real-time diarization.
- Public MCP exposure.
- External CRM or field-service record destinations.
- User-created organizations or shared team workspaces.
- Autonomous record writes.
- Assistant update or delete tools.
- Budgets, billing, inventory, technician assignment, and appointment scheduling.
- Self-hosted speech, diarization, or language models.
- Automatic time-based expiration was outside the original baseline; the
  accepted controlled-trial policy in section 26 now requires expiry/cleanup.

## 3. Architectural style

The solution is a **modular serverless monolith**:

- One source repository.
- One Next.js application.
- One primary Vercel project.
- One relational database authority.
- One private object-storage boundary.
- Managed durable workflow execution.
- External AI providers accessed only through server-side application services.

The monolith is divided into cohesive logical services. These boundaries provide
independent policy, contracts, ownership, testing, and future extraction points;
they are not separately deployed microservices.

```text
Users
  -> Vercel-hosted Next.js application
       -> Better Auth identity and session boundary
       -> Neon PostgreSQL through Prisma ORM
       -> private S3-compatible audio storage (Supabase Storage initially)
       -> Vercel Workflow / Vercel Queues
            -> AssemblyAI speech processing
            -> internal validation and extraction coordination
            -> Groq through the internal AI runtime
       -> observability platform
```

This topology keeps the demo operationally simple while preserving boundaries
that support future provider replacement or service extraction if scale or
product requirements justify it.

## 4. Technology and hosting baseline

| Concern | Selected technology/service | Architectural purpose |
| --- | --- | --- |
| Full application | Next.js App Router with TypeScript | Web experience, trusted server execution, application APIs, administration, assistant streaming, and workflow integration |
| Primary hosting | Vercel | Production and preview deployments, HTTPS, server-side execution, environment configuration, scaling, and deployment identity |
| Authentication | Better Auth plus application-owned admin policy | Email/password accounts and sessions; general administrator/trial roles; product-owned owner/operator profiles and server-only capabilities; account creation, suspension, password lifecycle and session revocation |
| Relational persistence | Neon PostgreSQL | Authoritative transactional store for identity-linked product, workflow, record, credit, and audit state |
| ORM and migrations | Prisma ORM | Relational schema definition, controlled migrations, typed application data access, and atomic transactions |
| Audio storage | Private S3-compatible object storage; Supabase Storage initially | Direct upload, private retained audio, authorized playback, object deletion, and provider portability |
| Durable orchestration | Vercel Workflow | Stateful multi-stage conversation processing, durable checkpoints, step retry, and recovery |
| Asynchronous delivery | Vercel Queues | Lower-level delivery, buffering, retry, and event decoupling when a workflow or operational task requires it |
| Speech processing | AssemblyAI | Initial post-recording transcription and speaker diarization for English and Spanish audio |
| AI integration | AI SDK | Application-owned provider abstraction, structured-output tasks, agent loop, tool governance, streaming, and tool approval |
| Extraction and agent inference | Groq | Initial language-model provider resolved independently for structured extraction and the assistant |
| Observability | Vercel-compatible managed platform | Central logs, traces, metrics, error reporting, alerting, and correlation search |

The product references application task aliases rather than provider model IDs.
AssemblyAI and Groq are initial adapters, not domain dependencies. Supabase Storage,
Workflow, Queues, Neon, and the observability platform are likewise accessed
through bounded infrastructure capabilities where portability is materially
valuable.

## 5. Deployment topology

### 5.1 Production environment

The production topology contains:

```text
Vercel production project
  - Next.js web and trusted application runtime
  - Better Auth integration
  - workflow and queue producers/consumers
  - provider adapters
  - protected administration surface

Neon production database
  - application schema
  - Better Auth persistence
  - workflow/application checkpoints
  - audit and usage ledger

Private S3-compatible object store (Supabase Storage initially)
  - recorded audio
  - uploaded audio
  - deletion reconciliation metadata

External providers
  - AssemblyAI
  - Groq
  - selected observability platform
```

The Next.js application is the only public application origin. Managed workflow
callbacks and provider callbacks, if used, terminate at authenticated trusted
application boundaries rather than directly changing product state.

### 5.2 Preview environments

Preview deployments use non-production configuration and must not silently
share production users, credentials, database records, audio, provider callback
state, or audit streams. Preview isolation may use a dedicated database branch,
separate object-storage namespace/bucket, and provider test configuration.

Database migration validation occurs outside the normal end-user request path.
Only an explicitly approved production migration changes the production schema.

### 5.3 Regional placement

The Vercel compute region, Neon database region, queue/workflow region, object-storage
region, and observability ingestion region should be selected to minimize
cross-region latency and unnecessary data movement. Any later residency promise
requires verification across every managed provider rather than relying only on
the application region.

## 6. Logical application services

### 6.1 Web Experience Service

Owns the English/Spanish user experience for authentication, dashboard,
recording, upload, processing state, transcript review, client/request records,
assistant, confirmation, deletion, and administration.

Client/request screens include ordinary CRUD forms, declared status transitions,
and same-workspace request reassignment. Manual creates do not require a source
conversation. Review supports a list of independent request drafts for one
client, with per-item correction/addition/removal before confirming the set.

It may initiate user intent but never establishes authoritative workspace scope,
credit eligibility, readiness, confirmation validity, or provider access.

### 6.2 Identity and Administration Service

Coordinates Better Auth with product-owned user profile, role, workspace,
temporary-password, activation, suspension, and administrator policy.

It owns:

- Creation of the initial platform administrator.
- Administrator-created trial accounts.
- Forced temporary-password replacement.
- Controlled activation reissuance, recovery reset and secret-free delivery
  acknowledgment.
- Active/suspended state.
- Session revocation.
- Account deletion initiation.
- Future public-registration mode and capacity policy.
- Audited administrative access to trial content.

### 6.3 Workspace Authorization Service

Resolves the current personal workspace from the authenticated user and applies
resource ownership to every product read and mutation.

Workspace scope is never accepted from assistant model output. When a browser
request carries a resource identifier, the service verifies ownership against
the authenticated workspace before the resource reaches a domain service.

Platform-administrator access is a separate privileged path with explicit
targeting, declared reason, and mandatory audit.

### 6.4 Conversation Service

Owns conversation identity, source type, locale, state transitions, audio
eligibility, processing initiation, transcript visibility, proposal association,
manual deletion, and conversation-to-record provenance.

It is the authority for the conversation lifecycle. Infrastructure providers
and AI outputs cannot directly change readiness or completion state.

### 6.5 Audio Artifact Service

Owns the application view of private audio artifacts:

- One-time direct-upload authorization.
- Expected owner, conversation, size, type, and expiry constraints.
- Verification of the completed object-storage artifact.
- Playback authorization.
- Object-storage reference and integrity metadata.
- Deletion request, completion, failure, and reconciliation state.

The service exposes authorized audio sources to speech processing without
turning storage URLs into application authorization.

### 6.6 Usage Credit Service

Owns the credit ledger and its invariants:

- Initial allocation, normally ten credits.
- Administrator adjustment.
- Transactional processing reservation.
- Successful consumption.
- Restoration after terminal failure without a reviewable proposal or earlier
  cancellation.
- Idempotent safe retry.
- Current available, reserved, consumed, and adjusted totals.
- Idempotent initialization, including an explicit zero allocation, represented
  independently from ledger quantity so it cannot be mistaken for unfinished setup.

The displayed balance is derived from the authoritative ledger rather than
maintained only as an independently mutable counter.

### 6.7 Conversation Processing Service

Coordinates the durable workflow from verified audio through transcript,
diarization, extraction, validation, and review availability.

It owns processing-run identity, step status, checkpoint references,
retryability, correlation, terminal outcome, and the connection between a run
and one credit reservation.

Processing acceptance creates the run, reservation, initial checkpoint and
workflow-dispatch outbox event in one PostgreSQL transaction. The interactive
path may dispatch immediately, while an authenticated reconciler redelivers
pending or interrupted events by idempotency identity. Successful speech moves
the conversation to `TRANSCRIBED` but deliberately leaves the run and
reservation open at the extraction boundary.

### 6.8 Speech Processing Service

Provides the application-owned boundary for post-recording transcription and
diarization. It accepts an authorized audio source and a declared speech task
profile and returns a normalized speech result.

The result distinguishes:

- Immutable original transcript text.
- Timestamped transcript evidence.
- Derived speaker segments.
- Generic or unknown speaker label.
- Language.
- Duration.
- Confidence when supported.
- Warnings and provider reference metadata.

The initial adapter uses AssemblyAI. Product and persistence services do not
depend on AssemblyAI response types.

The AssemblyAI adapter submits a known `en` or `es` language, requests speaker
labels and uses the pinned `universal-3-5-pro`, `universal-2` model fallback
sequence owned by the speech profile. Submission and status polling are separate
operations. A job creation whose result is uncertain is not retried blindly;
later polling and idempotent persistence use bounded retry around the stored
provider job reference.

### 6.9 Internal AI Runtime

Owns language-model access for registered application tasks. It separates:

1. Closed structured extraction.
2. Agentic assistant execution.

Each task profile declares a stable task code, capability type, purpose,
provider/model alias, input data classes, output contract where applicable,
prompt/schema versions, limits, retry policy, telemetry policy, and kill-switch
behavior.

The runtime resolves Groq as the initial provider for extraction and assistant
inference. It does not expose a generic public model-execution capability.

### 6.10 Extraction and Validation Service

Owns conversion of a minimized finalized transcript into a structured client
and service-request proposal.

The extraction task is closed and has no tools. The validation boundary checks:

- Output schema and declared versions.
- Supported field keys.
- Evidence existence.
- Normalized email and phone formats.
- Required and optional field policy.
- Controlled service vocabulary.
- Free-text preferred availability, service address, and next steps; declared
  priority values. Budget and appointment fields are not in the baseline.
- Missing, ambiguous, conflicting, low-confidence, and sensitive-data states.

Model output becomes a proposal only after schema/evidence validation; it does
not become a client, request, ready revision, or confirmed operation. A proposal
contains one client draft and one or more request items with stable IDs. Missing
business values may be reviewed but must be corrected before readiness. Original
text evidence is addressable independently of diarization. Extracted, manual,
and default values have distinct provenance; confidence may be absent.

### 6.11 Review and Proposal Service

Owns proposal revisions, user corrections, validation status, evidence links,
readiness checks, and the authorized transition to `READY`.

It preserves original transcript immutability and records the author and time of
every structured-field correction. Only an authenticated trial user in the
owning workspace can mark a valid current revision ready.

Human additions/removals of request items create revisions as well. A new
extraction run invalidates readiness/plans but retains prior revisions; users
compare/adopt candidate fields into another human revision. Completed
conversations cannot reprocess or create another record batch.

### 6.12 Client and Service Request Service

Owns workspace-scoped clients and service requests, normalized duplicate keys,
record provenance, and supported query behavior.

It exposes no cross-workspace query capability. The direct UI supports creation,
reading, editing, deletion, declared request status transitions, and reassignment.
The assistant remains read/create-only. Services reject stale record versions,
restrict client deletion while requests exist, and invalidate affected plans.
Client contact keys are indexed for matching but deliberately nonunique; explicit
duplicate acknowledgment can authorize a separate client sharing contact data.

### 6.13 Record Plan Service

Owns duplicate search, duplicate decision, exact write plan, confirmation,
operation intent, idempotency, atomic commit, and uncertain-outcome
reconciliation.

Ordinary forms, the review workspace, and the assistant call this service.
Operation kinds distinguish manual client creation, manual request creation,
and conversational batch creation. Only the last requires a ready revision and
is exposed as an assistant write capability. Manual payloads still require
server validation, duplicate policy, exact preview, approval, and idempotency.
No surface implements an independent record-creation path. Client reuse does
not update existing fields as a hidden side effect.

### 6.14 Agent Service and Tool Registry

Owns assistant threads, streaming model interactions, allowed tools, tool input
validation, server-owned authorization, bounded iteration, approval state,
results, and agent observability.

The registered capability families are:

- Conversation list and detail retrieval.
- Transcript and proposal retrieval.
- Client search and detail retrieval.
- Service-request list and detail retrieval.
- Client/request record-plan preparation.
- Confirmed client/request creation.

Read tools execute only after normal workspace authorization. The write tool
requires an explicit approval bound to the prepared operation. No arbitrary
query, HTTP, model, administrative, update, or delete tool is registered.

### 6.15 Audit and Observability Service

Owns application audit events, security events, correlation identifiers,
provider invocation metadata, workflow health, usage metrics, and integration
with the selected observability platform.

Audit records are application evidence, not unrestricted copies of transcript,
audio, model prompts, passwords, tokens, or provider credentials.

## 7. Dependency direction

Dependency direction follows this rule:

```text
User and administrator surfaces
  -> application services
      -> domain policy and contracts
          -> infrastructure adapters
              -> managed platforms and external providers
```

Domain policy cannot depend directly on:

- Better Auth session formats.
- Object-storage provider responses.
- Workflow or Queue provider payloads.
- AssemblyAI response schemas.
- Groq model identifiers or provider SDK responses.
- Observability vendor event formats.

Provider adapters normalize infrastructure results into stable application
contracts. This protects product behavior from provider replacement and keeps
tests focused on architectural capabilities.

Prisma ORM is the approved relational persistence boundary. Database records do
not embed provider response objects as authoritative domain state. Bounded raw
references may be retained for troubleshooting when privacy policy permits.

## 8. Communication model

### 8.1 Synchronous communication

Synchronous application interactions are used for:

- Authentication and session checks.
- Dashboard and record reads.
- Direct user mutations that complete quickly.
- Manual business CRUD, version checks, and request reassignment.
- Upload-authorization issuance.
- Processing initiation acknowledgment.
- Proposal edits and readiness.
- Record-plan preparation and confirmation.
- Administrator actions.
- Assistant streaming and tool approval.

The application persists authoritative state before reporting a completed
mutation. Long-running speech and extraction work is not kept inside an
end-user request.

### 8.2 Direct audio transfer

Audio uses a controlled direct-upload flow:

```text
Authenticated browser
  -> application requests upload authorization
  -> application validates workspace, limits, and expected artifact
  -> browser uploads directly to private S3-compatible object storage
  -> completion is verified by the trusted application
  -> Conversation becomes AUDIO_READY
```

The upload authorization is short lived and constrained to the expected
operation. A client-provided filename, media type, size, object reference, or
completion claim is not trusted without server-side verification.

This design prevents large audio files from being proxied through Vercel
Functions and keeps media separate from relational records.

### 8.3 Asynchronous communication

Vercel Workflow coordinates the stateful multi-step processing chain. Vercel
Queues supplies lower-level durable delivery when needed for decoupled cleanup,
callbacks, operational retry, or workload buffering.

Workflow and queue messages carry identifiers and bounded metadata:

- Workspace and conversation identifiers.
- Processing-run and credit-reservation identifiers.
- Authorized artifact reference identifier.
- Task-profile version.
- Correlation and idempotency identifiers.

They do not carry full audio bodies, unrestricted transcripts, credentials, or
complete application records.

Because asynchronous delivery may occur more than once, every consumer reloads
authoritative state and commits idempotently.

Conversation processing is dispatched through a transactional outbox. Its
idempotency identity maps one accepted run to one external workflow identity;
the workflow input contains only the processing-run identifier. Database,
private-storage and provider access occur inside durable steps, each of which
reloads current authorization, deletion state and run authority. The workflow
runtime's start acknowledgment is not application status; clients continue to
read the persisted conversation/run state.

### 8.4 External provider communication

All AssemblyAI and Groq requests originate from trusted server-side execution.
Provider credentials are resolved from protected configuration and never
returned to the browser.

Outbound inputs are minimized for the declared task. Provider output is
normalized, validated, correlated, and treated as untrusted before it affects
product state.

### 8.5 Status communication

Conversation and processing status is persisted in PostgreSQL. The user
experience reads persisted state rather than relying on an individual function
instance, in-memory event, or provider callback.

Assistant messages may stream for responsiveness, but tool outcomes,
confirmations, and record mutations become authoritative only after persistence.

## 9. End-to-end conversation flow

```text
1. User records or selects audio
2. Browser obtains bounded direct-upload authorization
3. Audio is uploaded to private S3-compatible object storage
4. Application verifies the artifact and marks the conversation AUDIO_READY
5. User initiates processing
6. Credit Service reserves one credit
7. Processing Service atomically creates an idempotent run, checkpoint, and outbox dispatch intent
8. Immediate dispatch or the authenticated reconciler starts Vercel Workflow with the processing-run identifier
9. Speech Service authorizes the audio source
10. AssemblyAI transcribes and diarizes
11. Original transcript is persisted as immutable evidence
12. Derived Speaker A/B/unknown segments are persisted separately
13. Conversation becomes TRANSCRIBED; the run and credit reservation remain open
14. Extraction task receives minimized transcript evidence and field policy
15. Groq returns schema-constrained output through the Internal AI Runtime
16. Validation produces a reviewable proposal or a safe failure
17. User reviews, corrects, and marks a revision READY
18. Record Plan Service searches for duplicate clients
19. User resolves duplicates and reviews the exact plan
20. User explicitly confirms the plan
21. Prisma transaction creates/reuses the client and creates the full request set
22. Operation result, provenance, and audit/outbox state are persisted
```

No single provider response can skip a lifecycle transition. The Conversation
Service and Record Plan Service remain the authorities for state and writes.

Credit consumption is persisted with successful review availability at step 16,
not with record creation at step 22. An extracted proposal may contain business
fields needing human completion but must pass structural/evidence validation.
Ordinary forms enter the same Record Plan Service with a manual-origin payload
instead of running steps 1-16.

## 10. Conversation processing architecture

### 10.1 State and checkpoints

The persisted lifecycle is:

```text
DRAFT
  -> AUDIO_READY
  -> QUEUED
  -> TRANSCRIBING
  -> DIARIZING
  -> TRANSCRIBED
  -> EXTRACTING
  -> VALIDATING
  -> NEEDS_REVIEW
  -> READY
  -> RECORD_PLAN_PENDING
  -> COMPLETED
```

`FAILED`, `QUOTA_BLOCKED`, and `CANCELLED` include the failed stage,
retryability, safe reason, run identifier, and correlation identifier.

Each durable step records enough application state to determine whether it:

- Has not started.
- Is in progress under a valid lease/run.
- Completed successfully.
- Failed before committing output.
- Produced an output already committed by an earlier delivery.
- Requires a safe retry, manual review, or terminal failure.

### 10.2 Credit transaction boundary

One credit is reserved in the same authoritative operation that accepts a new
processing run. This prevents concurrent requests from overspending a balance.

The reservation is:

- Consumed once when the workflow reaches successful review availability.
- Restored once after terminal failure without review availability or earlier
  cancellation/deletion.
- Reused by safe retry of the same run.
- Not created for invalid media or a discarded unprocessed conversation.
- Traceable to user, workspace, conversation, run, and administrator
  adjustments.

One reservation is settled as consumed OR restored. Persisting the valid
reviewable proposal and successful run/credit outcome is atomic. Transcription
alone never consumes credit. A retry after terminal settlement is a new run and
reservation, reusing safe artifacts where possible; internal retries retain
the same reservation. Successful re-extraction costs one unit. Manual CRUD and
assistant record creation spend no processing credits, but assistant inference
has its own bounded runtime usage policy.

### 10.3 Failure behavior

A failure follows the smallest safe recovery boundary:

- Upload failure leaves no processable conversation and reconciles orphaned
  storage when necessary.
- Transcription failure preserves verified audio and restores the credit after
  terminal exhaustion.
- Diarization failure preserves original transcript and may continue with
  unattributed transcript evidence when policy permits.
- Extraction failure preserves audio and all finalized transcript artifacts.
- Structural/evidence validation failure retains only safe diagnostic metadata,
  not raw rejected output; bounded retry may follow, with restoration at terminal
  failure. Valid proposals with incomplete business values reach human review
  and consume one credit without fabricating fields.
- Record-plan failure changes no client or request.
- Uncertain commit outcome is reconciled by operation intent and idempotency key
  before any retry.
- Cancellation/deletion closes an open reservation once and invalidates active
  run authority. Each later callback/step checks that authority before writing;
  it cannot recreate deleted content. If success committed first, no refund is
  issued and deletion cleans the completed artifacts.
- Conversation deletion also queues deletion of any stored remote speech job;
  provider cleanup is idempotent and retains only the minimum non-content
  reference needed to retry it.

## 11. Speech, transcript, and diarization architecture

### 11.1 Normalized speech contract

The stable speech capability provides:

- Original full text.
- Language and duration.
- Timestamped evidence segments where available.
- Derived speaker utterances with start/end time.
- Generic `Speaker A`, `Speaker B`, or unknown labels.
- Confidence and warning metadata where supported.
- Provider invocation reference and normalized usage.

The original text is persisted literally and fingerprinted with SHA-256.
Evidence offsets are measured against that exact text. Valid provider utterances
produce one evidence span each; without usable utterances, deterministic word
groups split by punctuation, pause, 40 words, or 280 characters. If granular
alignment cannot be proven, one global evidence span preserves the full text and
a warning replaces unreliable offsets.

Provider-specific speaker identifiers are mapped to conversation-local generic
identifiers such as `speaker_a` and `speaker_b`. No cross-conversation voice identity or biometric speaker profile is
created.

### 11.2 Original versus derived artifacts

The original transcript is finalized once and remains immutable. It serves as
the primary human-readable record of what the speech provider recognized.

Speaker segmentation is a derived, versioned interpretation. It may be replaced
or reprocessed without rewriting the original transcript. Extraction evidence
identifies stable transcript segments and records which transcript/diarization
version informed the proposal.

User correction changes structured proposal fields/items, not source transcript
artifacts. Reprocessing reuses the finalized original and creates another
derived proposal for explicit adoption. It cannot overwrite corrected revisions.
A future transcript-correction feature would require a separate annotated
artifact rather than mutation of the original.

### 11.3 Diarization limitations

A single room microphone produces mixed audio. Speaker attribution may degrade
with noise, echo, overlapping speech, short responses, or similar voices.

The architecture therefore requires:

- Generic rather than asserted real-world identities.
- An explicit unknown label.
- Visible qualification of derived speaker attribution.
- Original transcript accessibility regardless of diarization status.
- Extraction that can operate without trusted speaker identity.
- No automatic business decision based solely on a speaker label.
- An explicit unavailable diarization version with no invented speaker segments
  when valid utterances do not exist.

## 12. Structured extraction architecture

The extraction task receives only:

- Workspace locale and configured language context.
- Stable transcript evidence identifiers and minimized text.
- Generic speaker attribution when available.
- The declared client and request field contract.
- Required/optional field policy.
- Controlled service vocabulary.
- Bounded conversation metadata needed for interpretation.

The task does not receive provider credentials, authorization policy, database
access, tools, another workspace's records, or authority to create data.

Its normalized proposal represents:

- Observed and normalized values.
- Evidence identifiers.
- Per-field confidence.
- Validation state.
- Missing required information.
- Ambiguity and conflict findings.
- Task, prompt, schema, provider, and model versions.

The schema is one client draft plus an array of stable-ID request drafts using
the [business contract](data-model.md#2-business-records). It has no budget or
calendar fields. Multiple unrelated clients in speech are a review ambiguity,
not a multi-client creation capability. Required contact rules apply to saved
clients; a missing country prefix remains an actionable review finding.

Deterministic validation, not the model, determines whether the proposal can be
shown as structurally valid. Only a human can make a valid revision ready.

The extraction validator uses a closed EN/ES spoken-phone token map (individual
digits, digit groups, separators and a leading plus/más). Unsupported contact
transformations clear only the phone/email draft value, retain verified literal
evidence, and produce blocking AMBIGUITY. Empty observed-only contacts survive
adapter normalization and publication revalidation idempotently. No guessed
prefixes, arbitrary spoken-email parsing or additional provider retries are
introduced. Human corrections retain the existing authored-revision contract.

Field-local recovery extends to all client and request fields. The adapter checks
field representability against shared draft schemas; the authoritative validator
removes unsupported values and unverified quotes/references before publication.
Known identities with missing field metadata are recoverable. Duplicate/unknown
item identities, forged provenance and malformed envelopes remain fatal. The
existing NONEXISTENT_EVIDENCE finding represents a discarded, unverified field;
it is blocking, persists across revisions and requires an explicit human decision.
Correcting a field alone does not silently resolve it. Findings are bounded at
1024 to cover all 356 fields plus business/semantic issues in a 50-request batch.
No rejected provider content is stored as evidence or logged. Prompt v4/policy v3
retain independent validation and the existing atomic delivery/credit transaction.

Roadmap increments 6 and 7 implement a closed versioned AI SDK/Groq profile,
bounded provider attempts and an extraction checkpoint lease. A durable step
validates and publishes the proposal with credit settlement without returning
transcript/proposal content into workflow outputs. New speech runs enqueue
extraction automatically; existing `TRANSCRIBED` runs require explicit continuation
and reuse their reservation. An expired worker lease cannot publish late output.
Draft revisions are sealed after persistence, and save/readiness operations
validate both the current revision and conversation version. The existing detail
modal retains its audio player while the review tab owns a separate RHF form,
evidence inspection and paginated revision history. A separate creation
container/hook handles duplicate choice, exact persisted preview and confirmation
through the shared records boundary. Completed revisions remain read-only.
Reprocessing starts a separate durable extraction run using the finalized
transcript, with its own reservation and an atomic invalidation of readiness and
pending plans. Publication stores a parented extraction candidate while retaining
the current revision pointer. The pending candidate is identified by the current
run, current parent revision, extraction author and candidate status; no extra
conversation pointer or schema migration is required. While processing or awaiting
the candidate decision, edits/readiness are blocked. Explicit adoption builds a
new authored revision from server-loaded selected fields/items, preserving their
evidence and remaining manual corrections. Keeping the previous revision records
an idempotent audit decision. Both decisions retire the candidate; history remains
available. Revision numbers advance across all branches. Terminal failure returns
the preserved revision to review without restoring stale readiness or plans.

The provider adapter classifies only explicit Groq HTTP 400
`json_validate_failed` as a retryable generation rejection. Workflow retries it
within the existing configured attempt budget and reservation; the SDK itself
still has zero retries. Generic 400s, local schema/evidence errors and uncertain
submissions remain terminal. Strict JSON schema stays enabled. After exhausted
attempts, normal failure settlement preserves the previous review and releases
the reservation. The processing panel directs this case to Review rather than
the initial Process action. Provider response bodies are never logged or reused.

## 13. Agentic assistant architecture

### 13.1 Agent boundary

The assistant is a separately registered AI task with a bounded iterative tool
loop. It does not share the extraction task's prompt, authority, execution
policy, or output contract.

The Agent Service supplies:

- Authenticated user and server-resolved workspace context.
- Approved conversation context selected by the user or retrieved by tools.
- A fixed system policy.
- Registered tool descriptions and schemas.
- Step, time, context, token, concurrency, and cost limits.
- Tool results and approval responses.

### 13.2 Read tools

Read tools query application services, never the database directly. They apply
normal authorization, result bounds, and redaction before returning data to the
model.

Track the resource references used by each assistant thread. Conversation
deletion removes referencing threads and cached context so previously returned
evidence does not survive through persisted assistant messages.

Supported read capabilities cover conversations, transcript evidence, clients,
and service requests within the current workspace.

### 13.3 Confirmed write tool

Agent-initiated creation is a two-boundary operation:

```text
Preparation
  -> validate ready revision
  -> search duplicate clients
  -> resolve user duplicate choice
  -> construct exact record plan for one client and all reviewed requests
  -> return preview and approval request

Commit
  -> verify active authenticated user
  -> verify server-resolved workspace
  -> verify approval and plan hash
  -> verify plan freshness and operation intent
  -> execute shared atomic record creation
  -> persist result and audit
```

The model cannot synthesize a valid approval or operation intent. Denial or
expiry returns control to the assistant without executing the write.

### 13.4 Prompt-injection controls

Transcripts, client fields, request notes, uploaded filenames, and tool results
are untrusted content. Instructions found in them cannot:

- Change the system task.
- Register or unlock tools.
- Change workspace scope.
- Override confirmation.
- Reveal secrets or hidden prompts.
- Expand query bounds.
- Authorize another provider or model.

Application authorization and confirmation are enforced outside model
reasoning, so a successful prompt injection attempt still cannot grant the
model new technical authority.

## 14. Record planning and transactional writes

The Record Plan Service creates a normalized plan that contains:

- Operation kind and origin; source conversation and ready proposal revision
  for conversational creation, or validated form input for manual creation.
- Selected existing client or proposed new client.
- The complete proposed service-request set for a conversation; one request for
  manual request creation, or no request for independent manual client creation.
- Duplicate candidates and the user's resolution.
- Validation warnings.
- Exact operation set.
- Plan version, hash, expiry, and operation intent.

A plan becomes invalid when its source revision (if present), duplicate decision,
relevant client state/version, user authorization, or workspace state changes.
Explicit client reuse cannot silently copy extracted changes into that client.

The conversational service receives source identifiers and a client choice,
then reads the sealed, explicitly ready revision itself. It shares contact
normalization, duplicate lookup and transaction-scoped record writes with manual
creation. It persists 15-minute plans and moves the conversation to
`RECORD_PLAN_PENDING`; abandoning returns to `READY`, while authored corrections
invalidate pending plans and return to `NEEDS_REVIEW`. Reopening recovers the
pending preview or the successful receipt. A deterministic conversation-scoped
receipt idempotency key uses the existing unique constraint, independently of
the plan's operation intent. Serializable version-checked commits reconcile an
existing receipt before freshness checks and never consume processing credits.

Prisma ORM executes the approved relational changes in one PostgreSQL
transaction. That transaction:

1. Revalidates the operation intent and plan freshness.
2. Creates or reuses the selected client.
3. Creates every request in the exact approved set when requests are included;
   independent manual client creation has no request rows.
4. Links the manual origin or source conversation/proposal provenance.
5. Stores the successful operation result.
6. Prevents reuse of the same confirmation for a second write.

All requested records and their result receipt commit together or none do.
Enforce at most one successful conversational creation operation per
conversation, independently of plan IDs and retries. Saved request deletion
does not release that invariant. Ordinary editing/deletion uses explicit UI
intent, current-version checks, shared domain authorization, and audit; those
operations are not exposed to the assistant.

Audit publication and non-relational follow-up use an outbox or equivalent
reconciliation pattern so that failure after the database commit does not make
the record outcome unknowable.

## 15. Identity and authorization architecture

### 15.1 Identities

The solution has these security identities:

1. Trial user.
2. Platform administrator.
3. Vercel deployment/workflow identity.
4. AssemblyAI provider credential.
5. Groq provider credential.
6. Object-storage access identity.
7. Observability ingestion identity.

External provider credentials identify the application, not an end user. The
application retains user/workspace correlation internally.

### 15.2 Authentication lifecycle

Better Auth owns password verification and session lifecycle. Product policy
adds active/suspended state, role, nullable administrative profile, personal
workspace, and temporary-password completion. Better Auth browser-facing
administrative permissions remain empty; sensitive administration stays behind
application services/actions.

Initial trial accounts are created by a platform administrator. The temporary
credential permits only the password-replacement journey. Suspension blocks new
sessions and all subsequent authorized application operations; session
revocation is checked against authoritative session/user state on every protected
application operation, workflow step, and tool execution; a cached browser
session alone cannot preserve access.

New administrative trial provisioning generates a 192-bit temporary password
from the Node.js cryptographically secure random source, passes it directly to
Better Auth for hashing, and returns it once to the authorized administrator
only after provisioning and audit succeed. It records a mandatory-replacement
flag, an `activation` purpose and an expiry 72 hours after successful
provisioning. Existing accounts are not
retroactively gated. The activation service uses Better Auth for password
verification and hashing, serializes activation per user, clears the temporary
state exactly once, records activation and the 14-day expiry in the same audited
transaction, and revokes all sessions except the completing session. Until that
transaction succeeds, application session guards deny workspace pages, protected
actions and APIs; only minimal authentication state, the application-owned
replacement operation and sign-out remain available. Expired credentials cannot
complete replacement and receive only safe contact guidance.

Temporary-password purpose is explicit: `activation` requires absent trial
timestamps and creates the original activation/expiry pair; `recovery` requires
an existing valid pair and clears only the temporary state after replacement.
Recovery cannot restart or extend a trial. PostgreSQL requires activation and
expiry timestamps to be both null or both present, with expiry after activation.

Controlled reissuance/reset is an application-owned server service. Only a
server-authorized platform administrator can target an active or suspended
`trial_user`; administrative, deleted and missing targets are rejected. The
service calls Better Auth 1.7.3 server APIs to set the password and revoke all
target sessions. Better Auth remains the sole password-hash/verifier owner, and
its direct HTTP `admin/set-user-password` and `admin/revoke-user-sessions`
operations are denied so browser clients cannot bypass application policy.

A dedicated secret-free issuance ledger records operation UUID, per-user
monotonic version, purpose, structured reason and bounded optional note,
initiator/target, prepared/issued/superseded/failed lifecycle timestamps, safe
failure code, and optional delivery actor/time/category. It never records the
password or private channel details. One current issuance per user, unique
operation identity, expected-version comparison and a PostgreSQL advisory lock
serialize credential changes. H2A replacement and H2B reissuance share the same
per-user session advisory lock, held on a dedicated database connection across
the Better Auth mutation and finalization/failure path so Prisma transaction
timeouts cannot release the credential fence prematurely.

Preparation first sets an already-expired mandatory-replacement gate, revokes
persisted sessions and writes required safe audit. Only after the provider
password mutation, second session revocation, final state transition and audit
succeed does the response expose the generated password once. Any failure
returns no secret, never restores the old password and leaves normal access
blocked. A later explicit failure-recovery operation can supersede the failed or
abandoned attempt after acquiring the same lock. Activation reissuance retains
null trial dates; recovery preserves dates, workspace, credits and suspension.

H2C-1 keeps `trial_user` and `platform_admin` as general roles and adds a
product-owned nullable `adminProfile` (`owner`/`operator`) plus an optimistic
administrative-profile version. Trial users require a null profile;
administrators require a consistent non-null profile to exercise capabilities.
`requireAdminCapability` resolves the active session through the established
boundary and reloads current database role, profile and status for each request,
so stale browser/session claims cannot retain authority after demotion or
suspension. Pure typed policy helpers expose one testable capability matrix;
only minimal derived flags reach UI rendering and never serve as authority.

Owner-only promotion and demotion require confirmed intent and expected version,
take a per-target PostgreSQL advisory lock, execute the database transition in a
serializable transaction, revoke prior sessions and persist attributable audit
before success. Replays are idempotent and incompatible downgrade state is
rejected before partial transition. The unique owner cannot be demoted,
suspended or deleted. Settings uses distinct capability boundaries for read,
contact update, admission pause and admission resume; version fencing and
transactional audit prevent lost concurrent updates. Operators may read and
pause, while only the owner changes contact email or resumes.

Initial ownership is assigned only by the explicit
`pnpm auth:bootstrap-owner --email <email>` operational command. It defaults to
dry-run, requires confirmation for mutation and stronger confirmation in
production, accepts only an existing active administrator, serializes against a
single-owner database lock/index, is idempotent for the same owner and rejects a
different owner. The confirmed transition assigns remaining legacy
administrators as operators, revokes affected sessions and records safe audit
metadata. It never infers an email/owner or prints credentials, tokens or
  sessions. No web ownership-claim path exists; ownership transfer is available
  only through the protected two-participant H2C-2b protocol.

H2C-2a registers the official Better Auth 1.7.3 two-factor plugin on server and
client with the canonical application issuer, TOTP only, first-code
verification required, encrypted backup-code storage, a ten-minute signed
challenge and account-level lockout after five consecutive failures for 15
minutes. `modules/two-factor` follows the feature boundaries used by
`modules/users`: presentational components receive visual state/callbacks,
containers coordinate RHF/Zod forms and transient secrets, server actions parse
transport input, and server-only services authorize and coordinate Better Auth,
Prisma sessions and safe audit. QR rendering is local; the TOTP URI, manual
secret, entered codes, passwords and backup codes never enter URLs, logs,
analytics, application tables or audit metadata.

Enrollment requires an active current owner/operator session after any temporary
password replacement. Better Auth validates the current password, creates one
unverified factor and returns the URI and backup codes transiently. The service
accepts completion only after Better Auth verifies the first TOTP and an
authoritative reload observes both `User.twoFactorEnabled = true` and the single
`TwoFactor.verified = true` row. It then preserves only the replacement session,
revokes the others and shows the codes once from mounted UI memory. Regeneration
is self-service for either profile, requires a verified session created within
15 minutes, current password and explicit confirmation, overwrites all prior
codes and revokes other sessions. Existing codes are never revealed.

Credential login for an enabled administrator creates and immediately discards
Better Auth's provisional password session, then carries only its signed
two-factor context. TOTP or a single-use backup code creates the definitive
session; the application reloads role, profile, status, credential/workspace
readiness and both MFA states before returning success. Suspension, demotion or
profile inconsistency during the challenge fails closed and removes any newly
created session. Session hooks suppress provisional/rotation login and logout
events; the MFA service records one final login success only after post-factor
authorization. All public Better Auth two-factor endpoints, email/SMS OTP,
trusted-device payloads, disablement and generic admin endpoints are denied at
the HTTP boundary; trusted in-process services are the only enrollment and
challenge callers.

Better Auth's enable/verify sequence, session persistence and application audit
are separate durability boundaries, not one transaction. Authorization requires
both MFA persistence states so the flag/row split never grants access. If MFA
persists but audit or post-verification checks fail, the factor is not rolled
back unsafely; the new session is revoked and the administrator signs in again.
A consumed backup code remains consumed if later session/audit work fails. If an
enrollment/replacement session cannot be identified safely, all sessions for the
actor are revoked. Operations reconcile missing safe audit events from server
  diagnostics without handling factor secrets. H2C-2b adds controlled
  administrator recovery, total-factor-loss handling, takeover resistance,
  reinforced confirmations and protected ownership transfer without weakening
  this enrollment/challenge boundary.

H2C-2b step-up is a shared `server-only` boundary. It resolves the definitive
current session, enforces a maximum age of 15 minutes, reloads current
administrator/MFA state, and calls Better Auth 1.7.3 `verifyPassword` followed
by `verifyTOTP` with `trustDevice: false`. In this installed version TOTP can be
verified from the existing session without minting a new session; the service
compares the actor's session set before and after and deletes/fails closed on
any unexpected addition. Secrets exist only in the server action call. Better
Auth's persistent five-failure account lock applies to sign-in challenges; its
session-context TOTP branch does not increment that counter, so H2C-2b relies on
the official validation and application request throttling without claiming a
new lockout semantic.

Operator MFA recovery remains in `modules/users`: the owner-only service performs
step-up, then uses the target advisory lock and a serializable transaction to
revalidate both identities, operation fingerprint and expected version. The
same transaction updates the flag/version, deletes the factor, revokes every
target session and persists the operation ledger plus mandatory audit. Because
all mutable records are local Better Auth/Prisma tables, this path has no
external-provider atomicity gap.

Owner break-glass lives in authentication infrastructure, not a web action. The
dry-run-first `auth:recover-owner-mfa` command requires explicit owner selection,
operation ID, structured reason, safe reference and reinforced production
confirmation. Mutation acquires the global ownership advisory lock and owner
lock before one serializable factor/flag/session/ledger/audit transaction. Its
output is aggregate and contains no identity, credential, factor or token.

Ownership transfer uses a 30-minute globally unique pending record and an
append-only security-operation ledger. Every read/write evaluates expiry;
cancel, decline, expiry and acceptance are terminal. Acceptance locks the global
ownership key, then both users in deterministic identifier order, reloads
role/profile/status/version/credential/workspace/MFA and verifies the recipient.
Two guarded profile updates run inside the same serializable transaction: the
old owner is demoted before the target is promoted so the immediate partial
unique owner index cannot depend on row-update order. MVCC keeps the former
single-owner state visible until commit; failure of either update rolls back
both, and a post-swap count must still equal one. The transaction also stores both profile transitions,
completes the transfer/operation ledger, writes attributable audit and revokes
both session sets. Cookie caching remains disabled, so old cookies retain no
authority after commit.

### 15.3 Authorization enforcement

Authorization is evaluated:

- Before issuing upload authorization.
- Before accepting a processing run or credit reservation.
- At every workflow step using current state.
- Before audio playback or transcript access.
- Before reading or revising a proposal.
- Before manual client/request CRUD, status changes, and reassignment.
- Before readiness.
- Before record-plan preparation and commit.
- Before every assistant tool execution.
- Before administrator content inspection.
- Before deletion or account cleanup.

Administrator role alone does not grant a capability or bypass auditing. A
current consistent owner/operator profile and both authoritative verified MFA
states are required. Trial-user identity never grants platform administration.

## 16. Persistence architecture

### 16.1 PostgreSQL ownership

Neon PostgreSQL is the authoritative store for:

- Better Auth and product identity associations.
- Workspaces and roles.
- Conversation and processing state.
- Audio artifact metadata, not audio bytes.
- Transcript and derived segment metadata/content.
- Extraction proposals and revisions.
- Clients and service requests.
- Record plans, approvals, operation intents, and outcomes.
- Assistant threads, messages, tool invocations, and approval state.
- Credit ledger and reservations.
- Audit, outbox, cleanup, and reconciliation state.

The logical entity and field definitions are maintained in
[data-model.md](data-model.md). Shared operation receipts distinguish manual
origins from conversational batches; a reused client keeps its original origin.

### 16.2 Prisma ownership

Prisma ORM owns the application relational schema, migrations, integrity
constraints, and transactional data access. Production schema changes use a
controlled migration process and are not generated or applied dynamically by
the application during ordinary requests.

Database constraints reinforce workspace ownership, operation uniqueness,
idempotency, valid references, and immutable final artifacts where practical.
Client email/phone lookup keys are deliberately nonunique because reviewed
duplicates may be legitimate. Client deletion is restricted while any request
references it; concurrent insertion/reassignment must respect that restriction.
Mutable record versions reject stale edits and invalidate dependent plans. Application
authorization remains required even when a database constraint also protects an
invariant.

### 16.3 Object storage ownership

The configured private S3-compatible provider stores audio bytes; Supabase
Storage is the initial provider. PostgreSQL stores the authoritative association
between an object artifact, conversation, workspace, validation status, and
deletion lifecycle.

Private storage is mandatory because audio may contain personal and business
information. Public object URLs are not part of the product contract.

### 16.4 Retention and deletion

The original baseline retained content until manual deletion. The accepted
controlled-trial policy in section 26 supersedes indefinite trial retention:
14 days from activation, then 30 read-only days and warned account cleanup.
Implementation remains pending. Earlier deletion remains available when:

- The owning trial user deletes a conversation.
- The platform administrator deletes content or the account.
- A required integrity/security cleanup removes an invalid orphan.

Relational deletion and object-storage deletion cannot be assumed to be one atomic
transaction. The database records the requested deletion and cleanup state;
asynchronous cleanup deletes the object and reconciles completion or failure.

Account deletion traverses every workspace-owned domain and leaves only the
minimum non-content audit proof required to demonstrate that the deletion and
administrator action occurred.

Conversation deletion preserves confirmed clients and requests. Null their live
source references and retain a minimal source-deleted indication through operation
provenance; remove original/derived transcript, proposal revisions, content-bearing
plan payloads, and referencing assistant threads. Cancel runs before cleanup so
late results cannot resurrect content. Individual request deletion retains its
client; client deletion requires prior deletion/reassignment of all its requests.

## 17. Security and privacy architecture

### 17.1 Media security

- Microphone access requires browser permission and explicit user action.
- Active recording is continuously visible.
- Upload authorization is short lived, operation bound, and workspace bound.
- Audio remains private at rest and in transit.
- Playback requires current application authorization.
- Provider access occurs through trusted server execution.
- Audio content is excluded from routine logs and traces.

### 17.2 AI data security

- Speech and language providers receive only declared task data.
- Extraction receives text rather than raw audio.
- The assistant receives bounded tool results rather than unrestricted database
  access.
- Provider responses are untrusted and schema/domain validated.
- Prompts, schemas, aliases, and tools are controlled by the application.
- No model can access application secrets, authentication records, or provider
  credentials.

### 17.3 Administrative access

The platform administrator can inspect all trial content for demonstration
support and troubleshooting. The product discloses this capability before trial
use.

Every administrative content access records:

- Administrator identity.
- Target user and workspace.
- Resource type and identifier.
- Declared reason.
- Time and correlation identifier.
- Result and any subsequent administrative action.

### 17.4 Sensitive-data boundary

The product is not designed for payment-card data, medical records, or regulated
high-risk decisions. When detected, excluded sensitive data is redacted or
blocked from persisted proposals, manual record submissions, assistant tool
results, and service-request notes according to policy. The human review surface
explains the omission without reproducing the protected value. Private original
audio/transcript remains until deletion; any evidence supplied to the assistant
is filtered. Detection does not claim complete coverage of all sensitive content.

## 18. Usage, limits, and resilience

### 18.1 Baseline limits

- Ten initial processing credits per trial account.
- One credit per successful conversation-processing run.
- Ten-minute maximum recording duration.
- 25 MB maximum audio size.
- Supported WebM, MP3, M4A/MP4, WAV, and OGG inputs.
- Bounded concurrent processing per workspace and platform.
- Bounded assistant steps, tokens, tool calls, duration, and result size.
- Independent provider rate and cost ceilings.

Limits are enforced by the trusted application, not only by the UI or external
provider.

### 18.2 Retry and circuit behavior

Transient provider and infrastructure failures use bounded exponential backoff
or the equivalent managed retry policy. Non-retryable validation, authorization,
quota, or policy failures fail without repeated provider cost.

Repeated provider failure opens an application-level circuit or disables the
affected task alias. Independent kill switches control:

- Speech processing.
- Structured extraction.
- Assistant inference.
- Assistant writes.
- All AI execution.

A disabled later stage preserves earlier finalized artifacts and explains the
available recovery path.

### 18.3 Idempotency

Stable idempotency applies to:

- Upload completion.
- Processing-run creation.
- Credit reservation, consumption, and restoration.
- Provider-result persistence.
- Transcript finalization.
- Extraction proposal creation.
- Workflow and queue delivery.
- Tool approval and execution.
- Record-plan commit.
- Audit/outbox publication.
- Object-storage cleanup.
- Temporary-credential reissuance, supersession, failure recovery and delivery
  acknowledgment.
- Administrator MFA recovery, owner break-glass and every ownership-transfer
  transition.

## 19. Audit, metrics, and observability

### 19.1 Correlation

One correlation chain connects:

```text
user action
  -> conversation
  -> audio artifact
  -> processing run
  -> workflow steps
  -> speech invocation
  -> extraction invocation
  -> proposal revision
  -> record plan and confirmation
  -> Prisma transaction
  -> resulting records
```

Assistant activity additionally connects thread, message, model invocation,
tool call, approval, operation intent, and result.

### 19.2 Metrics

Operational metrics include:

- Sign-in and account failure rates.
- Active/suspended trial accounts.
- Credits allocated, reserved, consumed, restored, and remaining.
- Recording/upload success and rejection by reason.
- Processing queue time and per-stage latency.
- Speech, diarization, extraction, and agent success/failure.
- Provider latency, rate-limit, usage, and cost metadata.
- Conversations awaiting review.
- Duplicate findings and record-plan conversion.
- Approval acceptance/denial/expiry.
- Record commit and reconciliation outcomes.
- Deletion backlog and object-storage cleanup failures.
- Administrative content-access frequency.

### 19.3 Logging and traces

Structured logs and traces carry identifiers, stage, duration, outcome, safe
reason, provider alias, attempt, and correlation. They do not include
passwords, sessions, provider secrets, full audio, unrestricted transcript,
complete contact data, hidden prompts, or raw model responses by default.

### 19.4 Alerts

Administrator alerts cover:

- Authentication abuse or elevated failure.
- Cross-workspace authorization attempts.
- Credit-ledger invariant failure.
- Upload or private-playback failure.
- Workflow backlog or stuck processing.
- Provider outage, rate limit, or circuit opening.
- Extraction validation degradation.
- Agent tool failure or unexpected approval behavior.
- Record reconciliation backlog.
- Object-storage deletion failure.
- Audit persistence failure.

## 20. Data flow and trust-boundary summary

```text
[Untrusted browser]
   | session, user intent, bounded upload request
   v
[Trusted Next.js application on Vercel]
   |-- Better Auth: identity/session result
   |-- Workspace Authorization: server-resolved tenant
   |-- Prisma -> [Neon PostgreSQL]
   |-- bounded upload grant -> [Private S3-compatible storage / Supabase]
   |-- identifiers/checkpoints -> [Vercel Workflow / Queues]
   |       |-- authorized audio -> [AssemblyAI]
   |       |-- minimized transcript -> [Groq via AI SDK]
   |       `-- normalized results -> [PostgreSQL]
   |-- bounded tools -> [AI assistant via AI SDK/Groq]
   `-- metadata-only telemetry -> [Observability platform]
```

Trust rules:

- Browser claims are validated.
- Session identity determines workspace.
- Storage location does not determine authorization.
- Workflow delivery does not prove current eligibility.
- Provider output does not prove truth.
- Model intent does not authorize a tool.
- Tool selection does not authorize a write.
- User approval is valid only for the exact current plan.
- Database commit, not model prose, determines the write result.

## 21. Testing and architecture verification

### 21.1 Contract verification

- Speech-provider contract tests normalize original text, speaker segments,
  unknown attribution, warnings, failures, and usage.
- AI-provider contract tests validate structured extraction and bounded agent
  behavior without leaking provider-specific types.
- Storage contract tests verify private upload, verification, playback, and
  deletion behavior.
- Workflow contract tests verify checkpoint, retry, redelivery, and idempotency.
- Prisma integration tests verify constraints, atomic record creation, credit
  ledger invariants, and deletion traversal.
- Business contract tests cover required contacts, international phone handling,
  declared enums/transitions, duplicate acknowledgment, stale edits, and
  same-workspace reassignment.

### 21.2 Security verification

- Cross-workspace resource identifiers are rejected across every surface and
  assistant tool.
- Suspension and session revocation block subsequent access.
- Temporary credentials cannot access workspace content.
- Concurrent or replayed administrative credential operations cannot produce
  two successful current issuances, and superseded credentials cannot retain
  access.
- Upload and playback grants cannot be reused outside their bound operation.
- Transcript prompt injection cannot expand tools or workspace scope.
- Write tools pause for exact approval and reject forged, denied, expired,
  replayed, or stale approval.
- Administrator content inspection always creates an audit record.
- Secrets and sensitive content are absent from standard logs.
- Manual and conversational creation share authorization/confirmation services;
  assistant tools cannot accept manual-origin arbitrary creation payloads or
  invoke direct UI edit/delete capabilities.

### 21.3 Failure verification

- Invalid media fails before credit consumption.
- Duplicate processing requests reserve only one credit.
- Speech failure preserves audio and restores credit at terminal exhaustion.
- Diarization failure preserves original transcript and permits policy-approved
  unattributed review.
- Extraction or validation failure preserves finalized transcript artifacts.
- Duplicate workflow/queue delivery creates no duplicate artifacts.
- Database uncertainty reconciles before record retry.
- Object-storage deletion failure remains visible and retryable.
- Provider kill switches preserve unaffected data and present safe user status.
- Any request failure rolls back the entire approved batch; duplicate delivery
  and a second plan cannot create another batch for the same conversation.
- Reprocessing preserves prior human revisions and invalidates old plans.
- Success versus cancellation settles a reservation once; late results cannot
  recreate cancelled/deleted content or charge a restored reservation.
- Restricted client deletion holds under concurrent request creation/reassignment.
- Better Auth, post-rotation and mandatory-audit failures disclose no temporary
  credential and retain a repairable fail-closed gate.

### 21.4 End-to-end acceptance

The architectural acceptance suite covers:

- Spanish microphone recording to confirmed client/request creation.
- English prepared-file upload to confirmed client/request creation.
- Direct workspace and assistant creation producing equivalent plans and
  transactional outcomes.
- Existing-client selection after duplicate detection.
- Credit allocation, reservation, consumption, restoration, and replenishment.
- Trial-user isolation and audited administrator support access.
- English/Spanish functional and safety-message parity.
- Manual conversation deletion and complete account cleanup.
- Manual forms create and manage records before any conversation exists.
- One audio with several needs creates independently tracked requests for one
  client through one exact confirmed transaction.
- Conversation deletion preserves confirmed business records and deletes
  source evidence, plan content, and referencing assistant threads.

## 22. Delivery architecture by phase

### Phase 1: Secure foundation

One Next.js/Vercel deployment, Better Auth identity, administrator and trial
roles, product-owned owner/operator profiles and server-only capabilities,
personal workspace isolation, Neon PostgreSQL, Prisma migration
ownership, administrator-created accounts, temporary-password enforcement,
activation/suspension, session revocation, baseline audit, product navigation,
bilingual foundations, and production/preview separation.

### Phase 2: Manual business records

Client/request schema and CRUD services, lists/details/forms, status transitions,
reassignment, restricted deletion, duplicate lookup, optimistic concurrency,
and shared manual-origin record-plan/confirmation/transaction services.

### Phase 3: Audio plane

Browser recording, prepared-file input, direct private S3 upload, artifact
verification, playback authorization, and deletion reconciliation.

### Phase 4: Durable processing plane

Vercel Workflow/Queues, AssemblyAI speech adapter, immutable transcript,
separate speaker segmentation, step checkpoints, failure recovery, provider
health, and basic credit allocation/reservation/restoration. Consumption is
integrated with phase 5 review availability, never transcription success alone.

### Phase 5: Structured record plane

Internal AI runtime, Groq extraction adapter, versioned structured proposal,
deterministic validation, human review, duplicate detection, record plan,
confirmation, and atomic Prisma commit of one client and N requests through
phase 2 services. Add preserved-revision reprocessing and successful-processing
credit settlement.

### Phase 6: Agent plane

Streaming assistant, bounded AI SDK agent loop, workspace-scoped read tools,
write preparation, approval, shared commit service, prompt-injection controls,
and agent observability.

### Phase 7: Administration and operations

Complete dashboard, credit replenishment/usage UI, support access, audit search,
health views, limits/circuits/kill-switch controls, metrics/alerts, full account
deletion, and cleanup reconciliation across implemented domains.

### Phase 8: Integrated baseline verification

Bilingual parity, accessibility, security/concurrency/failure acceptance,
prepared demo audio, reproducible manual/conversation/assistant scripts, and
real deployment/setup/operating guidance.

### Phase 9: Public trial evolution (deferred)

Email verification, CAPTCHA, registration throttling, active-account cap,
closed-registration behavior, and safe self-service onboarding.

Phases 1-8 are required baseline work. Each phase implements its own security,
audit, translation, bounded usage, and cleanup controls immediately; later
phases complete operator surfaces and integrated acceptance. See the
[requirements index](requirements/index.md) for phase ownership and dependencies.

## 23. Future extension points

The architecture permits, but does not include:

- A new browser, mobile, VoIP, or WebRTC audio-source adapter.
- Real-time transcription as a provisional artifact separate from final
  processing.
- Alternative speech providers, including a provider with improved
  diarization.
- Independent extraction and assistant model/provider replacement.
- Additional record templates such as sales lead, support case, incident, or
  meeting commitments.
- External CRM or field-service record destinations.
- Shared team workspaces and organization membership.
- Assistant update tools with stronger field-level policy and confirmation.
- MCP exposure over the same bounded application services.
- Configurable automatic retention after legal and product policy is defined.
- Extraction of the workflow or AI runtime into a separate deployable service
  if actual scale, runtime duration, or organizational ownership requires it.

None of these extensions may weaken workspace isolation, original-evidence
preservation, deterministic validation, explicit write confirmation,
idempotency, or auditability.

## 24. Architecture decisions

| ID | Decision | Rationale |
| --- | --- | --- |
| CPD-ADR-001 | Use a modular serverless monolith. | One application is appropriate for a portfolio demo while logical boundaries preserve maintainability. |
| CPD-ADR-002 | Deploy the complete application on Vercel. | It provides one operational surface for web, trusted execution, preview deployments, workflow integration, and HTTPS. |
| CPD-ADR-003 | Do not introduce NestJS or a continuously running worker. | The selected managed Vercel execution model covers the baseline without a second backend deployment. |
| CPD-ADR-004 | Use Better Auth for application identity. | It supports the required account, session, role, suspension, and administrator lifecycle within the application. |
| CPD-ADR-005 | Use Neon PostgreSQL with Prisma ORM. | PostgreSQL provides transactional authority; Prisma owns schema, migrations, data access, and atomic commits. |
| CPD-ADR-006 | Use an application-owned S3-compatible storage boundary, with Supabase Storage as the initial provider, and upload audio directly through short-lived signed operations. | Large media bypasses application request-body limits, remains under application authorization, and can move to another S3-compatible provider without changing domain services. |
| CPD-ADR-007 | Use Vercel Workflow for processing and Queues where lower-level delivery is needed. | Managed durable execution removes the need for a persistent worker while retaining retry and recovery. |
| CPD-ADR-008 | Use AssemblyAI as the initial speech and diarization provider. | It supports the required post-recording original transcript and speaker segmentation for the initial languages. |
| CPD-ADR-009 | Store original and speaker-derived transcript artifacts separately. | Speaker attribution is fallible and must never overwrite primary evidence. |
| CPD-ADR-010 | Use AI SDK as an internal AI integration layer. | It provides one governed abstraction for provider-backed structured tasks and agent execution. |
| CPD-ADR-011 | Use Groq as the initial extraction and assistant provider. | Extraction and agent inference can be resolved independently through stable aliases. |
| CPD-ADR-012 | Keep extraction closed and tool-free. | Structured intake requires predictable bounded input/output and no operational authority. |
| CPD-ADR-013 | Give the assistant only registered application tools. | The agent remains useful without direct database, network, provider, or administrative access. |
| CPD-ADR-014 | Require approval for every assistant write. | Model reasoning alone cannot authorize operational state changes. |
| CPD-ADR-015 | Share one record-plan and commit service between workspace and assistant. | All writes receive identical duplicate, validation, confirmation, idempotency, transaction, and audit behavior. |
| CPD-ADR-016 | Resolve workspace scope only from authenticated server context. | Browser and model input cannot select another tenant. |
| CPD-ADR-017 | Use a ledger for credits. | Reservations, consumption, restoration, retries, and admin adjustments remain explainable and auditable. |
| CPD-ADR-018 | Original manual-only retention is superseded for controlled trials by section 26. | Retain explicit cleanup and implement accepted trial expiry followed by warned account cleanup. |
| CPD-ADR-019 | Allow disclosed, audited platform-admin content access. | The operator can support demonstrations while every privileged inspection remains attributable. |
| CPD-ADR-020 | Keep infrastructure and model providers behind application contracts. | The product can replace providers without changing domain lifecycle or persisted product meaning. |
| CPD-ADR-021 | Shared Record Plan Service accepts manual client, manual request, and conversational batch operation kinds. | Supersedes the former assumption that every plan must have a source revision; only conversational plans need readiness and are assistant-write eligible. Accepted 2026-09-06. |
| CPD-ADR-022 | A conversational transaction creates one selected client and N requests, once per conversation. | Supersedes the single-request transaction in former section 14; operation uniqueness and atomicity apply to the whole set. Accepted 2026-09-06. |
| CPD-ADR-023 | Use the data-model.md business field contract and UI CRUD with version checks. | Supersedes the former direct creation/read-only description and budget representation; contact lookup is nonunique, client deletion restricted. Accepted 2026-09-06. |
| CPD-ADR-024 | Settle credits atomically with successful review availability, or restore on failure/earlier cancellation. | Supersedes the former end-to-end step 21 credit ambiguity; terminal retry creates a new run, and late delivery cannot settle twice. Accepted 2026-09-06. |
| CPD-ADR-025 | Source deletion removes original/derived content and referenced assistant threads while preserving confirmed business records. | Defines former unspecified provenance/cascade behavior; cleanup outbox survives source removal and blocks resurrection. Accepted 2026-09-06. |
| CPD-ADR-026 | Nine phases deliver manual business services before audio automation; public signup is deferred phase 9. | Supersedes the former eight-phase ordering; security, audit, translation, and cleanup remain incremental. Accepted 2026-09-06. |

## 25. Official references

- [Next.js documentation](https://nextjs.org/docs)
- [Next.js Backend for Frontend guidance](https://nextjs.org/docs/app/guides/backend-for-frontend)
- [Vercel documentation](https://vercel.com/docs)
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
- [Supabase Storage S3 authentication](https://supabase.com/docs/guides/storage/s3/authentication)
- [Supabase Storage S3 compatibility](https://supabase.com/docs/guides/storage/s3/compatibility)
- [Vercel Queues](https://vercel.com/docs/queues)
- [Better Auth documentation](https://better-auth.com/docs)
- [Better Auth admin capability](https://better-auth.com/docs/plugins/admin)
- [Prisma ORM documentation](https://www.prisma.io/docs/orm)
- [Prisma migrations](https://www.prisma.io/docs/orm/prisma-migrate)
- [Neon documentation](https://neon.com/docs)
- [AssemblyAI pre-recorded transcription](https://www.assemblyai.com/docs/getting-started/transcribe-an-audio-file)
- [AssemblyAI speaker diarization](https://www.assemblyai.com/docs/pre-recorded-audio/label-speakers)
- [AI SDK documentation](https://ai-sdk.dev/docs)
- [AI SDK tool calling and approval](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Groq documentation](https://console.groq.com/docs/overview)

## 26. Controlled-access operating constraint (2026-09-09)

The [accepted product policy](product-source-of-truth.md#25-controlled-trial-policy-accepted-2026-09-09)
requires manual admission and zero USD of hosting/provider cash expense.
This records the user's operating constraint; it does not select a new
architecture, migrate providers or claim the current deployment meets it.

The current stack remains Vercel/Workflow, Neon, Supabase private storage,
Groq and AssemblyAI. Manual provisioning does not resolve
[Vercel Hobby's non-commercial-use restriction](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)
or [AssemblyAI's finite free introductory credit](https://www.assemblyai.com/docs/billing-and-pricing).
Validate account eligibility, remaining balances, recurring quotas, storage,
transfer, hosting/database/workflow usage and shared-project consumption before
setting safe admission capacity. No paid upgrade or automatic recharge is
authorized. Pause affected operations when free capacity cannot be assured.

The landing contact route creates no account automatically. A typed platform
settings singleton stores an administrator-managed business contact email and
an independent admission switch. The bilingual RHF/Zod form validates bounded
contact data at browser and server boundaries, then prepares a `mailto` message
in the visitor's own mail application. The application does not persist the
visitor's form values or send email server-side. A human approves each
individual trial; trusted administration provisions it and temporary-password
replacement gates workspace use. Unused temporary credentials expire after 72
hours without starting the 14-day trial. Provisioning generates the temporary
password on the server and shows it once to the authorized administrator; no
plaintext password is stored or audited. Recovery-purpose replacement preserves
the original trial dates. Controlled administrative activation reissuance and
recovery reset use a secret-free issuance ledger, revoke every target session
and expose the new credential only in the immediate result. Delivery
acknowledgment stores only a general channel category; the human private-channel
procedure remains operational rather than automated, and no public request
database or new email service is selected.
Owner/operator separation is implemented as an application-owned profile and
centralized server-only capability boundary; it does not add public Better Auth
roles or browser-authoritative permissions. Administrator TOTP MFA, backup
codes and second-factor login challenge are implemented and migrated in
H2C-2a. Administrative MFA recovery, owner break-glass and protected ownership
transfer are the bounded H2C-2b increment.

Current read-only migration status reports ten versioned migrations applied and
the schema up to date, including `20260910210000_admin_profiles` and
`20260910223000_admin_totp_mfa`. Aggregate evidence observes exactly one active
MFA-ready owner and no invalid role/profile/status/credential/workspace/MFA
combination without exposing identity. The authorized real H2C-2a administrator
journey remains a separate operational check.

REQ-001 owns access/credential completion; REQ-007 owns global free-tier
controls, bounded audited extensions and expiry/cleanup. Per-account credits
do not cover failed calls, assistant inference or storage. A provisional
25-active-trial ceiling must be reduced if free capacity requires it.
REQ-009 remains excluded from this roadmap and deferred until a separate
explicit future scope decision, even after baseline acceptance.
