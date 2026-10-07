# Conversation Processing Demo Data Model

## 1. Authority and conventions

This is the logical model for the agreed baseline, not an applied database
schema. [Product](product-source-of-truth.md#24-baseline-business-contract)
owns business behavior; [architecture](solution-architecture.md#16-persistence-architecture)
owns service and persistence boundaries. This document specifies their data
contracts. Implementation will translate them into Prisma models and controlled
migrations without silently changing these rules.

Identifiers are opaque application IDs. Timestamps are UTC instants. Dates in
source speech are evidence, not automatically confirmed appointments. Text
fields are trimmed; absent optional values are null rather than empty strings.
Original transcript text is exempt from normalization and remains immutable.
Enum codes are stable English identifiers; UI labels use the locale catalogs.

Every workspace-owned entity includes `id`, `workspaceId`, and `createdAt`.
Mutable business records additionally include `updatedAt`, `createdByUserId`,
`updatedByUserId`, and integer `version` for optimistic concurrency. Evidence,
revisions, ledger entries, and audit events are append-only except for authorized
content deletion. Author identity is resolved on the server.

References between workspace-owned entities must identify resources in the same
workspace, enforced in application services and reinforced by relational
constraints. Browser/model input never determines the authorized workspace.
Database uniqueness on IDs or operation keys does not replace authorization.

## 2. Business records

### 2.1 Client

| Field | Logical type | Required / rule |
| --- | --- | --- |
| `name` | text | Required, nonblank. Person/contact name; company is separate. |
| `email` | text or null | Valid email when supplied; at least email or phone is required. |
| `normalizedEmail` | text or null | Server-derived trimmed, lowercase lookup key; no provider-specific mailbox rewrites. |
| `phone` | text or null | International phone including country prefix when supplied. |
| `normalizedPhone` | text or null | Server-derived canonical international representation; no inferred country. |
| `company` | text or null | Optional. |
| `address` | text or null | Optional free text. |
| `notes` | text or null | Optional, subject to the sensitive-data policy. |
| `creationOperationId` | operation ID | Required reference to the successful creation receipt. |

The name and one valid contact are sufficient. If both contacts are supplied,
both must be valid. Raw incomplete extracted contacts remain proposal evidence
until corrected or cleared by the user; they are not valid saved contact keys.

Index `(workspaceId, normalizedEmail)` and `(workspaceId, normalizedPhone)` for
duplicate candidates, but do not make them unique. The user can explicitly
create a distinct client sharing a contact after seeing the candidates. A match
on either key is sufficient to show a candidate. Name-only matching is outside
the baseline. When contacts change during editing, repeat duplicate checks and
require acknowledgment of remaining matches.

### 2.2 Service request

| Field | Logical type | Required / rule |
| --- | --- | --- |
| `clientId` | client ID | Required, same workspace. |
| `title` | text | Required, nonblank. |
| `description` | text | Required, nonblank; represents the need/summary without a duplicate summary column. |
| `serviceType` | enum | Required: `installation`, `repair`, `maintenance`, `inspection`, `other`. |
| `priority` | enum | `low`, `normal`, `high`; default `normal`. |
| `status` | enum | `pending`, `in_progress`, `resolved`, `cancelled`; created as `pending`. |
| `preferredSchedule` | text or null | Optional preference such as "Tuesday afternoon"; not a booking. |
| `serviceAddress` | text or null | Optional; independent of the client's address, never silently synchronized. |
| `nextSteps` | text or null | Optional next actions/follow-up notes; one field rather than a second notes field. |
| `creationOperationId` | operation ID | Required successful creation receipt. |
| `sourceProposalItemId` | opaque ID or null | Stable source item identity for conversational creation; null for manual creation. |

There is no budget, currency, invoice, inventory, technician assignment, or
appointment entity in this baseline. `other` is a reviewed classification for
an actual service outside the catalog, not a way to conceal missing information.

Allowed status transitions:

| From | To |
| --- | --- |
| `pending` | `in_progress`, `resolved`, `cancelled` |
| `in_progress` | `pending`, `resolved`, `cancelled` |
| `resolved` | `pending` (reopen) |
| `cancelled` | `pending` (reopen) |

No-op updates do not represent a status transition. Only direct authorized user
actions change saved records; extraction never sets operational progress.
Reassignment selects an existing client in the same workspace, changes no
historical creation evidence, and is audited. Reject stale edits rather than
silently overwriting another saved version.

### 2.3 Creation, cardinality, and provenance

```text
Trial user 1 -- 1 Personal workspace
Workspace 1 -- N Clients
Client 1 -- N Service requests
Workspace 1 -- N Conversations
Conversation 1 -- N Processing runs / Proposal revisions
Conversation 1 -- 0..1 Successful conversation creation operation
Successful conversation creation operation 1 -- 1 Selected client
Successful conversation creation operation 1 -- N Service requests
```

Manual client creation is independent. Manual request creation selects an
existing client; users can first create that client through its normal form.
Choosing an existing duplicate from a standalone client-creation form opens
that client instead of creating a new record; it is not an implicit edit.
Conversation creation selects/reuses or creates exactly one client and creates
one or more requests in one transaction. Multiple unrelated clients mentioned
in audio are an ambiguity to resolve, not additional clients to create.

All creation origins share the Record Plan Service. Its operation kinds are
`manual_client_create`, `manual_request_create`, and `conversation_batch_create`.
Manual plans require valid form data but no conversation or readiness revision.
Conversation plans require a current, explicitly ready revision and duplicate
decision. Reusing a client cannot update its contact fields as a side effect.

Each created record links to an operation receipt carrying `origin`
(`manual` or `conversation`), actor, time, result identifiers, and nullable live
conversation/revision references. On source deletion, set live references to
null and set `sourceDeleted`; retain only non-content source/operation identity.
Do not keep the deleted proposal as a provenance snapshot. A reused client's
original creation origin remains unchanged; the new operation records its reuse.

Every create operation needs an exact preview and explicit confirmation.
Manual edits use an explicit Save action and version checks; destructive
deletion requires a warning and confirmation. Edits that affect pending plans
invalidate them. Deleting a request does not reopen its completed conversation
or make an old confirmation reusable.

## 3. Conversation and review

### 3.1 Conversation and audio

| Entity | Fields beyond common ownership and timestamps | Invariants |
| --- | --- | --- |
| Conversation | `sourceType` (`microphone`/`upload`), `locale` (`en`/`es`), `status`, `audioArtifactId`, `currentRunId?`, `currentProposalRevisionId?`, `completedOperationId?`, `correlationId`, `version`, `deletionState` | One source audio; at most one successful creation batch; active/deleting/deleted eligibility is checked by every asynchronous writer. |
| AudioArtifact | `conversationId`, private storage reference, original filename, verified MIME/container, byte size, duration, checksum/integrity metadata, verification state, deletion state | Storage reference is never authorization. Bytes live only in private object storage. |
| UploadGrant | `conversationId`, expected artifact identity, permitted type/size, expiry, completion/consumption state | One bounded upload operation; completion is verified and idempotent. |

Conversation statuses remain `DRAFT`, `AUDIO_READY`, `QUEUED`, `TRANSCRIBING`,
`DIARIZING`, `TRANSCRIBED`, `EXTRACTING`, `VALIDATING`, `NEEDS_REVIEW`, `READY`,
`RECORD_PLAN_PENDING`, `COMPLETED`, `FAILED`, `QUOTA_BLOCKED`, `CANCELLED`.
Processing and deletion have separate state: cancellation/deletion must not
depend on retaining the user-visible conversation row forever.

`TRANSCRIBED` is nonterminal. It means original evidence and the diarization
outcome are durable, but the run and credit reservation remain open for
extraction. The run has no successful terminal timestamp and the reservation
has no consume entry at this boundary.

Initial media limits are ten minutes and 25 MB, with the permitted WebM, MP3,
M4A/MP4, WAV, and OGG audio formats. Server verification precedes eligibility.
Invalid uploads and discarded unprocessed drafts consume no credit.

### 3.2 Original and derived evidence

| Entity | Fields | Invariants |
| --- | --- | --- |
| OriginalTranscript | `conversationId`, `processingRunId`, immutable literal `text`, language, `finalizedAt`, SHA-256 content fingerprint | One finalized original per conversation. Retries cannot replace it; database enforcement rejects updates to immutable evidence fields while still permitting authorized deletion. |
| TranscriptEvidence | `transcriptId`, stable evidence ID, text span start/end offsets, optional start/end time | Evidence resolves to the exact original text; offsets and time ranges are ordered and valid. Stable IDs derive from transcript fingerprint and the start/end offsets. Missing timestamps are allowed. |
| DiarizationVersion | `conversationId`, `processingRunId`, version, status, warnings | Derived artifact; unavailable diarization is explicit and does not invalidate original text. |
| SpeakerSegment | `diarizationVersionId`, evidence references, start/end time, generic speaker label or unknown, optional confidence | Conversation-local labels, no real-person or cross-conversation voice identity. |

Stable textual evidence exists independently of diarization. User edits never
change original text, evidence spans, or speaker artifacts. Regenerating derived
artifacts retains the source versions referenced by existing live revisions.
Provider utterances create one evidence item each only when text alignment is
safe. Otherwise deterministic word groups are used; if granular alignment is
unsafe, one full-text evidence item is stored with a warning instead of
incorrect offsets. Without valid utterances, diarization is `UNAVAILABLE` and
no speaker segment is invented.

### 3.3 Proposal and revisions

A proposal revision contains exactly one client draft and an ordered list of
request drafts with stable item IDs. Draft fields use the business contract in
section 2 but can be missing/invalid until review. Saved records cannot.

| Entity | Fields | Invariants |
| --- | --- | --- |
| ProposalRevision | `conversationId`, revision number, parent revision, producing run, transcript/diarization version references, schema/task/prompt/policy versions, author kind and user ID if human, validation summary, ready author/time | Immutable revision content. Current/ready pointers change through authorized services. |
| ProposalRequestItem | revision ID, stable item ID, display order, proposed request fields | One or more retained items required for readiness; humans may add/remove items without editing source evidence. |
| ProposalField | revision ID, client or request item identity, field key, observed/normalized value, provenance kind, evidence IDs, optional confidence, validation findings | Provenance is `extracted`, `manual`, or `default`; manual/default values never receive invented speech evidence. |

Findings classify missing required values, invalid formats, nonexistent evidence,
ambiguity, contradiction, low confidence, or sensitive-data omission. Confidence
is nullable and informational, never fabricated when a provider does not supply
it. Invalid evidence is discarded and malformed envelopes are rejected; readiness requires a valid revision
without unresolved blocking findings. Informational warnings remain visible.

For an uncertain phone/email, an extracted ProposalField may retain a verified
observed value and evidence links while its normalized value is null and the
client draft value is empty. A blocking AMBIGUITY requires an explicit human
decision. Deterministic spoken-phone normalization never changes the observed
quote. Unsupported proposed contact values are not persisted.

For every field, unverified evidence or an unsupported proposed value can instead
produce an empty/default field without evidence links and a blocking
NONEXISTENT_EVIDENCE finding. Priority falls back to the explicit normal default,
still requiring a decision. This finding survives saves and is resolved through
an authored revision; normal required-field validation cannot be waived by that
resolution. Valid sibling fields and request identities remain unchanged.

Corrections create authored revisions. Explicit saving creates one revision for the
submitted set of corrections; an operation key/fingerprint permits safe replay.
The physical `sealedAt` marker freezes persisted revision content and children;
readiness metadata and current pointers remain controlled mutable state.
An empty application-supplied request draft is permitted when no request was
identified, with default provenance and required-field findings.

Manual adoption of a new extraction can
select its useful fields/items, but creates another human revision rather than
overwriting prior corrections. Starting reprocessing invalidates pending
readiness/plans, preserves earlier revisions, and creates a separate candidate.
Failure preserves the earlier revision for review and explicit readiness again.
Reprocessing after a conversation has completed its creation batch is excluded.

A reprocessing candidate is a sealed extraction revision whose producing run is
the conversation's current run and whose parent is its retained current revision.
It remains `CANDIDATE` until explicit adoption (`SUPERSEDED`) or retention of the
old revision (`INVALIDATED`). Human adoption allocates the next conversation-wide
revision number, preserves retained item identities, and assigns fresh IDs to
explicitly added requests. Field selections copy server-persisted evidence and
findings with item-ID remapping. Keeping the previous revision records a durable
audit operation without duplicating its content. Both decisions bind the current
conversation version, candidate and parent, with idempotent replay. Existing
conversation cleanup removes all revision branches and their content.

## 4. Execution and governance

### 4.1 Identity

Better Auth owns credential/session persistence. Application-owned associations
add user name, email, locale, role (`trial_user`/`platform_admin`), nullable
administrative profile (`owner`/`operator`), monotonic administrative-profile
version, active or suspended state, Better Auth's non-null
`twoFactorEnabled` flag (false for existing identities),
`temporaryPasswordChangeRequired`, nullable
`temporaryPasswordExpiresAt`, nullable `temporaryPasswordPurpose`
(`activation`/`recovery`), nullable `trialActivatedAt` and nullable
`trialExpiresAt`, plus a monotonic `temporaryCredentialVersion`. A new
administrative trial account requires replacement and expires after 72 hours;
activation clears the temporary expiry/purpose and sets the two
trial timestamps exactly once, with `trialExpiresAt` initially 14 days after
`trialActivatedAt`. A recovery-purpose credential requires an existing trial
timestamp pair and clears only its temporary state; it never changes either
trial date. The database rejects an unpaired activation/expiry timestamp.
Existing accounts remain ungated unless explicitly issued a new temporary
credential. Trial users require a null administrative profile; platform
administrators require `owner` or `operator` before they can exercise
administrative capabilities. The database check prevents a trial user from
carrying an administrative profile, while the server policy rejects a legacy
administrator whose profile is still null; a partial unique index prevents
multiple owners. Because the additive migration must preserve legacy
administrators for explicit bootstrap and cannot require that an owner already
exists, application transactions protect the sole owner from demotion,
suspension or deletion and the explicit bootstrap rejects a different owner.
Never add plaintext
password columns. A trial user owns exactly one personal Workspace, with a
unique owner reference and active/deleting/deleted lifecycle. Administrators
use a separate audited access path, not arbitrary trial workspace selection.

Better Auth exclusively owns the `TwoFactor` record: generated ID, encrypted
TOTP secret, encrypted backup-code payload, unique user relation, verified flag,
consecutive failed-verification count and nullable lock expiry. The application
does not store a second factor copy. One row per user and cascade deletion
reinforce identity lifecycle. Administrative authorization requires both
`User.twoFactorEnabled` and `TwoFactor.verified`; a missing, unverified or
divergent row fails closed. Five consecutive sign-in factor failures set the
15-minute account lock. Successful backup-code verification atomically replaces
the encrypted payload without the consumed code, and regeneration overwrites the
whole prior set.

`TemporaryCredentialIssuance` is a secret-free administrative operation ledger.
It records a unique operation UUID, target, nullable initiating/delivering
administrator references, per-target version, purpose, structured reason,
optional `other` note limited to 200 characters, status (`prepared`, `issued`,
`superseded`, `failed`), lifecycle times, expiry, nullable safe failure code,
nullable delivery category (`in_person`, `phone`, `secure_message`, `other`) and
the succeeding issuance reference. It never stores a password, address, phone
number, conversation or private delivery detail.

The `(targetUserId, version)` pair and operation UUID are unique; only one
`prepared` or `issued` row may be current for a target. Delivery actor, category
and time are either all absent or all present on an issued row. Issued rows have
an issuance/expiry pair; failed rows have a safe failure code but no credential
or delivery metadata; superseded rows link forward when a replacement exists.
The user's version, expected-version input and a shared per-user advisory lock
fence H2A/H2B credential mutation. Reissuance preserves workspace, initial
allocation, credit ledger, trial timestamp pair and active/suspended state.

Administrative promotion/demotion is fenced by expected profile version and a
per-target advisory lock. A serializable transaction changes role/profile as one
state, revokes all sessions and persists mandatory audit. A downgrade to
`trial_user` clears the profile, disables the MFA flag and deletes the factor in
the same transaction; it is rejected before mutation if the existing
trial identity/workspace invariants cannot be satisfied. Idempotent replay does
not duplicate transition audit or leave role/profile divergence.

`AdminSecurityOperation` is the secret-free H2C-2b ledger. Its unique UUID and
SHA-256 fingerprint bind the normalized non-secret parameters for operator MFA
recovery, owner break-glass and ownership initiate/cancel/decline/accept/expire
transitions. It stores nullable actor/target/transfer references, structured MFA
recovery reason and optional 120-character safe operational reference, expected
and committed administrator versions, monotonic pending/succeeded/denied/failed
result, safe failure code, per-participant revoked-session counts and lifecycle
timestamps. It never stores passwords, factor secrets, TOTP/backup codes,
cookies, tokens, request payloads or human identity-check details.
Authenticated step-up or policy denials reserve their operation UUID and
non-secret fingerprint with a terminal failure code, so a later request cannot
reuse the UUID for different parameters. A transfer relation is required for a
successful transfer transition; a preflight denial may safely have none.

`OwnershipTransfer` records the initiating operation, current owner, target
operator, both expected versions, status (`pending`, `accepted`, `declined`,
`cancelled`, `expired`, `invalidated`), a 30-minute expiry and resolution times.
A unique nullable pending key permits one global pending transfer. Database
checks require distinct participants, nonnegative versions, expiry after
creation and a pending-key/null-resolution tuple only for pending state. Every
service read or mutation expires stale pending rows authoritatively. The existing
partial owner index remains the maximum-one defense; the global ownership lock,
deterministic row locks, full state reload, transactionally staged demotion then
promotion and an explicit post-swap count are the primary protocol. MVCC keeps
the previous one-owner state externally visible until the complete swap commits.

The additive `20260911120000_admin_mfa_recovery_ownership` migration introduces
only these enums/tables/indexes/constraints and two transfer-specific profile
transition kinds. It rewrites no user or factor. Rollback after use is a reviewed
forward repair: disable H2C-2b, preserve the ledgers, ensure no transfer is
pending and remove schema only in a later migration; deleted factors and revoked
sessions are never reconstructed.

Trial setup records `initialCreditAllocation` as a nonnegative integer, default
ten. Phase 1 may persist this intended allocation before processing exists.
When phase 4 introduces the ledger, create the corresponding grant exactly once
for each existing workspace and on each subsequent account creation. A unique
initial-grant operation key prevents repeated initialization. Workspace
`creditInitializedAt` records completion even when the intended allocation is
zero; the setup value is not an independently mutable live balance.

### 4.2 Runs, provider invocations, and credit ledger

| Entity | Fields | Invariants |
| --- | --- | --- |
| ProcessingRun | conversation ID, idempotency key, optional previous run ID, reservation ID, unique nullable `workflowRunId`, status/stage, profile versions, correlation, terminal reason, retryability, started/finished time | A safe internal retry keeps the same run; a new user-requested run gets a new identity. At most one `ACCEPTED`/`RUNNING` run exists per conversation. |
| ProcessingCheckpoint | run ID, stage, attempt, lease/checkpoint reference, outcome, committed artifact IDs | Redelivery reloads current authority and cannot duplicate committed output. |
| ProviderInvocation | run or assistant interaction ID, capability/task, provider/model alias, nullable `providerJobId`, `providerUpdatedAt`, versions, fingerprints, latency, usage, status, safe error | Bounded operational metadata, not raw prompts, transcripts, or provider SDK objects. One invocation exists per processing run/capability. |
| CreditEntry | workspace ID, kind, positive integer quantity, run/reservation or admin adjustment reference, actor, reason, operation key | Append-only; kinds are `grant`, `reserve`, `consume`, `restore`. |

Let G be granted units, R reservations, C consumed reservations, and F restored
reservations. Available balance is `G - R + F`; reserved balance is `R - C - F`.
A consume closes a reservation, not a second deduction. Both balances must stay
nonnegative. New accounts receive ten credits unless the administrator explicitly
sets another nonnegative integer allocation; replenishment adds grants.

Accepting a run and reserving one unit is atomic. Publishing a valid proposal as
available for review and consuming that reservation is one authoritative outcome.
Speech success alone is insufficient. Terminal errors, policy failures without
a reviewable proposal, and cancellation before successful review availability
restore once. Internal retries retain the reservation. Retrying a terminal run
creates a new run/reservation and can reuse safe artifacts. Each successful
re-extraction costs one credit. Forms and assistant reads/record creation do not
spend processing credits; their AI use has independent runtime limits.

One reservation can close as consumed OR restored. If successful completion wins
the cancellation race, no refund follows deletion; if cancellation wins, late
provider results cannot publish a proposal or consume the restored reservation.

### 4.3 Record plans, approvals, and receipts

| Entity | Fields | Invariants |
| --- | --- | --- |
| RecordPlan | operation kind, normalized exact payload, selected client/version or new client draft, duplicate candidates/decision, source revision if conversational, plan version/hash, expiry, operation intent, status | Server constructs the plan. Relevant source, client, duplicate, authorization, or workspace changes invalidate it. |
| RecordApproval | plan ID/hash, user/workspace binding, approved/denied state, time, expiry | User action only; model text cannot synthesize approval. Denied, stale, expired, or replayed approvals cannot create a second write. |
| OperationReceipt | operation intent/idempotency key, origin, source references, `sourceDeleted`, outcome, client ID, created request IDs, actor/time | One authoritative result. Used for uncertain-result reconciliation and duplicate delivery. |
| OutboxEvent | event type, workspace/aggregate/operation ID, unique `idempotencyKey`, bounded identifier-only payload, delivery state, attempts/times, correlation | Publishes workflow dispatch and audit/cleanup follow-up without losing committed outcomes. One logical processing dispatch per key; redelivery cannot create another workflow or run. |

Operation kind determines payload requirements: one client for manual client
creation, one request linked to an existing client for manual request creation,
or one selected client and N requests for conversation creation. Receipt
uniqueness also prevents a second successful conversational batch across
different plan IDs. Idempotent replay returns the existing receipt, not new rows.
The transaction revalidates references and records the complete result.

Conversational creation implements this uniqueness with the existing unique
receipt `idempotencyKey`, deterministically scoped to workspace/conversation
independently of each plan ID/operation intent. Successful receipts remain
authoritative after their plan expires or their business records are deleted;
a nullable selected-client reference does not authorize another batch.

### 4.4 Assistant, audit, and configuration

| Entity | Fields | Invariants |
| --- | --- | --- |
| AssistantThread | owner/workspace, title, created/updated time | Workspace-private; no cross-workspace retrieval. |
| AssistantMessage | thread ID, role, content, resource references, status/time | Retained content is governed by deletion and sensitive-data policy. |
| ToolInvocation | thread/message ID, registered tool code, validated bounded arguments/results, status, plan/approval/receipt references, correlation | No model-selected workspace; authorization at every execution. |
| AuditEvent | actor, target workspace/resource, action, outcome, reason, time, correlation | Admin content reads require a declared reason and durable audit before disclosure; no content payloads. |
| CleanupTask | resource/object reference, nullable `providerReference`, deletion intent, status, attempts, safe error, correlation | Idempotent, retryable, survives removal of the owning content and can remove a remote speech transcript without retaining transcript content. |
| PlatformSettings | singleton ID, contact email, admission-enabled flag, optimistic version, last updater, timestamps | Contact update, admission pause and admission resume are distinct version-fenced operations with transactional audit; operator may pause but only owner may change contact or resume. |
| TaskProfile / PlatformPolicy | version, capability, aliases, schema/prompt/policy versions, runtime limits, feature/kill-switch state | Server-controlled configuration; no user-authored prompts or schema designer. |

Assistant write preparation requires a ready conversation; manual-origin plans
are not exposed as assistant creation tools. Direct form editing/deletion is
not an assistant capability. Provider secrets stay in protected environment
configuration, never in profiles returned to users or models.

## 5. Deletion and sensitive-data rules

| Action | Required result |
| --- | --- |
| Delete request | Confirm; delete the request without deleting its client. Keep only non-content operation/audit proof. Invalidate affected plans; old approvals cannot recreate it. |
| Delete client | Confirm; reject while requests reference it. User must delete or reassign those requests first. Concurrent references must also prevent deletion. |
| Delete conversation | Revoke run write authority, restore open reservations once, cancel/invalidate runs and plans, delete original/derived text, proposal revisions and content-bearing plan snapshots, and schedule private audio plus remote speech-transcript cleanup. Preserve operational clients/requests and mark deleted source references. |
| Delete account | Revoke access; delete all workspace content, records, assistant history, plans, and associated media. Retain only minimal non-content deletion/audit proof and pending cleanup identifiers. |

Delete persisted assistant threads that reference a deleted conversation, so
quoted evidence and model responses in those threads do not preserve the
deleted content. Clear corresponding cached context; future tools cannot fetch
the source. Resource references must be tracked when evidence enters a thread.
Business fields already explicitly confirmed into clients/requests remain until
those records or the account are deleted, as disclosed by the conversation
deletion warning.

Detected excluded sensitive content is omitted from proposals, manual record
submissions, assistant tool results, and routine telemetry. The review explains
omission without echoing the protected value. Original audio/transcript remain
private evidence until deletion; evidence sent to the assistant is filtered.
Detection is not a claim that every sensitive passage can be recognized. Record
the applicable policy version and safe finding, not a diagnostic copy of the
excluded value.

## 6. Implementation acceptance

Schema and integration checks must prove workspace-safe references, at least one
valid client contact, declared enums, stale-edit rejection, nonunique contact
lookup, restricted client deletion, one conversational batch, atomic N-request
creation, mutually exclusive credit settlement, immutable evidence/revisions,
and complete cleanup without resurrection by asynchronous delivery.

The [phase backlog](requirements/index.md) assigns implementation and acceptance
ownership. No entity in this document is claimed to exist in the current
application; provider API selection and physical migration details are validated
within the relevant implementation phase.

## 7. Controlled trial policy data obligations (2026-09-09)

The [accepted trial policy](product-source-of-truth.md#25-controlled-trial-policy-accepted-2026-09-09)
adds logical obligations: distinguish administrator provisioning,
temporary-password replacement, its 72-hour unused-credential expiry, trial
activation, expiry, the 30-day read-only window and warned cleanup eligibility.
The temporary-password/activation and H2B issuance migrations are applied. The
H2B ledger and user version use additive
`20260910143000_temporary_credential_reissue`. Its explicit purpose
separates initial activation from recovery while preserving the original trial
dates. Preserve the once-only initial credit grant and separately
audited time extensions and credit grants; neither renews the other.

`PlatformSettings` stores the singleton public-access contact email, an
independent admission-enabled flag, optimistic version, last updating
administrator and timestamps. The access-request form itself creates no
persisted request or visitor-data entity; its server boundary only validates
before returning the currently enabled contact destination.

Track attributable administrator actions and bounded owner/operator powers
without persisting delivered passwords in audits. Credential delivery stores
only a general category, administrator and time; an unacknowledged issuance
remains issued/undelivered and a later issuance supersedes it. Individual
accounts retain exactly one isolated workspace; manual admission does not allow
shared users.
The additive `20260910210000_admin_profiles` migration adds the nullable profile,
profile version, role/profile check, profile/status index, single-owner partial
unique index and Settings version without selecting or degrading any
administrator. It preserves accounts, sessions, workspaces, credits and
credentials. Current read-only status observes all nine migrations applied, one
active owner and no invalid role/profile/state combinations without exposing
identity or inferring bootstrap provenance.

The applied additive `20260910223000_admin_totp_mfa` migration adds
`users.two_factor_enabled BOOLEAN NOT NULL DEFAULT false` and the plugin-owned
`two_factor` table with safe defaults, indexes, the unique user invariant and a
cascading foreign key. It performs no data update and enables no existing user.
Read-only status now observes all ten migrations applied and the schema current.
Destructive rollback
is unsafe after enrollment; disable enforcement first, verify no factors exist,
take a backup and use a separately reviewed recovery migration, or prefer a
forward repair once real factors exist.

Global free-tier usage and limits must include team/shared-provider consumption,
failed attempts and resources not represented by processing credits. MFA
recovery, total-factor-loss handling and protected ownership transfer remain
H2C-2b; notification and cleanup models and mechanisms remain design work.
Expiry cleanup follows section 5, including asynchronous media reconciliation
and minimal non-content proof. Public-registration entities remain deferred.
