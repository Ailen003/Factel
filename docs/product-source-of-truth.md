# Conversation Processing Demo Product Source of Truth

## 1. Authority and document boundaries

This document is the product source of truth for the **Conversation Processing
Demo**. The name is intentionally neutral and may be replaced by a commercial
brand without changing the product definition.

The document describes the intended product baseline. It is not a statement of
current implementation progress and does not narrow the product to whatever is
available in an early prototype.

The companion `solution-architecture.md` defines the system architecture that
realizes this product. When the documents appear to conflict:

1. This document owns product behavior, scope, users, permissions, and outcomes.
2. The solution architecture owns technology, service boundaries, hosting,
   communication, operational controls, and deployment topology.
3. Security, privacy, authorization, and explicit-confirmation requirements are
   mandatory in both documents.
4. A recorded decision supersedes older explanatory text only when the decision
   explicitly identifies the superseded behavior.

The companion [data model](data-model.md) defines logical fields, relationships,
and integrity/deletion rules under these authorities. The phase requirements
curate implementation scope without replacing the sources. The decisions dated
2026-09-06 below establish the current baseline; application code still contains
scaffold behavior and is not evidence that this baseline is implemented.

The package is independent from Jobber, VoIP, MCP, and any external CRM. Those
systems may later be connected through replaceable adapters, but none is
required for the baseline demonstration.

## 2. Product definition

Conversation Processing Demo is a multiuser web application that turns an
authorized recorded conversation into reviewed, structured business records.
It demonstrates the complete operational chain from human speech to a governed
write:

```text
Recorded or uploaded conversation
  -> original transcript
  -> derived speaker segmentation
  -> structured client and service-request proposal
  -> deterministic validation
  -> human review
  -> duplicate resolution
  -> explicit confirmation
  -> client and service-request records
```

The product also includes an AI assistant that can answer questions using the
signed-in user's own conversations, clients, and service requests. The
assistant can prepare record creation, but every write requires explicit user
approval and passes through the same application-owned record-plan service as a
direct workspace action.

The product is a reusable portfolio demonstration rather than a sector-specific
phone integration. Browser microphone recording and audio-file upload are the
initial audio sources. Client and service-request records are the initial target
domain.

The demonstration business is a technical-services company: installation,
repair, maintenance, inspection, and other services. This is an illustrative
catalog, not an industry integration. Ordinary forms support manual client and
request CRUD. Conversation processing prepares the same business data, with one
client and one or more independently reviewable requests per conversation.

## 3. Product outcomes

The product must demonstrate that an organization can:

1. Capture an in-person business conversation from a browser microphone.
2. Run a consistent demonstration from a prepared audio file.
3. Preserve a literal, reviewable transcript as source evidence.
4. Derive timestamped `Speaker A`, `Speaker B`, and unknown-speaker segments
   without treating speaker attribution as unquestioned fact.
5. Extract useful client and service-request information with provenance,
   confidence, missing-data, ambiguity, and conflict indicators.
6. Let a human correct the proposal before it becomes operational data.
7. Reuse a likely existing client instead of silently creating a duplicate.
8. Require an exact preview and confirmation before creating records.
9. Let an AI assistant safely consult the user's data and prepare the same
   bounded record creation.
10. Keep every trial user's data isolated while giving the platform
    administrator controlled and audited operational access.
11. Present the complete experience in English and Spanish.
12. Create, edit, inspect, and delete business records through ordinary forms.
13. Turn multiple independent needs in one conversation into separately tracked
    requests for one client, confirmed together in one atomic creation.

## 4. Product surfaces

### 4.1 Trial workspace

The authenticated trial workspace is the primary user surface. It provides:

- A dashboard showing remaining processing credits, recent conversations,
  clients, service requests, and processing health.
- A **Record conversation** flow using the browser microphone.
- An **Upload recording** flow for supported audio files.
- Visible recording status, elapsed time, microphone activity, and an explicit
  stop control.
- Conversation processing state and recoverable failure information.
- Authorized audio playback.
- The immutable original transcript.
- A separately identified speaker-segmented transcript derived from the audio.
- A structured client and service-request proposal with evidence references.
- Human correction, readiness, duplicate resolution, preview, and confirmation.
- Lists and detail views for created clients and service requests.
- Normal client and request forms for manual creation, editing, status changes,
  reassignment, and confirmed deletion, using the same domain rules as intake.
- An AI assistant scoped to the current user's workspace.
- Manual deletion of conversations and their associated artifacts.

The workspace does not expose provider credentials, unrestricted database
access, arbitrary model execution, or another user's data.

### 4.2 AI assistant

The assistant is a conversational operational surface within the authenticated
workspace. It can:

- Find and inspect the user's conversations.
- Retrieve original and speaker-segmented transcript evidence when authorized.
- Search and inspect the user's clients.
- List and inspect the user's service requests.
- Explain missing or ambiguous information in a processed conversation.
- Prepare a client and service-request creation plan from an eligible reviewed
  conversation.
- Request explicit approval for the exact plan.
- Execute the approved plan through the shared record-plan service.

The assistant cannot:

- Choose or override a workspace identifier.
- Access another trial user's content.
- Create records without explicit approval.
- Update or delete clients or service requests in the baseline.
- Change users, passwords, roles, credits, provider settings, or platform
  configuration.
- Call arbitrary URLs, database queries, model endpoints, or undeclared tools.
- Treat instructions found inside transcripts or records as trusted system
  instructions.

### 4.3 Platform administration

The platform administration surface is available only to the platform
administrator. It provides:

- Trial-user creation with temporary credentials.
- Password reset and forced replacement of temporary credentials.
- User activation, suspension, session revocation, and account deletion.
- Per-user processing-credit assignment and replenishment.
- User, conversation, client, service-request, usage, and processing inspection.
- Provider health, workflow failures, retry state, and platform kill switches.
- Audit search, including every administrative content-access event.

The administrator is technically permitted to inspect all trial content for
demonstration support and troubleshooting. This access is disclosed to trial
users, requires an active administrator session, and always creates an audit
event identifying the administrator, target workspace, resource, reason, and
time.

### 4.4 Future public registration

Excluded from the current controlled-access roadmap by the 2026-09-09 decision
in section 25. A separate explicit future scope decision is required to reopen
REQ-009; baseline completion does not activate it.

The product model supports a later public-registration mode. When enabled, it
adds:

- Email verification.
- CAPTCHA or equivalent automated-abuse protection.
- A configurable maximum number of active trial accounts.
- Registration throttling and safe duplicate-account handling.
- A closed-registration response when platform capacity is reached.

Public registration is not part of the initial baseline. Initial accounts are
created by the platform administrator.

## 5. Product principles

1. **Transcript first.** Structured records are derived from a preserved
   transcript, not directly from opaque audio processing.
2. **Derived evidence remains fallible.** Transcription, speaker attribution,
   confidence, and extraction can be wrong and must be presented accordingly.
3. **No silent writes.** Record creation always requires an exact preview and
   explicit user confirmation.
4. **One write path.** Direct workspace actions and assistant tools use the same
   record-plan, validation, duplicate, confirmation, transaction, and audit
   services for creation. UI-only edits/deletions use the same domain authority
   and audit policy; they are not assistant tools.
5. **Workspace isolation is server-owned.** The authenticated session determines
   the workspace. Neither browser input nor model output can change it.
6. **AI proposes; application code decides.** Models cannot grant readiness,
   bypass validation, assign credits, or authorize writes.
7. **Original and derived artifacts are distinct.** Speaker segmentation never
   overwrites the immutable original transcript.
8. **Provider neutrality.** Product contracts use stable capabilities rather
   than provider-specific response formats or model identifiers.
9. **Useful failure.** A later-stage failure must not discard a successfully
   captured audio artifact or original transcript.
10. **Demonstration cost is bounded.** Processing credits, media limits,
    concurrency, provider limits, and kill switches prevent unbounded use.
11. **Bilingual parity.** English and Spanish surfaces expose the same behavior,
    states, safety information, and error recovery.

## 6. Product scope

### 6.1 Included baseline

