# Requirement Brief: Manage clients and service requests

> **ID:** REQ-002
> **Status:** candidate
> **Priority:** high
> **Phase:** 2
> **Source:** [product-source-of-truth.md](../../product-source-of-truth.md#24-baseline-business-contract); [solution-architecture.md](../../solution-architecture.md#14-record-planning-and-transactional-writes); [data-model.md](../../data-model.md#2-business-records)

## Intent

Make the technical-services business usable through ordinary forms and establish shared validation and confirmed creation services.

## Actors

Trial user; authorized administrator for audited support.

## Scope

- Provide workspace-scoped paginated client/request lists, search, details, manual creation, editing, request reassignment/status changes and confirmed deletion.
- Implement client fields (name, email, phone, company, address, notes) and request fields (client, title, description, service type, priority, status, preferred availability, service address, next steps).
- Build shared prepare/confirm/commit services for a standalone client or a request with an existing client, extensible to the later exact conversation batch through the same policy boundary.
- Add normalized contact duplicate candidates, explicit reuse/create-anyway decisions, idempotency, stale-edit detection, audit and domain account cleanup.

## Out of Scope

Conversation extraction, assistant tools, budgets, invoices, confirmed appointments and technician assignment.

## Candidate Flows

1. User fills a client form and reviews duplicate candidates. Selecting an existing client opens its detail without creating or editing anything and without a creation receipt. Creating another client requires an explicit duplicate decision, exact preview and confirmation.
2. User creates a request for an existing client (create the client first through its normal form if needed), previews resulting records and confirms once.
3. User edits, changes status or reassigns requests; deletion of a client with remaining requests is blocked.

## Rules and Constraints

- Client requires name and at least one valid email or international phone. Normalize contacts for matching; if both are supplied, both must validate. Contact edits repeat duplicate checks and require acknowledgment of remaining matches. Never infer a country for a local phone. Company/address/notes are optional.
- Each request has one same-workspace client; a client has many requests. Title/description are required. Service types: installation, repair, maintenance, inspection, other.
- Priorities: low, normal, high (default normal). States: pending, in_progress, resolved, cancelled (new requests pending). Pending can move to in_progress, resolved or cancelled; in_progress can return to pending, resolve or cancel; resolved/cancelled may reopen as pending. Audit transitions.
- Preferred availability is optional free text, not a booking; service address is independent of client address. No budget, billing or technician assignment. Reject or omit detected excluded sensitive values in manual submissions without echoing protected content.
- Client reuse never silently overwrites data. Updates/deletes are explicit UI operations, excluded from assistant tools. Reject stale edits and invalidate plans when relevant record/plan state changes.
- Manual creation has explicit manual origin and needs no conversation. Shared creation transactions are atomic; uncertain outcomes reconcile before retry. A client can be deleted only after its requests are deleted/reassigned.
- Every introduced capability includes server authorization, English/Spanish parity, accessible critical actions, safe audit/telemetry and deletion coverage for its artifacts. All CPD-NFR-001–007 apply proportionally; see the index matrix.

## Dependencies

[REQ-001](../secure-application-foundation/brief.md) must be delivered first; earlier phases are transitive dependencies.

## Acceptance Scenarios

1. Create/view/edit/delete clients and requests without any conversation; verify defaults, catalogs and supported status changes.
2. Reject missing name/contact, local-only phone, invalid email, missing title/description and cross-workspace reassignment.
3. Find normalized contact duplicates; verify reuse and explicit create-anyway without overwriting client data.
4. Reject stale edits/approvals; replay confirmation returns original result. Inject transaction failure and verify no partial creation.
5. Block client deletion with dependents; allow after reassignment/deletion. Verify provenance, sensitive-value submission policy, audit and bilingual forms.

## Source Coverage

CPD-FR-050–059 shared/manual foundations; CPD-FR-080–083, 086–087; CPD-FR-070–072, 075. Acceptance: manual CRUD, duplicates, atomic confirmed creation, stale writes and restricted deletion. See the [coverage matrix](../index.md#functional-requirement-coverage) for shared ownership and non-functional coverage.

## Open Questions

None for the approved capability scope. Record implementation evidence and observed gaps in [progress](progress.md); shared policies are governed by the product sources and data model.

## Documentation Synchronization

Conversation-batch increment: reviewed the product, architecture and data model;
their REQ-005 updates document the shared creation boundary. This requirement
continues to govern manual fields, duplicate policy and record management.
Progress records shared-helper regression verification; no manual UX, database
schema, dependency or deployment changes are introduced.

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
