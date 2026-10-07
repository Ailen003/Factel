# Requirement Brief: Capped public registration

> **ID:** REQ-009
> **Status:** deferred
> **Priority:** low
> **Phase:** 9
> **Source:** [product-source-of-truth.md](../../product-source-of-truth.md#44-future-public-registration); [product-source-of-truth.md](../../product-source-of-truth.md#101-identity-workspace-and-administration); [solution-architecture.md](../../solution-architecture.md#15-identity-and-authorization-architecture)

## Intent

Capture a future self-service trial path with explicit account capacity and abuse controls.

## Current-roadmap exclusion (2026-09-09)

REQ-009 remains deferred and not-started, excluded from the zero-USD
controlled-access roadmap. It retains its public-registration identity and is
not repurposed or completed. Contact, human review and administrator-created
individual trials are owned by REQ-001/007. Reopening public registration needs
a separate explicit future scope decision; baseline completion alone does not
activate it. Future-only flows below apply solely after that decision.

## Actors

Prospective user; platform administrator; email/abuse-protection adapters.

## Scope

- After explicit activation following baseline delivery, provide verified-email registration with CAPTCHA or equivalent automated-abuse protection and throttling.
- Enforce a configurable active-trial-account cap atomically, safe duplicate handling and closed-registration behavior when disabled/full.
- Reuse personal-workspace/session/initial-credit policies with bilingual onboarding, lifecycle audit and complete account cleanup.

## Out of Scope

Initial baseline delivery, subscriptions, shared organizations and altered business models.

## Candidate Flows

1. When enabled with capacity, person completes abuse checks/email verification; server provisions an isolated trial account under the cap.
2. Concurrent/excess requests reach the cap/throttle and create no excess account; administrator can close new registration while existing users retain access.

## Rules and Constraints

- Deferred, excluded from initial baseline acceptance. Initial accounts are administrator-created.
- Safe duplicate responses must not reveal account existence. Server checks own capacity and abuse enforcement.
- Email/CAPTCHA adapter selection and operator thresholds are future configuration decisions to resolve when activating this deferred capability.
- Every introduced capability includes server authorization, English/Spanish parity, accessible critical actions, safe audit/telemetry and deletion coverage for its artifacts. All CPD-NFR-001–007 apply proportionally; see the index matrix.

## Dependencies

[REQ-008](../validate-baseline-demonstration/brief.md) must be delivered first; earlier phases are transitive dependencies. All REQ-001–008 baseline phases must be complete before activation.

## Acceptance Scenarios

1. Verify disabled/full registration creates no account and concurrency cannot exceed the cap.
2. Reject unverified email/failed abuse checks/throttled submissions; retries do not duplicate accounts/workspaces/initial credits.
3. Complete bilingual valid onboarding, isolation/session checks and cleanup.

## Source Coverage

CPD-FR-010; inherited identity/localization/audit/security constraints on activation. Initial-baseline acceptance does not depend on this phase. See the [coverage matrix](../index.md#functional-requirement-coverage) for shared ownership and non-functional coverage.

## Open Questions

Email/abuse adapter selection and production thresholds are deferred until activation; registration remains disabled meanwhile.

## Documentation Synchronization

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