- Administrator-created email/password trial accounts.
- One isolated personal workspace per trial user.
- Ten initial processing credits per account.
- Browser microphone recording.
- Upload of WebM, MP3, M4A/MP4, WAV, and OGG audio.
- A baseline maximum of 10 minutes and 25 MB per recording.
- Private audio storage and authorized playback.
- Durable post-recording processing with visible state.
- Original transcript preservation.
- Timestamped generic speaker diarization when available.
- Graceful operation when diarization is unavailable or unreliable.
- Versioned structured extraction for client and service-request fields.
- Deterministic validation and evidence checks.
- Human editing and readiness approval.
- Existing-client candidate detection by normalized email and phone.
- Exact record-plan preview and confirmation.
- Atomic client and service-request creation.
- Manual client and service-request CRUD with workspace ownership and version
  checks; one confirmed conversation creates/reuses one client and creates all
  its reviewed requests atomically.
- Assistant read tools over workspace-owned data.
- Confirmed assistant record creation.
- English and Spanish UI.
- Audit, usage, provider, and processing observability.
- Manual conversation deletion and complete account deletion.

### 6.2 Configurable product behavior

- Initial credits assigned to a newly created account.
- Additional credits granted by an administrator.
- Maximum recording duration and upload size within provider/platform limits.
- Accepted media types.
- Enabled languages and default locale.
- Versioned required/optional field policy and controlled service vocabulary;
  the baseline defaults are fixed in section 24 and the data model, with no
  end-user schema editor.
- Provider and model aliases for transcription, extraction, and the assistant.
- Processing timeouts, concurrency, retry limits, and cost ceilings.
- Audio playback availability.
- Administrator kill switches for audio processing, extraction, agent writes,
  or the full AI runtime.
- Future public-registration capacity.

### 6.3 Outside the baseline

- VoIP provider connections or telephone numbers.
- Recording ordinary mobile or landline calls.
- WebRTC calling between remote participants.
- Capturing the audio of external meeting applications or the operating system.
- Live or provisional transcription.
- Real-time agent assistance during the conversation.
- Public user self-registration.
- User-created organizations, teams, memberships, or invitations.
- Assistant-driven update or deletion of operational records.
- Automatic record creation without per-operation confirmation.
- External CRM, field-service, helpdesk, or calendar integrations.
- MCP endpoints or tools.
- Payments, card-data capture, medical records, or regulated high-risk workflows.
- Automatic retention was excluded from the original baseline; the controlled
  trial expiry/cleanup policy in section 25 supersedes that exclusion.
- A no-code extraction-schema designer.
- Budgets, quotes, invoicing, inventory, technician assignment, and confirmed
  appointment scheduling; preferred availability remains free text.
- Custom user-authored model prompts or arbitrary tool creation.

## 7. Users and actors

| Actor | Description | Product responsibilities |
| --- | --- | --- |
| Trial User | Authenticated person evaluating the demonstration | Record/upload conversations, review results, manage own records, use the assistant, confirm writes, delete own content |
| Platform Owner | Privileged administrator responsible for the administrative trust boundary | Perform operator work; appoint/retire operators; change contact settings; resume admission; own future global-limit and global-reopen controls |
| Platform Operator | Day-to-day administrator of controlled trials | Manage trial accounts and credentials, revoke sessions, perform permitted trial deletion, read required settings and pause admission without acting on administrators or resuming service |
| Conversation Participant | Person whose speech is captured with appropriate notice and consent | Provide conversation content; has no application identity by default |
| Speech Provider | Approved provider for transcription and diarization | Convert authorized audio into original text and derived timestamped speaker segments |
| Model Provider | Approved provider for extraction and assistant inference | Process minimized declared inputs for registered tasks |
| Durable Workflow Runtime | Managed asynchronous execution capability | Execute resumable processing steps and safe retries |
| Object Storage | Private media-artifact store | Retain authorized audio and enforce protected access/deletion |

## 8. Core user journeys

### 8.1 Administrator creates a trial account

1. The administrator enters the trial user's name, email, locale, and initial
   credit allocation. The server generates the temporary password; an
   administrator cannot choose it.
2. The product creates one active user and one isolated personal workspace,
   then displays the generated credential once for delivery through the agreed
   private channel.
3. The account receives ten processing credits unless the administrator chooses
   another approved allocation.
4. The first successful sign-in requires the user to replace the temporary
   password before accessing conversation content.
5. Creation and first-password completion are audited.

### 8.2 Record a conversation

1. The signed-in user opens **Record conversation**.
2. The product displays recording notice, consent responsibility, media limits,
   and remaining credits.
3. The user explicitly grants microphone permission and starts recording.
4. The UI shows an unmistakable active-recording indicator, elapsed time, and a
   stop control.
5. The user stops the recording.
6. The browser finalizes the supported audio artifact and uploads it privately.
7. The product creates an audio-ready conversation owned by the current
   workspace.
8. The user starts processing or discards the unprocessed conversation.

### 8.3 Upload a prepared recording

1. The user selects **Upload recording**.
2. The product validates type, declared size, duration when available, and
   remaining credit eligibility.
3. The browser uploads the audio directly to private storage through an
   authorized one-time upload grant.
4. Server-side verification confirms the final artifact before it becomes
   eligible for processing.
5. The product creates an audio-ready conversation or rejects the artifact with
   a safe, actionable reason.

### 8.4 Process a conversation

1. The product transactionally reserves one processing credit, creates one
   idempotent processing run, and records a durable dispatch intent. Duplicate
   starts for the same intent or an already-active conversation return the
   existing run rather than reserving again.
2. The durable workflow starts from the processing-run identifier and validates
   that the user, workspace, audio artifact, credit reservation, deletion state,
   and speech policy remain active at every step.
3. The speech provider generates original transcript text and, when available,
   timestamped generic speaker segments.
4. The product persists the literal original transcript as immutable evidence
   and speaker segmentation as a separate derived artifact.
5. The conversation enters `TRANSCRIBED`. The run and reservation remain open
   for extraction; no processing credit is consumed yet.
6. Terminal speech failure restores the open reservation once. A later explicit
   retry creates a new run, while late delivery from the failed/deleted run
   cannot recreate content.
7. The closed extraction task receives the minimized transcript, field contract,
   locale, controlled vocabulary, and stable evidence identifiers.
8. Deterministic code validates schema, evidence, formats, sensitive-data
   policy, controlled values, required fields, and contradictions.
9. The conversation enters `NEEDS_REVIEW` with a structured proposal.
10. Publishing a structurally valid proposal for review consumes the reserved
   credit once, even when business fields need human completion. A failed
   execution without a reviewable proposal restores it. Speech success alone
   does not charge. Safe internal retries never consume another credit.

### 8.5 Review and create records

1. The user opens a conversation in `NEEDS_REVIEW`.
2. The workspace shows audio playback, original transcript, derived speaker
   view, proposal fields, evidence, confidence, missing values, and warnings.
3. The user corrects the proposal. Corrections create revisions without
   changing source transcript artifacts. They may add, remove, or correct
   individual proposed requests, keeping at least one.
4. The user marks a complete revision ready.
5. The product searches the same workspace for clients with matching normalized
   email or phone.
6. The user selects an existing client or explicitly chooses to create a new
   client after reviewing duplicate warnings.
7. The product prepares an exact plan for the selected client and all reviewed
   requests. Reusing a client does not silently update its saved fields.
8. The user confirms the current, unexpired plan.
9. One atomic transaction creates or reuses the client, creates every request
   in the approved set, links source provenance, and records the operation
   result. Partial creation is not a successful outcome.
10. The conversation enters `COMPLETED` and exposes the resulting record links.
    It cannot create a second batch, even through a different plan or channel.

### 8.6 Use the assistant for a read operation

1. The user asks a question about their conversations, clients, or requests.
2. The assistant selects only registered read tools.
3. The application resolves the current workspace from the authenticated
   session and applies authorization independently of model input.
4. Tool results return bounded data with identifiers and provenance.
5. The assistant answers using those results and does not claim access to data
   it did not retrieve.

### 8.7 Use the assistant to create records

1. The user asks the assistant to create client/request records from a reviewed
   conversation.
2. The assistant retrieves the conversation and invokes the preparation
   capability.
3. The shared record-plan service validates readiness, revision, duplicates,
   field policy, and current data.
4. The assistant presents the exact client and complete request set and asks
   for approval. A manual-origin plan is not an assistant creation capability.
