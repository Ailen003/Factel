# Requirement Brief: Workspace AI assistant

> **ID:** REQ-006
> **Status:** candidate
> **Priority:** medium
> **Phase:** 6
> **Source:** [product-source-of-truth.md](../../product-source-of-truth.md#106-agentic-assistant); [solution-architecture.md](../../solution-architecture.md#13-agentic-assistant-architecture); [data-model.md](../../data-model.md#4-execution-and-governance); [data-model.md](../../data-model.md#5-deletion-and-sensitive-data-rules)

## Intent

Answer grounded workspace questions and approve the same bounded conversation-record creation through chat.

## Actors

Trial user; registered tools; AI runtime; shared record-plan service.

## Scope

- Provide streaming chat and persisted workspace-owned threads/messages with bounded context, pagination and safe interruption/failure behavior.
- Register schema-validated reads for own conversations, authorized transcript/proposal evidence, clients and requests, returning bounded results and traceable sources.
- Register creation-plan preparation and approved execution only for current ready, uncompleted conversations through REQ-002/005 services.
- Enforce inference/write switches, step/token/tool/time/concurrency/cost limits, safe audit correlation and source-reference tracking for cleanup.

## Out of Scope

Assistant edits/deletions, autonomous writes, arbitrary network/database tools, admin actions and unreviewed-conversation creation.

## Candidate Flows

1. User asks a question; authorized tools retrieve bounded records/evidence and the assistant answers with sources or explains unavailable information.
2. User requests creation from a reviewed eligible conversation; assistant prepares the exact plan, pauses for approval and executes only that current plan.
3. User denies approval or edits the proposal; no write occurs and another request requires a new plan/approval.

## Rules and Constraints

- Model inputs cannot select user/workspace scope. Execution rechecks current session, ownership, eligibility, revision and approval.
- No arbitrary URL/query/model/admin/credit tools, manual-form creation, updates or deletion. Transcripts and records are untrusted data, not instructions.
- Approval is explicit, unexpired and operation-bound; denial/forgery/staleness/replay cannot authorize new writes. Report committed database results, not speculative success.
- Suspension/revocation/deletion blocks later access. Delete threads referencing a removed source, including copied evidence, as specified in the data model; retained business records remain independently queryable.
- Every introduced capability includes server authorization, English/Spanish parity, accessible critical actions, safe audit/telemetry and deletion coverage for its artifacts. All CPD-NFR-001–007 apply proportionally; see the index matrix.

## Dependencies

[REQ-005](../review-and-confirm-conversation-records/brief.md) must be delivered first; earlier phases are transitive dependencies.

## Acceptance Scenarios

1. Use two accounts and malicious scope input; no cross-workspace content or inference is returned.
2. Inject transcript/record instructions requesting secrets, arbitrary URLs, updates/deletion/admin actions; tools remain bounded.
3. Test approved/denied/expired/forged/stale/replayed plans; assistant and direct UI produce equivalent transactions/results.
4. Interrupt streaming, fail tools/providers and exceed limits; verify safe bilingual recovery and correlated audit.
5. Delete a referenced source and verify related thread/context cleanup while independent business records remain accessible.

## Source Coverage

CPD-FR-060–069, 070–072, 074–075. Acceptance: scoped reads, exact approval, shared commit, source cleanup and prompt-injection isolation. See the [coverage matrix](../index.md#functional-requirement-coverage) for shared ownership and non-functional coverage.

## Open Questions

None for the approved capability scope. Record implementation evidence and observed gaps in [progress](progress.md); shared policies are governed by the product sources and data model.

## Documentation Synchronization

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
