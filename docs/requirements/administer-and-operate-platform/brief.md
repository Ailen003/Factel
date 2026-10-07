# Requirement Brief: Administer and operate platform

> **ID:** REQ-007
> **Status:** candidate
> **Priority:** medium
> **Phase:** 7
> **Source:** [product-source-of-truth.md](../../product-source-of-truth.md#43-platform-administration); [solution-architecture.md](../../solution-architecture.md#18-usage-limits-and-resilience); [solution-architecture.md](../../solution-architecture.md#19-audit-metrics-and-observability); [data-model.md](../../data-model.md#5-deletion-and-sensitive-data-rules)

## Intent

Complete the operational surfaces needed to support bounded trials, diagnose failures and remove account data reliably.

## Controlled-access policy (2026-09-09)

- Operate with zero USD of hosting/provider expense: no paid upgrades/top-ups; pause affected operations when free capacity cannot be assured. Include team/shared-provider consumption, failed attempts, storage, transfer and assistant use beyond processing credits.
- Accepted pilot policy is 14 days from activation, ten once-only credits and a provisional 25 active-trial ceiling. Actual admission/media/concurrency limits can be lower after free-tier validation; three-minute audio remains an unaccepted suggestion.
- H2C-1 implements the owner/operator split for current administrative surfaces. Owner alone manages administrators, contact email, resuming admission and future global limits/reopening. Operators manage trials and can read Settings and pause admission, but cannot act on administrators, change contact email or resume admission. H2C-2a requires verified TOTP MFA for both profiles before any capability; neither can override zero USD. Controlled factor recovery and protected ownership transfer remain H2C-2b.
- Trial expiry now includes 30 days read-only access with extension/deletion requests, followed by warned cleanup. This supersedes automatic retention being out of scope below. Time extensions and credit grants never renew each other.
- Acceptance adds capacity enforcement during concurrent provisioning, zero-budget refusal, denied operator owner-only actions, processing blocked at zero credits, writes blocked at expiry, warned complete cleanup and no late-worker resurrection.
- Activation is completion of first-login temporary-password replacement. Open: safe shared free-tier quotas, Vercel commercial eligibility, AssemblyAI free-balance continuity, operator grant/extension bounds and cleanup warning/channel/schedule. These supersede the older "None" statement below. The H2C-1 and H2C-2a migrations are applied; the authorized real MFA journey remains pending.
- See [accepted policy](../../product-source-of-truth.md#25-controlled-trial-policy-accepted-2026-09-09). H2C-1 and H2C-2a are implemented and active, aggregate evidence confirms one valid active MFA-ready owner, and H2C-2b is complete in code with its migration and authorized real journey pending; broader REQ-007 operations remain pending.

## Actors

Platform administrator; trial user viewing dashboard; application operator.

## Scope

- Complete the personal dashboard with ledger-derived credits, recent conversations/clients/requests and processing health.
- Manage the public access-contact email and pause/resume new access requests independently, with attributable audit.
- Enforce a centralized server-only owner/operator capability matrix for every administrative service/action; authorize from current database role, profile and status rather than browser claims.
- Complete account/credit allocation and replenishment views, platform/user usage, provider health, stuck workflows, allowed retry controls and audit search.
- Require disclosed, reason-bound, searchable audit for every privileged content inspection.
- Complete speech/extraction/assistant-inference/assistant-write/all-AI switches, limits/circuits, safe metrics and alerts.
- Complete account deletion across identity, records, media, processing, proposals/plans, assistant and usage; reconcile object-storage cleanup, audit/outbox and uncertain operations.

## Out of Scope

Paid billing/subscriptions, shared organizations and public registration. Trial expiry and warned cleanup are in scope under the accepted 2026-09-09 policy.

## Candidate Flows

1. Administrator declares a reason before inspecting content, diagnoses a user/workflow failure and performs allowed recovery or ledger adjustment.
2. An outage opens a circuit or administrator disables a capability; earlier artifacts remain intact and the user sees a safe recovery state.
3. Administrator confirms account deletion; revoke sessions/access, remove all workspace content and track asynchronous cleanup to completion.

## Rules and Constraints

- Credit adjustments are auditable ledger entries, idempotent under retries. Deleting successfully processed content never refunds consumption.
- Ordinary telemetry excludes full contacts/audio/transcripts/passwords/sessions/prompts/raw responses. Content inspection cannot bypass audit persistence.
- Account deletion retains only minimal non-content proof of deletion/admin action. Conversation-only deletion preserves business records with minimal source-deleted marker.
- This phase completes controls introduced incrementally; isolation, localization, audit, limits and cleanup cannot be deferred from earlier capability delivery.
- Trial users have no administrative profile; platform administrators require a consistent `owner` or `operator` profile to exercise capabilities. The sole owner is protected. Owner-only promotion/demotion revokes target sessions, fails closed with mandatory audit and cannot partially transition an ineligible trial identity/workspace.
- Settings operations remain distinct: owner changes contact email, pauses or resumes admission; operator reads required state and may pause only. Optimistic version fencing and transactional audit protect concurrent updates.
- Administrative capabilities require current active role/profile plus both Better Auth's user MFA flag and its verified TOTP record. Password-only provisional sessions, pending enrollment and stale pre-enrollment sessions grant no capability; email/SMS OTP, trusted devices, factor disablement and direct plugin bypasses are unavailable.
- Only owner may start/cancel ownership transfer or recover an operator's MFA. The recipient operator may accept/decline only its own pending request; this contextual permission grants no general owner-management capability. All H2C-2b mutations require password/TOTP step-up and authoritative current-state/version checks, revoke affected sessions and fail closed unless ledger and audit commit.
- Every introduced capability includes server authorization, English/Spanish parity, accessible critical actions, safe audit/telemetry and deletion coverage for its artifacts. All CPD-NFR-001–007 apply proportionally; see the index matrix.

## Dependencies

[REQ-006](../workspace-ai-assistant/brief.md) must be delivered first; earlier phases are transitive dependencies.

## Acceptance Scenarios

1. Replay allocation/replenishment and reconcile displayed available/reserved/consumed totals with ledger invariants.
2. Require admin role/reason/searchable event for inspection; simulate audit failure and deny unlogged access.
3. Exercise independent switches/circuits and representative alerts for abuse/isolation, ledger, media, stuck workflow, provider/extraction/tool failure, commit/Blob/audit failure.
4. Delete an account populated across all domains; verify no content/media remains and failed cleanup retries safely.
5. Verify bilingual dashboard/admin operations, safe logs and keyboard-accessible destructive confirmations.
6. Verify operator recovery and every ownership-transfer terminal state, including expiry, replay, stale versions, concurrent suspension/MFA loss, exactly one owner and no old-session capability retention.

## Source Coverage

CPD-FR-006–009 completion, 028 completion, 070–075 operations. Acceptance: support audit, replenishment, full account cleanup and bilingual operation. See the [coverage matrix](../index.md#functional-requirement-coverage) for shared ownership and non-functional coverage.

## Open Questions

Validate shared free-tier quotas, hosting commercial eligibility and transcription continuity; configure a monitored access-contact address; choose operator grant/extension bounds, unused temporary-credential expiry and cleanup warning/channel/schedule. REQ-001 tracks credential delivery. The three-minute audio proposal remains unaccepted. Record implementation evidence and gaps in [progress](progress.md).

## Documentation Synchronization

### H2C-2a mandatory administrator TOTP MFA, 2026-09-10

| Document | Result | Justification |
|---|---|---|
| Product, architecture and data model | updated | Record the shared operational MFA prerequisite, locked challenge, sessions, safe audit and Better Auth-owned factor storage. |
| REQ-001 and this brief/progress | updated | Keep MFA identity delivery under REQ-001 while recording its enforcement across every REQ-007 capability. |
| Requirements index and roadmap | updated | Split H2C-2a from H2C-2b and retain broader REQ-007 work as pending. |
| Documentation inventory, templates, guides and operations | no-change | Existing routing remains sufficient and no migration/deployment/real-account mutation is performed. |

### H2C-1 owner/operator separation, 2026-09-10

| Document | Result | Justification |
|---|---|---|
| Product, architecture and data model | updated | Record current owner/operator powers, centralized server-only authorization, protected profile transitions, explicit bootstrap and independently authorized Settings operations. |
| This brief and progress | updated | Record the material REQ-007 slice and verification without claiming broader operations complete. |
| Requirements index | updated | Clarify H2C-1 ownership while preserving REQ-007 candidate/in-progress state. |
| Roadmap | updated | Mark H2C-1 verified, its migration/bootstrap pending execution and H2C-2 MFA/ownership transfer open. |
| Documentation inventory, templates, README, guides, operations and harness | no-change | Existing routing and shapes remain sufficient; no deployed operator procedure changed. |

### Access-contact administration implementation, 2026-09-09

| Document | Result | Justification |
|---|---|---|
| Product, architecture and data model | updated | Add the typed contact destination, independent admission switch, administrator ownership and audit boundary. |
| This brief and progress | updated | Record the bounded REQ-007 administration slice without claiming broader operational completion. |
| Requirements index | no-change | REQ-007 status, priority and dependency remain accurate. |
| Roadmap | updated | Distinguish code completion from migration and runtime configuration. |
| Project README, guides, operations and harness | no-change | No deployed operating procedure or harness interface changed. |

### Review for controlled-access policy, 2026-09-09

| Document | Result | Justification |
|---|---|---|
| Product, architecture and data model | updated | Record accepted manual admission, zero-USD constraint, intended administrative powers and expiry/cleanup obligations without claiming implementation or migration. |
| This brief, progress and requirements index | updated | Synchronize affected ownership and preserve REQ-009 deferral; progress owner is agent-requirements-curator. |
| Documentation inventory | no-change | Existing maintained-document routing remains sufficient. |
| Requirement brief/progress templates | no-change | Existing shapes support this policy iteration. |
| Roadmap and docs navigation | updated | Root-owned synchronization for controlled trials; this executor does not edit those artifacts. |
| Guides, operations and harness | not-applicable | No runtime procedure or harness changes are delivered. |

### Earlier iteration ledger

| Document | Result | Justification |
|---|---|---|
| [Product](../../product-source-of-truth.md) and [architecture](../../solution-architecture.md) | updated | Synchronized manual CRUD, multiple-request batches, fields, credit settlement, deletion rules and nine delivery phases. |
| [Data model](../../data-model.md) | updated | Created logical fields, cardinalities, origins, credit settlement and deletion contracts, including initial allocation and exactly-once grants. |
| [Inventory](../../documentation-inventory.md) | updated | Added logical-model and requirement-progress navigation and aligned the maintained product documentation set. |
| [Index](../index.md), [guidance](../README.md) and this brief | updated | Replace inherited backlog with ordered product phases and acceptance criteria. |
| [Progress](progress.md) | updated | Records documentation curation without claiming implementation. |
| [Project README](../../../README.md) and [docs navigation](../../README.md) | updated | Reoriented navigation toward Conversation Processing Demo, its shared model and prioritized product backlog. |
| Reusable brief template | updated | Adds explicit acceptance scenarios and source coverage for future briefs. |
| Reusable progress template | no-change | Existing current-state/append-only history shape is sufficient. |
| Guides and operations documents | not-applicable | No implemented runtime procedure changes in this documentation iteration. |
| Harness documentation | not-applicable | No harness behavior change. |