5. No write occurs until the user explicitly approves that plan.
6. Approval is bound to the user, workspace, plan hash, expiration, and
   operation intent.
7. The confirmed write uses the same application service and transaction as the
   direct workspace journey.
8. The assistant reports the actual result and resulting identifiers.

### 8.8 Delete content or an account

1. A user may delete a conversation they own after an explicit warning.
2. The product cancels unfinished work, invalidates plans, removes original and
   derived text and content-bearing plan snapshots, and schedules private audio
   deletion. It deletes assistant threads referencing the conversation to remove
   retained evidence copies. Existing clients and requests remain, with a
   source-deleted indication and minimum non-content provenance/audit proof.
3. The administrator may delete a trial account after explicit confirmation.
4. Account deletion removes workspace-owned operational data and schedules
   deletion of all associated object-storage artifacts.
5. Partial cleanup is retried and remains visible to the administrator until
   reconciled.

### 8.9 Manage records through forms

1. The user creates a client with name and at least one valid contact, resolves
   duplicate warnings, previews the exact fields, and confirms the creation.
2. The user creates a request for an existing client using the field contract
   in section 24, previews it, and confirms. No conversation is required.
3. The user edits records with an explicit Save action; stale versions are
   rejected. Requests support status changes and same-workspace reassignment.
4. The user confirms individual deletion after a warning. A client with any
   associated requests cannot be deleted until they are deleted or reassigned.
5. Every mutation uses application-owned authorization, validation, and audit.
   Manual creates use the shared Record Plan Service with a manual origin.

### 8.10 Reprocess or cancel

1. Before a conversation is completed, the user may request a new extraction.
   Existing original evidence and human revisions remain intact; pending plans
   and readiness are invalidated when the new run starts.
2. The new run reserves its own credit and reuses finalized artifacts. A new
   proposal is compared with earlier revisions; adopting fields/items creates
   an authored revision rather than overwriting corrections.
3. A successful proposal publication consumes one credit; terminal failure
   restores it and leaves prior revisions available for review/readiness again.
   The user may keep the previous revision without adopting any candidate value;
   that decision does not refund a successfully published extraction. Comparison
   supports selected client fields, explicit mapping of request fields, adding
   whole requests and removing existing requests. Request correspondence is never
   inferred automatically. Pending candidate decisions block editing/readiness and
   another extraction; unsaved human edits must be saved before starting.
4. Cancelling or deleting before successful review availability restores an
   open reservation once and prevents late results from publishing. If success
   already consumed it, cancellation/deletion does not refund that run.

## 9. Conversation and record lifecycle

The conversation processing lifecycle is:

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

`FAILED`, `QUOTA_BLOCKED`, and `CANCELLED` are explicit terminal or recoverable
states. A failure records its stage, safe reason, retryability, processing-run
identifier, and correlation identifier. Resumable recovery starts from the last
safe checkpoint rather than repeating already committed side effects.

The original transcript is immutable after finalization. Speaker segments and
extraction proposals are versioned derived artifacts. User corrections produce
proposal revisions. A conversational record plan is bound to one current ready
revision and becomes invalid if the proposal, duplicate decision, or relevant
record state changes. Manual plans bind to validated form data and relevant
client versions without requiring a conversation. Every plan still requires
exact, current, unexpired confirmation.

## 10. Functional requirements

### 10.1 Identity, workspace, and administration

| ID | Requirement | Status |
| --- | --- | --- |
| CPD-FR-001 | Authenticate trial users with email and password and maintain secure application sessions. | Included |
| CPD-FR-002 | Let only a platform administrator create accounts in the initial baseline. | Included |
| CPD-FR-003 | Require replacement of administrator-issued temporary passwords before workspace access. | Included |
| CPD-FR-004 | Create exactly one isolated personal workspace for each baseline trial user. | Included |
| CPD-FR-005 | Resolve workspace identity from the authenticated session for every data access and operation. | Included |
| CPD-FR-006 | Let the administrator activate, suspend, reset credentials for, revoke sessions for, and delete trial users. | Included |
| CPD-FR-007 | Let the administrator allocate and replenish per-user processing credits. | Included |
| CPD-FR-008 | Let the administrator inspect platform users, usage, content, processing state, and provider health. | Included |
| CPD-FR-009 | Audit every administrative inspection of trial-user content. | Included |
| CPD-FR-010 | Support a future public-registration mode with verified email, CAPTCHA, throttling, and a configurable active-account cap. | Future-compatible |

### 10.2 Conversation capture and audio

| ID | Requirement | Status |
| --- | --- | --- |
| CPD-FR-020 | Capture microphone audio only after explicit browser permission and a user-initiated recording action. | Included |
| CPD-FR-021 | Display a persistent recording indicator, elapsed time, and stop control while capture is active. | Included |
| CPD-FR-022 | Accept authorized upload of supported prepared audio files. | Included |
| CPD-FR-023 | Validate media type, size, duration, ownership, and storage completion before processing. | Included |
| CPD-FR-024 | Enforce configurable media limits with a baseline of 10 minutes and 25 MB. | Included |
| CPD-FR-025 | Store audio privately and permit playback only to the owning user or an audited administrator. | Included |
| CPD-FR-026 | Prevent the browser from receiving permanent storage or provider credentials. | Included |
| CPD-FR-027 | Let a user discard an unprocessed conversation without consuming a processing credit. | Included |
| CPD-FR-028 | Let authorized users manually delete conversation content and associated audio. | Included |

### 10.3 Processing, transcription, and diarization

| ID | Requirement | Status |
| --- | --- | --- |
| CPD-FR-030 | Reserve one available credit before accepting a new processing run. | Included |
| CPD-FR-031 | Execute processing asynchronously with durable state, bounded retry, checkpoints, and idempotency. | Included |
| CPD-FR-032 | Persist literal immutable original transcript text, a content fingerprint, and safely aligned evidence for every successful transcription. | Included |
| CPD-FR-033 | Persist timestamped generic speaker segments as a derived artifact when the provider supplies diarization. | Included |
| CPD-FR-034 | Represent uncertain or unavailable speaker attribution explicitly and never fabricate a speaker label. | Included |
| CPD-FR-035 | Preserve the original transcript when diarization or a later processing step fails. | Included |
| CPD-FR-036 | Record provider, model/profile, duration, latency, usage, status, warnings, and correlation metadata for each AI invocation. | Included |
| CPD-FR-037 | Keep the run and reservation open at `TRANSCRIBED`; consume the reservation only when a valid proposal becomes available for review. | Included |
| CPD-FR-038 | Restore the reserved credit after terminal failure without review availability and avoid double charging safe retries. | Included |
| CPD-FR-039 | Show processing stage, safe failure reason, and permitted recovery action to the user. | Included |

### 10.4 Extraction and human review

| ID | Requirement | Status |
| --- | --- | --- |
| CPD-FR-040 | Execute extraction as a registered closed structured-output task with no model-callable tools. | Included |
| CPD-FR-041 | Extract configured client and service-request fields from minimized transcript evidence. | Included |
| CPD-FR-042 | Return normalized value, observed value, confidence, evidence identifiers, validation state, missing fields, ambiguities, and conflicts. | Included |
| CPD-FR-043 | Validate every extraction result against a versioned schema and deterministic domain rules. | Included |
| CPD-FR-044 | Reject or flag evidence identifiers that do not exist in the finalized transcript artifacts. | Included |
| CPD-FR-045 | Let users review audio, original transcript, speaker segments, proposal fields, and evidence together. | Included |
| CPD-FR-046 | Let users correct structured fields without modifying the original transcript. | Included |
| CPD-FR-047 | Version user corrections and preserve their authorship and time. | Included |
| CPD-FR-048 | Prevent models and background workflows from marking a proposal ready. | Included |
| CPD-FR-049 | Require an authorized user to mark a valid current proposal ready. | Included |

### 10.5 Clients, requests, and confirmed writes

