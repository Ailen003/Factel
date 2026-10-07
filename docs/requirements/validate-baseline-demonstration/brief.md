# Requirement Brief: Validate baseline demonstration

> **ID:** REQ-008
> **Status:** candidate
> **Priority:** medium
> **Phase:** 8
> **Source:** [product-source-of-truth.md](../../product-source-of-truth.md#16-product-acceptance-criteria); [solution-architecture.md](../../solution-architecture.md#21-testing-and-architecture-verification); [product-source-of-truth.md](../../product-source-of-truth.md#24-baseline-business-contract)

## Intent

Demonstrate all baseline phases together and provide reproducible material for showing the solution.

## Actors

Demonstrator; trial users; platform administrator; acceptance-check implementer.

## Scope

- Prepare authorized Spanish microphone and English prepared-file scenarios with expected clients/requests and reproducible walkthroughs, including multiple requests, missing contact correction and client reuse.
- Run integrated acceptance for manual forms, reviewed conversation creation and assistant reads/approved writes through shared contracts.
- Verify bilingual parity, keyboard accessibility, isolation, concurrency/replays, provider failures, credits and deletion across the baseline.
- Document actual setup/configuration, authorized demo audio/data, operational controls and observed limits, distinguishing verified behavior from future registration.

## Out of Scope

Public registration implementation, new product scope and undocumented performance promises.

## Candidate Flows

1. Provision a trial account and replace credentials; manage manual client/request records, then process Spanish microphone and English uploaded conversations.
2. Review evidence, correct gaps and commit a reused-client multi-request batch; assistant reads evidence and approves a separate eligible conversation batch.
3. Induce a recoverable failure, reconcile credits, delete source content and complete account cleanup using the published walkthrough.

## Rules and Constraints

- REQ-001–007 are all required. This phase verifies integration, not postponed security/localization implementation.
- Use authorized non-sensitive demo audio and repeatable expected outcomes; do not depend on exact model wording or perfect attribution.
- Record observed commands/outcomes honestly. Unavailable provider-dependent checks remain explicit gaps, not presumed passes.
- Every introduced capability includes server authorization, English/Spanish parity, accessible critical actions, safe audit/telemetry and deletion coverage for its artifacts. All CPD-NFR-001–007 apply proportionally; see the index matrix.

## Dependencies

[REQ-007](../administer-and-operate-platform/brief.md) must be delivered first; earlier phases are transitive dependencies.

## Acceptance Scenarios

1. Execute all product §16 acceptance criteria and the index matrix, including manual CRUD/multiple-request additions.
2. Verify equivalent UI/assistant plans, one-batch semantics, credit finalization/release and uncertain-write recovery without duplicates.
3. Compare English/Spanish actions/warnings/confirmations/recovery with keyboard and programmatic recording-state checks.
4. Exercise isolation attacks, injection, admin audit, provider/cleanup failures, conversation deletion and complete account deletion; record evidence.

## Source Coverage

Integrated verification of all baseline CPD-FR except deferred CPD-FR-010, all CPD-NFR-001–007 and every product §16 baseline criterion. See the [coverage matrix](../index.md#functional-requirement-coverage) for shared ownership and non-functional coverage.

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