| ID | Requirement | Status |
| --- | --- | --- |
| CPD-FR-050 | Maintain workspace-owned client records with name, email, phone, company, address, and notes where provided. | Included |
| CPD-FR-051 | Maintain workspace-owned requests with client, title, description, service type, priority, status, optional preferred schedule, service address, and next steps; no budget. | Included |
| CPD-FR-052 | Search for likely existing clients by normalized email and phone before proposing client creation. | Included |
| CPD-FR-053 | Require the user to resolve likely duplicate candidates before preparing a write. | Included |
| CPD-FR-054 | Prepare an exact conversational record plan bound to the current ready proposal revision and duplicate decision; manual plans use validated form data. | Included |
| CPD-FR-055 | Require an explicit, unexpired, operation-bound confirmation before record creation. | Included |
| CPD-FR-056 | Create or reuse the selected client and create the complete reviewed request set in one atomic transaction. | Included |
| CPD-FR-057 | Link created records to confirmation, actor, operation intent, and manual/conversation origin; retain source conversation/revision references while that source exists. | Included |
| CPD-FR-058 | Make confirmed writes idempotent and reconcile uncertain outcomes before retry. | Included |
| CPD-FR-059 | Invalidate a prepared plan when relevant proposal or record state changes. | Included |

### 10.6 Agentic assistant

| ID | Requirement | Status |
| --- | --- | --- |
| CPD-FR-060 | Provide a streaming assistant inside the authenticated trial workspace. | Included |
| CPD-FR-061 | Expose only registered, schema-validated, server-owned tools to the assistant. | Included |
| CPD-FR-062 | Let the assistant list and inspect workspace-owned conversations, clients, and service requests. | Included |
| CPD-FR-063 | Let the assistant prepare client/request record creation for an eligible ready conversation. | Included |
| CPD-FR-064 | Require explicit tool approval before every assistant-initiated write. | Included |
| CPD-FR-065 | Execute approved assistant writes through the same shared record-plan service used by the workspace. | Included |
| CPD-FR-066 | Prevent assistant tools from accepting a model-selected workspace or user scope. | Included |
| CPD-FR-067 | Prevent assistant-driven update and deletion of records in the baseline. | Included constraint |
| CPD-FR-068 | Bound agent steps, tool calls, context, time, concurrency, and cost per interaction. | Included |
| CPD-FR-069 | Record assistant task profile, tool calls, approvals, results, failures, usage, and correlation metadata. | Included |

### 10.7 Localization, audit, and operations

| ID | Requirement | Status |
| --- | --- | --- |
| CPD-FR-070 | Provide complete English and Spanish UI coverage for baseline user and administrator journeys. | Included |
| CPD-FR-071 | Preserve equivalent safety, confirmation, warning, failure, and deletion meaning in both locales. | Included |
| CPD-FR-072 | Audit authentication, administration, content access, processing, proposal revision, confirmation, record creation, tool approval, and deletion events. | Included |
| CPD-FR-073 | Expose provider, workflow, quota, failure, and stuck-processing health to the administrator. | Included |
| CPD-FR-074 | Provide independent kill switches for speech processing, extraction, assistant writes, and all AI execution. | Included |
| CPD-FR-075 | Keep content and credentials out of ordinary logs and minimize sensitive data in telemetry. | Included |

### 10.8 Agreed business model and manual operations

| ID | Requirement | Status |
| --- | --- | --- |
| CPD-FR-080 | Provide UI client CRUD, duplicate checks, and preview/confirmation for manual creation. | Included |
| CPD-FR-081 | Provide UI request CRUD, declared status transitions, and same-workspace client reassignment. | Included |
| CPD-FR-082 | Require client name and valid email or international phone; do not infer a missing country prefix. | Included |
| CPD-FR-083 | Use the section 24 service field contract/catalog, free-text availability, and no budget. | Included |
| CPD-FR-084 | Propose one client and one or more requests per conversation; let the human add, remove, and correct request items. | Included |
| CPD-FR-085 | Confirm the exact request set atomically and allow at most one successful creation batch per conversation. | Included |
| CPD-FR-086 | Share manual/conversational creation services with explicit origins; client reuse never silently edits saved fields. | Included |
| CPD-FR-087 | Block deletion of a client with requests; conversation deletion preserves business records with a source-deleted indication. | Included |
| CPD-FR-088 | Reprocess only before completion; preserve human revisions, require explicit adoption of a new candidate, and invalidate readiness/plans. | Included |
| CPD-FR-089 | Consume once at valid review availability; restore on failure or earlier cancellation; a post-terminal retry is a new run/reservation. | Included |

## 11. Non-functional requirements

### CPD-NFR-001 Security

- All product access uses HTTPS.
- Sessions use secure server-controlled lifecycle and revocation.
- Authorization is enforced at every read, mutation, workflow step, tool call,
  playback request, and administrative access.
- Secrets remain server-side and are never embedded in browser bundles or model
  prompts.
- Uploaded media is untrusted until server-side validation completes.
- Transcript and record content is untrusted when supplied to the assistant and
  cannot alter system policy or tool definitions.
- Passwords are never stored or logged in plaintext.
- Temporary credentials require replacement before content access.

### CPD-NFR-002 Privacy and data minimization

- The recording experience displays notice and makes the recording state
  unmistakable.
- Trial users are responsible for obtaining appropriate participant consent.
- The product discloses that the platform administrator can inspect trial data.
- Speech and model providers receive only the data required for their declared
  task.
- Audio, transcripts, contact details, and extracted records are excluded from
  ordinary application logs.
- The product does not solicit payment-card data, medical records, or other
  declared excluded sensitive classes. Detected excluded values are omitted
  from proposals, manual record submissions, and assistant results. Original
  audio/text remains private evidence until deletion; the policy does not claim
  complete detection of every sensitive passage.
- Content is retained until manual deletion or account deletion in the initial
  baseline.

### CPD-NFR-003 Reliability

- Processing steps are durable, resumable, and idempotent.
- Processing acceptance and durable-dispatch intent commit atomically; pending
  dispatch is reconciled independently of the interactive request.
- Duplicate workflow delivery cannot duplicate credits, transcripts, proposals,
  clients, requests, or audit results.
- Successfully persisted earlier artifacts survive later-stage failures.
- Provider timeouts and transient failures use bounded retries with backoff.
- A provider job creation with an uncertain outcome is reconciled rather than
  retried blindly; status polling and idempotent persistence may retry safely.
- Uncertain database write outcomes are reconciled before retry.
- Object deletion failures remain visible and retryable.

### CPD-NFR-004 Performance and limits

- Recording and upload feedback remains interactive throughout capture and
  transfer.
- A processing request returns promptly with an asynchronous status rather than
  waiting for the full AI pipeline.
- User-visible state reflects persisted workflow state.
- Read queries and assistant tools use bounded result sizes and pagination.
- Media size, duration, credits, concurrent processing, agent steps, tokens,
  time, and provider calls use server-owned limits.

### CPD-NFR-005 Auditability and observability

- Correlation spans the upload, processing run, provider invocations,
  extraction, review, record plan, confirmation, database transaction, agent
  tools, and cleanup.
- Audit events identify actor, workspace, action, resource, outcome, time, and
  correlation identifier.
- AI invocation records include task/profile versions, provider/model alias,
  input/output fingerprints, latency, usage, status, and safe failure metadata.
- Administrator content access is distinguishable from ordinary trial-user
  access.
- Operational dashboards do not expose unrestricted conversation content by
  default.

### CPD-NFR-006 Maintainability and portability

- Product modules depend on application-owned speech, model, storage, workflow,
  and record contracts rather than provider SDK types.
- Provider and model identifiers are resolved through stable aliases.
- Prompt, schema, policy, and task versions are explicit.
- English and Spanish message catalogs maintain key parity.
- The product can add new audio sources or record destinations without changing
  the core conversation lifecycle.

### CPD-NFR-007 Accessibility and usability

- Recording state is communicated visually and programmatically.
- Critical actions are keyboard accessible.
- Confirmation, destructive deletion, errors, and credit exhaustion do not rely
  on color alone.
- Audio playback and transcript navigation remain usable without speaker
  diarization.
- Both supported locales use clear non-technical language for user-facing
  failures.

## 12. Roles and authorization policy

The general identity roles remain:

| Role | Scope | Capabilities |
| --- | --- | --- |
| `trial_user` | One personal workspace | Manage own conversations; create/read/edit/delete own business records through forms; review proposals, use assistant, and confirm own writes |
| `platform_admin` | Capability-scoped platform administration | Exercise only the server-authorized capabilities assigned by the current product-owned `owner` or `operator` administrative profile |

Administrative profiles are separate from these public roles. A `trial_user`
has no administrative profile. A `platform_admin` must have exactly one current
profile, `owner` or `operator`, to exercise administrative capabilities; null or
inconsistent state fails closed. The application keeps one centralized typed
server-only capability matrix. Every administrative service/action reloads the
active user's current role, profile and status from authoritative persistence,
so promotion, demotion or suspension takes effect for existing sessions without
trusting stale browser claims. Generic Better Auth administrative permissions
exposed to the browser remain empty.

The owner can do all operator work and alone can appoint or retire operators,
change the contact email, resume admission and manage future global limits or
reopen future global pauses. Operators can list and manage trial users, create
trials, edit allowed trial data, reissue credentials, confirm delivery,
suspend/reactivate, revoke sessions, perform permitted trial deletion, read the
required Settings state and pause admission. An operator cannot act on any
administrator, change administrative profiles or its own privilege, change the
contact email, resume admission, manage global limits or reopen global pauses.
The sole owner cannot be demoted, suspended or deleted. H2C-2a requires every
active owner and operator to hold a Better Auth-owned verified TOTP factor
before any administrative capability is usable. Password-only provisional
sessions, unverified enrollment, email/SMS OTP, trusted devices and factor
disablement grant no privileged access. Ownership transfer and controlled
administrator MFA recovery remain unavailable until H2C-2b.

Trial-user "manage records" includes ordinary UI CRUD. Assistant tools remain
read/create-only and creation remains limited to ready conversations. The
administrator's content-support path does not impersonate a trial user or
silently acquire the assistant's scope.

A trial-user operation is allowed only when:

```text
active authenticated user
AND completed temporary-password replacement
AND active personal workspace
AND resource belongs to that workspace
AND required product capability is enabled
AND applicable credit, state, and confirmation policy passes
```

An assistant write is allowed only when:

```text
active authenticated trial user
AND current workspace resolved by the server
AND approved registered write tool
AND current ready proposal revision
AND resolved duplicate decision
AND exact unexpired user approval
AND unused operation intent and idempotency key
```

Administrative content access is allowed only when:

```text
active platform administrator
AND explicit target workspace and resource
AND declared support or operational reason
AND mandatory audit event
```

## 13. Data model summary

The product persists the following conceptual data domains:

- Users, credentials, sessions, roles, and temporary-password state.
- Personal workspaces and workspace ownership.
- Processing-credit balance, reservations, consumption, restoration, and
  administrator adjustments.
- Conversations, source type, locale, state, and processing correlation.
- Private audio artifact references, verified media metadata, and deletion
  state.
- Original transcript artifacts and immutable original text.
- Derived speaker segments, timestamps, generic speaker labels, confidence, and
  warnings.
- Processing runs, checkpoints, attempts, failures, and provider invocations.
- Extraction runs, task/prompt/schema versions, and structured proposals.
- Proposal fields, observed/normalized values, evidence, validation states, and
  user revisions.
- Clients, normalized identifiers, and duplicate-candidate decisions.
- Service requests with stable service/priority/status enums, client ownership,
  and manual or conversational creation provenance.
- Record plans, confirmations, operation intents, idempotency, and outcomes.
- Assistant threads, messages, tool calls, approval state, and results.
- Audit events and administrator content-access events.

No provider-specific response type is a product-domain dependency. Provider raw
references may be retained only as bounded operational metadata under the
applicable privacy policy.

## 14. Technical product baseline

The product is delivered as one Next.js and TypeScript application hosted on
Vercel. It uses Better Auth for application identity, Neon PostgreSQL for
relational persistence, Prisma ORM for schema and data access, private
S3-compatible storage for audio with Supabase Storage initially, Vercel Workflow/Queues for durable processing,
AssemblyAI for initial speech transcription and diarization, AI SDK as the
internal AI integration layer, and Groq as the initial structured-extraction and
agent-model provider.

These are baseline implementation decisions rather than permanent product
dependencies. Application-owned capability boundaries keep speech, model,
storage, workflow, database hosting, and future record destinations
replaceable.

## 15. Trust boundaries

### Browser

The browser is untrusted for identity scope, ownership, credit balance,
validation, readiness, confirmation, and provider access. It may capture audio,
upload through a narrowly authorized grant, render data, and submit user intent.

### Next.js trusted application

The trusted application authenticates users, resolves workspace scope, enforces
policy, coordinates workflows, validates AI output, owns record plans, and
executes confirmed writes.

### Durable workflow

Workflow input contains identifiers and bounded metadata. Every step reloads
current authoritative state and cannot rely solely on the state captured when
the run was queued.

### External providers

AssemblyAI and Groq receive only declared task inputs through server-side
adapters. Their outputs are untrusted until normalized and validated.

### Object storage

Audio remains private. Upload and playback authorization is short lived and
bound to the authenticated operation. A storage URL is not treated as proof of
application authorization.

### AI assistant

The model chooses among declared tools but does not control their authorization,
workspace scope, transaction semantics, approval, or result truth.

### Platform administrator

The administrator is a privileged actor with disclosed content access. Every
access and mutation remains attributable and auditable.

## 16. Product acceptance criteria

The baseline is accepted when all of the following are demonstrated:

1. An administrator creates a trial user with ten credits and temporary
   credentials.
2. The user cannot access workspace content until replacing the temporary
   password.
3. The user records a valid Spanish conversation through the microphone and a
   valid English conversation through file upload.
4. Oversized, over-duration, unsupported, incomplete, and unauthorized media is
   rejected safely.
5. One processing credit is reserved once, including under duplicate requests.
6. Processing produces an immutable original transcript.
7. Supported audio produces timestamped generic speaker segments without
   changing the original transcript.
8. A diarization failure preserves the original transcript and still permits a
   clearly qualified review path.
9. Extraction returns client and request fields with valid evidence and flags
   missing, ambiguous, conflicting, or low-confidence information.
10. Fabricated evidence identifiers and malformed model output are rejected.
11. A user correction creates a proposal revision and survives safe
    reprocessing.
12. No model or workflow can mark a proposal ready.
13. Duplicate matching identifies an existing client by normalized email or
    phone and requires a user decision.
14. An exact confirmed conversation plan atomically creates or reuses one client
    and creates every request in its approved set, with no partial batch.
15. Duplicate confirmation delivery cannot create duplicate records.
16. The assistant can retrieve only the current user's conversations, clients,
    and requests.
17. The assistant cannot execute a write before receiving approval for the
    exact current plan.
18. The assistant and direct workspace use the same record-plan and commit
    behavior.
19. A trial user cannot read, infer, or mutate another workspace's content by
    changing browser input or prompting the model.
20. An administrator can inspect content, and every inspection produces a
    searchable audit event.
21. Terminal failure without review availability restores the reserved credit.
    Safe internal retries retain the same reservation without charging twice;
    retry after terminal settlement creates a new run and reservation.
22. Manual conversation deletion removes associated content and reconciles object-storage
    deletion.
23. Account deletion removes workspace-owned data and all associated private
    audio artifacts.
24. English and Spanish journeys expose equivalent actions, warnings, states,
    confirmations, and recovery guidance.
25. Normal forms create a client and requests without a conversation, with the
    same validation, duplicate decision, and confirmed-creation services.
26. Client saving requires name and email or international phone; missing country
    prefixes, invalid supplied contacts, and stale edits are rejected.
27. Requests support the declared service catalog, priorities, status changes,
    and client reassignment, without budget or appointment functionality.
28. A client with requests cannot be deleted, including under concurrent writes.
29. Multiple independent needs in one audio produce editable request items; one
    confirmation creates the entire set for one client exactly once.
30. Client reuse never silently changes the existing client, and later deletion
    of the source preserves operational records with a source-deleted marker.
31. Reprocessing preserves corrections for comparison/adoption, invalidates old
    readiness/plans, and cannot create a second batch for a completed conversation.
32. Cancellation and successful processing racing each other settle a credit
    once; a cancelled/deleted run cannot resurrect content through late delivery.
33. Detected excluded values do not enter proposals, saved records, or assistant
    context; original private evidence remains available only until deletion.
34. Conversation deletion removes associated original/derived text, plan content,
    and assistant threads containing referenced evidence, with Blob reconciliation.

## 17. Risks and mitigations

| Risk | Product impact | Required mitigation |
| --- | --- | --- |
| A single mixed microphone produces poor speaker separation | Incorrect Speaker A/B attribution | Treat diarization as derived, show confidence/warnings, preserve original text, allow unattributed fallback |
| Background noise, echo, accents, or overlapping speech reduce transcription quality | Incorrect extracted data | Evidence-first review, editable proposal, missing/ambiguity states, no automatic write |
| A transcript contains prompt injection or instructions | Agent or extraction manipulation | Treat transcript as untrusted data, fixed task prompts, tool allowlist, server-side authorization |
| Public or shared credentials cause abuse | Unbounded cost or data exposure | Administrator-created accounts, forced password change, suspension, session revocation, credits and limits |
| Repeated processing or workflow delivery double charges or duplicates records | Cost and integrity failure | Reservations, idempotency keys, checkpoints, atomic operations and reconciliation |
| Administrator content access surprises trial users | Trust and privacy harm | Clear disclosure, reason capture, least-use practice, mandatory audit |
| Provider outage or model change blocks the demo | Unavailable processing | Stable aliases, replaceable adapters, health status, bounded retry and kill switches |
| Manual-only retention accumulates data | Storage cost and privacy exposure | Visible deletion controls, admin inventory, account cleanup, later retention-policy extension |
| Vercel Workflow/Queues changes during beta evolution | Processing portability risk | Application-owned orchestration boundary and persisted checkpoints independent of provider payloads |

## 18. Trial configuration

Before a trial user receives access, the administrator records:

- User name and email.
- Initial locale.
- Temporary credential delivery status.
- Credit allocation, defaulting to ten.
- Any non-default media or AI limits.
- Whether audio playback is enabled.
- Trial purpose or customer reference for internal administration.

Platform-level configuration includes:

- Supported locales and media types.
- Media size and duration limits.
- Speech, extraction, and assistant task profiles.
- Controlled service vocabulary and extraction field contract.
- Provider credentials and health status.
- Optional regional speech endpoint and a server-only conversation-speech
  enablement switch.
- Retry, timeout, concurrency, cost, and credit policy.
- Administrative access disclosure text.
- Feature and kill-switch state.
- Future registration mode and account capacity.

## 19. Delivery phases

### Phase 1: Secure application foundation

Next.js application baseline, Better Auth, Neon PostgreSQL, Prisma migrations,
personal workspace isolation, owner/operator administrative profiles and
server-authoritative capabilities, administrator-created trial
accounts, temporary-password replacement, activation/suspension, session
revocation, audit foundation, and separate production/preview configuration.
Adapt product navigation and preserve bilingual UI foundations.

### Phase 2: Manual clients and service requests

Business schema, lists, details, ordinary CRUD forms, status transitions,
reassignment, restricted deletion, duplicate decisions, and shared exact
creation-plan/confirmation services with manual provenance.

### Phase 3: Conversation capture

Microphone recording, prepared-audio upload, validation, private S3-compatible
storage, playback authorization, discard, and manual deletion.

### Phase 4: Durable speech processing

Vercel Workflow/Queues coordination, AssemblyAI adapter, immutable original
transcript, derived speaker segments, checkpoints, retry, failure visibility,
basic credit initialization/reservation/restoration, and provider observability.
This phase ends at the persisted `TRANSCRIBED` boundary with the run and
reservation still open. The credit success hook is completed by phase 5 when a
valid proposal reaches review; transcript success alone never consumes a credit.

### Phase 5: Structured intake and direct record creation

Closed extraction task, deterministic validation, review workspace, evidence,
user corrections, readiness, duplicate matching, exact record plan,
confirmation, and atomic creation of one client's complete request set through
the phase 2 service. Add comparison/adoption of reprocessing, creation-once
invariants, and successful-processing credit settlement.

### Phase 6: Agentic assistant

AI SDK agent runtime, workspace-scoped read tools, bounded tool loop, record-plan
preparation, per-write approval, confirmed commit, agent audit, and prompt
injection safeguards.

### Phase 7: Platform administration and operations

Complete dashboard, credit replenishment/usage views, audited support access,
audit search, provider/workflow health, alerts, limits, kill switches, complete
account deletion, and cleanup reconciliation across all product domains.

### Phase 8: Integrated baseline acceptance

English/Spanish parity, accessibility, cross-workspace isolation, concurrency,
failure/recovery verification, prepared demo audio, reproducible manual and
assistant demonstration scripts, and real setup/operating guidance.

### Phase 9: Capped public registration (deferred)

Email verification, CAPTCHA, global active-account capacity, signup throttling,
closed-registration behavior, and safe default credit allocation.

Phases 1-8 form the complete baseline. Security, translations, audit, limits,
and cleanup start in the capability that introduces the risk; phases 7-8
complete their operational surfaces and integrated verification. The ordered
[requirements index](requirements/index.md) owns delivery scope and status.

## 20. Decision log

| ID | Decision | Status |
| --- | --- | --- |
| CPD-D-001 | The product is a generic conversation-to-record demonstration, not a Jobber or VoIP feature. | Accepted |
| CPD-D-002 | Browser microphone recording and prepared-file upload are the baseline audio sources. | Accepted |
| CPD-D-003 | Processing starts after recording/upload rather than providing live transcription. | Accepted |
| CPD-D-004 | The original transcript is immutable evidence; speaker segmentation is a separate derived artifact. | Accepted |
| CPD-D-005 | AssemblyAI is the initial transcription and diarization provider behind a replaceable application contract. | Accepted |
| CPD-D-006 | Clients and service requests are the baseline record domain; CPD-D-024 supersedes the earlier single-request-per-conversation assumption. | Accepted, clarified |
| CPD-D-007 | Direct workspace and assistant writes share one record-plan and commit service. | Accepted |
| CPD-D-008 | Every record creation requires exact, explicit, operation-bound confirmation. | Accepted |
| CPD-D-009 | The assistant supports read and create capabilities but no update or delete tools in the baseline. | Accepted |
| CPD-D-010 | Each trial user owns one isolated personal workspace. | Accepted |
| CPD-D-011 | Initial accounts are created only by the platform administrator. | Accepted |
| CPD-D-012 | Public registration is a later capped mode with email verification and abuse protection. | Accepted |
| CPD-D-013 | Each new trial account receives ten configurable processing credits. | Accepted |
| CPD-D-014 | Content remains until manual deletion or account deletion in the initial baseline. | Accepted |
| CPD-D-015 | The administrator has disclosed full content access and every access is audited. | Accepted |
| CPD-D-016 | The complete product is one modular Next.js and TypeScript application deployed on Vercel. | Accepted |
| CPD-D-017 | Neon PostgreSQL is the relational store and Prisma ORM owns schema evolution and data access. | Accepted |
| CPD-D-018 | An application-owned S3-compatible boundary stores private audio, Supabase Storage is the initial provider, and Vercel Workflow/Queues execute durable processing. | Accepted |
| CPD-D-019 | AI SDK is the internal AI integration layer and Groq is the initial extraction and assistant provider. | Accepted |
| CPD-D-020 | Extraction is a closed task with no tools; the assistant is a separately governed agentic task. | Accepted |
| CPD-D-021 | The UI supports English and Spanish with equivalent product behavior. | Accepted |
| CPD-D-022 | VoIP, WebRTC calling, MCP, and external record destinations remain compatible future extensions, not baseline dependencies. | Accepted |
| CPD-D-023 | UI forms support manual client/request CRUD; shared creation accepts manual or conversation origin. Supersedes the former creation/read-only direct-surface description; assistant update/delete remain excluded. | Accepted 2026-09-06 |
| CPD-D-024 | One conversation reviews one client and N requests, confirmed atomically once. Supersedes singular-request creation in journeys, FR-056, acceptance 14, and former architecture commit steps. | Accepted 2026-09-06 |
| CPD-D-025 | Section 24 and data-model.md fix the compact technical-services field contract. No budget and no calendar; supersedes the former optional-budget field in FR-051. | Accepted 2026-09-06 |
| CPD-D-026 | Conversation deletion preserves saved business records and minimal deleted-source proof; client deletion is restricted while requests exist. Clarifies former unspecified record cascade behavior. | Accepted 2026-09-06 |
| CPD-D-027 | Successful proposal publication consumes one credit; terminal failure/earlier cancellation restores once; post-terminal retry uses a new run. Supersedes ambiguous wording tying credit outcome to record commit. | Accepted 2026-09-06 |
| CPD-D-028 | Reprocessing before completion creates a separate candidate for human adoption and preserves corrections. Completed conversations cannot create another batch. | Accepted 2026-09-06 |
| CPD-D-029 | Detected sensitive content is omitted downstream, while original evidence remains private until deletion. Clarifies the original-preservation/sensitive-data boundary. | Accepted 2026-09-06 |
| CPD-D-030 | Nine ordered phase requirements replace the former eight-phase delivery order; manual business CRUD precedes capture and public registration is phase 9/deferred. Template requirements are removed, with IDs restarted at REQ-001. | Accepted 2026-09-06 |

## 21. Change control

A product change requires updates to this document when it modifies:

- Product outcomes, users, surfaces, or scope.
- Record fields, lifecycle, readiness, confirmation, or duplicate policy.
- Assistant capabilities or tool safety.
- Authentication, administration, workspace isolation, or content access.
- Credit, media, retention, deletion, or consent behavior.
- A functional or non-functional requirement.
- An accepted decision or delivery phase.

Architecture-only changes that preserve product behavior belong in the companion
solution architecture. Provider/model replacement does not require a product
change when normalized contracts, safety, and observable behavior remain
equivalent.

## 22. Glossary

| Term | Meaning |
| --- | --- |
| Original transcript | Immutable full text produced from the authorized audio and retained as source evidence |
| Speaker segment | Derived timestamped utterance with a generic or unknown speaker label |
| Diarization | Identification of changes between distinct speakers without necessarily knowing their identities |
| Intake proposal | Structured client/request fields extracted from transcript evidence and awaiting human review |
| Ready revision | Valid proposal revision explicitly approved by the user for record-plan preparation |
| Record plan | Exact proposed client reuse/creation and service-request creation bound to current state |
| Operation intent | Server-owned identity for one confirmed write operation |
| Processing credit | Application allowance for one completed conversation-processing run |
| Personal workspace | Server-resolved tenant boundary containing one trial user's data |
| Closed extraction task | Schema-constrained AI task with no tools and no authority to change application state |
| Agentic assistant | Bounded conversational model capable of selecting registered tools under application authorization |

## 23. References

- [MediaDevices: getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MediaStream Recording API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API)
- [Next.js Backend for Frontend guidance](https://nextjs.org/docs/app/guides/backend-for-frontend)
- [Better Auth documentation](https://better-auth.com/docs)
- [Prisma ORM documentation](https://www.prisma.io/docs/orm)
- [Neon documentation](https://neon.com/docs)
- [Supabase Storage S3 authentication](https://supabase.com/docs/guides/storage/s3/authentication)
- [Supabase Storage S3 compatibility](https://supabase.com/docs/guides/storage/s3/compatibility)
- [Vercel Queues](https://vercel.com/docs/queues)
- [AssemblyAI speaker diarization](https://www.assemblyai.com/docs/pre-recorded-audio/label-speakers)
- [AI SDK Core](https://ai-sdk.dev/docs/ai-sdk-core)
- [AI SDK tool calling and approval](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Groq documentation](https://console.groq.com/docs/overview)

## 24. Baseline business contract

The following rules close the initial domain decisions. The
[logical data model](data-model.md) specifies field types, relations, enums,
provenance, concurrency, and deletion. Changes to these rules update both
documents and the affected phase briefs.

### 24.1 Clients and requests

A client requires a nonblank name and at least a valid email or an international
phone number. If both contacts are supplied, both must validate. Company,
address, and notes are optional. Normalize email and phone server-side to find
same-workspace duplicate candidates; do not impose unique contact constraints
because a user may explicitly confirm a distinct client sharing those contacts.

A request requires a client, title, description, and service type. The catalog
is installation, repair, maintenance, inspection, and other. Priority is low,
normal, or high, defaulting to normal. Status starts pending and can be changed
by a user to in progress, resolved, or cancelled. In-progress work can return
to pending; resolved/cancelled work can reopen as pending. Availability,
service address, and next steps are optional text. Availability is a preference,
not a scheduled appointment. Budget is excluded.

One client may have many requests. Manual creation uses normal forms; request
creation selects an existing client. A conversation can prepare one client and
multiple independent request items. A human chooses the relevant client when
the audio mentions more than one. The AI does not create multiple clients from
one conversation or set saved operational status based on spoken claims.

### 24.2 Shared creation and review

All creates pass through exact preview and explicit confirmation in the shared
Record Plan Service. A manual client plan creates one client; a manual request
plan creates one request for an existing client; a conversational plan creates
or reuses one client and creates its whole reviewed request set atomically.
Only conversational plans require a current ready proposal revision.

Models propose values. Humans correct fields and add/remove proposed requests,
retaining at least one. Manual/default values carry their real provenance and
never invented evidence. Unknown evidence, invalid formats, missing required
values, and unresolved blocking ambiguity/conflicts prevent readiness.
Confidence remains optional, informational evidence rather than a readiness
authority. Every edit creates an authored revision.

Extraction may deterministically normalize explicitly spoken EN/ES phone digit
tokens and a leading plus sign/word, preserving the exact observed quote. It
never infers country codes, missing digits, extensions or ambiguous groups.
An unsupported phone/email value with verified source evidence is omitted from
the draft and retained as an observed-only field with blocking ambiguity for
human review; other supported data remains available. This recovery applies to
all identifiable client/request fields: invalid or absent quotes/references,
unsupported catalog labels, field-length violations and inconsistent values
are discarded locally with blocking review findings. Unverified quotes and
references are never published as evidence. Discarded priority uses the explicit
application default, with a blocking finding. Malformed envelopes, ambiguous
item identities and provider failures still fail the run. Delivering a recovered
reviewable proposal follows the normal one-credit settlement rule.

Saving a group of field/request corrections explicitly creates one authored
revision; unsaved browser edits are not revisions. A stale save preserves the
local draft for explicit reconciliation. If no service request can be extracted,
review receives one empty application-supplied request draft, marked incomplete
with default provenance and no speech evidence. This remains chargeable review
output, but readiness requires an actual complete request.

Duplicate decisions precede creation, not silent merges. Reusing a client does
not update its saved fields. Selecting an existing match in a standalone client
creation form opens that record without creating or editing it. Direct UI edits use explicit Save and stale-version
checks; destructive actions need warning/confirmation. Editing relevant data
invalidates pending plans. The assistant cannot edit, delete, or create from a
manual form payload; it prepares only eligible ready conversation batches.

In conversational creation, one client choice applies to every reviewed request.
Without contact matches, the final preview proposes a new client with all
requests already associated. With matches, the user chooses one candidate or
explicitly acknowledges creating a distinct client; there is no client selection
per request. The final confirmation creates the entire batch. Closing and
reopening retains the pending preview, and completed conversations display the
persisted creation result with read-only review history.

### 24.3 Processing and credit outcomes

Initial allocation is ten configurable credits. Internal reservation prevents
concurrent overspending but is not a second user charge. Successful review
availability means a structurally valid proposal was persisted, even if it
contains missing business fields for human completion. That event consumes one
credit; saving the eventual records does not.

A failed operation without a reviewable proposal or an earlier cancellation
restores its reservation once. A safe internal retry retains the same run and
reservation. Retrying after terminal failure creates a new run/reservation;
successfully re-extracting also consumes one. Record CRUD and assistant record
creation do not consume processing credits. Assistant inference has separate
server-owned usage limits.

Reprocessing is available only before the conversation's first successful
creation batch. It reuses immutable evidence, preserves old revisions, and
invalidates readiness/plans. The new candidate is compared and adopted by the
human into an authored revision; corrections are never silently overwritten.
Cancellation and success settle the same reservation mutually exclusively.
Deleting after success does not refund already consumed credit.

Successful transcription is an intermediate outcome: `TRANSCRIBED` exposes the
original evidence while retaining the run and reservation for extraction. It
does not set the run's successful terminal time and does not append a consume
entry.

### 24.4 Deletion and original evidence

A client cannot be deleted while requests reference it; first delete or
reassign those requests. Deleting a conversation removes original and derived
content, revokes asynchronous write authority, restores any open reservation
once, and schedules private media plus provider-transcript cleanup, but
preserves confirmed business records with a deleted-source indication. Delete
assistant threads that
reference that evidence and content-bearing plan snapshots so source deletion
does not leave hidden copies. Account deletion traverses every owned domain.
Keep only non-content operation/audit proof and cleanup identifiers where needed.

Detected excluded sensitive data is omitted from proposals, form submissions,
assistant results, and routine telemetry. Original audio and transcript remain
private until deletion; the product discloses this distinction. Safe omission
messages do not repeat protected values. Detection does not guarantee that
every sensitive passage will be recognized.

## 25. Controlled trial policy (accepted 2026-09-09)

This decision supersedes automatic admission in the earlier public-trial
roadmap, the manual-only retention exclusion in section 6.3 and the assumption
that all administrators have identical powers in section 12. H2C-1 now
implements the administrative profile/capability subset described below; later
limits, expiry/cleanup and H2C-2 MFA work remain intended rather than complete.

- Public self-registration remains disabled. The landing offers a bilingual
  request-access form backed by an administrator-configured business email and
  admission switch. It validates and prepares a message in the visitor's own
  mail application without persisting the form data, creating an identity or
  reserving capacity. A human reviews the sent request before an administrator
  creates one individual account and isolated workspace. There are no shared
  trial credentials or automatic account grants.
- The server generates each temporary credential with a cryptographically secure
  random source and displays it once to the provisioning administrator for
  delivery through an agreed private channel. The user must replace the
  password before workspace access; creation,
  reset, activation and replacement are audited without recording passwords.
  The access-contact address is configured at runtime by the owner; an operator
  can read the required state and pause admission but cannot change the address
  or resume admission. The private credential-delivery channel remains open. No
  server-side email service, public request database or invitation system is
  introduced by the contact form.
- A current owner or operator may reissue a temporary activation credential to a
  never-activated trial user or reset an activated trial user's access after
  human identity verification. The action requires explicit confirmation and a
  structured reason: expired credential, forgotten password, suspected
  compromise, failure recovery, or other with a bounded note. Administrative,
  deleted and missing targets are rejected. A suspended trial user may receive
  a rotated credential and have sessions revoked, but remains suspended until a
  separate explicit reactivation.
- The new password is shown only in the immediate authorized result and cannot
  be retrieved later. A separate acknowledgment records only whether it was
  delivered, when, by whom and through the general category `in_person`,
  `phone`, `secure_message` or `other`; no password or private channel details
  are retained. Closing without acknowledgment leaves it issued and undelivered.
  A later intentional issuance supersedes the former one.
- Authorized hosting/provider cash expense is **0 USD**: no paid-plan upgrades
  or automatic top-ups. Free-tier capacity and provider-account restrictions
  must be validated before admitting users, with safe pauses at exhaustion.
- Activation is completion of the first-login temporary-password replacement.
  A newly provisioned temporary credential expires 72 hours after successful
  provisioning. Expiry never starts or extends the trial; an expired credential
  provides no workspace access and directs the person to the team through the
  controlled contact channel.
- A temporary credential has an explicit purpose. Initial activation starts the
  14-day clock exactly once; a later recovery credential preserves the original
  activation and expiry timestamps and never renews the trial.
- Credential reissuance is operation-bound and version-fenced so duplicate,
  stale or concurrent requests cannot each appear successful. Preparation
  blocks normal access and revokes sessions before password rotation; a provider
  or required-audit failure returns no credential and leaves a fail-closed state
  that an authorized later failure-recovery operation can repair. Reissuance and
  recovery never create a workspace, grant credits or change trial dates.
- Accepted pilot policy: 14 days from activation and ten initial credits granted
  once, without automatic renewal; 25 active trials is a provisional ceiling,
  not a capacity promise. Actual admission and credit/media limits may be lower
  after the shared free-tier inventory. Team consumption also counts globally.
  Trial duration and credits are independent; an extension does not grant
  credits and a credit grant does not extend time.
- Exhausted credits block new processing while preserving existing-data access.
  After expiry, provide 30 days of read-only access with extension/deletion
  requests, followed by warned account-data cleanup. Warn before deletion;
  notification timing/channel and operational cleanup design remain open.
- Owner and operator are application-owned administrative profiles layered over
  the general `platform_admin` role. H2C-1 implements a centralized typed
  server-only capability matrix and current-state authorization. Owner alone
  manages administrators, contact email, admission resume, future global limits
  and reopening after a future global pause. Operators manage trial users,
  credentials and sessions, perform permitted confirmed trial deletion, read
  required Settings state and pause admission. Later REQ-007 increments add
  bounded extensions/credits, support inspection and processing/global limits.
  Neither profile can override the zero-cost ceiling. H2C-2a requires both
  profiles to complete password-confirmed TOTP enrollment, first-code
  verification and a second-factor challenge on later credential sign-ins.
  Better Auth owns encrypted factor and single-use backup-code storage. Five
  consecutive challenge failures lock the account for 15 minutes; trusted
  devices, email/SMS OTP and administrator factor disablement are unavailable.
- Owner-only promotion/demotion uses explicit confirmation, version/idempotency
  fencing, per-target serialization, session revocation and mandatory audit.
  Incompatible downgrade state is rejected without partial mutation. An
  explicit email-based bootstrap is dry-run by default, requires confirmation
  (and stronger production confirmation), permits only one owner, is idempotent
  for that owner and assigns remaining legacy administrators as operators. It
  never selects an owner implicitly or prints secrets. No bootstrap or ownership
  transfer is available through a public web claim flow.
- H2C-2b lets only the current owner recover a distinct operator who has lost
  every MFA factor. The owner must hold a recent definitive MFA session and
  confirm again with the current password and TOTP, explicit intent, a
  structured reason, an optional non-sensitive reference, operation ID and
  expected target version. The serializable target-locked transaction removes
  the Better Auth factor and MFA flag together, revokes every operator session,
  increments the security/profile version and preserves password, role,
  profile, workspace, business data and suspension. The operator is blocked by
  the existing MFA gate until a new enrollment; no recovery generates or
  reveals a factor.
- Total owner-factor loss has no operator-controlled web recovery. A trusted
  dry-run-first server command explicitly selects the sole owner, requires
  normal and production-strength confirmations, serializes globally and by
  user, removes only MFA, revokes every session and records a secret-free
  ledger/audit after the separate human identity procedure. Simultaneous
  password and MFA loss remains out of scope.
- Ownership transfer is a 30-minute, globally single pending request from the
  current owner to one active credential-backed MFA-ready operator. Both
  participants complete password-and-TOTP step-up in their own recent sessions.
  The recipient may accept or decline; the owner may cancel. Expiry and every
  transition are authoritative, monotonic, version-fenced and replay-safe. One
  serializable acceptance acquires the global lock, deterministically locks and
  reloads both users, swaps owner/operator profiles atomically, increments both
  versions, preserves MFA, records both transitions/ledger/audit and revokes all
  sessions of both participants. Exactly one owner remains and new authority is
  available only after a fresh login.
- Global controls cover processing minutes, tokens, storage, transfer, retries,
  concurrency, hosting, database and any email usage, including failed/refunded
  runs and other demos sharing provider accounts. Availability is conditional;
  account caps and credits alone cannot guarantee zero expense.
- Media duration/size and safe concurrent/active-trial capacity require measured
  free-tier limits. The proposed three-minute audio cap is not accepted; the
  existing baseline is not evidence that its limits fit free-tier capacity.

Manual admission improves demand control but does not resolve the current
Vercel Hobby commercial-use restriction or AssemblyAI's finite introductory
balance. See architecture section 26. No hosting or provider migration is
approved by this policy.

Delivery is tracked under REQ-001 (contact/access and credential security) and
REQ-007 (administrative controls, quotas and expiry/cleanup); REQ-009 stays
deferred and excluded from current delivery. The
[controlled trial roadmap](roadmaps/public-trial-readiness.md) coordinates the
work. H2C-1 is active: read-only evidence confirms its ninth migration applied,
one valid active owner and no invalid role/profile/state combinations without
revealing identity. H2C-2a is implemented and its additive migration is now
applied; all ten migrations are current. No authorized real-account enrollment journey has yet been recorded.
H2C-2b recovery/ownership work, deployment and completion of H2 remain open.
